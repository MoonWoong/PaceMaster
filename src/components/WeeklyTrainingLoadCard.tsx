import React, { useState, useMemo, useEffect } from 'react';
import {
  Flame,
  Activity,
  Mountain,
  Zap,
  TrendingUp,
  ShieldCheck,
  Info,
  Calendar,
  Layers,
  Sparkles,
  BarChart3,
  Percent,
  CheckCircle2,
  Gauge,
  Sliders,
  RotateCcw,
  Footprints,
  BedDouble,
  Coffee,
  Check,
  Timer,
} from 'lucide-react';
import { PlanWeek, WeeklyPlanDay, TrainingSession, IntensityCategory, ComprehensiveTrainingPlan } from '../types';
import { formatPace, parsePaceToSeconds } from '../lib/vdot';
import { getTodayDateStr } from '../lib/comprehensivePlanGenerator';

/**
 * 5-Tier Subdivided Intensity Categories:
 * 1. highIntensity: 고강도 인터벌 (1000m/800m 인터벌, 대회 전력 질주, VO2max 질주) - 역치 이상
 * 2. moderateIntensity: 중강도 템포·역치 (젖산역치 템포런, 크루즈 인터벌, 빌드업주, 파틀렉) - 역치 구간
 * 3. lowIntensityPoint: 저강도 포인트 (존3 마라톤 페이스주, 모더레이트런, 유산소 역치주) - 존3 구간
 * 4. longRun: 장거리 러닝 (15km+ 주말 LSD, 유산소 지구력)
 * 5. recovery: 회복주 & 베이스 조깅 (회복주, 조깅, 완전 휴식 0pt)
 */
export type { IntensityCategory };

export interface ClassifiedWorkoutDay {
  day: WeeklyPlanDay;
  category: IntensityCategory;
  categoryLabel: string;
  loadMultiplier: number;
  dayLoad: number;
  effectiveDist: number;
  plannedDist: number;
  effectivePaceStr: string;
  effectivePaceSec: number;
  isActualPace: boolean;
  isActualRest: boolean;
  isCompletedRun: boolean;
  isPastDay: boolean;
  isToday: boolean;
  isFutureDay: boolean;
  paceZoneLabel: string;
  paceExplanation: string;
  actualShoeName?: string;
  isUserOverridden?: boolean;
}

export interface WeekTrainingLoadSummary {
  weekNumber: number;
  weekLabel: string;
  phase: string;
  targetWeeklyKm: number;
  totalPlannedKm: number;
  totalEffectiveKm: number;
  totalLoadScore: number;
  plannedTotalLoadScore: number;

  // Classified Days
  classifiedDays: ClassifiedWorkoutDay[];

  // 1. High Intensity (고 - 역치 이상 인터벌 등)
  highIntensityKm: number;
  highIntensityLoad: number;
  highIntensityCount: number;
  highIntensityDistPct: number;
  highIntensityLoadPct: number;
  highIntensityDays: ClassifiedWorkoutDay[];

  // 2. Moderate Intensity (중 - 역치 구간)
  moderateIntensityKm: number;
  moderateIntensityLoad: number;
  moderateIntensityCount: number;
  moderateIntensityDistPct: number;
  moderateIntensityLoadPct: number;
  moderateIntensityDays: ClassifiedWorkoutDay[];

  // 3. Low Intensity Point (저 - 존3 구간 포인트)
  lowPointKm: number;
  lowPointLoad: number;
  lowPointCount: number;
  lowPointDistPct: number;
  lowPointLoadPct: number;
  lowPointDays: ClassifiedWorkoutDay[];

  // 4. Long Run (장거리 LSD)
  longRunKm: number;
  longRunLoad: number;
  longRunCount: number;
  longRunDistPct: number;
  longRunLoadPct: number;
  longRunDays: ClassifiedWorkoutDay[];

  // 5. Recovery (회복 및 베이스 조깅)
  recoveryKm: number;
  recoveryLoad: number;
  recoveryCount: number;
  recoveryDistPct: number;
  recoveryLoadPct: number;
  recoveryDays: ClassifiedWorkoutDay[];

  // Point Workout Subtotals (저/중/고 포인트 3대 강도 합계)
  totalPointKm: number;
  totalPointLoad: number;
  totalPointCount: number;

  plannedRestDaysCount: number;
  actualRestDaysCount: number;

  // 3-Tier Pyramidal & Polarized distribution
  aerobicRatio: number; // Low (Recovery + Long Run + Low Point) %
  moderateRatio: number; // Moderate (Threshold & Tempo) %
  highRatio: number; // High (Interval & Sprints) %
  polarizedEvaluation: string;
  polarizedBadgeColor: string;

  loadLevel: 'recovery' | 'optimal' | 'challenging' | 'peak';
  loadLevelLabel: string;
  loadLevelColor: string;
  loadLevelBg: string;
}

/**
 * Robust pace extractor: parses strings like "6'00\"", "6:00", "5'50\"~6'10\"", "06:00/km"
 * and returns seconds per kilometer.
 */
export function extractPaceInSeconds(paceStr: string | undefined): number {
  if (!paceStr || !paceStr.trim()) return 0;
  const matches = paceStr.match(/(\d{1,2})[':.](\d{2})/g);
  if (matches && matches.length > 0) {
    const secondsList = matches.map((m) => {
      const parts = m.split(/[':.]/).map((n) => parseInt(n, 10) || 0);
      return parts[0] * 60 + parts[1];
    });
    const avgSec = secondsList.reduce((a, b) => a + b, 0) / secondsList.length;
    return Math.round(avgSec);
  }
  return parsePaceToSeconds(paceStr);
}

/**
 * Smart Subdivided Pace & Actual Rest Classifier:
 * Subdivides into:
 * - highIntensity: 고강도 인터벌 (VO2max, 숏 인터벌, 대회 전력 질주)
 * - moderateIntensity: 중강도 템포·역치 (LT 템포런, M-페이스 지속주, 빌드업주, 파틀렉)
 * - longRun: 장거리 LSD (15km+ 주말 지구력)
 * - recovery: 회복주 & 베이스 조깅 & 실제 휴식일(0pt)
 */
export function classifyWorkoutDay(
  day: WeeklyPlanDay,
  runnerVdot: number = 38,
  userOverride?: IntensityCategory,
  sessions?: TrainingSession[],
  loadDataSource: 'actual' | 'planned' = 'actual',
  todayStr: string = getTodayDateStr()
): ClassifiedWorkoutDay {
  const isPastDay = !!day.dateStr && day.dateStr < todayStr;
  const isToday = !!day.dateStr && day.dateStr === todayStr;
  const isFutureDay = !!day.dateStr && day.dateStr > todayStr;

  // Match actual logged session
  const matchedSession =
    day.actualSession ||
    (day.dateStr && sessions ? sessions.find((s) => s.date === day.dateStr) : undefined);

  const hasRunLogged =
    !!matchedSession &&
    (matchedSession.totalDistanceKm > 0 || (!!matchedSession.avgPace && matchedSession.avgPace !== "-'--\""));

  const actualShoeName = matchedSession?.shoeName;
  const plannedDist = day.distanceKm || 0;

  const effectiveOverride = userOverride || day.userCategoryOverride;

  // User override takes highest precedence if provided
  if (effectiveOverride) {
    let multiplier = 1.0;
    let label = '회복/조깅';
    if (effectiveOverride === 'highIntensity') {
      multiplier = 2.8;
      label = '고강도 인터벌 (역치 이상)';
    } else if (effectiveOverride === 'moderateIntensity') {
      multiplier = 2.2;
      label = '중강도 템포·역치';
    } else if (effectiveOverride === 'lowIntensityPoint') {
      multiplier = 1.6;
      label = '저강도 포인트 (존3)';
    } else if (effectiveOverride === 'longRun') {
      multiplier = 1.4;
      label = '장거리(LSD)';
    }

    const effectiveDist =
      loadDataSource === 'actual' && hasRunLogged
        ? matchedSession!.totalDistanceKm
        : loadDataSource === 'actual' && isPastDay && !hasRunLogged
        ? 0
        : plannedDist;

    const dayLoad = Math.round(effectiveDist * multiplier * 10) / 10;
    return {
      day,
      category: effectiveOverride,
      categoryLabel: label,
      loadMultiplier: multiplier,
      dayLoad,
      effectiveDist,
      plannedDist,
      effectivePaceStr: matchedSession?.avgPace || day.targetPace || '자유 페이스',
      effectivePaceSec: extractPaceInSeconds(matchedSession?.avgPace || day.targetPace),
      isActualPace: hasRunLogged,
      isActualRest: effectiveDist === 0,
      isCompletedRun: hasRunLogged,
      isPastDay,
      isToday,
      isFutureDay,
      paceZoneLabel: '사용자 지정 분류',
      paceExplanation: '러너가 직접 설정한 훈련 강도로 반영되었습니다.',
      actualShoeName,
      isUserOverridden: true,
    };
  }

  // 1. ACTUAL REST DAY REFLECTION ("실제 휴식한 날 0pt 반영")
  if (loadDataSource === 'actual') {
    // Planned rest and no run logged
    if ((day.type === '휴식' || plannedDist === 0) && !hasRunLogged) {
      return {
        day,
        category: 'recovery',
        categoryLabel: '계획된 휴식',
        loadMultiplier: 0,
        dayLoad: 0,
        effectiveDist: 0,
        plannedDist: 0,
        effectivePaceStr: '-',
        effectivePaceSec: 0,
        isActualPace: false,
        isActualRest: true,
        isCompletedRun: false,
        isPastDay,
        isToday,
        isFutureDay,
        paceZoneLabel: '완전 휴식',
        paceExplanation: '신체 초회복 및 관절 이완을 위한 휴식일 (부하 0 pt)',
        actualShoeName,
      };
    }

    // Planned workout, but date is in the past and no run logged -> ACTUAL REST
    if (plannedDist > 0 && isPastDay && !hasRunLogged) {
      return {
        day,
        category: 'recovery',
        categoryLabel: '실제 휴식 (미수행)',
        loadMultiplier: 0,
        dayLoad: 0,
        effectiveDist: 0,
        plannedDist,
        effectivePaceStr: '-',
        effectivePaceSec: 0,
        isActualPace: false,
        isActualRest: true,
        isCompletedRun: false,
        isPastDay,
        isToday,
        isFutureDay,
        paceZoneLabel: '실제 휴식 (0 pt)',
        paceExplanation: `계획 훈련(${day.title} ${plannedDist}km) 대신 실제 휴식을 취함 (피로 회복 및 훈련 부하 0pt로 정확히 반영)`,
        actualShoeName,
      };
    }
  } else {
    if (day.type === '휴식' || plannedDist === 0) {
      return {
        day,
        category: 'recovery',
        categoryLabel: '휴식',
        loadMultiplier: 0,
        dayLoad: 0,
        effectiveDist: 0,
        plannedDist: 0,
        effectivePaceStr: '-',
        effectivePaceSec: 0,
        isActualPace: false,
        isActualRest: true,
        isCompletedRun: false,
        isPastDay,
        isToday,
        isFutureDay,
        paceZoneLabel: '완전 휴식',
        paceExplanation: '계획된 완전 휴식일 (부하 0 pt)',
        actualShoeName,
      };
    }
  }

  // 2. Active Run Workout Evaluation
  const isCompletedRun = hasRunLogged;
  const effectiveDist =
    loadDataSource === 'actual' && hasRunLogged
      ? matchedSession!.totalDistanceKm
      : plannedDist;

  const actualPaceStr = matchedSession?.avgPace;
  const isActualPace = hasRunLogged && !!actualPaceStr && actualPaceStr.trim().length > 0;
  const effectivePaceStr = (isActualPace ? actualPaceStr : day.targetPace) || '';
  const effectivePaceSec = extractPaceInSeconds(effectivePaceStr);

  const isLongDistance =
    effectiveDist >= 15 || day.type === 'LSD' || day.title.toLowerCase().includes('lsd');

  const titleLower = day.title.toLowerCase();
  const isZone3LowPoint =
    titleLower.includes('존3') ||
    titleLower.includes('모더레이트') ||
    titleLower.includes('유산소 역치') ||
    titleLower.includes('m-pace') ||
    titleLower.includes('마라톤 페이스');

  const isTempoOrThreshold =
    day.type === '템포런' ||
    titleLower.includes('템포') ||
    titleLower.includes('역치') ||
    titleLower.includes('크루즈') ||
    titleLower.includes('빌드업') ||
    titleLower.includes('파틀렉') ||
    titleLower.includes('변속');

  // 3. Subdivided Pace Evaluation
  if (effectivePaceSec > 0) {
    // A. Easy Aerobic / Zone 2 Pace (5'45"/km or slower, e.g. 6'00" = 360s, 6'15" = 375s)
    if (effectivePaceSec >= 345) {
      if (isLongDistance) {
        return {
          day,
          category: 'longRun',
          categoryLabel: day.type === '대회' ? '대회 (장거리 유산소)' : '장거리(LSD)',
          loadMultiplier: 1.35,
          dayLoad: Math.round(effectiveDist * 1.35 * 10) / 10,
          effectiveDist,
          plannedDist,
          effectivePaceStr,
          effectivePaceSec,
          isActualPace,
          isActualRest: false,
          isCompletedRun,
          isPastDay,
          isToday,
          isFutureDay,
          paceZoneLabel: `Zone 2 이지/장거리 (${formatPace(effectivePaceSec)})`,
          paceExplanation:
            day.type === '대회'
              ? `${isActualPace ? '실제 완주' : '목표'} 페이스(${formatPace(effectivePaceSec)})가 이지 페이스이므로 고강도/중강도가 아닌 장거리 유산소(LSD) 부하로 정밀 판정되었습니다.`
              : `${isActualPace ? '실제 기록' : '목표'} 페이스(${formatPace(effectivePaceSec)})가 유산소 이지 페이스로 장거리 지속주 부하로 판정되었습니다.`,
          actualShoeName,
        };
      }

      // Shorter distance (< 15km) at easy pace:
      return {
        day,
        category: 'recovery',
        categoryLabel: day.type === '대회' ? '대회 (이지 페이스)' : day.type === '회복주' ? '회복주' : '베이스 조깅',
        loadMultiplier: day.type === '회복주' ? 0.8 : 1.0,
        dayLoad: Math.round(effectiveDist * (day.type === '회복주' ? 0.8 : 1.0) * 10) / 10,
        effectiveDist,
        plannedDist,
        effectivePaceStr,
        effectivePaceSec,
        isActualPace,
        isActualRest: false,
        isCompletedRun,
        isPastDay,
        isToday,
        isFutureDay,
        paceZoneLabel: `Zone 1~2 회복/조깅 (${formatPace(effectivePaceSec)})`,
        paceExplanation:
          day.type === '대회'
            ? `${isActualPace ? '실제 완주' : '목표'} 페이스(${formatPace(effectivePaceSec)})가 여유로운 이지 페이스이므로 유산소 회복 조깅 부하로 산출되었습니다.`
            : `유산소 모세혈관 발달 및 젖산 세척을 위한 편안한 조깅 부하입니다.`,
        actualShoeName,
      };
    }

    // B. Moderate / Marathon Pace (310s ~ 344s, approx 5'10" ~ 5'44")
    // => SUBDIVIDED TO LOW INTENSITY POINT (Zone 3) OR MODERATE THRESHOLD (Zone 4) OR LONG RUN
    if (effectivePaceSec >= 310 && effectivePaceSec < 345) {
      if (isLongDistance) {
        return {
          day,
          category: 'longRun',
          categoryLabel: '마라톤 페이스 장거리주',
          loadMultiplier: 1.45,
          dayLoad: Math.round(effectiveDist * 1.45 * 10) / 10,
          effectiveDist,
          plannedDist,
          effectivePaceStr,
          effectivePaceSec,
          isActualPace,
          isActualRest: false,
          isCompletedRun,
          isPastDay,
          isToday,
          isFutureDay,
          paceZoneLabel: `Zone 3 마라톤 페이스 (${formatPace(effectivePaceSec)})`,
          paceExplanation: `마라톤 실전 페이스 감각 유지를 위한 유산소 파워 장거리 부하입니다.`,
          actualShoeName,
        };
      }

      // Zone 3 Low Intensity Point Session
      if (isZone3LowPoint || (!isTempoOrThreshold && day.type !== '회복주' && day.type !== '조깅')) {
        return {
          day,
          category: 'lowIntensityPoint',
          categoryLabel: '저강도 포인트 (존3)',
          loadMultiplier: 1.6,
          dayLoad: Math.round(effectiveDist * 1.6 * 10) / 10,
          effectiveDist,
          plannedDist,
          effectivePaceStr,
          effectivePaceSec,
          isActualPace,
          isActualRest: false,
          isCompletedRun,
          isPastDay,
          isToday,
          isFutureDay,
          paceZoneLabel: `Zone 3 저강도 포인트 (${formatPace(effectivePaceSec)})`,
          paceExplanation: `젖산 축적 없이 유산소 파워와 실전 페이스 감각을 배양하는 저강도(Zone 3) 포인트 훈련 부하입니다.`,
          actualShoeName,
        };
      }

      if (isTempoOrThreshold || day.type === '인터벌' || day.type === '언덕훈련') {
        return {
          day,
          category: 'moderateIntensity',
          categoryLabel: '중강도 템포·역치런',
          loadMultiplier: 2.2,
          dayLoad: Math.round(effectiveDist * 2.2 * 10) / 10,
          effectiveDist,
          plannedDist,
          effectivePaceStr,
          effectivePaceSec,
          isActualPace,
          isActualRest: false,
          isCompletedRun,
          isPastDay,
          isToday,
          isFutureDay,
          paceZoneLabel: `Zone 3~4 중강도 역치 (${formatPace(effectivePaceSec)})`,
          paceExplanation: `젖산 축적을 억제하며 유산소 역치를 끌어올리는 중강도(Moderate) 템포 훈련 부하입니다.`,
          actualShoeName,
        };
      }

      return {
        day,
        category: 'recovery',
        categoryLabel: '중강도 베이스 조깅',
        loadMultiplier: 1.1,
        dayLoad: Math.round(effectiveDist * 1.1 * 10) / 10,
        effectiveDist,
        plannedDist,
        effectivePaceStr,
        effectivePaceSec,
        isActualPace,
        isActualRest: false,
        isCompletedRun,
        isPastDay,
        isToday,
        isFutureDay,
        paceZoneLabel: `Zone 2~3 중강도 조깅 (${formatPace(effectivePaceSec)})`,
        paceExplanation: `기초 유산소 지구력 배양을 위한 표준 빌드업 조깅 부하입니다.`,
        actualShoeName,
      };
    }

    // C. Fast Pace / High Speed (< 310s, Faster than 5'10"/km)
    // Subdivided into HIGH INTENSITY vs MODERATE TEMPO vs LOW POINT vs FAST LSD
    if (isLongDistance && day.type === 'LSD') {
      return {
        day,
        category: 'longRun',
        categoryLabel: '패스트 장거리 지속주',
        loadMultiplier: 1.55,
        dayLoad: Math.round(effectiveDist * 1.55 * 10) / 10,
        effectiveDist,
        plannedDist,
        effectivePaceStr,
        effectivePaceSec,
        isActualPace,
        isActualRest: false,
        isCompletedRun,
        isPastDay,
        isToday,
        isFutureDay,
        paceZoneLabel: `Zone 3+ 패스트 장거리 (${formatPace(effectivePaceSec)})`,
        paceExplanation: `빠른 페이스로 밀어붙인 장거리 지속주로 높은 근지구력 부하가 발생합니다.`,
        actualShoeName,
      };
    }

    // If fast pace and Zone 3 specific run
    if (isZone3LowPoint) {
      return {
        day,
        category: 'lowIntensityPoint',
        categoryLabel: '저강도 포인트 (존3 M-Pace)',
        loadMultiplier: 1.7,
        dayLoad: Math.round(effectiveDist * 1.7 * 10) / 10,
        effectiveDist,
        plannedDist,
        effectivePaceStr,
        effectivePaceSec,
        isActualPace,
        isActualRest: false,
        isCompletedRun,
        isPastDay,
        isToday,
        isFutureDay,
        paceZoneLabel: `Zone 3 실전 M-Pace (${formatPace(effectivePaceSec)})`,
        paceExplanation: `목표 마라톤 실전 페이스에 맞춘 저강도 파워 포인트 부하입니다.`,
        actualShoeName,
      };
    }

    // If fast pace and tempo/threshold workout -> Moderate Intensity
    if (isTempoOrThreshold) {
      return {
        day,
        category: 'moderateIntensity',
        categoryLabel: '중강도 역치 템포런',
        loadMultiplier: 2.3,
        dayLoad: Math.round(effectiveDist * 2.3 * 10) / 10,
        effectiveDist,
        plannedDist,
        effectivePaceStr,
        effectivePaceSec,
        isActualPace,
        isActualRest: false,
        isCompletedRun,
        isPastDay,
        isToday,
        isFutureDay,
        paceZoneLabel: `Zone 4 젖산 역치 (${formatPace(effectivePaceSec)})`,
        paceExplanation: `젖산 역치 페이스 지속주로 심폐 버퍼를 강화하는 중강도 훈련 부하입니다.`,
        actualShoeName,
      };
    }

    // Interval, race, hill sprints, short fast repeats -> HIGH INTENSITY
    const multiplier = day.type === '대회' ? 3.0 : 2.8;
    return {
      day,
      category: 'highIntensity',
      categoryLabel: day.type === '대회' ? '대회 전력 질주 (고강도)' : '고강도 인터벌 (VO2max)',
      loadMultiplier: multiplier,
      dayLoad: Math.round(effectiveDist * multiplier * 10) / 10,
      effectiveDist,
      plannedDist,
      effectivePaceStr,
      effectivePaceSec,
      isActualPace,
      isActualRest: false,
      isCompletedRun,
      isPastDay,
      isToday,
      isFutureDay,
      paceZoneLabel: `Zone 4~5 VO2max 질주 (${formatPace(effectivePaceSec)})`,
      paceExplanation: `최대 산소 섭취량(VO2max) 및 젖산 내구성을 폭발적으로 자극하는 고강도(High) 인터벌 부하입니다.`,
      actualShoeName,
    };
  }

  // 4. Fallback if pace is unspecified
  if (isLongDistance) {
    return {
      day,
      category: 'longRun',
      categoryLabel: '장거리(LSD)',
      loadMultiplier: 1.4,
      dayLoad: Math.round(effectiveDist * 1.4 * 10) / 10,
      effectiveDist,
      plannedDist,
      effectivePaceStr: '거리 기준 판정',
      effectivePaceSec: 0,
      isActualPace: false,
      isActualRest: false,
      isCompletedRun,
      isPastDay,
      isToday,
      isFutureDay,
      paceZoneLabel: '장거리 지구력',
      paceExplanation: '15km 이상 장거리 세션으로 유산소 지구력 부하가 반영되었습니다.',
      actualShoeName,
    };
  }

  if (isZone3LowPoint) {
    return {
      day,
      category: 'lowIntensityPoint',
      categoryLabel: '저강도 포인트 (존3)',
      loadMultiplier: 1.6,
      dayLoad: Math.round(effectiveDist * 1.6 * 10) / 10,
      effectiveDist,
      plannedDist,
      effectivePaceStr: '존3 포인트',
      effectivePaceSec: 0,
      isActualPace: false,
      isActualRest: false,
      isCompletedRun,
      isPastDay,
      isToday,
      isFutureDay,
      paceZoneLabel: '존3 유산소 파워',
      paceExplanation: '유산소 파워 및 마라톤 페이스 감각을 위한 저강도 포인트 훈련 부하입니다.',
      actualShoeName,
    };
  }

  if (isTempoOrThreshold) {
    return {
      day,
      category: 'moderateIntensity',
      categoryLabel: '중강도 템포런',
      loadMultiplier: 2.2,
      dayLoad: Math.round(effectiveDist * 2.2 * 10) / 10,
      effectiveDist,
      plannedDist,
      effectivePaceStr: '중강도 포인트',
      effectivePaceSec: 0,
      isActualPace: false,
      isActualRest: false,
      isCompletedRun,
      isPastDay,
      isToday,
      isFutureDay,
      paceZoneLabel: '중강도 템포',
      paceExplanation: '젖산 역치 및 마라톤 페이스 감각을 위한 중강도 훈련 부하입니다.',
      actualShoeName,
    };
  }

  if (day.type === '인터벌' || day.type === '언덕훈련' || day.type === '대회') {
    return {
      day,
      category: 'highIntensity',
      categoryLabel: '고강도 인터벌',
      loadMultiplier: 2.8,
      dayLoad: Math.round(effectiveDist * 2.8 * 10) / 10,
      effectiveDist,
      plannedDist,
      effectivePaceStr: '고강도 포인트',
      effectivePaceSec: 0,
      isActualPace: false,
      isActualRest: false,
      isCompletedRun,
      isPastDay,
      isToday,
      isFutureDay,
      paceZoneLabel: '고강도 인터벌',
      paceExplanation: '심폐 최대 산소 섭취량 자극을 위한 고강도 스피드 훈련 부하입니다.',
      actualShoeName,
    };
  }

  return {
    day,
    category: 'recovery',
    categoryLabel: day.type === '회복주' ? '회복주' : '조깅',
    loadMultiplier: 1.0,
    dayLoad: Math.round(effectiveDist * 1.0 * 10) / 10,
    effectiveDist,
    plannedDist,
    effectivePaceStr: '유산소 조깅',
    effectivePaceSec: 0,
    isActualPace: false,
    isActualRest: false,
    isCompletedRun,
    isPastDay,
    isToday,
    isFutureDay,
    paceZoneLabel: '유산소 조깅',
    paceExplanation: '기초 유산소 조깅 부하입니다.',
    actualShoeName,
  };
}

export function calculateWeekTrainingLoad(
  week: PlanWeek,
  runnerVdot: number = 38,
  overrides?: Record<string, IntensityCategory>,
  sessions?: TrainingSession[],
  loadDataSource: 'actual' | 'planned' = 'actual'
): WeekTrainingLoadSummary {
  const classifiedDays: ClassifiedWorkoutDay[] = [];
  const todayStr = getTodayDateStr();

  // 1. High Intensity (고 - 역치 이상 인터벌 등)
  let highIntensityKm = 0;
  let highIntensityLoad = 0;
  const highIntensityDays: ClassifiedWorkoutDay[] = [];

  // 2. Moderate Intensity (중 - 역치 구간)
  let moderateIntensityKm = 0;
  let moderateIntensityLoad = 0;
  const moderateIntensityDays: ClassifiedWorkoutDay[] = [];

  // 3. Low Intensity Point (저 - 존3 구간 포인트)
  let lowPointKm = 0;
  let lowPointLoad = 0;
  const lowPointDays: ClassifiedWorkoutDay[] = [];

  // 4. Long Run (장거리 LSD)
  let longRunKm = 0;
  let longRunLoad = 0;
  const longRunDays: ClassifiedWorkoutDay[] = [];

  // 5. Recovery (회복 및 베이스 조깅)
  let recoveryKm = 0;
  let recoveryLoad = 0;
  const recoveryDays: ClassifiedWorkoutDay[] = [];

  let plannedRestDaysCount = 0;
  let actualRestDaysCount = 0;
  let plannedTotalKm = 0;
  let plannedTotalLoadScore = 0;

  for (const day of week.days) {
    if (day.type === '휴식' || day.distanceKm === 0) {
      plannedRestDaysCount++;
    }
    plannedTotalKm += day.distanceKm || 0;

    // Baseline planned load calculation
    const baseClassified = classifyWorkoutDay(day, runnerVdot, undefined, sessions, 'planned', todayStr);
    plannedTotalLoadScore += baseClassified.dayLoad;

    const dayKey = `${week.weekNumber}_${day.day}`;
    const userOverride =
      overrides?.[dayKey] ||
      (day.dateStr ? overrides?.[day.dateStr] : undefined) ||
      week.categoryOverrides?.[dayKey] ||
      day.userCategoryOverride;

    const classified = classifyWorkoutDay(
      day,
      runnerVdot,
      userOverride,
      sessions,
      loadDataSource,
      todayStr
    );
    classifiedDays.push(classified);

    if (classified.isActualRest) {
      actualRestDaysCount++;
    }

    const dist = classified.effectiveDist;

    if (classified.category === 'highIntensity') {
      highIntensityKm += dist;
      highIntensityLoad += classified.dayLoad;
      highIntensityDays.push(classified);
    } else if (classified.category === 'moderateIntensity') {
      moderateIntensityKm += dist;
      moderateIntensityLoad += classified.dayLoad;
      moderateIntensityDays.push(classified);
    } else if (classified.category === 'lowIntensityPoint') {
      lowPointKm += dist;
      lowPointLoad += classified.dayLoad;
      lowPointDays.push(classified);
    } else if (classified.category === 'longRun') {
      longRunKm += dist;
      longRunLoad += classified.dayLoad;
      longRunDays.push(classified);
    } else {
      recoveryKm += dist;
      recoveryLoad += classified.dayLoad;
      if (dist > 0 || classified.day.type === '휴식' || classified.isActualRest) {
        recoveryDays.push(classified);
      }
    }
  }

  const totalEffectiveKm =
    Math.round((highIntensityKm + moderateIntensityKm + lowPointKm + longRunKm + recoveryKm) * 10) / 10;
  const totalLoadScore =
    Math.round((highIntensityLoad + moderateIntensityLoad + lowPointLoad + longRunLoad + recoveryLoad) * 10) / 10;

  const totalPointKm = Math.round((highIntensityKm + moderateIntensityKm + lowPointKm) * 10) / 10;
  const totalPointLoad = Math.round((highIntensityLoad + moderateIntensityLoad + lowPointLoad) * 10) / 10;
  const totalPointCount =
    highIntensityDays.filter((d) => d.effectiveDist > 0).length +
    moderateIntensityDays.filter((d) => d.effectiveDist > 0).length +
    lowPointDays.filter((d) => d.effectiveDist > 0).length;

  plannedTotalLoadScore = Math.round(plannedTotalLoadScore * 10) / 10;
  plannedTotalKm = Math.round(plannedTotalKm * 10) / 10;

  // Percentage calculations
  const highIntensityDistPct =
    totalEffectiveKm > 0 ? Math.round((highIntensityKm / totalEffectiveKm) * 100) : 0;
  const moderateIntensityDistPct =
    totalEffectiveKm > 0 ? Math.round((moderateIntensityKm / totalEffectiveKm) * 100) : 0;
  const lowPointDistPct =
    totalEffectiveKm > 0 ? Math.round((lowPointKm / totalEffectiveKm) * 100) : 0;
  const recoveryDistPct =
    totalEffectiveKm > 0 ? Math.round((recoveryKm / totalEffectiveKm) * 100) : 0;
  const longRunDistPct =
    totalEffectiveKm > 0
      ? Math.max(0, 100 - highIntensityDistPct - moderateIntensityDistPct - lowPointDistPct - recoveryDistPct)
      : 0;

  const highIntensityLoadPct =
    totalLoadScore > 0 ? Math.round((highIntensityLoad / totalLoadScore) * 100) : 0;
  const moderateIntensityLoadPct =
    totalLoadScore > 0 ? Math.round((moderateIntensityLoad / totalLoadScore) * 100) : 0;
  const lowPointLoadPct =
    totalLoadScore > 0 ? Math.round((lowPointLoad / totalLoadScore) * 100) : 0;
  const recoveryLoadPct =
    totalLoadScore > 0 ? Math.round((recoveryLoad / totalLoadScore) * 100) : 0;
  const longRunLoadPct =
    totalLoadScore > 0
      ? Math.max(0, 100 - highIntensityLoadPct - moderateIntensityLoadPct - lowPointLoadPct - recoveryLoadPct)
      : 0;

  // 3-Tier Pyramidal & Polarized distribution check:
  // Low (Recovery + Long Run + Low Point Zone 3) vs Moderate (Threshold/Tempo) vs High (Interval/Sprints)
  const aerobicKm = recoveryKm + longRunKm + lowPointKm;
  const aerobicRatio = totalEffectiveKm > 0 ? Math.round((aerobicKm / totalEffectiveKm) * 100) : 100;
  const moderateRatio = totalEffectiveKm > 0 ? Math.round((moderateIntensityKm / totalEffectiveKm) * 100) : 0;
  const highRatio = Math.max(0, 100 - aerobicRatio - moderateRatio);

  let polarizedEvaluation = '저강도 유산소 80% : 중·고강도 20%의 이상적인 피라미달 훈련 밸런스를 충족합니다.';
  let polarizedBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';

  if (highRatio > 15) {
    polarizedEvaluation =
      '고강도 인터벌 비중이 높아 관절 및 심폐 피로 회복에 각별한 관리가 필요합니다 (수면 및 단백질 로딩 권장).';
    polarizedBadgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
  } else if (moderateRatio > 30) {
    polarizedEvaluation =
      '중강도 템포런 비중이 다소 높습니다. 회복 조깅을 가볍게 유지하여 중강도 블랙홀(과도한 누적 피로)을 방지하세요.';
    polarizedBadgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
  } else if (aerobicRatio >= 75) {
    polarizedEvaluation =
      '견고한 저강도 유산소 베이스(75%+) 위에 중강도 역치와 고강도 스피드가 균형 있게 배치되었습니다.';
    polarizedBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  }

  // Load level classification
  let loadLevel: 'recovery' | 'optimal' | 'challenging' | 'peak' = 'optimal';
  let loadLevelLabel = '적정 유산소 빌드 (Optimal Build)';
  let loadLevelColor = 'text-emerald-700';
  let loadLevelBg = 'bg-emerald-50 border-emerald-200';

  if (totalLoadScore < 45) {
    loadLevel = 'recovery';
    loadLevelLabel = '회복 / 테이퍼링 (Recovery/Taper)';
    loadLevelColor = 'text-teal-700';
    loadLevelBg = 'bg-teal-50 border-teal-200';
  } else if (totalLoadScore >= 45 && totalLoadScore <= 85) {
    loadLevel = 'optimal';
    loadLevelLabel = '적정 유산소 빌드 (Optimal Build)';
    loadLevelColor = 'text-emerald-700';
    loadLevelBg = 'bg-emerald-50 border-emerald-200';
  } else if (totalLoadScore > 85 && totalLoadScore <= 125) {
    loadLevel = 'challenging';
    loadLevelLabel = '고부하 강화 주간 (Challenging Peak)';
    loadLevelColor = 'text-amber-700';
    loadLevelBg = 'bg-amber-50 border-amber-200';
  } else {
    loadLevel = 'peak';
    loadLevelLabel = '최대 한계 자극 (Max Overreaching)';
    loadLevelColor = 'text-rose-700';
    loadLevelBg = 'bg-rose-50 border-rose-200';
  }

  return {
    weekNumber: week.weekNumber,
    weekLabel: week.weekLabel,
    phase: week.phase,
    targetWeeklyKm: week.targetWeeklyKm,
    totalPlannedKm: plannedTotalKm,
    totalEffectiveKm,
    totalLoadScore,
    plannedTotalLoadScore,
    classifiedDays,

    // High
    highIntensityKm: Math.round(highIntensityKm * 10) / 10,
    highIntensityLoad: Math.round(highIntensityLoad * 10) / 10,
    highIntensityCount: highIntensityDays.filter((d) => d.effectiveDist > 0).length,
    highIntensityDistPct,
    highIntensityLoadPct,
    highIntensityDays,

    // Moderate
    moderateIntensityKm: Math.round(moderateIntensityKm * 10) / 10,
    moderateIntensityLoad: Math.round(moderateIntensityLoad * 10) / 10,
    moderateIntensityCount: moderateIntensityDays.filter((d) => d.effectiveDist > 0).length,
    moderateIntensityDistPct,
    moderateIntensityLoadPct,
    moderateIntensityDays,

    // Low Intensity Point (Zone 3)
    lowPointKm: Math.round(lowPointKm * 10) / 10,
    lowPointLoad: Math.round(lowPointLoad * 10) / 10,
    lowPointCount: lowPointDays.filter((d) => d.effectiveDist > 0).length,
    lowPointDistPct,
    lowPointLoadPct,
    lowPointDays,

    // Long Run
    longRunKm: Math.round(longRunKm * 10) / 10,
    longRunLoad: Math.round(longRunLoad * 10) / 10,
    longRunCount: longRunDays.filter((d) => d.effectiveDist > 0).length,
    longRunDistPct,
    longRunLoadPct,
    longRunDays,

    // Recovery
    recoveryKm: Math.round(recoveryKm * 10) / 10,
    recoveryLoad: Math.round(recoveryLoad * 10) / 10,
    recoveryCount: recoveryDays.filter((d) => d.effectiveDist > 0).length,
    recoveryDistPct,
    recoveryLoadPct,
    recoveryDays,

    // 3-Tier Point Subtotals
    totalPointKm,
    totalPointLoad,
    totalPointCount,

    plannedRestDaysCount,
    actualRestDaysCount,
    aerobicRatio,
    moderateRatio,
    highRatio,
    polarizedEvaluation,
    polarizedBadgeColor,
    loadLevel,
    loadLevelLabel,
    loadLevelColor,
    loadLevelBg,
  };
}

/**
 * Synchronize and enrich the entire ComprehensiveTrainingPlan with training load scores,
 * multipliers, intensity categories, and user category overrides across all weeks and days.
 */
export function enrichPlanWithTrainingLoads(
  plan: ComprehensiveTrainingPlan,
  runnerVdot: number = 38,
  overrides?: Record<string, IntensityCategory>,
  sessions: TrainingSession[] = [],
  loadDataSource: 'actual' | 'planned' = 'actual'
): ComprehensiveTrainingPlan {
  const mergedOverrides: Record<string, IntensityCategory> = {
    ...(plan.categoryOverrides || {}),
    ...(overrides || {}),
  };

  let totalPlanLoadScore = 0;

  const updatedWeeks = plan.weeks.map((week) => {
    // Collect overrides relevant for this week
    const weekOverrides: Record<string, IntensityCategory> = {};
    for (const [k, v] of Object.entries(mergedOverrides)) {
      if (k.startsWith(`${week.weekNumber}_`) || week.days.some((d) => d.dateStr === k)) {
        weekOverrides[k] = v;
      }
    }

    const summary = calculateWeekTrainingLoad(
      week,
      runnerVdot,
      mergedOverrides,
      sessions,
      loadDataSource
    );

    totalPlanLoadScore += summary.totalLoadScore;

    const updatedDays = week.days.map((day) => {
      const dayKey = `${week.weekNumber}_${day.day}`;
      const classified = summary.classifiedDays.find(
        (c) => c.day.day === day.day && (c.day.dateStr === day.dateStr || !day.dateStr)
      );

      const dayOverride =
        mergedOverrides[dayKey] ||
        (day.dateStr ? mergedOverrides[day.dateStr] : undefined) ||
        week.categoryOverrides?.[dayKey] ||
        day.userCategoryOverride;

      return {
        ...day,
        trainingLoad:
          classified?.dayLoad ??
          Math.round((day.distanceKm || 0) * (day.type === '인터벌' ? 2.8 : 1.0) * 10) / 10,
        loadMultiplier: classified?.loadMultiplier ?? 1.0,
        intensityCategory: classified?.category ?? 'recovery',
        userCategoryOverride: dayOverride,
      };
    });

    return {
      ...week,
      totalLoadScore: summary.totalLoadScore,
      plannedTotalLoadScore: summary.plannedTotalLoadScore,
      categoryOverrides: Object.keys(weekOverrides).length > 0 ? weekOverrides : undefined,
      days: updatedDays,
    };
  });

  return {
    ...plan,
    weeks: updatedWeeks,
    totalPlanLoadScore: Math.round(totalPlanLoadScore * 10) / 10,
    categoryOverrides: Object.keys(mergedOverrides).length > 0 ? mergedOverrides : undefined,
    updatedAt: new Date().toISOString(),
  };
}

interface WeeklyTrainingLoadCardProps {
  currentWeek: PlanWeek;
  allWeeks: PlanWeek[];
  selectedWeekIdx: number;
  onSelectWeek?: (index: number) => void;
  runnerVdot?: number;
  sessions?: TrainingSession[];
  categoryOverrides?: Record<string, IntensityCategory>;
  onUpdateCategoryOverride?: (dayKey: string, category: IntensityCategory) => void;
  onResetCategoryOverrides?: () => void;
}

export const WeeklyTrainingLoadCard: React.FC<WeeklyTrainingLoadCardProps> = ({
  currentWeek,
  allWeeks,
  selectedWeekIdx,
  onSelectWeek,
  runnerVdot = 38,
  sessions = [],
  categoryOverrides: initialCategoryOverrides,
  onUpdateCategoryOverride,
  onResetCategoryOverrides,
}) => {
  const [loadDataSource, setLoadDataSource] = useState<'actual' | 'planned'>('actual');
  const [metricMode, setMetricMode] = useState<'load' | 'distance'>('load');
  const [showMultiWeekTrend, setShowMultiWeekTrend] = useState<boolean>(true);
  const [showSessionPaceBreakdown, setShowSessionPaceBreakdown] = useState<boolean>(true);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<IntensityCategory | 'all'>('all');
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, IntensityCategory>>(
    initialCategoryOverrides || {}
  );

  // Sync internal state when external categoryOverrides prop changes
  useEffect(() => {
    if (initialCategoryOverrides) {
      setCategoryOverrides(initialCategoryOverrides);
    }
  }, [initialCategoryOverrides]);

  // Summary for current week with smart pace logic, actual rest detection, and user overrides
  const weekSummary = useMemo(() => {
    return calculateWeekTrainingLoad(currentWeek, runnerVdot, categoryOverrides, sessions, loadDataSource);
  }, [currentWeek, runnerVdot, categoryOverrides, sessions, loadDataSource]);

  // Summaries for all weeks (for multi-week load curve)
  const allWeeksSummaries = useMemo(() => {
    return allWeeks.map((w) => calculateWeekTrainingLoad(w, runnerVdot, categoryOverrides, sessions, loadDataSource));
  }, [allWeeks, runnerVdot, categoryOverrides, sessions, loadDataSource]);

  const maxWeeklyLoad = useMemo(() => {
    return Math.max(...allWeeksSummaries.map((s) => s.totalLoadScore), 100);
  }, [allWeeksSummaries]);

  const avgWeeklyLoad = useMemo(() => {
    if (!allWeeksSummaries.length) return 0;
    const sum = allWeeksSummaries.reduce((acc, s) => acc + s.totalLoadScore, 0);
    return Math.round((sum / allWeeksSummaries.length) * 10) / 10;
  }, [allWeeksSummaries]);

  const handleOverrideCategory = (dayKey: string, newCat: IntensityCategory) => {
    setCategoryOverrides((prev) => ({
      ...prev,
      [dayKey]: newCat,
    }));
    onUpdateCategoryOverride?.(dayKey, newCat);
  };

  const handleResetOverrides = () => {
    setCategoryOverrides({});
    onResetCategoryOverrides?.();
  };

  const filteredDays = useMemo(() => {
    if (activeCategoryFilter === 'all') return weekSummary.classifiedDays;
    return weekSummary.classifiedDays.filter((d) => d.category === activeCategoryFilter);
  }, [weekSummary.classifiedDays, activeCategoryFilter]);

  const restDiff = weekSummary.actualRestDaysCount - weekSummary.plannedRestDaysCount;

  return (
    <div className="rounded-2xl sm:rounded-3xl bg-white border border-stone-200/90 shadow-xs overflow-hidden transition-all">
      {/* 1. Header Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0">
            <Flame className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-base sm:text-lg text-white font-athletic tracking-tight">
                주간 훈련 부하 &amp; 5단계 강도 세분화 분석
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-stone-800 text-amber-300 border border-stone-700">
                {weekSummary.weekLabel}
              </span>
            </div>
            <p className="text-xs text-stone-300 mt-0.5">
              <strong className="text-rose-300 font-bold">고강도 인터벌</strong>, <strong className="text-amber-300 font-bold">중강도 역치</strong>, <strong className="text-emerald-300 font-bold">저강도(존3)</strong>를 세분화하여 피로도 및 적응도를 과학적으로 분석합니다
            </p>
          </div>
        </div>

        {/* Source Switcher & Metric Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Load Data Source: Actual vs Planned */}
          <div className="inline-flex rounded-xl bg-stone-800/80 p-1 border border-stone-700">
            <button
              type="button"
              onClick={() => setLoadDataSource('actual')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                loadDataSource === 'actual'
                  ? 'bg-emerald-500 text-stone-950 shadow-xs font-black'
                  : 'text-stone-300 hover:text-white'
              }`}
              title="실제 달린 기록과 실제 휴식한 날(미수행 0pt)을 반영"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>실제 기록 &amp; 휴식 반영</span>
            </button>
            <button
              type="button"
              onClick={() => setLoadDataSource('planned')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                loadDataSource === 'planned'
                  ? 'bg-amber-400 text-stone-950 shadow-xs font-black'
                  : 'text-stone-300 hover:text-white'
              }`}
              title="원래 계획된 7일 훈련 원안 기준"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>계획 목표 기준</span>
            </button>
          </div>

          {/* Metric Mode Switcher */}
          <div className="inline-flex rounded-xl bg-stone-800/80 p-1 border border-stone-700">
            <button
              type="button"
              onClick={() => setMetricMode('load')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                metricMode === 'load'
                  ? 'bg-amber-400 text-stone-950 shadow-xs font-black'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>부하 점수</span>
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('distance')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                metricMode === 'distance'
                  ? 'bg-amber-400 text-stone-950 shadow-xs font-black'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>거리 비율</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {/* 2. Top Summary Metrics Row (Total + 5 Subdivided Categories) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Total Training Load Score */}
          <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 shadow-2xs col-span-2 sm:col-span-1 lg:col-span-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 mb-1">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                {loadDataSource === 'actual' ? '실제 총 부하' : '계획 총 부하'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-stone-200 text-stone-700">
                평균 {avgWeeklyLoad}pt
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-stone-900 font-athletic">
                {weekSummary.totalLoadScore}
              </span>
              <span className="text-xs font-bold text-stone-500">pt</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-stone-600">
              <span>{weekSummary.totalEffectiveKm}km / {weekSummary.totalPlannedKm}km</span>
              <span className="flex items-center gap-0.5 text-indigo-700">
                <Coffee className="w-3 h-3" />
                휴식 {weekSummary.actualRestDaysCount}일
              </span>
            </div>
          </div>

          {/* Intensity Category 1: High Intensity (고 - 역치 이상 인터벌) */}
          <div
            onClick={() =>
              setActiveCategoryFilter(activeCategoryFilter === 'highIntensity' ? 'all' : 'highIntensity')
            }
            className={`p-3 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
              activeCategoryFilter === 'highIntensity'
                ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300'
                : 'bg-white border-stone-200 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-rose-700 mb-1">
              <span className="flex items-center gap-1 font-bold">
                <Flame className="w-3.5 h-3.5 text-rose-600" />
                🔥 고 - 역치이상
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                {metricMode === 'load' ? `${weekSummary.highIntensityLoadPct}%` : `${weekSummary.highIntensityDistPct}%`}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-rose-600 font-athletic">
                  {metricMode === 'load' ? weekSummary.highIntensityLoad : weekSummary.highIntensityKm}
                </span>
                <span className="text-[10px] font-bold text-stone-500">
                  {metricMode === 'load' ? 'pt' : 'km'}
                </span>
              </div>
              <span className="text-[11px] font-bold text-stone-500">
                {weekSummary.highIntensityCount}개
              </span>
            </div>
            <div className="mt-1 text-[10px] text-stone-500 truncate">
              VO2max 인터벌·질주
            </div>
          </div>

          {/* Intensity Category 2: Moderate Intensity (중 - 역치 구간) */}
          <div
            onClick={() =>
              setActiveCategoryFilter(activeCategoryFilter === 'moderateIntensity' ? 'all' : 'moderateIntensity')
            }
            className={`p-3 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
              activeCategoryFilter === 'moderateIntensity'
                ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300'
                : 'bg-white border-stone-200 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700 mb-1">
              <span className="flex items-center gap-1 font-bold">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                ⚡ 중 - 역치구간
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                {metricMode === 'load' ? `${weekSummary.moderateIntensityLoadPct}%` : `${weekSummary.moderateIntensityDistPct}%`}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-amber-600 font-athletic">
                  {metricMode === 'load' ? weekSummary.moderateIntensityLoad : weekSummary.moderateIntensityKm}
                </span>
                <span className="text-[10px] font-bold text-stone-500">
                  {metricMode === 'load' ? 'pt' : 'km'}
                </span>
              </div>
              <span className="text-[11px] font-bold text-stone-500">
                {weekSummary.moderateIntensityCount}개
              </span>
            </div>
            <div className="mt-1 text-[10px] text-stone-500 truncate">
              젖산 역치 템포·크루즈
            </div>
          </div>

          {/* Intensity Category 3: Low Intensity Point (저 - 존3 구간) */}
          <div
            onClick={() =>
              setActiveCategoryFilter(activeCategoryFilter === 'lowIntensityPoint' ? 'all' : 'lowIntensityPoint')
            }
            className={`p-3 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
              activeCategoryFilter === 'lowIntensityPoint'
                ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300'
                : 'bg-white border-stone-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 mb-1">
              <span className="flex items-center gap-1 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                🎯 저 - 존3구간
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900">
                {metricMode === 'load' ? `${weekSummary.lowPointLoadPct}%` : `${weekSummary.lowPointDistPct}%`}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-emerald-700 font-athletic">
                  {metricMode === 'load' ? weekSummary.lowPointLoad : weekSummary.lowPointKm}
                </span>
                <span className="text-[10px] font-bold text-stone-500">
                  {metricMode === 'load' ? 'pt' : 'km'}
                </span>
              </div>
              <span className="text-[11px] font-bold text-stone-500">
                {weekSummary.lowPointCount}개
              </span>
            </div>
            <div className="mt-1 text-[10px] text-stone-500 truncate">
              M-Pace 지속·모더레이트
            </div>
          </div>

          {/* Intensity Category 4: Long Run (LSD 장거리) */}
          <div
            onClick={() =>
              setActiveCategoryFilter(activeCategoryFilter === 'longRun' ? 'all' : 'longRun')
            }
            className={`p-3 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
              activeCategoryFilter === 'longRun'
                ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-300'
                : 'bg-white border-stone-200 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-700 mb-1">
              <span className="flex items-center gap-1 font-bold">
                <Mountain className="w-3.5 h-3.5 text-indigo-600" />
                🏔️ 장거리 (LSD)
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">
                {metricMode === 'load' ? `${weekSummary.longRunLoadPct}%` : `${weekSummary.longRunDistPct}%`}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-indigo-700 font-athletic">
                  {metricMode === 'load' ? weekSummary.longRunLoad : weekSummary.longRunKm}
                </span>
                <span className="text-[10px] font-bold text-stone-500">
                  {metricMode === 'load' ? 'pt' : 'km'}
                </span>
              </div>
              <span className="text-[11px] font-bold text-stone-500">
                {weekSummary.longRunCount}개
              </span>
            </div>
            <div className="mt-1 text-[10px] text-stone-500 truncate">
              15km+ 주말 지구력주
            </div>
          </div>

          {/* Intensity Category 5: Recovery (회복 및 베이스 조깅) */}
          <div
            onClick={() =>
              setActiveCategoryFilter(activeCategoryFilter === 'recovery' ? 'all' : 'recovery')
            }
            className={`p-3 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
              activeCategoryFilter === 'recovery'
                ? 'bg-stone-100 border-stone-400 ring-2 ring-stone-300'
                : 'bg-white border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-stone-700 mb-1">
              <span className="flex items-center gap-1 font-bold">
                <Activity className="w-3.5 h-3.5 text-stone-600" />
                🌿 회복 / 조깅
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-stone-200 text-stone-800">
                {metricMode === 'load' ? `${weekSummary.recoveryLoadPct}%` : `${weekSummary.recoveryDistPct}%`}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-stone-700 font-athletic">
                  {metricMode === 'load' ? weekSummary.recoveryLoad : weekSummary.recoveryKm}
                </span>
                <span className="text-[10px] font-bold text-stone-500">
                  {metricMode === 'load' ? 'pt' : 'km'}
                </span>
              </div>
              <span className="text-[11px] font-bold text-stone-500">
                {weekSummary.recoveryCount}개
              </span>
            </div>
            <div className="mt-1 text-[10px] text-stone-500 truncate">
              이지 베이스 &amp; 실제 휴식
            </div>
          </div>
        </div>

        {/* Dedicated 3-Tier Point Workout Analysis Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900 text-white shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-750">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold text-xs">
                🎯
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide">
                  포인트 훈련 3대 강도 분포 (저 - 존3구간 / 중 - 역치구간 / 고 - 역치 이상 인터벌)
                </h4>
                <p className="text-[11px] text-stone-300">
                  선택한 포인트 훈련 종류와 페이스를 3대 강도 구간으로 정밀 매핑하여 생리학적 과부하를 예방합니다
                </p>
              </div>
            </div>
            <div className="text-[11px] font-bold text-stone-300 bg-stone-800 px-2.5 py-1 rounded-lg border border-stone-700 self-start sm:self-auto">
              포인트 총합: <strong className="text-amber-300 font-black">{weekSummary.totalPointKm}km</strong> · <strong className="text-amber-300 font-black">{weekSummary.totalPointLoad}pt</strong> ({weekSummary.totalPointCount}세션)
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            {/* 저 - 존3 구간 */}
            <div className="p-3 rounded-xl bg-stone-800/80 border border-emerald-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                  <span>🟢</span>
                  <span>저 - 존3구간</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                  Zone 3 파워
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-white font-athletic">
                  {weekSummary.lowPointKm}km
                </span>
                <span className="text-xs text-stone-400 font-semibold">
                  ({weekSummary.lowPointLoad}pt / {weekSummary.lowPointCount}회)
                </span>
              </div>
              <p className="text-[11px] text-stone-300 leading-snug">
                <strong>훈련: </strong>존3 마라톤 페이스주(M-Pace), 모더레이트런, 유산소 역치주
              </p>
              <p className="text-[10px] text-emerald-300/90 leading-tight">
                💡 젖산 축적 없이 유산소 파워와 실전 순항 페이스 감각을 배양하는 안전한 저강도 포인트
              </p>
            </div>

            {/* 중 - 역치 구간 */}
            <div className="p-3 rounded-xl bg-stone-800/80 border border-amber-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                  <span>🟡</span>
                  <span>중 - 역치구간</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700">
                  Zone 4 역치
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-white font-athletic">
                  {weekSummary.moderateIntensityKm}km
                </span>
                <span className="text-xs text-stone-400 font-semibold">
                  ({weekSummary.moderateIntensityLoad}pt / {weekSummary.moderateIntensityCount}회)
                </span>
              </div>
              <p className="text-[11px] text-stone-300 leading-snug">
                <strong>훈련: </strong>젖산 역치(LT) 템포런, 크루즈 인터벌, 빌드업주, 파틀렉
              </p>
              <p className="text-[10px] text-amber-300/90 leading-tight">
                💡 젖산 축적 한계점을 늦춰 마라톤 후반 페이스 붕괴를 원천 방어하는 핵심 중강도 포인트
              </p>
            </div>

            {/* 고 - 역치 이상 인터벌 등 */}
            <div className="p-3 rounded-xl bg-stone-800/80 border border-rose-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-rose-400 flex items-center gap-1">
                  <span>🔴</span>
                  <span>고 - 역치 이상 인터벌</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-700">
                  Zone 5+ 스피드
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-white font-athletic">
                  {weekSummary.highIntensityKm}km
                </span>
                <span className="text-xs text-stone-400 font-semibold">
                  ({weekSummary.highIntensityLoad}pt / {weekSummary.highIntensityCount}회)
                </span>
              </div>
              <p className="text-[11px] text-stone-300 leading-snug">
                <strong>훈련: </strong>1000m/800m 인터벌, 언덕 파워 질주, 400m 숏 질주
              </p>
              <p className="text-[10px] text-rose-300/90 leading-tight">
                💡 최대 산소 섭취량(VO2max) 천장을 뚫고 케이던스와 다리 반발력을 폭발시키는 고강도 포인트
              </p>
            </div>
          </div>
        </div>

        {/* 3. Visual 5-Segment Stacked Intensity Distribution Bar */}
        <div className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Layers className="w-4 h-4 text-stone-700" />
              <span className="text-xs font-bold text-stone-800">
                {metricMode === 'load' ? '5단계 훈련 부하 비중 (Load %)' : '5단계 훈련 거리 비중 (Distance %)'}
              </span>
              <span className="text-[11px] text-stone-500">
                (고강도 {metricMode === 'load' ? weekSummary.highIntensityLoadPct : weekSummary.highIntensityDistPct}% : 중강도{' '}
                {metricMode === 'load' ? weekSummary.moderateIntensityLoadPct : weekSummary.moderateIntensityDistPct}% : 저강도(존3){' '}
                {metricMode === 'load' ? weekSummary.lowPointLoadPct : weekSummary.lowPointDistPct}% : 장거리{' '}
                {metricMode === 'load' ? weekSummary.longRunLoadPct : weekSummary.longRunDistPct}% : 회복{' '}
                {metricMode === 'load' ? weekSummary.recoveryLoadPct : weekSummary.recoveryDistPct}%)
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-xs flex-wrap">
              <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                고강도
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                중강도
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                저강도(존3)
              </span>
              <span className="inline-flex items-center gap-1 text-indigo-700 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                장거리
              </span>
              <span className="inline-flex items-center gap-1 text-stone-600 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-stone-400 inline-block" />
                회복/조깅
              </span>
            </div>
          </div>

          {/* 5-Segment Stacked Bar */}
          <div className="w-full h-5 rounded-full bg-stone-200 overflow-hidden flex p-0.5 shadow-inner">
            {/* 1. High Intensity */}
            {(metricMode === 'load' ? weekSummary.highIntensityLoadPct : weekSummary.highIntensityDistPct) > 0 && (
              <div
                style={{
                  width: `${metricMode === 'load' ? weekSummary.highIntensityLoadPct : weekSummary.highIntensityDistPct}%`,
                }}
                className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-l-full relative group transition-all"
                title={`고강도: ${weekSummary.highIntensityKm}km (${weekSummary.highIntensityLoad}pt)`}
              />
            )}

            {/* 2. Moderate Intensity */}
            {(metricMode === 'load' ? weekSummary.moderateIntensityLoadPct : weekSummary.moderateIntensityDistPct) > 0 && (
              <div
                style={{
                  width: `${metricMode === 'load' ? weekSummary.moderateIntensityLoadPct : weekSummary.moderateIntensityDistPct}%`,
                }}
                className={`h-full bg-gradient-to-r from-amber-500 to-amber-600 relative group transition-all ${
                  (metricMode === 'load' ? weekSummary.highIntensityLoadPct : weekSummary.highIntensityDistPct) === 0
                    ? 'rounded-l-full'
                    : ''
                }`}
                title={`중강도: ${weekSummary.moderateIntensityKm}km (${weekSummary.moderateIntensityLoad}pt)`}
              />
            )}

            {/* 3. Low Intensity Point (Zone 3) */}
            {(metricMode === 'load' ? weekSummary.lowPointLoadPct : weekSummary.lowPointDistPct) > 0 && (
              <div
                style={{
                  width: `${metricMode === 'load' ? weekSummary.lowPointLoadPct : weekSummary.lowPointDistPct}%`,
                }}
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 relative group transition-all"
                title={`저강도 포인트(존3): ${weekSummary.lowPointKm}km (${weekSummary.lowPointLoad}pt)`}
              />
            )}

            {/* 4. Long Run */}
            {(metricMode === 'load' ? weekSummary.longRunLoadPct : weekSummary.longRunDistPct) > 0 && (
              <div
                style={{
                  width: `${metricMode === 'load' ? weekSummary.longRunLoadPct : weekSummary.longRunDistPct}%`,
                }}
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 relative group transition-all"
                title={`장거리 LSD: ${weekSummary.longRunKm}km (${weekSummary.longRunLoad}pt)`}
              />
            )}

            {/* 5. Recovery */}
            {(metricMode === 'load' ? weekSummary.recoveryLoadPct : weekSummary.recoveryDistPct) > 0 && (
              <div
                style={{
                  width: `${metricMode === 'load' ? weekSummary.recoveryLoadPct : weekSummary.recoveryDistPct}%`,
                }}
                className="h-full bg-gradient-to-r from-stone-400 to-stone-500 rounded-r-full relative group transition-all"
                title={`회복/조깅: ${weekSummary.recoveryKm}km (${weekSummary.recoveryLoad}pt)`}
              />
            )}
          </div>

          {/* Bar Sub-legend with values (5 items) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 text-center text-[11px]">
            <div className="p-1.5 rounded-xl bg-rose-50 border border-rose-100">
              <span className="font-bold text-rose-700">고강도 {weekSummary.highIntensityKm}km</span>
              <span className="text-stone-500 ml-1">({weekSummary.highIntensityLoad} pt)</span>
            </div>
            <div className="p-1.5 rounded-xl bg-amber-50 border border-amber-100">
              <span className="font-bold text-amber-800">중강도 {weekSummary.moderateIntensityKm}km</span>
              <span className="text-stone-500 ml-1">({weekSummary.moderateIntensityLoad} pt)</span>
            </div>
            <div className="p-1.5 rounded-xl bg-emerald-50 border border-emerald-100">
              <span className="font-bold text-emerald-800">저강도(존3) {weekSummary.lowPointKm}km</span>
              <span className="text-stone-500 ml-1">({weekSummary.lowPointLoad} pt)</span>
            </div>
            <div className="p-1.5 rounded-xl bg-indigo-50 border border-indigo-100">
              <span className="font-bold text-indigo-800">장거리 {weekSummary.longRunKm}km</span>
              <span className="text-stone-500 ml-1">({weekSummary.longRunLoad} pt)</span>
            </div>
            <div className="p-1.5 rounded-xl bg-stone-100 border border-stone-200">
              <span className="font-bold text-stone-700">회복 {weekSummary.recoveryKm}km</span>
              <span className="text-stone-500 ml-1">({weekSummary.recoveryLoad} pt)</span>
            </div>
          </div>
        </div>

        {/* 4. Detailed Session Pace & Intensity Verification Table */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-stone-900">
                이번 주 세션별 강도 세분화 &amp; 실제 휴식 반영 내역
              </span>
              <span className="text-[11px] text-stone-500">
                ({filteredDays.length}개 일자 표시 · 휴식 {weekSummary.actualRestDaysCount}일)
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                title="원클릭 강도 전환 및 부하값이 플랜과 클라우드(Firestore)에 즉시 저장됩니다"
              >
                <Check className="w-3 h-3 text-emerald-600" />
                <span>부하값 플랜 자동 저장</span>
              </span>

              {Object.keys(categoryOverrides).length > 0 && (
                <button
                  type="button"
                  onClick={handleResetOverrides}
                  className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-800 px-2 py-0.5 rounded border border-stone-200 bg-stone-50 cursor-pointer"
                  title="사용자 강도 조정을 기본 페이스 자동 판정으로 초기화"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>초기화 ({Object.keys(categoryOverrides).length}건)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSessionPaceBreakdown(!showSessionPaceBreakdown)}
                className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                {showSessionPaceBreakdown ? '세션 목록 접기' : '세션 목록 펼치기'}
              </button>
            </div>
          </div>

          {/* Filter Pills for 5 Categories */}
          <div className="flex items-center gap-1.5 pb-2.5 overflow-x-auto text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                activeCategoryFilter === 'all'
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              전체 ({weekSummary.classifiedDays.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('highIntensity')}
              className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                activeCategoryFilter === 'highIntensity'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <span>🔥 고강도</span>
              <span>({weekSummary.highIntensityDays.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('moderateIntensity')}
              className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                activeCategoryFilter === 'moderateIntensity'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span>⚡ 중강도</span>
              <span>({weekSummary.moderateIntensityDays.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('lowIntensityPoint')}
              className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                activeCategoryFilter === 'lowIntensityPoint'
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
              }`}
            >
              <span>🎯 저강도(존3)</span>
              <span>({weekSummary.lowPointDays.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('longRun')}
              className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                activeCategoryFilter === 'longRun'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <span>🏔️ 장거리</span>
              <span>({weekSummary.longRunDays.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('recovery')}
              className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                activeCategoryFilter === 'recovery'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span>🌿 회복/휴식</span>
              <span>({weekSummary.recoveryDays.length})</span>
            </button>
          </div>

          {showSessionPaceBreakdown && (
            <div className="space-y-2.5 mt-2">
              {filteredDays.map((cDay) => {
                const dayKey = `${weekSummary.weekNumber}_${cDay.day.day}`;
                const isRace = cDay.day.type === '대회';

                return (
                  <div
                    key={dayKey}
                    className={`p-3 rounded-xl border transition-all ${
                      cDay.isActualRest
                        ? 'bg-stone-50/90 border-stone-200'
                        : cDay.category === 'highIntensity'
                        ? 'bg-rose-50/50 border-rose-200'
                        : cDay.category === 'moderateIntensity'
                        ? 'bg-amber-50/50 border-amber-200'
                        : cDay.category === 'lowIntensityPoint'
                        ? 'bg-teal-50/50 border-teal-200'
                        : cDay.category === 'longRun'
                        ? 'bg-indigo-50/50 border-indigo-200'
                        : 'bg-emerald-50/40 border-emerald-200'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      {/* Left info: Day, Title, Distance, Pace */}
                      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                        <span
                          className={`px-2 py-1 rounded-lg border font-black text-xs flex-shrink-0 ${
                            cDay.isActualRest
                              ? 'bg-stone-100 text-stone-500 border-stone-200'
                              : 'bg-white text-stone-800 border-stone-200'
                          }`}
                        >
                          {cDay.day.dayShort || cDay.day.day.slice(0, 1)}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`font-extrabold text-xs truncate ${
                                cDay.isActualRest ? 'text-stone-500 line-through' : 'text-stone-900'
                              }`}
                            >
                              {cDay.day.title}
                            </span>

                            {/* Status Badge */}
                            {cDay.isActualRest ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200 flex items-center gap-1">
                                <BedDouble className="w-3 h-3" />
                                실제 휴식 완료 (부하 0pt)
                              </span>
                            ) : cDay.isCompletedRun ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                실제 완주 완료
                              </span>
                            ) : cDay.isFutureDay ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-stone-100 text-stone-600">
                                예정
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  isRace
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-white text-stone-700 border border-stone-200'
                                }`}
                              >
                                {cDay.day.type}
                              </span>
                            )}

                            <span className="text-xs font-bold text-stone-800 font-athletic">
                              {cDay.effectiveDist}km
                              {cDay.isActualRest && cDay.plannedDist > 0 && (
                                <span className="text-stone-400 text-[10px] ml-1">
                                  (계획: {cDay.plannedDist}km)
                                </span>
                              )}
                            </span>
                          </div>

                          {/* Pace and Zone Indicator */}
                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-stone-600 mt-1">
                            {!cDay.isActualRest && cDay.effectivePaceStr && cDay.effectivePaceStr !== '-' && (
                              <span className="inline-flex items-center gap-1 font-bold text-stone-800 bg-white px-1.5 py-0.5 rounded border border-stone-200 font-mono">
                                ⏱️ {cDay.isActualPace ? '실제 기록' : '목표 페이스'}:{' '}
                                <span className="text-emerald-800 font-black">
                                  {cDay.effectivePaceStr}
                                  {!cDay.effectivePaceStr.includes('/km') ? '/km' : ''}
                                </span>
                              </span>
                            )}

                            {cDay.actualShoeName && (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                <Footprints className="w-3 h-3 text-emerald-700" />
                                실제 착용: {cDay.actualShoeName}
                              </span>
                            )}

                            <span className="px-1.5 py-0.5 rounded bg-white font-bold text-[10px] border border-stone-200 text-stone-700">
                              {cDay.paceZoneLabel}
                            </span>

                            <span className="font-black text-stone-800 text-[11px]">
                              부하: {cDay.dayLoad} pt ({cDay.loadMultiplier}x)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick category switcher buttons (5-Tier: 고강도 / 중강도 / 저강도 / 장거리 / 회복) */}
                      <div className="flex items-center gap-1 self-start md:self-auto flex-shrink-0">
                        <div className="inline-flex rounded-lg bg-white p-0.5 border border-stone-200 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleOverrideCategory(dayKey, 'highIntensity')}
                            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                              cDay.category === 'highIntensity'
                                ? 'bg-rose-600 text-white shadow-2xs font-extrabold'
                                : 'text-stone-600 hover:text-rose-700'
                            }`}
                            title="고강도 인터벌 부하로 원클릭 변환 (2.8x)"
                          >
                            고강도
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOverrideCategory(dayKey, 'moderateIntensity')}
                            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                              cDay.category === 'moderateIntensity'
                                ? 'bg-amber-600 text-white shadow-2xs font-extrabold'
                                : 'text-stone-600 hover:text-amber-700'
                            }`}
                            title="중강도 템포·역치 부하로 원클릭 변환 (2.2x)"
                          >
                            중강도
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOverrideCategory(dayKey, 'lowIntensityPoint')}
                            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                              cDay.category === 'lowIntensityPoint'
                                ? 'bg-teal-600 text-white shadow-2xs font-extrabold'
                                : 'text-stone-600 hover:text-teal-700'
                            }`}
                            title="저강도 포인트(존3 M-Pace) 부하로 원클릭 변환 (1.6x)"
                          >
                            저강도(존3)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOverrideCategory(dayKey, 'longRun')}
                            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                              cDay.category === 'longRun'
                                ? 'bg-indigo-600 text-white shadow-2xs font-extrabold'
                                : 'text-stone-600 hover:text-indigo-700'
                            }`}
                            title="장거리 LSD 지구력 부하로 원클릭 변환 (1.4x)"
                          >
                            장거리
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOverrideCategory(dayKey, 'recovery')}
                            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                              cDay.category === 'recovery'
                                ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                                : 'text-stone-600 hover:text-emerald-700'
                            }`}
                            title="회복 및 기초 조깅 부하로 원클릭 변환 (1.0x)"
                          >
                            회복/휴식
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Scientific Pace / Rest Explanation note */}
                    <div className="text-[11px] text-stone-600 mt-1.5 pl-0.5 leading-snug">
                      💡 {cDay.paceExplanation}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Sports Science & Pyramidal Coaching Bar */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-stone-900">
                  피라미달 &amp; 80:20 강도 분배 진단:
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${weekSummary.polarizedBadgeColor}`}>
                  저강도(회복+LSD) {weekSummary.aerobicRatio}% : 중강도(템포) {weekSummary.moderateRatio}% : 고강도(인터벌) {weekSummary.highRatio}%
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                {weekSummary.polarizedEvaluation}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-shrink-0">
            <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${weekSummary.loadLevelBg} ${weekSummary.loadLevelColor}`}>
              {weekSummary.loadLevelLabel}
            </span>
          </div>
        </div>

        {/* 6. Multi-Week Training Load Curve (주차별 4단계 훈련 부하 추이) */}
        <div className="pt-2 border-t border-stone-100">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setShowMultiWeekTrend(!showMultiWeekTrend)}
              className="flex items-center gap-2 text-xs font-bold text-stone-800 hover:text-emerald-700 cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span>전체 주차별 훈련 부하 추이 (Weekly Training Load Progression)</span>
              <span className="text-[11px] text-stone-500">
                ({allWeeks.length}주간 4단계 강도 스택 곡선)
              </span>
            </button>
            <span className="text-[11px] text-stone-500 hidden sm:inline">
              *주차 막대를 클릭하면 해당 주간으로 이동합니다
            </span>
          </div>

          {showMultiWeekTrend && (
            <div className="p-3.5 rounded-2xl bg-stone-50/70 border border-stone-200">
              {/* Responsive scrollable multi-week bars */}
              <div className="flex items-end gap-1.5 sm:gap-2 overflow-x-auto pb-2 pt-6 min-h-[140px] px-1 scrollbar-thin">
                {allWeeksSummaries.map((s, idx) => {
                  const isSelected = idx === selectedWeekIdx;
                  const barHeightPct = Math.min(100, Math.max(12, Math.round((s.totalLoadScore / maxWeeklyLoad) * 100)));
                  const highH = (s.highIntensityLoad / (s.totalLoadScore || 1)) * 100;
                  const modH = (s.moderateIntensityLoad / (s.totalLoadScore || 1)) * 100;
                  const lsdH = (s.longRunLoad / (s.totalLoadScore || 1)) * 100;
                  const recH = Math.max(0, 100 - highH - modH - lsdH);

                  return (
                    <div
                      key={s.weekNumber}
                      onClick={() => onSelectWeek?.(idx)}
                      className={`flex flex-col items-center cursor-pointer group transition-all relative flex-1 min-w-[28px] sm:min-w-[34px] max-w-[48px]`}
                      title={`${s.weekLabel}: 총 ${s.totalEffectiveKm}km / ${s.totalLoadScore}pt\n고강도: ${s.highIntensityKm}km\n중강도: ${s.moderateIntensityKm}km\n장거리: ${s.longRunKm}km\n회복: ${s.recoveryKm}km`}
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute -top-6 text-[10px] font-bold text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap bg-white px-1.5 py-0.5 rounded shadow-xs border border-stone-200 z-10">
                        {s.totalLoadScore}pt
                      </div>

                      {/* Stacked Vertical Bar */}
                      <div
                        style={{ height: `${barHeightPct}px` }}
                        className={`w-full rounded-t-md flex flex-col justify-end overflow-hidden transition-all shadow-2xs ${
                          isSelected
                            ? 'ring-2 ring-emerald-600 ring-offset-1 scale-[1.03]'
                            : 'hover:brightness-110 opacity-80 hover:opacity-100'
                        }`}
                      >
                        {/* High (Top) */}
                        <div
                          style={{ height: `${highH}%` }}
                          className="w-full bg-rose-500"
                        />
                        {/* Moderate (Upper-Mid) */}
                        <div
                          style={{ height: `${modH}%` }}
                          className="w-full bg-amber-500"
                        />
                        {/* Long Run (Lower-Mid) */}
                        <div
                          style={{ height: `${lsdH}%` }}
                          className="w-full bg-indigo-500"
                        />
                        {/* Recovery (Bottom) */}
                        <div
                          style={{ height: `${recH}%` }}
                          className="w-full bg-emerald-500"
                        />
                      </div>

                      {/* Week label */}
                      <span
                        className={`text-[10px] mt-1.5 font-bold truncate max-w-full ${
                          isSelected
                            ? 'text-emerald-800 font-black underline'
                            : 'text-stone-500 group-hover:text-stone-800'
                        }`}
                      >
                        W{s.weekNumber}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Legend for the multi-week progression */}
              <div className="flex items-center justify-between pt-2 border-t border-stone-200/80 text-[11px] text-stone-500 mt-1 flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                    고강도
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                    중강도
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                    장거리
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    회복/조깅
                  </span>
                </div>
                <span className="font-medium text-stone-600">
                  선택: {weekSummary.weekLabel} ({weekSummary.totalLoadScore}pt / {weekSummary.totalEffectiveKm}km / 휴식 {weekSummary.actualRestDaysCount}일)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
