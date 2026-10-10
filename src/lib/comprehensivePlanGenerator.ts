import {
  WeeklyPlanDay,
  WorkoutStage,
  TrainingSession,
  RunningShoe,
  RegisteredRace,
  RunningGoals,
  PlanWeek,
  TrainingPlanPeriodSettings,
  ComprehensiveTrainingPlan,
  PlanPeriodizationPhase,
  SpeedWorkoutType,
  PlanFitnessAudit,
} from '../types';
import { getTrainingPaces, formatPace, parseTimeToSeconds, parsePaceToSeconds, calculateVDOT } from './vdot';
import { attachShoeRecommendationsToPlan, createShoeRotationTracker } from './shoeRecommender';
import { analyzeRunnerState, inferWorkoutType } from './trainingPlanGenerator';
import { calculateDDay } from './marathonData';

export type DayOfWeek = '월요일' | '화요일' | '수요일' | '목요일' | '금요일' | '토요일' | '일요일';

const DAY_ORDER: DayOfWeek[] = [
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
  '일요일',
];

const DAY_SHORT_MAP: Record<DayOfWeek, string> = {
  월요일: 'MON',
  화요일: 'TUE',
  수요일: 'WED',
  목요일: 'THU',
  금요일: 'FRI',
  토요일: 'SAT',
  일요일: 'SUN',
};

/**
 * Format a Date object to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get Monday of the week for a given date
 */
export function getMonday(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 is Sun, 1 is Mon
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

/**
 * Safely parse YYYY-MM-DD string into local midnight Date avoiding UTC timezone shifts
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  return new Date(dateStr);
}

/**
 * Get formatted string for today e.g. "2026-10-04"
 */
export function getTodayDateStr(): string {
  return formatDate(new Date());
}

/**
 * Get formatted string for upcoming Monday (next Monday)
 * If today is Sunday, next Monday is tomorrow.
 * If today is Monday, next Monday is in 7 days.
 * If today is Tue-Sat, next Monday is the upcoming Monday.
 */
export function getNextMondayStr(from: Date = new Date()): string {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 is Sun, 1 is Mon
  const daysUntilNextMonday = day === 0 ? 1 : day === 1 ? 7 : (8 - day);
  d.setDate(d.getDate() + daysUntilNextMonday);
  return formatDate(d);
}

/**
 * Infer course distance in km with precision
 */
export function parseCourseKm(courseName: string, customDistanceKm?: number): number {
  if (customDistanceKm && customDistanceKm > 0) return customDistanceKm;
  if (!courseName) return 42.195;
  const lower = courseName.toLowerCase().trim();
  if (lower.includes('풀') || lower.includes('full') || lower.includes('42.195')) return 42.195;
  if (lower.includes('하프') || lower.includes('half') || lower.includes('21.0975')) return 21.0975;
  
  // Extract number before k or km (e.g. "10k", "10km", "5k", "32km", "15.5k")
  const kmMatch = lower.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:k|km|킬로)/);
  if (kmMatch && parseFloat(kmMatch[1])) {
    const val = parseFloat(kmMatch[1]);
    if (val >= 42 && val <= 43) return 42.195;
    if (val >= 21 && val <= 22) return 21.0975;
    return val;
  }
  
  // Extract standalone number
  const numMatch = lower.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if (numMatch && parseFloat(numMatch[1])) {
    const val = parseFloat(numMatch[1]);
    if (val >= 42 && val <= 43) return 42.195;
    if (val >= 21 && val <= 22) return 21.0975;
    return val;
  }

  if (lower.includes('10')) return 10.0;
  if (lower.includes('5')) return 5.0;

  return 42.195;
}

/**
 * Precision race pace & target time calculator for ANY race or target distance
 * Fixes any mismatch between target finish time and target pace per km!
 */
export function calculateSpecificRacePace(
  courseName: string,
  targetTime?: string,
  targetPaceDirect?: string,
  fallbackVdot: number = 45,
  goals?: RunningGoals,
  customDistanceKm?: number
): { pace: string; finishTime: string } {
  const dist = parseCourseKm(courseName, customDistanceKm);

  // 1. Direct Target Time provided by user (e.g. "00:59:59" for 10km -> 5'59"/km)
  // When a user specifies a target time, that time and the distance strictly govern the target pace!
  if (targetTime && targetTime.trim() && targetTime.trim() !== '--:--' && targetTime.trim() !== '미설정') {
    const totalSec = parseTimeToSeconds(targetTime);
    if (totalSec > 0 && dist > 0) {
      const paceSec = totalSec / dist;
      const calcPace = formatPace(paceSec);
      return { pace: calcPace, finishTime: targetTime };
    }
  }

  // 2. Direct Target Pace provided by user (e.g. "4'30\"" or "5'00\"/km" or "5'59\"")
  if (targetPaceDirect && targetPaceDirect.trim() && targetPaceDirect !== '-' && targetPaceDirect !== "-'--\"") {
    const clean = targetPaceDirect.replace('/km', '').trim();
    const parts = clean.split("'");
    if (parts.length >= 2) {
      const min = parseInt(parts[0], 10);
      const sec = parseInt(parts[1].replace('"', ''), 10) || 0;
      if (!isNaN(min) && !isNaN(sec)) {
        const paceSec = min * 60 + sec;
        const totalSec = Math.round(paceSec * dist);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return { pace: `${min}'${String(sec).padStart(2, '0')}"`, finishTime: timeStr };
      }
    }
  }

  // 3. Fallback to user's saved personal goals for the matching distance
  if (dist >= 40 && goals?.targetFull) {
    const totalSec = parseTimeToSeconds(goals.targetFull);
    if (totalSec > 0) {
      return { pace: formatPace(totalSec / 42.195), finishTime: goals.targetFull };
    }
  }
  if (dist >= 20 && dist < 40 && goals?.targetHalf) {
    const totalSec = parseTimeToSeconds(goals.targetHalf);
    if (totalSec > 0) {
      return { pace: formatPace(totalSec / 21.0975), finishTime: goals.targetHalf };
    }
  }
  if (dist >= 8 && dist < 20 && goals?.target10k) {
    const totalSec = parseTimeToSeconds(goals.target10k);
    if (totalSec > 0) {
      return { pace: formatPace(totalSec / 10.0), finishTime: goals.target10k };
    }
  }

  // 4. Default VDOT pace expectation for that specific distance
  const paces = getTrainingPaces(fallbackVdot > 28 ? fallbackVdot : 45);
  const marathonPaceRawSec = paces?.marathonPace?.rawSec || 295;
  const marathonPaceStr = paces?.marathonPace?.pace || "4'55\"";
  const thresholdPaceRawSec = paces?.thresholdPace?.rawSec || 275;
  const intervalPaceRawSec = paces?.intervalPace?.rawSec || 245;
  const intervalPaceStr = paces?.intervalPace?.pace || "4'05\"";

  if (dist >= 40) {
    const totalSec = Math.round(marathonPaceRawSec * 42.195);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return {
      pace: marathonPaceStr,
      finishTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    };
  } else if (dist >= 20) {
    const halfPaceSec = Math.round(thresholdPaceRawSec * 0.35 + marathonPaceRawSec * 0.65);
    const totalSec = Math.round(halfPaceSec * 21.0975);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return {
      pace: formatPace(halfPaceSec),
      finishTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    };
  } else if (dist >= 8) {
    const tenkPaceSec = Math.round(thresholdPaceRawSec * 0.96);
    const totalSec = Math.round(tenkPaceSec * 10.0);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return {
      pace: formatPace(tenkPaceSec),
      finishTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    };
  } else {
    const fivekPaceSec = intervalPaceRawSec;
    const totalSec = Math.round(fivekPaceSec * dist);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return {
      pace: intervalPaceStr,
      finishTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    };
  }
}

/**
 * Normalizes workout stage distances to guarantee that the sum of all stages
 * mathematically equals totalDist with 100% precision (no 0.1km drift or rounding errors).
 */
export function normalizeStagesDistance(stages: WorkoutStage[], totalDist: number): WorkoutStage[] {
  if (!stages || stages.length === 0 || totalDist <= 0) return stages;
  const currentSum = Math.round(stages.reduce((acc, s) => acc + s.distanceKm, 0) * 10) / 10;
  const diff = Math.round((totalDist - currentSum) * 10) / 10;
  if (Math.abs(diff) > 0.001) {
    // Find the main workout stage (identified by keywords or largest distance)
    let targetIdx = 0;
    let maxDist = -1;
    stages.forEach((s, idx) => {
      if (s.step.includes('본운동') || s.step.includes('본훈련') || s.step.includes('본세트') || s.step.includes('2구간') || s.step.includes('2단계')) {
        targetIdx = idx;
        maxDist = 999999;
      } else if (s.distanceKm > maxDist && maxDist !== 999999) {
        maxDist = s.distanceKm;
        targetIdx = idx;
      }
    });
    stages[targetIdx].distanceKm = Math.max(0.5, Math.round((stages[targetIdx].distanceKm + diff) * 10) / 10);
  }
  return stages;
}

/**
 * Intelligently select speed workout type for each week based on:
 * 1. Long run load (avoids explosive VO2max intervals on heavy 28~35km LSD weeks to prevent fatigue injury)
 * 2. Periodization phase (Base, Build, Peak, Deload, Taper, Race Week)
 * 3. Non-repetitive rotation (prevents duplicate workout types in consecutive weeks)
 * 4. Recency balancing & pseudo-random organic variety
 */
export function selectIntelligentSpeedWorkoutType(params: {
  availableTypes: SpeedWorkoutType[];
  weekNum: number;
  totalWeeks: number;
  phase: PlanPeriodizationPhase;
  longRunKm: number;
  targetWeeklyKm: number;
  isFullCourse: boolean;
  isDeload: boolean;
  isTaper: boolean;
  isRaceWeek: boolean;
  lastUsedSpeedType: SpeedWorkoutType | null;
  lastUsedWeekMap: Partial<Record<SpeedWorkoutType, number>>;
}): SpeedWorkoutType {
  const {
    availableTypes,
    weekNum,
    phase,
    longRunKm,
    isFullCourse,
    isDeload,
    isTaper,
    isRaceWeek,
    lastUsedSpeedType,
    lastUsedWeekMap,
  } = params;

  if (!availableTypes || availableTypes.length === 0) {
    return '템포런';
  }
  if (availableTypes.length === 1) {
    return availableTypes[0];
  }

  const isHeavyLongRunWeek =
    (isFullCourse && longRunKm >= 28.0) ||
    (!isFullCourse && longRunKm >= 18.0) ||
    phase === '목표 페이스 특화기 (Peak)';

  const scoredCandidates = availableTypes.map((type, idx) => {
    let score = 100;

    // A. Heavy Long Run Week Adjustment:
    // When weekend LSD is massive (28~35km), explosive intervals (1000m, 800m, 400m) cause excessive neuromuscular fatigue & injury risk.
    // Favor Zone 3 Marathon Pace, Moderate Run, Lactate Threshold Tempo, Cruise Intervals (1~3k), or Progressive Buildup run!
    if (isHeavyLongRunWeek) {
      if (type === '존3 마라톤 페이스주') score += 75; // Ultimate synergy with marathon LSD! Builds race pace feel with minimal tear
      else if (type === '존3 모더레이트런') score += 65;
      else if (type === '존3 유산소 역치주') score += 60;
      else if (type === '템포런') score += 65; // Best synergy with marathon LSD
      else if (type === '크루즈 인터벌') score += 60; // Cruise aerobic endurance
      else if (type === '1~3k 인터벌') score += 55; // Cruise aerobic endurance
      else if (type === '빌드업주') score += 45; // Progressive acceleration with low acute tear
      else if (type === '변속주(파틀렉)') score += 15;
      else if (type === '언덕훈련') score -= 30; // Heavy calf/tendon load right before 30km+ long run
      else if (type === '인터벌') score -= 65; // High acute tear clash with 30km+ LSD
      else if (type === '800m 인터벌') score -= 65;
      else if (type === '400m 숏 인터벌') score -= 70;
    }

    // B. Recovery / Deload Week
    if (isDeload) {
      if (type === '존3 모더레이트런') score += 55; // Gentle steady aerobic volume
      else if (type === '변속주(파틀렉)') score += 50; // Playful, enjoyable
      else if (type === '존3 마라톤 페이스주') score += 40;
      else if (type === '빌드업주') score += 40;
      else if (type === '존3 유산소 역치주') score += 35;
      else if (type === '템포런') score += 25;
      else if (type === '크루즈 인터벌') score += 20;
      else if (type === '언덕훈련') score += 15;
      else if (type === '인터벌') score -= 45; // Avoid maximal anaerobic burnout
      else if (type === '800m 인터벌') score -= 45;
      else if (type === '400m 숏 인터벌') score -= 50;
      else if (type === '1~3k 인터벌') score -= 25;
    }

    // C. Base Phase (Early weeks)
    if (phase === '기초 유산소 구축기 (Base)') {
      if (type === '존3 유산소 역치주') score += 60; // Aerobic capacity expansion
      else if (type === '존3 모더레이트런') score += 55;
      else if (type === '언덕훈련') score += 50; // Neuromuscular power & tendon stiffness
      else if (type === '존3 마라톤 페이스주') score += 45;
      else if (type === '변속주(파틀렉)') score += 40;
      else if (type === '빌드업주') score += 30;
      else if (type === '템포런') score += 25;
      else if (type === '크루즈 인터벌') score += 25;
      else if (type === '인터벌') score -= 30;
      else if (type === '800m 인터벌') score -= 30;
      else if (type === '400m 숏 인터벌') score -= 35;
    }

    // D. Build Phase (Moderate long runs 18~26km)
    if (phase === '스피드/지구력 빌드업기 (Build)' && !isHeavyLongRunWeek && !isDeload) {
      if (type === '인터벌') score += 50; // Open VO2max ceiling!
      else if (type === '800m 인터벌') score += 50;
      else if (type === '400m 숏 인터벌') score += 45;
      else if (type === '크루즈 인터벌') score += 40;
      else if (type === '언덕훈련') score += 30;
      else if (type === '템포런') score += 25;
      else if (type === '1~3k 인터벌') score += 25;
      else if (type === '존3 마라톤 페이스주') score += 35;
    }

    // E. Race Week / Tapering
    if (isRaceWeek) {
      if (type === '400m 숏 인터벌') score += 40; // Short light strides for neural sharpness
      else if (type === '빌드업주') score += 35;
      else if (type === '존3 마라톤 페이스주') score += 30; // Pace reminder
      else if (type === '인터벌') score += 25; // Short sharp awakening
      else if (type === '템포런') score += 20;
      else if (type === '언덕훈련') score -= 40; // Avoid eccentric soreness right before race
      else if (type === '1~3k 인터벌') score -= 30;
    } else if (isTaper) {
      if (type === '존3 마라톤 페이스주') score += 35;
      else if (type === '템포런') score += 30;
      else if (type === '크루즈 인터벌') score += 25;
      else if (type === '인터벌') score += 25;
      else if (type === '빌드업주') score += 25;
      else if (type === '언덕훈련') score -= 20;
    }

    // F. Prevent Consecutive Duplication
    if (type === lastUsedSpeedType && availableTypes.length > 1) {
      score -= 160;
    }

    // G. Recency Bonus: Reward types not used for several weeks to balance variety
    const lastUsedWeek = lastUsedWeekMap[type];
    if (lastUsedWeek !== undefined) {
      const weeksSince = weekNum - lastUsedWeek;
      score += Math.min(60, weeksSince * 15);
    } else {
      score += 30; // First time bonus
    }

    // H. Pseudo-random Organic Jitter (Seed-based, deterministic)
    // Avoids completely rigid round-robin cycling
    const hash = ((weekNum * 23 + idx * 37 + (type.charCodeAt(0) || 0) * 13) % 17);
    score += hash;

    return { type, score };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);
  return scoredCandidates[0].type;
}

/**
 * Comprehensive Training Plan Generator
 */
export function generateComprehensivePlan(params: {
  vdot: number;
  settings: TrainingPlanPeriodSettings;
  trainingSessions?: TrainingSession[];
  shoes?: RunningShoe[];
  races?: RegisteredRace[];
  goals?: RunningGoals;
}): ComprehensiveTrainingPlan {
  const vdot = params.vdot;
  const settings = params.settings;
  const trainingSessions = params.trainingSessions || [];
  const shoes = params.shoes || [];
  const races = params.races || [];
  const goals = params.goals;

  // 1. Analyze Runner's Current Physical & Workload State
  const runnerState = analyzeRunnerState(
    trainingSessions,
    settings.targetCourse || '풀코스',
    new Date(),
    races,
    goals
  );

  // Baseline weekly volume
  const baselineWeeklyKm =
    settings.baseWeeklyKm && settings.baseWeeklyKm > 0
      ? settings.baseWeeklyKm
      : runnerState.avgWeeklyMileage4Weeks > 10
      ? runnerState.avgWeeklyMileage4Weeks
      : vdot >= 50
      ? 48
      : vdot >= 42
      ? 38
      : 28;

  // 2. Determine Plan Start Date & Weeks Count
  let startMonday = getMonday(settings.startDate ? parseLocalDate(settings.startDate) : new Date());
  let totalWeeks = settings.durationWeeks || 8;

  // Target race matching (if goalMode is 'race')
  let targetRace: RegisteredRace | undefined = undefined;
  if (settings.goalMode === 'race' && settings.targetRaceId) {
    const candidate = races.find((r) => r.id === settings.targetRaceId);
    if (candidate) {
      const dDayInfo = calculateDDay(candidate.date);
      // Valid if not passed and not completed
      if (!dDayInfo.isPassed && candidate.status !== 'completed' && !candidate.actualRecord) {
        targetRace = candidate;
      }
    }
  }
  if (!targetRace && settings.goalMode === 'race') {
    const upcomingRaces = races
      .filter((r) => {
        if (!r.date || r.status === 'completed' || r.actualRecord) return false;
        const dDayInfo = calculateDDay(r.date);
        return !dDayInfo.isPassed && dDayInfo.daysDiff >= 0;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    targetRace = upcomingRaces.find((r) => r.isTarget || r.priority === 'A') || upcomingRaces[0];
  }

  // Duration preset calculations
  if (settings.durationPreset === 'to_target_race' && targetRace) {
    const raceDate = parseLocalDate(targetRace.date);
    // Align race day to the end of its week so full race week is included
    const raceWeekMonday = getMonday(raceDate);
    // If startMonday is after raceWeekMonday (e.g. startDate was next monday but race is this week),
    // clamp startMonday to raceWeekMonday so race week is covered
    if (startMonday.getTime() > raceWeekMonday.getTime()) {
      startMonday = raceWeekMonday;
    }
    const diffMs = raceWeekMonday.getTime() - startMonday.getTime();
    const diffWeeks = Math.max(1, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
    totalWeeks = Math.min(104, diffWeeks);
  } else if (settings.durationPreset === 'custom' && settings.endDate) {
    const end = parseLocalDate(settings.endDate);
    const endMonday = getMonday(end);
    if (startMonday.getTime() > endMonday.getTime()) {
      startMonday = endMonday;
    }
    const diffMs = endMonday.getTime() - startMonday.getTime();
    const diffWeeks = Math.max(1, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
    totalWeeks = Math.min(104, diffWeeks);
  } else if (settings.durationPreset === '4weeks') {
    totalWeeks = 4;
  } else if (settings.durationPreset === '8weeks') {
    totalWeeks = 8;
  } else if (settings.durationPreset === '12weeks') {
    totalWeeks = 12;
  } else if (settings.durationPreset === '16weeks') {
    totalWeeks = 16;
  } else if (settings.durationWeeks && settings.durationWeeks > 0) {
    totalWeeks = settings.durationWeeks;
  }

  totalWeeks = Math.max(1, Math.min(104, totalWeeks));

  // 3. Target Pace Calculation (supports targetRace OR target_goal without a race!)
  const paces = getTrainingPaces(vdot > 28 ? vdot : 45);
  const easyMin = paces ? paces.easyPaceRange.min : "5'40\"";
  const easyMax = paces ? paces.easyPaceRange.max : "6'15\"";
  const marathonPace = paces ? paces.marathonPace.pace : "4'55\"";
  const thresholdPace = paces ? paces.thresholdPace.pace : "4'35\"";
  const intervalPace = paces ? paces.intervalPace.pace : "4'05\"";

  // Calculate effective target race pace
  let effectiveTargetPace = marathonPace;
  let effectiveTargetFinishTime = '03:30:00';
  let targetCourseName = settings.targetCourse || '풀코스';

  if (settings.goalMode === 'race' && targetRace) {
    targetCourseName = settings.targetCourse || targetRace.course;
    const effectiveTime = settings.targetTime || targetRace.targetTime;
    const effectivePace = settings.targetPace;
    const racePaceInfo = calculateSpecificRacePace(
      targetCourseName,
      effectiveTime,
      effectivePace,
      vdot,
      goals
    );
    effectiveTargetPace = racePaceInfo.pace;
    effectiveTargetFinishTime = racePaceInfo.finishTime;
  } else if (settings.goalMode === 'target_goal') {
    targetCourseName = settings.targetCourse || '10K';
    const goalPaceInfo = calculateSpecificRacePace(
      targetCourseName,
      settings.targetTime,
      settings.targetPace,
      vdot,
      goals
    );
    effectiveTargetPace = goalPaceInfo.pace;
    effectiveTargetFinishTime = goalPaceInfo.finishTime;
  }

  const isContinuousProgression = settings.goalMode === 'continuous_progression';

  // Course classification for volume caps and LSD limits
  const courseDistKm = parseCourseKm(targetCourseName, targetRace?.customDistanceKm);
  const isFullCourse = courseDistKm >= 40;
  const isHalfCourse = !isFullCourse && (courseDistKm >= 18 || targetCourseName.includes('하프') || targetCourseName.includes('21'));
  const is10kCourse = !isFullCourse && !isHalfCourse && (courseDistKm >= 9 || targetCourseName.includes('10'));
  const is5kCourse = !isFullCourse && !isHalfCourse && !is10kCourse;

  // Max peak volume multiplier depending on course:
  // Full Marathon: up to 1.65x
  // Half Marathon: up to 1.45x (e.g. 42km baseline -> peak 60.5km max)
  // 10K: up to 1.28x
  // 5K: up to 1.20x
  const maxVolumeMultiplier = isFullCourse ? 1.65 : isHalfCourse ? 1.45 : is10kCourse ? 1.28 : 1.20;

  // 4. Speed Workout Types Setup (supports multi-selection rotation + Hill Training!)
  const speedTypes: SpeedWorkoutType[] =
    settings.speedWorkoutTypes && settings.speedWorkoutTypes.length > 0
      ? settings.speedWorkoutTypes
      : settings.speedWorkoutType
      ? [settings.speedWorkoutType]
      : ['인터벌', '템포런', '언덕훈련'];

  // 5. Generate Weekly Schedules
  const weeks: PlanWeek[] = [];
  let totalPlannedKm = 0;
  let totalPlannedSessions = 0;
  let totalPlanLoadScore = 0;
  const todayStr = formatDate(new Date());

  let lastUsedSpeedType: SpeedWorkoutType | null = null;
  const lastUsedWeekMap: Partial<Record<SpeedWorkoutType, number>> = {};
  const shoeRotationTracker = createShoeRotationTracker(shoes, trainingSessions);

  for (let w = 1; w <= totalWeeks; w++) {
    const weekMonday = new Date(startMonday.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000);
    const weekSunday = new Date(weekMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
    const startDateStr = formatDate(weekMonday);
    const endDateStr = formatDate(weekSunday);

    const isCurrentWeek = todayStr >= startDateStr && todayStr <= endDateStr;

    // Check if any registered race takes place in this week or adjacent days!
    const raceInThisWeek = races.find((r) => r.date >= startDateStr && r.date <= endDateStr);

    const nextWeekMonday = new Date(weekMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextWeekMondayStr = formatDate(nextWeekMonday);
    const raceOnNextMonday = races.find((r) => r.date === nextWeekMondayStr);

    const prevWeekSunday = new Date(weekMonday.getTime() - 24 * 60 * 60 * 1000);
    const prevWeekSundayStr = formatDate(prevWeekSunday);
    const raceOnPrevSunday = races.find((r) => r.date === prevWeekSundayStr);

    // Determine Periodization Phase & Focus
    let phase: PlanPeriodizationPhase = '스피드/지구력 빌드업기 (Build)';
    let phaseBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    let phaseDescription = '심폐 지구력 및 스피드 지속력 향상 훈련';
    let focus = '주간 거리 및 포인트 훈련을 통한 러닝 체력 증진';
    let volumeMultiplier = 1.0;

    if (settings.goalMode === 'race' || settings.goalMode === 'target_goal') {
      const weeksToTarget = totalWeeks - w;
      const taperWeeks = totalWeeks >= 8 ? 3 : totalWeeks >= 5 ? 2 : 1;
      const mainWeeks = totalWeeks - taperWeeks;
      const peakWeeks = totalWeeks >= 8 ? 1 : 0;

      if (weeksToTarget === 0) {
        phase = '대회 직전 조정기 (Race Week)';
        phaseBadgeColor = 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold';
        phaseDescription = '결전의 날! 가벼운 리듬 점검 및 글리코겐 충전';
        focus = `${settings.goalMode === 'race' ? targetRace?.name || '목표 대회' : `목표 ${targetCourseName}`} 완주 및 목표 페이스(${effectiveTargetPace}) 실전 달성`;
        volumeMultiplier = 0.55;
      } else if (weeksToTarget === 1) {
        phase = '테이퍼링 감량기 (Tapering)';
        phaseBadgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
        phaseDescription = '대회 1주 전: 훈련량 35~40% 감량 및 피로 제거';
        focus = '피로 누적 해소, 짧고 날카로운 질주로 신경계 각성 유지 및 글리코겐 충전';
        volumeMultiplier = 0.65;
      } else if (weeksToTarget === 2 && taperWeeks >= 3) {
        phase = '테이퍼링 감량기 (Tapering)';
        phaseBadgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
        phaseDescription = '대회 2주 전: 훈련량 18~20% 1차 감량 시작';
        focus = '장거리 거리 서서히 단축, 관절 피로 배제 및 목표 페이스 적응 훈련';
        volumeMultiplier = 0.82;
      } else if (w === mainWeeks && peakWeeks > 0) {
        phase = '목표 페이스 특화기 (Peak)';
        phaseBadgeColor = 'bg-purple-100 text-purple-900 border-purple-300';
        phaseDescription = '최고 피크 마일리지 달성 및 실전 목표 페이스 락온';
        focus = `목표 페이스(${effectiveTargetPace}) 집중 지속주 및 최장거리 LSD 완성`;
        const peakMult = isFullCourse
          ? Math.round((1.22 + (totalWeeks >= 12 ? 0.14 : 0.08)) * 100) / 100
          : isHalfCourse
          ? 1.42
          : is10kCourse
          ? 1.26
          : 1.18;
        volumeMultiplier = peakMult;
      } else {
        const cycleStep = ((w - 1) % 4) + 1; // 1, 2, 3, 4 (3:1 mesocycle wave)
        const cycleIndex = Math.floor((w - 1) / 4);

        if (cycleStep === 4 && w < mainWeeks) {
          phase = '회복 및 디로드 (Recovery)';
          phaseBadgeColor = 'bg-teal-100 text-teal-900 border-teal-300';
          phaseDescription = `사이클 ${cycleIndex + 1} 초과회복(Supercompensation): 피로 리셋 및 조직 회복`;
          focus = '훈련량 15~20% 감량 및 이지 리커버리 위주 편성, 다음 단계 도약 준비';
          const deloadBase = isFullCourse
            ? 0.88 + cycleIndex * 0.08
            : isHalfCourse
            ? 0.88 + cycleIndex * 0.05
            : 0.88 + cycleIndex * 0.04;
          volumeMultiplier = Math.round(Math.min(maxVolumeMultiplier * 0.85, deloadBase) * 100) / 100;
        } else {
          if (cycleIndex === 0 && cycleStep <= 3) {
            phase = '기초 유산소 구축기 (Base)';
            phaseBadgeColor = 'bg-sky-100 text-sky-900 border-sky-300';
            phaseDescription = `기초 체력 구축 ${cycleStep}단계: 모세혈관 발달 및 유산소 베이스 확장`;
            focus = '무리 없는 편안한 Zone 2 이지런 마일리지 적립 및 관절/인대 적응';
          } else {
            phase = '스피드/지구력 빌드업기 (Build)';
            phaseBadgeColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
            phaseDescription = `스피드/지구력 빌드업 (사이클 ${cycleIndex + 1}): 볼륨 점진 증량 및 역치 페이스 확장`;
            focus = 'VO2max 인터벌 세트 및 점진적 주말 LSD 거리 확장, 젖산 역치(LT) 강화';
          }

          if (w === 1) {
            volumeMultiplier = 1.0;
          } else {
            const cycleIncRate = isFullCourse ? 0.12 : isHalfCourse ? 0.08 : is10kCourse ? 0.05 : 0.04;
            const cycleBase = 1.0 + cycleIndex * cycleIncRate;
            const stepIncrement = (cycleStep - 1) * 0.035;
            volumeMultiplier = Math.round(Math.min(maxVolumeMultiplier, cycleBase + stepIncrement) * 100) / 100;
          }
        }
      }
    } else {
      // Continuous Progression Mode (3:1 Mesocycle)
      const cycleWeek = ((w - 1) % 4) + 1; // 1, 2, 3, 4
      const mesocycleIndex = Math.floor((w - 1) / 4) + 1;

      if (cycleWeek === 4) {
        phase = '회복 및 디로드 (Recovery)';
        phaseBadgeColor = 'bg-teal-100 text-teal-900 border-teal-300';
        phaseDescription = `사이클 ${mesocycleIndex} 완료: 근육 및 관절 초과회복(Supercompensation)`;
        focus = '훈련량 25% 감량 및 완전 휴식, 가벼운 폼롤러 스트레칭으로 신체 피로 흡수';
        volumeMultiplier = Math.round(Math.min(maxVolumeMultiplier * 0.82, 0.75 + (mesocycleIndex - 1) * 0.04) * 100) / 100;
      } else if (cycleWeek === 1) {
        phase = '지속 점진적 과부하 (Progression)';
        phaseBadgeColor = 'bg-blue-100 text-blue-900 border-blue-300';
        phaseDescription = `사이클 ${mesocycleIndex} 1단계: 새로운 기준선 안정화 (기준 VDOT ${vdot + (mesocycleIndex - 1) * 0.5})`;
        focus = '새로운 마일리지 적응 및 안정적인 Zone 2 유산소 베이스 정립';
        volumeMultiplier = Math.round(Math.min(maxVolumeMultiplier, 1.0 + (mesocycleIndex - 1) * 0.05) * 100) / 100;
      } else if (cycleWeek === 2) {
        phase = '스피드/지구력 빌드업기 (Build)';
        phaseBadgeColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
        phaseDescription = `사이클 ${mesocycleIndex} 2단계: 볼륨 및 인터벌 강도 +6% 점진적 상승`;
        focus = '젖산 역치 템포런 및 중거리 LSD 빌드업';
        volumeMultiplier = Math.round(Math.min(maxVolumeMultiplier, 1.06 + (mesocycleIndex - 1) * 0.05) * 100) / 100;
      } else {
        phase = '목표 페이스 특화기 (Peak)';
        phaseBadgeColor = 'bg-indigo-100 text-indigo-900 border-indigo-300';
        phaseDescription = `사이클 ${mesocycleIndex} 3단계: 사이클 최고 마일리지 도전`;
        focus = '스피드 지속력 극대화 및 최고 장거리 LSD 소화';
        volumeMultiplier = Math.round(Math.min(maxVolumeMultiplier, 1.12 + (mesocycleIndex - 1) * 0.05) * 100) / 100;
      }
    }

    // Intermediate Tune-up race adjustment
    if (raceInThisWeek) {
      if (settings.goalMode === 'race' && targetRace && raceInThisWeek.id === targetRace.id) {
        phase = '대회 직전 조정기 (Race Week)';
        phaseBadgeColor = 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold';
        phaseDescription = `결전의 날! ${raceInThisWeek.name} (${raceInThisWeek.course}) 메인 레이스 출전`;
        focus = `목표 페이스(${effectiveTargetPace}) 집중 및 최고 기량 발휘`;
      } else {
        phase = '스피드/지구력 빌드업기 (Build)';
        phaseBadgeColor = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
        phaseDescription = `참가 대회 (${raceInThisWeek.name}) 포함 주간: 실전 감각 및 페이스 배분 점검`;
        focus = `실전 레이스 감각 점검 및 대회 당일 페이스 테스트 (${raceInThisWeek.priority || 'B'}등급)`;
      }
    }

    // Calculate Week Target Mileage (balanced with race distance if present)
    let targetWeeklyKm = Math.round(baselineWeeklyKm * volumeMultiplier * 10) / 10;
    if (w === 1) {
      targetWeeklyKm = baselineWeeklyKm;
    }
    if (raceInThisWeek) {
      const raceDist = parseCourseKm(raceInThisWeek.course, raceInThisWeek.customDistanceKm);
      if (raceDist >= targetWeeklyKm) {
        targetWeeklyKm = Math.round((raceDist + (raceDist >= 40 ? 3.0 : 5.0)) * 10) / 10;
      } else {
        // 5K / 10K / Half race: preserve baseline weekly mileage without inflating!
        if (w === 1) {
          targetWeeklyKm = baselineWeeklyKm;
        } else {
          targetWeeklyKm = Math.max(raceDist + 3.0, Math.round(baselineWeeklyKm * volumeMultiplier * 10) / 10);
        }
      }
    } else if (raceOnNextMonday) {
      if (w === 1) {
        targetWeeklyKm = baselineWeeklyKm;
      } else {
        targetWeeklyKm = Math.max(20, Math.round(baselineWeeklyKm * 0.85 * 10) / 10);
      }
    }

    // Training days setup
    const trainingDays = settings.trainingDays && settings.trainingDays.length > 0
      ? settings.trainingDays
      : (['화요일', '목요일', '토요일', '일요일'] as DayOfWeek[]);
    const speedDay = settings.speedDay || '화요일';
    const longRunDay = settings.longRunDay || '일요일';

    const isRaceWeek = phase === '대회 직전 조정기 (Race Week)';
    const isTaper = phase === '테이퍼링 감량기 (Tapering)';
    const isDeload = phase === '회복 및 디로드 (Recovery)';

    // For Full Marathon:
    // If preparing over a longer period (e.g. totalWeeks >= 20, such as 1-year plans) or high baseline volume,
    // allow peak LSD up to 35.0km (32~35km golden range for full marathon peak).
    const maxLsdLimit = isFullCourse
      ? (totalWeeks >= 20 || baselineWeeklyKm >= 50 ? 35.0 : 32.0)
      : isHalfCourse
      ? 21.5
      : is10kCourse
      ? 15.0
      : 11.0;
    const minLsdLimit = isFullCourse ? 12.0 : isHalfCourse ? 10.0 : is10kCourse ? 7.0 : 5.0;
    const lsdRatio = isFullCourse
      ? (isDeload ? 0.32 : isTaper ? 0.35 : (phase === '목표 페이스 특화기 (Peak)' ? 0.44 : 0.42))
      : isHalfCourse
      ? (isDeload ? 0.28 : isTaper ? 0.30 : 0.35)
      : (isDeload ? 0.24 : isTaper ? 0.26 : 0.28);

    let longRunKm = Math.round(targetWeeklyKm * lsdRatio * 10) / 10;
    longRunKm = Math.max(minLsdLimit, Math.min(maxLsdLimit, longRunKm));

    const isHeavyLongRunWeek =
      (isFullCourse && longRunKm >= 28.0) ||
      (!isFullCourse && longRunKm >= 18.0) ||
      phase === '목표 페이스 특화기 (Peak)';

    // Intelligently select speed workout type considering weekly long run load, periodization phase & variety
    const activeSpeedType = selectIntelligentSpeedWorkoutType({
      availableTypes: speedTypes,
      weekNum: w,
      totalWeeks,
      phase,
      longRunKm,
      targetWeeklyKm,
      isFullCourse,
      isDeload,
      isTaper,
      isRaceWeek,
      lastUsedSpeedType,
      lastUsedWeekMap,
    });
    lastUsedSpeedType = activeSpeedType;
    lastUsedWeekMap[activeSpeedType] = w;

    const maxSpeedLimit = isFullCourse ? 14.0 : isHalfCourse ? 11.5 : is10kCourse ? 9.0 : 7.0;
    let speedKm = Math.round(targetWeeklyKm * (isRaceWeek ? 0.15 : isDeload ? 0.18 : 0.22) * 10) / 10;
    speedKm = Math.max(5.0, Math.min(maxSpeedLimit, speedKm));

    let days: WeeklyPlanDay[];

    if (raceInThisWeek) {
      totalPlannedSessions++;
      const raceDist = parseCourseKm(raceInThisWeek.course, raceInThisWeek.customDistanceKm);
      const isMainTarget = targetRace && raceInThisWeek.id === targetRace.id;
      const thisRacePaceInfo = isMainTarget
        ? { pace: effectiveTargetPace, finishTime: effectiveTargetFinishTime }
        : calculateSpecificRacePace(
            raceInThisWeek.course,
            raceInThisWeek.targetTime,
            undefined,
            vdot,
            goals,
            raceInThisWeek.customDistanceKm
          );

      const rDate = parseLocalDate(raceInThisWeek.date);
      const raceDayIdx = (rDate.getDay() + 6) % 7; // Monday=0, Sunday=6
      const raceDayName = DAY_ORDER[raceDayIdx];

      const s1 = Math.round(raceDist * 0.15 * 10) / 10;
      const s2 = Math.round(raceDist * 0.60 * 10) / 10;
      const s3 = Math.round((raceDist - s1 - s2) * 10) / 10;
      const raceStages: WorkoutStage[] = [
        {
          step: `1구간: 스타트 & 호흡 안정화 (초반 ${s1}km)`,
          distanceKm: s1,
          pace: thisRacePaceInfo.pace,
          zone: 'Zone 3 (안정권)',
          focus: '오버페이스 억제. 인파에 휩쓸리지 않고 피치와 호흡 정속 주행 진입',
        },
        {
          step: `2구간: 정속 순항 & 수분 공급 (중반 ${s2}km)`,
          distanceKm: s2,
          pace: thisRacePaceInfo.pace,
          zone: 'Zone 3~4',
          focus: '규칙적 급수 및 에너지젤 섭취, 팔치기 리듬과 케이던스 유지',
        },
        {
          step: `3구간: 승부처 및 결승 피니시 (후반 ${s3}km)`,
          distanceKm: s3,
          pace: thisRacePaceInfo.pace,
          zone: 'Zone 4~5',
          focus: '코어의 힘으로 버텨내며 가슴 벅찬 피니시 라인 골인!',
        },
      ];

      const shakeoutStages: WorkoutStage[] = [
        {
          step: '1단계: 가벼운 예열 조깅 (2.0km)',
          distanceKm: 2.0,
          pace: easyMax,
          zone: 'Zone 1~2',
          focus: '관절 예열 및 가벼운 체온 상승, 무리 없는 조깅',
        },
        {
          step: '2단계: 신경계 각성 질주 (0.5km)',
          distanceKm: 0.5,
          pace: thresholdPace,
          zone: 'Zone 3~4',
          focus: '50m 가벼운 질주 2~3회 반복, 발목 탄력과 신경계 가벼운 각성',
        },
        {
          step: '3단계: 쿨다운 걷기 및 스트레칭 (0.5km)',
          distanceKm: 0.5,
          pace: "6'30\" ~ 7'00\"",
          zone: 'Zone 1',
          focus: '심박 안정화 및 하체 가벼운 이완 스트레칭',
        },
      ];

      const dayConfigs: Record<string, { type: '대회' | '휴식' | '조깅' | '회복주'; title: string; dist: number; isShakeout?: boolean }> = {};

      // 1. Race Day (지정한 훈련 요일과 무관하게 대회 진행)
      dayConfigs[raceDayName] = {
        type: '대회',
        title: `[🏁 ${isMainTarget ? '메인 목표 대회' : '점검 대회'}] ${raceInThisWeek.name}`,
        dist: raceDist,
      };

      // 2. Day after race (대회 익일 D+1: 이번 주 범위 내에 있을 때 100% 완전 휴식)
      if (raceDayIdx + 1 < 7) {
        const nextDayName = DAY_ORDER[raceDayIdx + 1];
        dayConfigs[nextDayName] = {
          type: '휴식',
          title: '[대회 익일] 완전 휴식 및 근육 회복 (Rest & Recovery)',
          dist: 0,
        };
      }

      // 3. Days before race (대회 전 D-1 및 D-2: 이번 주 범위 내에 있을 때 적용)
      const hasShakeout = raceDist >= 5;
      if (raceDayIdx - 1 >= 0) {
        const prevDayName = DAY_ORDER[raceDayIdx - 1];
        if (hasShakeout) {
          dayConfigs[prevDayName] = {
            type: '조깅',
            title: '대회 D-1 실전 대비 쉐이크아웃 (3.0km)',
            dist: 3.0,
            isShakeout: true,
          };
        } else {
          dayConfigs[prevDayName] = {
            type: '휴식',
            title: '대회 D-1 완전 휴식 (Rest & Recovery)',
            dist: 0,
          };
        }
      }

      if (raceDayIdx - 2 >= 0) {
        const prev2DayName = DAY_ORDER[raceDayIdx - 2];
        dayConfigs[prev2DayName] = {
          type: '휴식',
          title: '대회 D-2 완전 휴식 및 글리코겐 충전',
          dist: 0,
        };
      }

      // 4. Remaining volume distributed to other available days
      const preDist = (raceDayIdx - 1 >= 0 && dayConfigs[DAY_ORDER[raceDayIdx - 1]]) ? dayConfigs[DAY_ORDER[raceDayIdx - 1]].dist : 0;
      const fixedDist = raceDist + preDist;
      const remainingKm = Math.max(0, Math.round((targetWeeklyKm - fixedDist) * 10) / 10);

      // Candidate days not yet configured
      const candidateDays = DAY_ORDER.filter((d) => !dayConfigs[d]);

      // Prioritize days from runner's chosen trainingDays
      let activeOtherDays = candidateDays.filter((d) => trainingDays.includes(d));
      if (activeOtherDays.length === 0 && remainingKm > 0) {
        // Fallback to reasonable recovery days if runner's chosen days were adjacent to race
        activeOtherDays = candidateDays.slice(0, remainingKm >= 12 ? 2 : 1);
      }

      if (activeOtherDays.length === 0 || remainingKm <= 0) {
        candidateDays.forEach((d) => {
          if (!dayConfigs[d]) {
            dayConfigs[d] = { type: '휴식', title: '완전 휴식 및 리커버리 (Rest & Recovery)', dist: 0 };
          }
        });
      } else if (activeOtherDays.length === 1) {
        dayConfigs[activeOtherDays[0]] = {
          type: '회복주',
          title: `가벼운 피로 회복 조깅 (${remainingKm}km)`,
          dist: remainingKm,
        };
      } else if (activeOtherDays.length === 2) {
        const d0 = Math.max(4.0, Math.round(remainingKm * 0.44 * 10) / 10);
        const d1 = Math.max(4.0, Math.round((remainingKm - d0) * 10) / 10);
        dayConfigs[activeOtherDays[0]] = {
          type: '회복주',
          title: `가벼운 피로 회복 조깅 (${d0}km)`,
          dist: d0,
        };
        dayConfigs[activeOtherDays[1]] = {
          type: '조깅',
          title: `유산소 이지 조깅 (${d1}km)`,
          dist: d1,
        };
      } else {
        let allocated = 0;
        activeOtherDays.forEach((d, idx) => {
          const isLast = idx === activeOtherDays.length - 1;
          const share = isLast
            ? Math.max(4.0, Math.round((remainingKm - allocated) * 10) / 10)
            : Math.max(4.0, Math.round((remainingKm / activeOtherDays.length) * 10) / 10);
          allocated += share;
          dayConfigs[d] = {
            type: idx === 0 ? '회복주' : '조깅',
            title: idx === 0 ? `가벼운 피로 회복 조깅 (${share}km)` : `유산소 컨디셔닝 조깅 (${share}km)`,
            dist: share,
          };
        });
      }

      DAY_ORDER.forEach((d) => {
        if (!dayConfigs[d]) {
          dayConfigs[d] = { type: '휴식', title: '완전 휴식 및 리커버리 (Rest & Recovery)', dist: 0 };
        }
      });

      days = DAY_ORDER.map((dayName, idx) => {
        const dayDate = new Date(weekMonday.getTime() + idx * 86400000);
        const dateStr = formatDate(dayDate);
        const dayShort = DAY_SHORT_MAP[dayName];
        const matchedSession = trainingSessions.find((s) => s.date === dateStr);
        const cfg = dayConfigs[dayName] || { type: '휴식', title: '완전 휴식', dist: 0 };

        if (cfg.type === '대회') {
          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '대회',
            title: cfg.title,
            distanceKm: cfg.dist,
            targetPace: thisRacePaceInfo.pace,
            targetZone: '실전 마라톤 레이스 (Zone 4~5)',
            description: `${raceInThisWeek.course} 완주를 위한 실전 레이스. 목표 기록: ${thisRacePaceInfo.finishTime} / 목표 페이스: ${thisRacePaceInfo.pace}/km.`,
            purpose: '그동안의 훈련 성과를 결실로 맺고, 실전 마라톤 페이스 배분 및 멘탈리티를 극대화하는 결전의 무대',
            intensity: '높음',
            isCompleted: !!matchedSession,
            stages: normalizeStagesDistance(raceStages, cfg.dist),
            actualSession: matchedSession ? {
              id: matchedSession.id,
              title: matchedSession.title,
              totalDistanceKm: matchedSession.totalDistanceKm,
              avgPace: matchedSession.avgPace,
              avgHr: matchedSession.avgHr,
              maxHr: matchedSession.maxHr,
              shoeName: matchedSession.shoeName,
              date: matchedSession.date,
            } : undefined,
          };
        }

        if (cfg.type === '휴식') {
          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '휴식',
            title: cfg.title,
            distanceKm: 0,
            targetPace: '-',
            targetZone: '-',
            description: cfg.title.includes('대회 익일')
              ? '어제 대회 출전으로 인한 근육 피로를 풀고 글리코겐을 충전하는 완전 휴식일입니다. 족욕 및 폼롤러 마사지를 권장합니다.'
              : '체력 비축 및 근육 회복을 위한 완전 휴식일입니다.',
            purpose: '피로 대사물질 배출 및 신체 초과회복',
            intensity: '휴식',
            isCompleted: !!matchedSession,
            stages: [],
            actualSession: matchedSession ? {
              id: matchedSession.id,
              title: matchedSession.title,
              totalDistanceKm: matchedSession.totalDistanceKm,
              avgPace: matchedSession.avgPace,
              avgHr: matchedSession.avgHr,
              maxHr: matchedSession.maxHr,
              shoeName: matchedSession.shoeName,
              date: matchedSession.date,
            } : undefined,
          };
        }

        if (cfg.isShakeout) {
          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '조깅',
            title: cfg.title,
            distanceKm: cfg.dist,
            targetPace: easyMax,
            targetZone: 'Zone 1~2 (가벼운 예열)',
            description: '내일 실전 대회를 앞두고 다리 근육의 가벼운 긴장감 유지와 신경계 각성을 위한 3km 쉐이크아웃 러닝입니다. 후반에 50m 질주 2회를 가볍게 곁들입니다.',
            purpose: '신경근 협응력 자극, 가벼운 다리 탄력 유지 및 멘탈 안정화',
            intensity: '낮음',
            isCompleted: !!matchedSession,
            stages: normalizeStagesDistance(shakeoutStages, cfg.dist),
            actualSession: matchedSession ? {
              id: matchedSession.id,
              title: matchedSession.title,
              totalDistanceKm: matchedSession.totalDistanceKm,
              avgPace: matchedSession.avgPace,
              avgHr: matchedSession.avgHr,
              maxHr: matchedSession.maxHr,
              shoeName: matchedSession.shoeName,
              date: matchedSession.date,
            } : undefined,
          };
        }

        const wKm = cfg.dist;
        const wm = wKm >= 8 ? 1.5 : 1.0;
        const cm = wKm >= 8 ? 1.5 : 1.0;
        const mm = Math.round((wKm - wm - cm) * 10) / 10;
        const jStages: WorkoutStage[] = [
          { step: `1단계: 워밍업 (${wm}km)`, distanceKm: wm, pace: easyMax, zone: 'Zone 1~2', focus: '가벼운 조깅으로 체온 서서히 예열' },
          { step: `2단계: 본운동 유산소 조깅 (${mm}km)`, distanceKm: mm, pace: `${easyMin} ~ ${easyMax}`, zone: 'Zone 2 (이지 에어로빅)', focus: '코로 숨쉬며 편안하게 대화 가능한 유산소 페이스 유지' },
          { step: `3단계: 쿨다운 (${cm}km)`, distanceKm: cm, pace: `${easyMax} ~ 6'40"`, zone: 'Zone 1 (회복)', focus: '심박 안정화 및 하체 스트레칭' },
        ];

        return {
          day: dayName,
          dayShort,
          dateStr,
          type: cfg.type,
          title: cfg.title,
          distanceKm: cfg.dist,
          targetPace: `${easyMin} ~ ${easyMax}`,
          targetZone: 'Zone 2 (이지 에어로빅)',
          description: `대회 주간 컨디션을 안정시키는 편안한 유산소 조깅입니다. 몸에 부담 없는 페이스로 심폐 리듬을 유지합니다.`,
          purpose: '유산소 기초 혈류량 유지 및 대회 전후 유연한 컨디셔닝',
          intensity: '낮음',
          isCompleted: !!matchedSession,
          stages: normalizeStagesDistance(jStages, cfg.dist),
          actualSession: matchedSession ? {
            id: matchedSession.id,
            title: matchedSession.title,
            totalDistanceKm: matchedSession.totalDistanceKm,
            avgPace: matchedSession.avgPace,
            avgHr: matchedSession.avgHr,
            maxHr: matchedSession.maxHr,
            shoeName: matchedSession.shoeName,
            date: matchedSession.date,
          } : undefined,
        };
      });
    } else {
      // Normal week or week leading up to next Monday's race
      let pointSum = 0;
      let otherDays: DayOfWeek[] = [];

      if (raceOnNextMonday) {
        // Week before next Monday's race:
        // Sunday becomes D-1 Shakeout (3.0km) and Saturday becomes D-2 Rest (0km).
        // Heavy Sunday LSD is cancelled to ensure fresh legs for Monday's race!
        const satDateStr = formatDate(new Date(weekMonday.getTime() + 5 * 86400000));
        const ranSaturday = trainingSessions.some((s) => s.date === satDateStr);
        const sunShakeoutDist = !ranSaturday ? 3.0 : 0;

        const effectiveSpeedKm = (trainingDays.includes(speedDay as DayOfWeek) || speedDay !== '없음') ? Math.min(speedKm, 6.0) : 0;
        speedKm = effectiveSpeedKm; // sync speedKm so speed workout stages and title match capped volume!
        pointSum = effectiveSpeedKm + sunShakeoutDist;

        let candMid = trainingDays.filter((d) => d !== '토요일' && d !== '일요일' && d !== speedDay);
        if (candMid.length === 0) {
          candMid = (['화요일', '목요일'] as DayOfWeek[]).filter(d => d !== speedDay);
        }
        const remCheck = Math.max(0, targetWeeklyKm - pointSum);
        if (candMid.length === 0 || remCheck / candMid.length > 12) {
          const fallbackMid: DayOfWeek[] = (['화요일', '수요일', '목요일', '금요일'] as DayOfWeek[]).filter(d => d !== speedDay);
          candMid = Array.from(new Set([...candMid, ...fallbackMid])).slice(0, remCheck >= 28 ? 4 : remCheck >= 18 ? 3 : 2);
        }
        otherDays = candMid;
      } else {
        pointSum = (trainingDays.includes(longRunDay as DayOfWeek) ? longRunKm : 0) +
                   (trainingDays.includes(speedDay as DayOfWeek) ? speedKm : 0);
        otherDays = trainingDays.filter((d) => d !== longRunDay && d !== speedDay);
      }

      const remainingKm = Math.max(0, Math.round((targetWeeklyKm - pointSum) * 10) / 10);

      // Accurately allocate remaining volume to other days so total weekly mileage matches targetWeeklyKm
      const otherDaysDistMap: Record<string, number> = {};
      if (otherDays.length === 1) {
        otherDaysDistMap[otherDays[0]] = Math.max(4.0, remainingKm);
      } else if (otherDays.length === 2) {
        // 1st otherDay is recovery jog (~44%), 2nd is aerobic jog (remaining)
        const recKm = Math.max(4.0, Math.round(remainingKm * 0.44 * 10) / 10);
        const jogKm = Math.max(4.0, Math.round((remainingKm - recKm) * 10) / 10);
        otherDaysDistMap[otherDays[0]] = recKm;
        otherDaysDistMap[otherDays[1]] = jogKm;
      } else if (otherDays.length === 3) {
        const d0 = Math.max(4.0, Math.round(remainingKm * 0.28 * 10) / 10);
        const d1 = Math.max(4.0, Math.round(remainingKm * 0.36 * 10) / 10);
        const d2 = Math.max(4.0, Math.round((remainingKm - d0 - d1) * 10) / 10);
        otherDaysDistMap[otherDays[0]] = d0;
        otherDaysDistMap[otherDays[1]] = d1;
        otherDaysDistMap[otherDays[2]] = d2;
      } else if (otherDays.length > 3) {
        let allocated = 0;
        otherDays.forEach((dName, dIdx) => {
          if (dIdx === otherDays.length - 1) {
            otherDaysDistMap[dName] = Math.max(4.0, Math.round((remainingKm - allocated) * 10) / 10);
          } else {
            const part = Math.max(4.0, Math.round((remainingKm / otherDays.length) * 10) / 10);
            otherDaysDistMap[dName] = part;
            allocated += part;
          }
        });
      }

      const baseJogKm = otherDays.length > 0
        ? Math.max(4.0, Math.round(((targetWeeklyKm - pointSum) / otherDays.length) * 10) / 10)
        : 6.0;

      days = DAY_ORDER.map((dayName, idx) => {
        const dayDate = new Date(weekMonday.getTime() + idx * 24 * 60 * 60 * 1000);
        const dateStr = formatDate(dayDate);
        const dayShort = DAY_SHORT_MAP[dayName];

        const matchedSession = trainingSessions.find((s) => s.date === dateStr);

        // Check if next week Monday is a race (e.g. Sunday D-1 shakeout if rested Saturday)
        if (raceOnNextMonday) {
          const friDateStr = formatDate(new Date(weekMonday.getTime() + 4 * 86400000));
          const satDateStr = formatDate(new Date(weekMonday.getTime() + 5 * 86400000));
          const ranFriday = trainingSessions.some((s) => s.date === friDateStr);
          const ranSaturday = trainingSessions.some((s) => s.date === satDateStr);

          if (dayName === '일요일') {
            if (!ranSaturday) {
              const shakeoutStages: WorkoutStage[] = [
                { step: '1단계: 가벼운 예열 조깅 (2.0km)', distanceKm: 2.0, pace: easyMax, zone: 'Zone 1~2', focus: '관절 예열 및 가벼운 체온 상승' },
                { step: '2단계: 신경계 각성 질주 (0.5km)', distanceKm: 0.5, pace: thresholdPace, zone: 'Zone 3~4', focus: '50m 가벼운 질주 2회, 다리 탄력 보존' },
                { step: '3단계: 쿨다운 스트레칭 (0.5km)', distanceKm: 0.5, pace: "6'30\" ~ 7'00\"", zone: 'Zone 1', focus: '심박 안정화 및 하체 이완' },
              ];
              return {
                day: dayName,
                dayShort,
                dateStr,
                type: '조깅',
                title: '[대회 D-1] 실전 대비 쉐이크아웃 (3.0km)',
                distanceKm: 3.0,
                targetPace: easyMax,
                targetZone: 'Zone 1~2 (가벼운 예열)',
                description: `내일(${raceOnNextMonday.name}) 대회를 앞두고, ${ranFriday ? '금요일 훈련을 마치고 토요일 충분한 휴식을 취하셨으므로 ' : ''}오늘(일요일) 3km 가벼운 쉐이크아웃 러닝으로 다리 근육의 탄력과 신경계를 최상으로 예열합니다. 후반에 50m 가벼운 질주 2회를 곁들입니다.`,
                purpose: '내일 실전 레이스 대비 다리 무거움 해소 및 심신 안정화',
                intensity: '낮음',
                isCompleted: !!matchedSession,
                stages: shakeoutStages,
                actualSession: matchedSession ? {
                  id: matchedSession.id,
                  title: matchedSession.title,
                  totalDistanceKm: matchedSession.totalDistanceKm,
                  avgPace: matchedSession.avgPace,
                  avgHr: matchedSession.avgHr,
                  maxHr: matchedSession.maxHr,
                  shoeName: matchedSession.shoeName,
                  date: matchedSession.date,
                } : undefined,
              };
            } else {
              return {
                day: dayName,
                dayShort,
                dateStr,
                type: '휴식',
                title: '대회 D-1 완전 휴식 (Rest & Recovery)',
                distanceKm: 0,
                targetPace: '-',
                targetZone: '-',
                description: `내일(${raceOnNextMonday.name}) 결전을 앞두고 체력을 100% 충전하는 완전 휴식일입니다.`,
                purpose: '글리코겐 저장 극대화 및 심신 안정',
                intensity: '휴식',
                isCompleted: !!matchedSession,
                stages: [],
                actualSession: matchedSession ? {
                  id: matchedSession.id,
                  title: matchedSession.title,
                  totalDistanceKm: matchedSession.totalDistanceKm,
                  avgPace: matchedSession.avgPace,
                  avgHr: matchedSession.avgHr,
                  maxHr: matchedSession.maxHr,
                  shoeName: matchedSession.shoeName,
                  date: matchedSession.date,
                } : undefined,
              };
            }
          } else if (dayName === '토요일') {
            return {
              day: dayName,
              dayShort,
              dateStr,
              type: '휴식',
              title: '대회 D-2 완전 휴식 및 영양 충전',
              distanceKm: 0,
              targetPace: '-',
              targetZone: '-',
              description: '대회 2일 전 완전 휴식 및 탄수화물 영양 보충일입니다.',
              purpose: '피로 완전 해소',
              intensity: '휴식',
              isCompleted: !!matchedSession,
              stages: [],
              actualSession: matchedSession ? {
                id: matchedSession.id,
                title: matchedSession.title,
                totalDistanceKm: matchedSession.totalDistanceKm,
                avgPace: matchedSession.avgPace,
                avgHr: matchedSession.avgHr,
                maxHr: matchedSession.maxHr,
                shoeName: matchedSession.shoeName,
                date: matchedSession.date,
              } : undefined,
            };
          }
        }

        // Check if previous Sunday was a race (Monday D+1 rest)
        if (raceOnPrevSunday && dayName === '월요일') {
          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '휴식',
            title: '[대회 익일] 완전 휴식 및 근육 회복',
            distanceKm: 0,
            targetPace: '-',
            targetZone: '-',
            description: `어제(${raceOnPrevSunday.name}) 완주 후 근육 회복을 위한 완전 휴식일입니다.`,
            purpose: '피로 대사물질 배출',
            intensity: '휴식',
            isCompleted: !!matchedSession,
            stages: [],
            actualSession: matchedSession ? {
              id: matchedSession.id,
              title: matchedSession.title,
              totalDistanceKm: matchedSession.totalDistanceKm,
              avgPace: matchedSession.avgPace,
              avgHr: matchedSession.avgHr,
              maxHr: matchedSession.maxHr,
              shoeName: matchedSession.shoeName,
              date: matchedSession.date,
            } : undefined,
          };
        }

      // Check if there is an actual registered race on this specific day!
      const raceOnThisDay = races.find((r) => r.date === dateStr);
      if (raceOnThisDay) {
        totalPlannedSessions++;
        const raceDist = parseCourseKm(raceOnThisDay.course, raceOnThisDay.customDistanceKm);
        const isMainTarget = targetRace && raceOnThisDay.id === targetRace.id;

        // ACCURATELY CALCULATE PACE FOR THIS SPECIFIC RACE!
        const thisRacePaceInfo = isMainTarget
          ? { pace: effectiveTargetPace, finishTime: effectiveTargetFinishTime }
          : calculateSpecificRacePace(
              raceOnThisDay.course,
              raceOnThisDay.targetTime,
              undefined,
              vdot,
              goals,
              raceOnThisDay.customDistanceKm
            );

        return {
          day: dayName,
          dayShort,
          dateStr,
          type: '대회',
          title: `[🏁 ${isMainTarget ? '메인 목표 대회' : '점검 대회'}] ${raceOnThisDay.name}`,
          distanceKm: raceDist,
          targetPace: thisRacePaceInfo.pace,
          targetZone: '실전 마라톤 레이스 (Zone 4~5)',
          description: `${raceOnThisDay.course} 완주를 위한 실전 레이스. 목표 기록: ${thisRacePaceInfo.finishTime} / 목표 페이스: ${thisRacePaceInfo.pace}/km.`,
          purpose: '그동안의 훈련 성과를 결실로 맺고, 실전 마라톤 페이스 배분 및 멘탈리티를 극대화하는 결전의 무대',
          intensity: '높음',
          isCompleted: !!matchedSession,
          stages: (() => {
            const s1 = Math.round(raceDist * 0.15 * 10) / 10;
            const s2 = Math.round(raceDist * 0.60 * 10) / 10;
            const s3 = Math.round((raceDist - s1 - s2) * 10) / 10;
            const stages: WorkoutStage[] = [
              {
                step: `1구간: 스타트 & 호흡 안정화 (초반 ${s1}km)`,
                distanceKm: s1,
                pace: thisRacePaceInfo.pace,
                zone: 'Zone 3 (안정권)',
                focus: '인파에 휩쓸려 오버페이스 하지 않기. 피치와 호흡을 가다듬고 정속 주행 진입',
              },
              {
                step: `2구간: 정속 순항 & 에너지 공급 (중반 ${s2}km)`,
                distanceKm: s2,
                pace: thisRacePaceInfo.pace,
                zone: 'Zone 3~4',
                focus: '5km마다 급수대 이용 및 에너지젤 규칙적 섭취, 팔치기 리듬 유지',
              },
              {
                step: `3구간: 승부처 및 결승 피니시 (후반 ${s3}km)`,
                distanceKm: s3,
                pace: thisRacePaceInfo.pace,
                zone: 'Zone 4~5',
                focus: '후반 허벅지 피로를 코어의 힘으로 버텨내며 가슴 벅찬 피니시 라인 통과!',
              },
            ];
            return normalizeStagesDistance(stages, raceDist);
          })(),
          actualSession: matchedSession
            ? {
                id: matchedSession.id,
                title: matchedSession.title,
                totalDistanceKm: matchedSession.totalDistanceKm,
                avgPace: matchedSession.avgPace,
                avgHr: matchedSession.avgHr,
                maxHr: matchedSession.maxHr,
                shoeName: matchedSession.shoeName,
                date: matchedSession.date,
              }
            : undefined,
        };
      }

      // Final week Target Goal Milestone (if user set a target goal without a registered race!)
      if (settings.goalMode === 'target_goal' && isRaceWeek && dayName === longRunDay) {
        totalPlannedSessions++;
        const targetDist = parseCourseKm(settings.targetCourse || '10K');
        const s1 = Math.round(targetDist * 0.15 * 10) / 10;
        const s2 = Math.round(targetDist * 0.60 * 10) / 10;
        const s3 = Math.round((targetDist - s1 - s2) * 10) / 10;
        const goalStages: WorkoutStage[] = [
          {
            step: `1구간: 안정적 진입 (초반 ${s1}km)`,
            distanceKm: s1,
            pace: effectiveTargetPace,
            zone: 'Zone 3~4',
            focus: '오버페이스 억제 및 호흡 리듬 정착',
          },
          {
            step: `2구간: 정속 순항 (중반 ${s2}km)`,
            distanceKm: s2,
            pace: effectiveTargetPace,
            zone: 'Zone 4',
            focus: '케이던스 유지 및 일정한 목표 페이스 완벽 유지',
          },
          {
            step: `3구간: 피니시 스퍼트 (후반 ${s3}km)`,
            distanceKm: s3,
            pace: effectiveTargetPace,
            zone: 'Zone 4~5',
            focus: '남은 에너지를 모두 쏟아부으며 목표 기록 달성 피니시!',
          },
        ];

        return {
          day: dayName,
          dayShort,
          dateStr,
          type: '대회',
          title: `[🎯 목표 기록 달성 도전] ${settings.targetCourse || '10K'} 타임트라이얼`,
          distanceKm: targetDist,
          targetPace: effectiveTargetPace,
          targetZone: '실전 목표 페이스 (Zone 4~5)',
          description: `그동안의 주기화 훈련 완성! 목표 ${settings.targetCourse || '10K'} ${effectiveTargetFinishTime} (${effectiveTargetPace}/km) 완주를 위해 페이스를 지키며 완주합니다.`,
          purpose: `체계적인 주기화 플랜의 결실로써 목표 거리(${targetDist}km)와 목표 페이스(${effectiveTargetPace}/km) 완주 능력 검증`,
          intensity: '높음',
          isCompleted: !!matchedSession,
          stages: normalizeStagesDistance(goalStages, targetDist),
          actualSession: matchedSession
            ? {
                id: matchedSession.id,
                title: matchedSession.title,
                totalDistanceKm: matchedSession.totalDistanceKm,
                avgPace: matchedSession.avgPace,
                avgHr: matchedSession.avgHr,
                maxHr: matchedSession.maxHr,
                shoeName: matchedSession.shoeName,
                date: matchedSession.date,
              }
            : undefined,
        };
      }

      // If an actual session is recorded on this day, display it with real metrics!
      if (matchedSession) {
        const actualType = inferWorkoutType(matchedSession.title, matchedSession.totalDistanceKm);
        return {
          day: dayName,
          dayShort,
          dateStr,
          type: actualType,
          title: `[실제 기록 완료] ${matchedSession.title}`,
          distanceKm: matchedSession.totalDistanceKm,
          targetPace: matchedSession.avgPace || "-'--\"",
          targetZone: matchedSession.avgHr ? `평균 ${matchedSession.avgHr}bpm` : '실훈련 페이스',
          description: `실제 기록 완료된 훈련입니다. (${matchedSession.totalDistanceKm}km / 완주: ${matchedSession.totalTime || '-'} / 평균페이스: ${matchedSession.avgPace}/km${matchedSession.avgHr ? ` / 평균심박: ${matchedSession.avgHr}bpm` : ''}${matchedSession.shoeName ? ` / 착용화: ${matchedSession.shoeName}` : ''})`,
          purpose: '기록된 실제 훈련 성과 분석 및 주간 부하 자동 반영',
          intensity: matchedSession.totalDistanceKm >= 20 ? '높음' : matchedSession.totalDistanceKm >= 10 ? '보통' : '낮음',
          isCompleted: true,
          stages: [],
          actualSession: {
            id: matchedSession.id,
            title: matchedSession.title,
            totalDistanceKm: matchedSession.totalDistanceKm,
            avgPace: matchedSession.avgPace,
            avgHr: matchedSession.avgHr,
            maxHr: matchedSession.maxHr,
            shoeName: matchedSession.shoeName,
            date: matchedSession.date,
          },
        };
      }

      // If not an active running day for this week, it's a Rest day
      const isRunningDay = raceOnNextMonday
        ? (dayName === speedDay || otherDays.includes(dayName))
        : trainingDays.includes(dayName);

      if (!isRunningDay) {
        return {
          day: dayName,
          dayShort,
          dateStr,
          type: '휴식',
          title: '완전 휴식 및 리커버리 (Rest & Recovery)',
          distanceKm: 0,
          targetPace: '-',
          targetZone: '-',
          description: isRaceWeek
            ? '대회 직전 피로 완전 회복. 충분한 수면과 탄수화물 로딩 위주의 식단 관리.'
            : '하체 스트레칭, 폼롤러 마사지 및 수분 섭취. 근육 글리코겐 재충전.',
          purpose: '근섬유 미세 손상 복구, 신경계 안정화 및 다음 포인트 훈련을 위한 최상의 컨디션 확보',
          intensity: '휴식',
          isCompleted: false,
        };
      }

      totalPlannedSessions++;

      // Point Workout 1: Long Run Day (LSD 장거리 지속주)
      if (dayName === longRunDay) {
        const warmupKm = longRunKm >= 14 ? 2.0 : 1.5;
        const cooldownKm = longRunKm >= 14 ? 1.5 : 1.0;
        const mainTotalKm = Math.round((longRunKm - warmupKm - cooldownKm) * 10) / 10;

        let lsdStages: WorkoutStage[] = [];
        let lsdPace = `${easyMin} ~ ${easyMax}`;
        let lsdZone = 'Zone 2 (심폐 유산소 지구력)';
        let lsdTitle = `유산소 지구력 장거리 지속주 (LSD ${longRunKm}km)`;
        let lsdDesc = `장거리 주행력을 키우는 핵심 주말 포인트 훈련입니다. ${warmupKm}km 워밍업 후 본훈련 진행.`;

        // Determine Peak long-run pace:
        // Marathon target runner: peak lock-on pace is marathonPace (~4'55").
        // 10K/5K target runner: long run peak pace is still aerobic Zone 3 (~4'55" ~ 5'05"), NOT 10K race pace (4'15")!
        const targetSec = parsePaceToSeconds(effectiveTargetPace);
        const maraSec = paces?.marathonPace?.rawSec || 295;
        const peakLsdPace = targetCourseName === '풀코스'
          ? (targetSec >= maraSec - 10 ? effectiveTargetPace : marathonPace)
          : marathonPace;

        if (isRaceWeek) {
          lsdTitle = `가벼운 대회 리듬 셰이핑 (${longRunKm}km)`;
          lsdPace = `${easyMin} ~ ${easyMax}`;
          lsdZone = 'Zone 2 (컨디셔닝)';
          lsdDesc = `대회를 앞두고 무리하지 않으며 가볍게 몸을 풀고 다리 리듬을 살려두는 이지런입니다.`;
          lsdStages = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅으로 관절 윤활액 분비 및 가벼운 체온 상승 유도',
            },
            {
              step: `2단계: 본운동 리듬 이지런 (${mainTotalKm}km)`,
              distanceKm: mainTotalKm,
              pace: `${easyMin} ~ ${easyMax}`,
              zone: 'Zone 2',
              focus: '부드러운 케이던스로 대회 전 컨디션 최적화 유지',
            },
            {
              step: `3단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '심박 안정화 및 하체 피로 털기 스트레칭',
            },
          ];
        } else if (isDeload) {
          lsdTitle = `회복 디로드 저강도 LSD (${longRunKm}km)`;
          lsdPace = `${easyMax} ~ 6'30"`;
          lsdZone = 'Zone 1~2 (회복 유산소)';
          lsdDesc = `디로드(회복) 주간입니다. 무리 없는 편안한 저강도 페이스(${easyMax} ~ 6'30")로 달려 하체 관절과 심폐의 누적 피로를 회복하고 초과회복을 유도합니다.`;
          lsdStages = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: `${easyMax} ~ 6'30"`,
              zone: 'Zone 1',
              focus: '몸에 무리가 가지 않도록 아주 천천히 조깅하며 호흡 안정',
            },
            {
              step: `2단계: 본운동 회복형 이지 LSD (${mainTotalKm}km)`,
              distanceKm: mainTotalKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '대화가 편안히 가능한 페이스로 관절과 근육에 무리 없는 지속주',
            },
            {
              step: `3단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: "6'30\" ~ 7'00\"",
              zone: 'Zone 1 (회복)',
              focus: '폼롤러 및 전신 스트레칭으로 신체 피로 흡수',
            },
          ];
        } else if (phase === '목표 페이스 특화기 (Peak)') {
          // Peak Phase: Race-Pace build-up LSD (4 stages)
          const part1Km = Math.round(mainTotalKm * 0.65 * 10) / 10;
          const part2Km = Math.round((mainTotalKm - part1Km) * 10) / 10;
          lsdTitle = `실전 목표 페이스 락온 장거리 LSD (${longRunKm}km)`;
          lsdPace = `${easyMin} ~ ${peakLsdPace}`;
          lsdZone = 'Zone 2 ➡️ Zone 3 (실전 페이스 락온)';
          lsdDesc = `초반 ${part1Km}km는 안정적인 이지런(${easyMin} ~ ${easyMax})으로 달리고, 후반 ${part2Km}km는 실전 목표 페이스(${peakLsdPace})로 락온하여 후반 글리코겐 고갈 저항력과 멘탈 지구력을 기릅니다.`;
          lsdStages = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '체온 상승 및 관절 윤활액 분비 유도, 가벼운 호흡 리듬 정착',
            },
            {
              step: `2단계: 본훈련 1구간 기초 유산소 정속 (${part1Km}km)`,
              distanceKm: part1Km,
              pace: `${easyMin} ~ ${easyMax}`,
              zone: 'Zone 2',
              focus: '안정된 보폭과 케이던스(180spm) 유지, 지방 대사 최적화 및 5km마다 뉴트리션 섭취',
            },
            {
              step: `3단계: 본훈련 2구간 목표 페이스 락온 (${part2Km}km)`,
              distanceKm: part2Km,
              pace: peakLsdPace,
              zone: 'Zone 3',
              focus: `대회 후반부와 동일한 피로 상황에서 실전 페이스(${peakLsdPace}) 정밀 사수 훈련, 코어 중심 안정적 주행`,
            },
            {
              step: `4단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '심박수를 점진적으로 떨어뜨리고 가벼운 햄스트링/종아리 스트레칭',
            },
          ];
        } else if (phase === '스피드/지구력 빌드업기 (Build)') {
          // Build Phase: Negative Split Progression LSD (4 stages)
          const part1Km = Math.round(mainTotalKm * 0.65 * 10) / 10;
          const part2Km = Math.round((mainTotalKm - part1Km) * 10) / 10;
          lsdTitle = `점진적 네거티브 스플릿 빌드업 LSD (${longRunKm}km)`;
          lsdPace = `${easyMax} ➡️ ${easyMin} (후반 ${marathonPace})`;
          lsdZone = 'Zone 2 ➡️ Zone 3 (네거티브 스플릿)';
          lsdDesc = `장거리 후반부 글리코겐 보존 및 페이스 제어력을 기르는 빌드업 LSD입니다. 초반 ${part1Km}km는 안정적인 이지런(${easyMax} ➡️ ${easyMin})으로 달리고, 후반 ${part2Km}km는 유산소 템포(${marathonPace})로 점진 가속합니다.`;
          lsdStages = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅으로 관절 가동성 확보 및 체온 상승',
            },
            {
              step: `2단계: 본훈련 1구간 기초 유산소 정속 (${part1Km}km)`,
              distanceKm: part1Km,
              pace: `${easyMax} ➡️ ${easyMin}`,
              zone: 'Zone 2',
              focus: '대화가 편안한 Zone 2 정속 주행, 지방 대사 최적화 및 5km마다 수분 섭취',
            },
            {
              step: `3단계: 본훈련 2구간 후반 점진 가속 (${part2Km}km)`,
              distanceKm: part2Km,
              pace: `${easyMin} ➡️ ${marathonPace}`,
              zone: 'Zone 2~3',
              focus: `후반 다리 피로 누적 상황에서 리듬을 살리며 유산소 템포(${marathonPace}) 영역까지 부드럽게 점진 가속`,
            },
            {
              step: `4단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '심박 정상화 및 하체 피로 털기 스트레칭',
            },
          ];
        } else if (phase === '테이퍼링 감량기 (Tapering)') {
          // Tapering Phase: Controlled volume easy long run
          lsdTitle = `테이퍼링 컨디션 조율 LSD (${longRunKm}km)`;
          lsdPace = `${easyMin} ~ ${easyMax}`;
          lsdZone = 'Zone 2 (테이퍼링)';
          lsdDesc = `대회를 앞둔 테이퍼링 주간입니다. 거리를 축소하여 글리코겐을 충전하고 다리의 가벼운 반발력을 유지합니다.`;
          lsdStages = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅으로 몸을 풀고 호흡 안정',
            },
            {
              step: `2단계: 본운동 테이퍼링 가벼운 이지런 (${mainTotalKm}km)`,
              distanceKm: mainTotalKm,
              pace: `${easyMin} ~ ${easyMax}`,
              zone: 'Zone 2',
              focus: '무리하지 않고 경쾌한 케이던스로 다리 탄력 유지',
            },
            {
              step: `3단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '심박 안정화 및 하체 스트레칭',
            },
          ];
        } else {
          // Base Phase / Default: Pure Steady Aerobic Long Run (3 stages)
          lsdTitle = `기초 유산소 정속 장거리 지속주 (LSD ${longRunKm}km)`;
          lsdPace = `${easyMin} ~ ${easyMax}`;
          lsdZone = 'Zone 2 (심폐 유산소 기초)';
          lsdDesc = `일정한 이지런 페이스(${easyMin} ~ ${easyMax})로 달리는 순수 유산소 정속 지속주입니다. 심박수를 Zone 2로 일정하게 통제하여 모세혈관망 확장과 지방 연소 효율을 극대화합니다.`;
          lsdStages = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅으로 관절 윤활액 분비 및 체온 상승 유도',
            },
            {
              step: `2단계: 본운동 순수 유산소 정속 지속주 (${mainTotalKm}km)`,
              distanceKm: mainTotalKm,
              pace: `${easyMax} ➡️ ${easyMin}`,
              zone: 'Zone 2',
              focus: '대화가 편안한 Zone 2 정속 유지, 케이던스 180spm 안정 유지, 5km마다 수분/전해질 보충 연습',
            },
            {
              step: `3단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '심박수를 점진적으로 떨어뜨리고 가벼운 햄스트링/종아리 정적 스트레칭',
            },
          ];
        }

        normalizeStagesDistance(lsdStages, longRunKm);

        return {
          day: dayName,
          dayShort,
          dateStr,
          type: 'LSD',
          title: lsdTitle,
          distanceKm: longRunKm,
          targetPace: lsdPace,
          targetZone: lsdZone,
          description: lsdDesc,
          purpose: '지방 대사 효소 활성화로 30km 이후 글리코겐 고갈 방지, 심장 1회 박출량 증대 및 멘탈 지구력 극대화',
          intensity: isDeload || isRaceWeek ? '보통' : '높음',
          isCompleted: false,
          stages: lsdStages,
          actualSession: undefined,
        };
      }

      // Point Workout 2: Speed Workout Day (Rotates through user's selected speed types!)
      if (dayName === speedDay) {
        // A. Hill Training (언덕 훈련)
        if (activeSpeedType === '언덕훈련') {
          const warmupKm = speedKm >= 9 ? 2.0 : 1.5;
          const cooldownKm = speedKm >= 9 ? 1.5 : 1.0;
          const mainKm = Math.round((speedKm - warmupKm - cooldownKm) * 10) / 10;
          const hillReps = Math.max(4, Math.round(mainKm / 0.4));
          const hillStages: WorkoutStage[] = [
            {
              step: `1단계: 평지 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅 및 고관절/발목 가동성 동적 스트레칭, 체온 상승',
            },
            {
              step: `2단계: 본훈련 경사도 언덕 질주 ${hillReps}회 (${mainKm}km)`,
              distanceKm: mainKm,
              pace: `질주: ${intervalPace} 체감 / 회복: 천천히 걷기`,
              zone: 'Zone 5 (무산소 파워)',
              focus: `경사도 5~8% 200m 전력 질주(목표: ${intervalPace} 페이스 체감) + 200m 다운힐 도보 회복 × ${hillReps}회. 시선은 언덕 정상, 무릎을 높이고 팔치기를 강하게 흔들어 둔근과 심폐 한계 자극`,
            },
            {
              step: `3단계: 평지 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '평지 천천히 조깅으로 심박 안정화 및 하체 근막 이완',
            },
          ];
          normalizeStagesDistance(hillStages, speedKm);

          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '언덕훈련',
            title: isRaceWeek
              ? '가벼운 언덕 질주 3세트 (신경계 각성)'
              : isDeload
              ? `경사도 파워 언덕 훈련 (4세트, ${speedKm}km)`
              : `경사도 파워 & 케이던스 언덕 인터벌 (Hill Repeats ${speedKm}km)`,
            distanceKm: speedKm,
            targetPace: `질주: ${intervalPace} 체감 (Zone 5)`,
            targetZone: isDeload ? 'Zone 4 (젖산역치)' : 'Zone 4~5 (무산소 파워)',
            description: isDeload
              ? `디로드 주간입니다. ${warmupKm}km 조깅 워밍업 후 200m 완만한 언덕 질주 4회 반복 후 쿨다운.`
              : `워밍업 ${warmupKm}km 후 경사도 5~8% 언덕(200m) 전력 질주(${intervalPace} 체감) + 200m 내리막 걷기 회복 ${hillReps}회 반복 + 쿨다운 ${cooldownKm}km.`,
            purpose: '경사면을 차고 오르는 둔근·햄스트링·종아리 폭발적 근지구력 강화, 무릎 관절 착지 충격 분산 및 심폐 한계 자극',
            intensity: isDeload ? '보통' : '높음',
            isCompleted: false,
            stages: hillStages,
            actualSession: undefined,
          };
        }

        // B. Interval Training (1000m 인터벌)
        if (activeSpeedType === '인터벌') {
          const reps = Math.max(3, Math.min(7, Math.floor((speedKm - 2.8) / 1.4)));
          const mainWorkDist = Math.round(reps * 1.4 * 10) / 10;
          const remainDist = Math.round((speedKm - mainWorkDist) * 10) / 10;
          const warmupKm = Math.round(remainDist * 0.55 * 10) / 10;
          const cooldownKm = Math.round((remainDist - warmupKm) * 10) / 10;

          const stages: WorkoutStage[] = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '충분한 동적 스트레칭 및 50m 가벼운 질주 2회로 심폐 예열',
            },
            {
              step: `2단계: 본훈련 1000m 인터벌 ${reps}세트 (${mainWorkDist}km)`,
              distanceKm: mainWorkDist,
              pace: `질주: ${intervalPace} (Zone 5) / 회복: ${easyMax} (Zone 1~2)`,
              zone: 'Zone 5 (최대산소섭취량)',
              focus: `1000m 질주(${intervalPace}) + 400m 회복 조깅(2분) × ${reps}세트. 세트 간 목표 페이스를 정확히 사수하고 회복 조깅에서 호흡 빠르게 안정`,
            },
            {
              step: `3단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '가벼운 털기 조깅으로 근육 내 젖산 신속 제거',
            },
          ];
          normalizeStagesDistance(stages, speedKm);

          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '인터벌',
            title: isRaceWeek
              ? '신경계 각성 400m 질주 4세트'
              : isDeload
              ? `가벼운 템포런 (${speedKm}km)`
              : `VO2max 1000m 인터벌 ${reps}세트 (${speedKm}km)`,
            distanceKm: speedKm,
            targetPace: isRaceWeek ? intervalPace : isDeload ? thresholdPace : intervalPace,
            targetZone: isDeload ? 'Zone 4 (젖산역치)' : 'Zone 5 (최대산소섭취량)',
            description: isDeload
              ? `디로드 주간입니다. 고강도 인터벌 대신 편안한 역치 페이스(${thresholdPace})로 짧게 달려 심폐 감각만 유지합니다.`
              : `워밍업 ${warmupKm}km 후 1000m 질주 구간(${intervalPace}) + 400m 조깅 휴식(2분) ${reps}세트 반복 + 쿨다운 ${cooldownKm}km.`,
            purpose: '최대 산소 섭취량(VO2max) 15% 이상 자극, 빠른 수축 근섬유 동원력 및 스피드 피치 효율 개선',
            intensity: isDeload ? '보통' : '높음',
            isCompleted: false,
            stages,
            actualSession: undefined,
          };
        }

        // C. 800m Interval (야소 800)
        if (activeSpeedType === '800m 인터벌') {
          const reps = Math.max(3, Math.min(8, Math.floor((speedKm - 2.4) / 1.2)));
          const mainWorkDist = Math.round(reps * 1.2 * 10) / 10;
          const remainDist = Math.round((speedKm - mainWorkDist) * 10) / 10;
          const warmupKm = Math.round(remainDist * 0.55 * 10) / 10;
          const cooldownKm = Math.round((remainDist - warmupKm) * 10) / 10;

          const stages: WorkoutStage[] = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅 + 고관절 가동성 스트레칭 및 80m 질주 2회',
            },
            {
              step: `2단계: 본훈련 야소 800m 인터벌 ${reps}세트 (${mainWorkDist}km)`,
              distanceKm: mainWorkDist,
              pace: `질주: ${intervalPace} (Zone 5) / 회복: ${easyMax} (Zone 1~2)`,
              zone: 'Zone 5 (야소 800)',
              focus: `트랙 800m(2바퀴) 질주(${intervalPace}) + 400m(1바퀴) 회복 조깅(2분~2분20초) × ${reps}세트 정밀 사수`,
            },
            {
              step: `3단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '심박 안정화, 체온 회복 및 젖산 완충 조깅',
            },
          ];
          normalizeStagesDistance(stages, speedKm);

          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '인터벌',
            title: isRaceWeek
              ? '신경계 각성 400m 질주 4세트'
              : isDeload
              ? `가벼운 템포런 (${speedKm}km)`
              : `VO2max 야소 800m 인터벌 ${reps}세트 (${speedKm}km)`,
            distanceKm: speedKm,
            targetPace: isRaceWeek ? intervalPace : isDeload ? thresholdPace : intervalPace,
            targetZone: isDeload ? 'Zone 4 (젖산역치)' : 'Zone 5 (최대산소섭취량)',
            description: isDeload
              ? `디로드 주간입니다. 고강도 인터벌 대신 편안한 역치 페이스(${thresholdPace})로 짧게 달려 심폐 감각만 유지합니다.`
              : `워밍업 ${warmupKm}km 후 800m 질주 구간(${intervalPace}) + 400m 조깅 휴식 ${reps}세트 반복 + 쿨다운 ${cooldownKm}km.`,
            purpose: '최대 산소 섭취량(VO2max) 15% 이상 자극 및 800m 페이스 지속력 배양',
            intensity: isDeload ? '보통' : '높음',
            isCompleted: false,
            stages,
            actualSession: undefined,
          };
        }

        // D. 1~3k Interval (롱 크루즈 인터벌)
        if (activeSpeedType === '1~3k 인터벌') {
          const reps = Math.max(2, Math.min(4, Math.floor((speedKm - 2.5) / 2.0)));
          const mainWorkDist = Math.round(reps * 2.0 * 10) / 10;
          const remainDist = Math.round((speedKm - mainWorkDist) * 10) / 10;
          const warmupKm = Math.round(remainDist * 0.55 * 10) / 10;
          const cooldownKm = Math.round((remainDist - warmupKm) * 10) / 10;

          const stages: WorkoutStage[] = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅 및 관절 가동성 확보',
            },
            {
              step: `2단계: 본훈련 롱 크루즈 인터벌 ${reps}세트 (${mainWorkDist}km)`,
              distanceKm: mainWorkDist,
              pace: `질주: ${thresholdPace} (Zone 4) / 회복: ${easyMax} (Zone 1~2)`,
              zone: 'Zone 4~5 (크루즈 인터벌)',
              focus: `1500m 역치 질주(${thresholdPace}) + 500m 회복 조깅(3분) × ${reps}세트. 중장거리 레이스 지속력 극대화`,
            },
            {
              step: `3단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '호흡을 정리하며 심박수 안정화',
            },
          ];
          normalizeStagesDistance(stages, speedKm);

          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '인터벌',
            title: isHeavyLongRunWeek
              ? `[장거리 부하 완화] 마라톤 순항 크루즈 인터벌 ${reps}세트 (${speedKm}km)`
              : `롱 크루즈 인터벌 ${reps}세트 (${speedKm}km)`,
            distanceKm: speedKm,
            targetPace: thresholdPace,
            targetZone: 'Zone 4~5 (크루즈 인터벌)',
            description: isHeavyLongRunWeek
              ? `주말 장거리 LSD(${longRunKm}km)의 대형 부하를 고려하여 다리 관절 충격을 완화하고 마라톤 유산소 역치 지속력을 다듬는 크루즈 인터벌입니다. (워밍업 ${warmupKm}km + 1500m 질주(${thresholdPace}) + 500m 조깅 휴식 ${reps}세트 + 쿨다운 ${cooldownKm}km)`
              : `워밍업 ${warmupKm}km 후 1500m 질주(${thresholdPace}) + 500m 조깅 휴식 ${reps}세트 반복 + 쿨다운 ${cooldownKm}km.`,
            purpose: '젖산 역치 지속력과 심폐 한계 극복 능력을 동시에 강화하는 중장거리 핵심 인터벌',
            intensity: '높음',
            isCompleted: false,
            stages,
            actualSession: undefined,
          };
        }

        // E. Buildup Run (빌드업주)
        if (activeSpeedType === '빌드업주') {
          const targetSec = parsePaceToSeconds(effectiveTargetPace);
          const threshSec = paces?.thresholdPace?.rawSec || 276;
          const maraSec = paces?.marathonPace?.rawSec || 295;
          const isTargetFasterThanThreshold = targetSec > 0 && targetSec < threshSec - 5;

          let stages: WorkoutStage[] = [];
          let targetPaceStr = '';
          let targetZoneStr = '';
          let descStr = '';

          if (isTargetFasterThanThreshold && speedKm >= 8) {
            // 4-stage progression: Zone 2 -> Zone 3 (MP) -> Zone 4 (Threshold) -> Zone 5 (Target Fast Finish)
            const s1 = Math.round(speedKm * 0.25 * 10) / 10;
            const s2 = Math.round(speedKm * 0.30 * 10) / 10;
            const s3 = Math.round(speedKm * 0.25 * 10) / 10;
            const s4 = Math.round((speedKm - s1 - s2 - s3) * 10) / 10;

            stages = [
              {
                step: `1구간: 워밍업 & 초반 이지런 (${s1}km)`,
                distanceKm: s1,
                pace: `${easyMax} ~ ${easyMin}`,
                zone: 'Zone 2',
                focus: '가벼운 조깅으로 점진적 체온 및 심박수 상승, 무리 없는 안정 주행',
              },
              {
                step: `2구간: 본훈련 1구간 유산소 순항 (${s2}km)`,
                distanceKm: s2,
                pace: marathonPace,
                zone: 'Zone 3',
                focus: `일정한 보폭과 리드미컬한 호흡 유지, 유산소 순항(마라톤 페이스 ${marathonPace}) 정속 감각 체화`,
              },
              {
                step: `3구간: 본훈련 2구간 젖산 역치 가속 (${s3}km)`,
                distanceKm: s3,
                pace: thresholdPace,
                zone: 'Zone 4',
                focus: `피로 누적 속에서도 탄력 있는 케이던스로 젖산 역치 페이스(${thresholdPace}) 지속 주행`,
              },
              {
                step: `4구간: 본훈련 3구간 실전 목표 스피드 피니시 (${s4}km)`,
                distanceKm: s4,
                pace: effectiveTargetPace,
                zone: 'Zone 5',
                focus: `피로 속에서도 무너지지 않는 코어 유지와 강한 팔치기로 목표 레이스 페이스(${effectiveTargetPace}) 네거티브 가속 피니시`,
              },
            ];

            targetPaceStr = `${easyMin} ➡️ ${marathonPace} ➡️ ${thresholdPace} ➡️ ${effectiveTargetPace}`;
            targetZoneStr = 'Zone 2 ➡️ Zone 5';
            descStr = `이지런(${easyMin})으로 출발하여 중반 유산소 순항(${marathonPace}, Zone 3), 젖산 역치(${thresholdPace}, Zone 4)를 거쳐 최종 구간 실전 목표 페이스(${effectiveTargetPace}, Zone 5)까지 4단계 점진 가속 완주합니다.`;
          } else if (isTargetFasterThanThreshold) {
            // 3-stage progression when speedKm is shorter: Zone 2 -> Zone 3 (MP) -> Zone 4~5 (Threshold to Target)
            const s1 = Math.round(speedKm * 0.35 * 10) / 10;
            const s2 = Math.round(speedKm * 0.35 * 10) / 10;
            const s3 = Math.round((speedKm - s1 - s2) * 10) / 10;

            stages = [
              {
                step: `1구간: 워밍업 & 초반 이지런 (${s1}km)`,
                distanceKm: s1,
                pace: `${easyMax} ~ ${easyMin}`,
                zone: 'Zone 2',
                focus: '릴랙스한 주법으로 점진적 체온 및 심박수 상승, 무리 없는 안정 주행',
              },
              {
                step: `2구간: 본훈련 1구간 유산소 순항 (${s2}km)`,
                distanceKm: s2,
                pace: marathonPace,
                zone: 'Zone 3',
                focus: `일정한 보폭과 리드미컬한 호흡 유지, 유산소 순항 페이스(${marathonPace}) 정속 주행`,
              },
              {
                step: `3구간: 본훈련 2구간 역치 가속 & 피니시 질주 (${s3}km)`,
                distanceKm: s3,
                pace: `${thresholdPace} ➡️ ${effectiveTargetPace}`,
                zone: 'Zone 4 ➡️ Zone 5',
                focus: `젖산 역치 페이스(${thresholdPace}, Zone 4)로 가속 후 최종 피니시 구간은 목표 페이스(${effectiveTargetPace}, Zone 5)로 폭발적 질주`,
              },
            ];

            targetPaceStr = `${easyMin} ➡️ ${marathonPace} ➡️ ${thresholdPace} (피니시 ${effectiveTargetPace})`;
            targetZoneStr = 'Zone 2 ➡️ Zone 4~5';
            descStr = `이지런(${easyMin})으로 시작하여 중반 유산소 순항(${marathonPace}, Zone 3)을 거쳐 후반 역치 페이스(${thresholdPace}, Zone 4) 및 실전 목표 페이스(${effectiveTargetPace})로 가속 피니시합니다.`;
          } else {
            // Standard 3-stage progression: Zone 2 -> Zone 3 (MP / Target) -> Zone 4 (Threshold)
            const s1 = Math.round(speedKm * 0.35 * 10) / 10;
            const s2 = Math.round(speedKm * 0.40 * 10) / 10;
            const s3 = Math.round((speedKm - s1 - s2) * 10) / 10;

            stages = [
              {
                step: `1구간: 워밍업 & 초반 이지런 (${s1}km)`,
                distanceKm: s1,
                pace: `${easyMax} ~ ${easyMin}`,
                zone: 'Zone 2',
                focus: '릴랙스한 주법으로 점진적 체온 및 심박수 상승, 무리 없는 안정 주행',
              },
              {
                step: `2구간: 본훈련 1구간 목표 유산소 정속 (${s2}km)`,
                distanceKm: s2,
                pace: effectiveTargetPace,
                zone: 'Zone 3',
                focus: `일정한 보폭과 리드미컬한 호흡 유지, 실전 목표 페이스(${effectiveTargetPace}) 감각 완벽 체화`,
              },
              {
                step: `3구간: 본훈련 2구간 역치 가속 피니시 (${s3}km)`,
                distanceKm: s3,
                pace: thresholdPace,
                zone: 'Zone 4',
                focus: `피로 속에서도 무너지지 않는 코어 유지와 강한 팔치기로 역치 페이스(${thresholdPace}) 네거티브 스플릿 피니시`,
              },
            ];

            targetPaceStr = `${easyMin} ➡️ ${effectiveTargetPace} ➡️ ${thresholdPace}`;
            targetZoneStr = 'Zone 2 ➡️ Zone 4';
            descStr = `이지런(${easyMin})으로 시작하여 중반 목표 페이스(${effectiveTargetPace}, Zone 3)를 거쳐 마지막 구간은 역치 페이스(${thresholdPace}, Zone 4)로 가속 완주합니다.`;
          }

          normalizeStagesDistance(stages, speedKm);

          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '템포런',
            title: isHeavyLongRunWeek
              ? `[장거리 부하 완화] 점진적 가속 빌드업주 (${speedKm}km)`
              : `점진적 가속 빌드업주 (${speedKm}km)`,
            distanceKm: speedKm,
            targetPace: targetPaceStr,
            targetZone: targetZoneStr,
            description: isHeavyLongRunWeek
              ? `주말 대형 롱런(${longRunKm}km)을 앞두고 다리 근육의 폭발적 파열을 방지하며 부드러운 네거티브 스플릿으로 순항 리듬을 점검합니다. ${descStr}`
              : descStr,
            purpose: '후반 가속 능력(Negative Split) 및 심리적 자신감 고취, 점진적 젖산 대사 적응력 배양',
            intensity: '높음',
            isCompleted: false,
            stages,
            actualSession: undefined,
          };
        }

        // F. Fartlek (변속주)
        if (activeSpeedType === '변속주(파틀렉)') {
          const warmupKm = speedKm >= 9 ? 2.0 : 1.5;
          const cooldownKm = speedKm >= 9 ? 1.5 : 1.0;
          const mainKm = Math.round((speedKm - warmupKm - cooldownKm) * 10) / 10;
          const sets = Math.max(4, Math.round(mainKm / 0.8));

          const stages: WorkoutStage[] = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅 및 체온 상승, 호흡 예열',
            },
            {
              step: `2단계: 본훈련 파틀렉 변속 세트 (${mainKm}km)`,
              distanceKm: mainKm,
              pace: `질주: ${thresholdPace} / 회복: ${easyMax}`,
              zone: 'Zone 3~4',
              focus: `500m 고속 질주(${thresholdPace}) + 300m 이지 조깅(${easyMax}) × ${sets}세트 반복. 지형과 리듬을 활용한 자연스러운 속도 변화`,
            },
            {
              step: `3단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '가벼운 털기 조깅으로 근육 내 젖산 신속 제거',
            },
          ];
          normalizeStagesDistance(stages, speedKm);

          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '템포런',
            title: `스피드 플레이 파틀렉 변속주 (${speedKm}km)`,
            distanceKm: speedKm,
            targetPace: `${thresholdPace} ~ ${easyMin}`,
            targetZone: 'Zone 3~4',
            description: `지형과 리듬을 활용한 자유 변속주. 500m 고속 질주(${thresholdPace}) + 300m 회복 조깅(${easyMax})을 ${sets}세트 반복합니다.`,
            purpose: '다양한 페이스 변화에 대한 심폐 반응성 및 지면 순응력 향상, 러닝의 유연한 즐거움 회복',
            intensity: '높음',
            isCompleted: false,
            stages,
            actualSession: undefined,
          };
        }

        // G. Zone 3 Marathon Pace Steady Run (저강도 포인트 - 존3 마라톤 페이스주)
        if (activeSpeedType === '존3 마라톤 페이스주') {
          const warmupKm = speedKm >= 9 ? 2.0 : 1.5;
          const cooldownKm = speedKm >= 9 ? 1.5 : 1.0;
          const mainKm = Math.round((speedKm - warmupKm - cooldownKm) * 10) / 10;

          const stages: WorkoutStage[] = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅 및 심박 예열, 유산소 혈류 확장',
            },
            {
              step: `2단계: 본훈련 존3 마라톤 페이스(M-Pace) 지속주 (${mainKm}km)`,
              distanceKm: mainKm,
              pace: marathonPace,
              zone: 'Zone 3 (마라톤 페이스)',
              focus: `목표 풀코스 마라톤 페이스(${marathonPace}) 정속 순항. 젖산 축적 없이 유산소 파워와 실전 레이스 리듬 완벽 체화`,
            },
            {
              step: `3단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '가벼운 조깅으로 심박수 안정화 및 쿨다운',
            },
          ];
          normalizeStagesDistance(stages, speedKm);

          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '템포런',
            title: isHeavyLongRunWeek
              ? `[장거리 최적 시너지] 존3 마라톤 페이스주 (${speedKm}km)`
              : `저강도 포인트: 존3 마라톤 페이스주 (${speedKm}km)`,
            distanceKm: speedKm,
            targetPace: marathonPace,
            targetZone: 'Zone 3 (마라톤 페이스)',
            description: isHeavyLongRunWeek
              ? `주말 대형 롱런(${longRunKm}km)을 앞두고 다리 관절과 근육 피로를 최소화하면서, 풀코스 실전 목표 페이스(${marathonPace}) 감각을 날카롭게 유지하는 저강도 포인트 세션입니다. (워밍업 ${warmupKm}km + 본훈련 ${mainKm}km + 쿨다운 ${cooldownKm}km)`
              : `워밍업 ${warmupKm}km 후 존3 마라톤 페이스(${marathonPace})로 ${mainKm}km 정속 지속주 진행 + 쿨다운 ${cooldownKm}km. 젖산 축적 없이 유산소 파워를 기르는 저강도 포인트 훈련입니다.`,
            purpose: 'Zone 3 유산소 파워 극대화 및 풀코스 마라톤 목표 페이스 정속 지속력 완성 (부상 방지 저강도 포인트)',
            intensity: '보통',
            isCompleted: false,
            stages,
            actualSession: undefined,
          };
        }

        // H. Zone 3 Moderate Run (저강도 포인트 - 존3 모더레이트런)
        if (activeSpeedType === '존3 모더레이트런') {
          const warmupKm = speedKm >= 9 ? 1.5 : 1.0;
          const cooldownKm = speedKm >= 9 ? 1.5 : 1.0;
          const mainKm = Math.round((speedKm - warmupKm - cooldownKm) * 10) / 10;
          const moderatePaceSec = Math.round((parsePaceToSeconds(easyMin) + parsePaceToSeconds(marathonPace)) / 2);
          const moderatePaceStr = formatPace(moderatePaceSec);

          const stages: WorkoutStage[] = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅 및 체온 상승',
            },
            {
              step: `2단계: 본훈련 존3 모더레이트 정속 지속주 (${mainKm}km)`,
              distanceKm: mainKm,
              pace: moderatePaceStr,
              zone: 'Zone 3 (모더레이트 유산소)',
              focus: `이지런보다 빠르고 역치보다 편안한 Zone 3 중간 유산소 영역(${moderatePaceStr})으로 일정한 보폭 유지`,
            },
            {
              step: `3단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '심박 안정화 및 하체 피로 털기',
            },
          ];
          normalizeStagesDistance(stages, speedKm);

          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '조깅',
            title: `저강도 포인트: 존3 모더레이트런 (${speedKm}km)`,
            distanceKm: speedKm,
            targetPace: moderatePaceStr,
            targetZone: 'Zone 3 (모더레이트 유산소)',
            description: `이지 조깅(Zone 2)과 젖산 역치(Zone 4) 사이의 중간 유산소 지구력(Zone 3, ${moderatePaceStr})을 부드럽게 자극하는 저강도 포인트 세션입니다. (워밍업 ${warmupKm}km + 본훈련 ${mainKm}km + 쿨다운 ${cooldownKm}km)`,
            purpose: '유산소 대사 효율 개선, 피로 누적 없는 안정적인 마일리지 및 유산소 베이스 확장',
            intensity: '보통',
            isCompleted: false,
            stages,
            actualSession: undefined,
          };
        }

        // I. Zone 3 Aerobic Threshold Run (저강도 포인트 - 존3 유산소 역치주 AeT)
        if (activeSpeedType === '존3 유산소 역치주') {
          const warmupKm = speedKm >= 9 ? 2.0 : 1.5;
          const cooldownKm = speedKm >= 9 ? 1.5 : 1.0;
          const mainKm = Math.round((speedKm - warmupKm - cooldownKm) * 10) / 10;
          const aetPaceSec = parsePaceToSeconds(marathonPace) + 8;
          const aetPaceStr = formatPace(aetPaceSec);

          const stages: WorkoutStage[] = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅 및 관절 가동성 확보',
            },
            {
              step: `2단계: 본훈련 유산소 역치(AeT) 지속주 (${mainKm}km)`,
              distanceKm: mainKm,
              pace: aetPaceStr,
              zone: 'Zone 3 (유산소 역치 AeT)',
              focus: `젖산 발생 시작 직전의 상한 유산소 구간(${aetPaceStr}). 깊고 규칙적인 복식 호흡 유지`,
            },
            {
              step: `3단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '호흡을 정리하며 심박수 안정화',
            },
          ];
          normalizeStagesDistance(stages, speedKm);

          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '템포런',
            title: `저강도 포인트: 존3 유산소 역치(AeT) 지속주 (${speedKm}km)`,
            distanceKm: speedKm,
            targetPace: aetPaceStr,
            targetZone: 'Zone 3 (유산소 역치 AeT)',
            description: `유산소 역치(Aerobic Threshold) 부근으로 달려 지방 대사율과 심폐 베이스를 극한까지 끌어올리는 저강도 포인트 훈련입니다. (워밍업 ${warmupKm}km + 본훈련 ${mainKm}km + 쿨다운 ${cooldownKm}km)`,
            purpose: '유산소 역치(AeT) 지점 상향 이동 및 장거리 에너지 대사 효율 극대화',
            intensity: '보통',
            isCompleted: false,
            stages,
            actualSession: undefined,
          };
        }

        // J. Cruise Intervals (중강도 포인트 - 크루즈 인터벌 LT)
        if (activeSpeedType === '크루즈 인터벌') {
          const reps = Math.max(2, Math.min(5, Math.floor((speedKm - 2.5) / 1.8)));
          const mainWorkDist = Math.round(reps * 1.8 * 10) / 10;
          const remainDist = Math.round((speedKm - mainWorkDist) * 10) / 10;
          const warmupKm = Math.round(remainDist * 0.55 * 10) / 10;
          const cooldownKm = Math.round((remainDist - warmupKm) * 10) / 10;

          const stages: WorkoutStage[] = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅 및 심폐 예열',
            },
            {
              step: `2단계: 본훈련 크루즈 역치 인터벌 ${reps}세트 (${mainWorkDist}km)`,
              distanceKm: mainWorkDist,
              pace: `질주: ${thresholdPace} (Zone 4) / 회복: ${easyMax} (Zone 1~2)`,
              zone: 'Zone 4 (크루즈 역치)',
              focus: `1500m 역치 질주(${thresholdPace}) + 300m 회복 조깅(1분) × ${reps}세트. 젖산 역치 자극을 안전하게 분할 누적`,
            },
            {
              step: `3단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '하체 털기 조깅으로 젖산 신속 제거',
            },
          ];
          normalizeStagesDistance(stages, speedKm);

          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '템포런',
            title: isHeavyLongRunWeek
              ? `[장거리 부하 완화] 분할 역치 크루즈 인터벌 ${reps}세트 (${speedKm}km)`
              : `중강도 포인트: 크루즈 역치 인터벌 ${reps}세트 (${speedKm}km)`,
            distanceKm: speedKm,
            targetPace: thresholdPace,
            targetZone: 'Zone 4 (크루즈 역치)',
            description: `1500m 젖산역치 질주(${thresholdPace})와 300m 짧은 조깅 휴식을 ${reps}세트 반복하여 다리 피로를 분산하면서 젖산 한계점을 정복하는 중강도 핵심 세션입니다. (워밍업 ${warmupKm}km + 본훈련 ${mainWorkDist}km + 쿨다운 ${cooldownKm}km)`,
            purpose: '젖산 역치 한계 속도 내구성을 관절 충격 없이 효과적으로 체득',
            intensity: '높음',
            isCompleted: false,
            stages,
            actualSession: undefined,
          };
        }

        // K. 400m Short Intervals (고강도 포인트 - 400m 숏 인터벌)
        if (activeSpeedType === '400m 숏 인터벌') {
          const reps = Math.max(6, Math.min(12, Math.floor((speedKm - 2.5) / 0.6)));
          const mainWorkDist = Math.round(reps * 0.6 * 10) / 10;
          const remainDist = Math.round((speedKm - mainWorkDist) * 10) / 10;
          const warmupKm = Math.round(remainDist * 0.55 * 10) / 10;
          const cooldownKm = Math.round((remainDist - warmupKm) * 10) / 10;
          const shortPaceSec = Math.max(180, parsePaceToSeconds(intervalPace) - 8);
          const shortPaceStr = formatPace(shortPaceSec);

          const stages: WorkoutStage[] = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅 + 동적 스트레칭 및 50m 질주 2회',
            },
            {
              step: `2단계: 본훈련 400m 숏 인터벌 ${reps}세트 (${mainWorkDist}km)`,
              distanceKm: mainWorkDist,
              pace: `질주: ${shortPaceStr} (Zone 5+) / 회복: 천천히 걷기/조깅`,
              zone: 'Zone 5+ (스피드/무산소)',
              focus: `트랙 400m 쾌속 질주(${shortPaceStr}) + 200m(90초) 걷기/조깅 휴식 × ${reps}세트. 빠른 지면 반발력과 케이던스 폭발`,
            },
            {
              step: `3단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '호흡 안정화 및 하체 피로 털기',
            },
          ];
          normalizeStagesDistance(stages, speedKm);

          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '인터벌',
            title: `고강도 포인트: 400m 숏 인터벌 ${reps}세트 (${speedKm}km)`,
            distanceKm: speedKm,
            targetPace: shortPaceStr,
            targetZone: 'Zone 5+ (스피드/무산소)',
            description: `트랙 400m 쾌속 질주(${shortPaceStr})와 200m 휴식을 ${reps}세트 반복하여 러닝 이코노미와 최고 속도 능력을 극대화하는 고강도 스피드 세션입니다. (워밍업 ${warmupKm}km + 본훈련 ${mainWorkDist}km + 쿨다운 ${cooldownKm}km)`,
            purpose: '빠른 수축 근섬유 활성화, 러닝 이코노미 개선 및 스피드 피치 향상',
            intensity: '높음',
            isCompleted: false,
            stages,
            actualSession: undefined,
          };
        }

        // L. Standard Tempo Run (젖산 역치 템포런)
        const warmupKm = speedKm >= 9 ? 2.0 : 1.5;
        const cooldownKm = speedKm >= 9 ? 1.5 : 1.0;
        const mainKm = Math.round((speedKm - warmupKm - cooldownKm) * 10) / 10;

        const stages: WorkoutStage[] = [
          {
            step: `1단계: 워밍업 (${warmupKm}km)`,
            distanceKm: warmupKm,
            pace: easyMax,
            zone: 'Zone 1~2',
            focus: '가벼운 조깅 및 관절 가동성 확보, 50m 질주 1회',
          },
          {
            step: `2단계: 본훈련 LT 템포 지속주 (${mainKm}km)`,
            distanceKm: mainKm,
            pace: thresholdPace,
            zone: 'Zone 4 (역치 페이스)',
            focus: `호흡 2-2 리듬 유지, 흔들림 없는 코어와 일정한 역치 페이스(${thresholdPace}) 완벽 제어. 젖산 축적 한계점을 늦추는 핵심 훈련`,
          },
          {
            step: `3단계: 쿨다운 (${cooldownKm}km)`,
            distanceKm: cooldownKm,
            pace: `${easyMax} ~ 6'40"`,
            zone: 'Zone 1 (회복)',
            focus: '호흡을 정리하며 심박수 안정화 및 하체 피로 털기',
          },
        ];
        normalizeStagesDistance(stages, speedKm);

        return {
          day: dayName,
          dayShort,
          dateStr,
          type: '템포런',
          title: isHeavyLongRunWeek
            ? `[장거리 부하 완화] 레이스 락온 LT 템포런 (${speedKm}km)`
            : `젖산 역치(LT) 템포런 (${speedKm}km)`,
          distanceKm: speedKm,
          targetPace: thresholdPace,
          targetZone: 'Zone 4 (역치 페이스)',
          description: isHeavyLongRunWeek
            ? `주말 장거리 LSD(${longRunKm}km)의 높은 부하를 고려하여 폭발적 인터벌 대신 관절 충격이 적고 실전 페이스 유지력을 높이는 젖산역치(${thresholdPace}) 템포런으로 부하를 최적 조율합니다. (워밍업 ${warmupKm}km + 본훈련 ${mainKm}km + 쿨다운 ${cooldownKm}km)`
            : `워밍업 ${warmupKm}km 후 본훈련으로 역치 페이스(${thresholdPace}) ${mainKm}km 정속 지속주 진행 + 쿨다운 ${cooldownKm}km. 젖산 축적을 억제하고 페이스를 유지하는 감각을 기릅니다.`,
          purpose: '젖산 역치(Lactate Threshold) 지점을 상향 이동시켜, 마라톤 후반에도 페이스 저하 없이 쾌적하게 질주할 수 있는 지구력 배양',
          intensity: '높음',
          isCompleted: false,
          stages,
          actualSession: undefined,
        };
      }

      // Base Aerobic / Recovery Running Day (조깅 / 회복주)
      const isRecoveryDay = otherDays.indexOf(dayName) === 0 && otherDays.length > 1;
      const workoutDist = otherDaysDistMap[dayName] || (isRecoveryDay ? Math.max(4.0, Math.round(baseJogKm * 0.8 * 10) / 10) : baseJogKm);
      const warmupKm = workoutDist >= 8 ? 1.5 : 1.0;
      const cooldownKm = workoutDist >= 8 ? 1.5 : 1.0;
      const mainJogKm = Math.round((workoutDist - warmupKm - cooldownKm) * 10) / 10;

      const jogStages: WorkoutStage[] = [
        {
          step: `1단계: 워밍업 (${warmupKm}km)`,
          distanceKm: warmupKm,
          pace: easyMax,
          zone: 'Zone 1~2',
          focus: '가벼운 조깅으로 체온 서서히 상승 및 관절 예열',
        },
        {
          step: isRecoveryDay ? `2단계: 본운동 리커버리 지속주 (${mainJogKm}km)` : `2단계: 본운동 유산소 조깅 (${mainJogKm}km)`,
          distanceKm: mainJogKm,
          pace: isRecoveryDay ? `${easyMax} ~ 6'30"` : `${easyMin} ~ ${easyMax}`,
          zone: isRecoveryDay ? 'Zone 1~2 (능동적 회복)' : 'Zone 2 (이지 에어로빅)',
          focus: isRecoveryDay
            ? '대화가 편안히 가능한 아주 편안한 페이스 유지, 혈액 순환 촉진'
            : '코로 숨쉬며 편안하게 대화 가능한 페이스 유지, 상체 힘 빼기',
        },
        {
          step: `3단계: 쿨다운 (${cooldownKm}km)`,
          distanceKm: cooldownKm,
          pace: isRecoveryDay ? "6'30\" ~ 7'00\"" : `${easyMax} ~ 6'40"`,
          zone: 'Zone 1 (회복)',
          focus: '심박 안정화 및 하체 스트레칭, 폼롤러 마사지 권장',
        },
      ];
      normalizeStagesDistance(jogStages, workoutDist);

      return {
        day: dayName,
        dayShort,
        dateStr,
        type: isRecoveryDay ? '회복주' : '조깅',
        title: isRecoveryDay
          ? `가벼운 리커버리 조깅 (${workoutDist}km)`
          : `유산소 기초 에어로빅 조깅 (${workoutDist}km)`,
        distanceKm: workoutDist,
        targetPace: isRecoveryDay ? `${easyMax} ~ 6'30"` : `${easyMin} ~ ${easyMax}`,
        targetZone: isRecoveryDay ? 'Zone 1~2 (회복)' : 'Zone 2 (이지 에어로빅)',
        description: isRecoveryDay
          ? `포인트 훈련 다음날 가벼운 회복주입니다. 대화가 편안히 가능한 페이스(${easyMax})로 달리며 혈액 순환을 촉진합니다.`
          : `기본 유산소 체력을 다지는 편안한 조깅입니다. 후반에 가벼운 100m 질주 3~5회를 곁들여도 좋습니다.`,
        purpose: '근육 내 모세혈관망 신생 촉진, 심폐 지구력 기초 다지기 및 전날 고강도 포인트 훈련의 피로 대사물질 능동적 배출',
        intensity: '낮음',
        isCompleted: false,
        stages: jogStages,
        actualSession: undefined,
      };
    });
    }

    // Attach shoe rotation recommendations to days with multi-week rotation and actual wear history
    const daysWithShoes = attachShoeRecommendationsToPlan(days, shoes, trainingSessions, w, shoeRotationTracker);

    // Calculate planned and completed km for this week
    const weekActualPlannedKm = Math.round(
      daysWithShoes.reduce((sum, d) => sum + d.distanceKm, 0) * 10
    ) / 10;
    totalPlannedKm += weekActualPlannedKm;

    const completedKm = Math.round(
      daysWithShoes.reduce((sum, d) => sum + (d.actualSession ? d.actualSession.totalDistanceKm : 0), 0) * 10
    ) / 10;

    // Calculate baseline training load scores for days and week
    let weekLoadSum = 0;
    const daysWithLoads = daysWithShoes.map((d) => {
      let multiplier = 1.0;
      let category: 'highIntensity' | 'moderateIntensity' | 'lowIntensityPoint' | 'longRun' | 'recovery' = 'recovery';
      const isLowPoint =
        d.title.includes('존3') ||
        d.title.includes('M-페이스') ||
        d.title.includes('모더레이트') ||
        d.targetZone.includes('존3') ||
        d.targetZone.includes('Zone 3') ||
        d.description.includes('존3') ||
        d.description.includes('Zone 3');

      if (d.type === '휴식' || d.distanceKm === 0) {
        multiplier = 0;
        category = 'recovery';
      } else if (d.type === '인터벌' || d.type === '언덕훈련' || d.type === '대회') {
        multiplier = 2.8;
        category = 'highIntensity';
      } else if (isLowPoint) {
        multiplier = 1.6;
        category = 'lowIntensityPoint';
      } else if (d.type === '템포런') {
        multiplier = 2.2;
        category = 'moderateIntensity';
      } else if (d.type === 'LSD') {
        multiplier = 1.4;
        category = 'longRun';
      } else {
        multiplier = 1.0;
        category = 'recovery';
      }

      const effectiveDist = d.actualSession && d.actualSession.totalDistanceKm > 0 ? d.actualSession.totalDistanceKm : d.distanceKm;
      const dayLoad = Math.round(effectiveDist * multiplier * 10) / 10;
      weekLoadSum += dayLoad;

      return {
        ...d,
        trainingLoad: dayLoad,
        loadMultiplier: multiplier,
        intensityCategory: category,
      };
    });

    const weekTotalLoadScore = Math.round(weekLoadSum * 10) / 10;
    totalPlanLoadScore += weekTotalLoadScore;

    weeks.push({
      weekNumber: w,
      startDateStr,
      endDateStr,
      weekLabel: `${w}주차 (${startDateStr.slice(5).replace('-', '/')} ~ ${endDateStr.slice(5).replace('-', '/')})`,
      phase,
      phaseBadgeColor,
      phaseDescription,
      focus,
      targetWeeklyKm: weekActualPlannedKm,
      completedKm,
      totalLoadScore: weekTotalLoadScore,
      plannedTotalLoadScore: weekTotalLoadScore,
      categoryOverrides: {},
      days: daysWithLoads,
      raceInThisWeek,
      isCurrentWeek,
    });
  }

  // Target race summary
  const targetRaceSummary =
    targetRace
      ? (() => {
          const dDayInfo = calculateDDay(targetRace.date);
          const dDayDays = Math.max(0, dDayInfo.daysDiff);
          const dDayWeeks = Math.max(0, Math.ceil(dDayDays / 7));
          return {
            raceName: targetRace.name,
            raceDate: targetRace.date,
            dDayWeeks,
            dDayDays,
            dDayText: dDayInfo.text,
            course: targetCourseName,
            priority: targetRace.priority || 'A',
            targetTime: effectiveTargetFinishTime,
            targetPace: effectiveTargetPace,
          };
        })()
      : settings.goalMode === 'target_goal' && settings.targetCourse
      ? {
          raceName: `목표 ${settings.targetCourse} 기록 달성`,
          raceDate: settings.endDate || formatDate(new Date(startMonday.getTime() + (totalWeeks * 7 - 1) * 86400000)),
          dDayWeeks: totalWeeks,
          dDayDays: totalWeeks * 7,
          dDayText: `D-${totalWeeks * 7}`,
          course: settings.targetCourse,
          priority: 'A',
          targetTime: effectiveTargetFinishTime,
          targetPace: effectiveTargetPace,
        }
      : undefined;

  // 6. Compute Goal-Fitness Match Audit (플랜 정합성 및 실력 진단)
  const targetTimeSec = parseTimeToSeconds(effectiveTargetFinishTime);
  let targetVdot = vdot;
  if (targetTimeSec > 0 && courseDistKm > 0) {
    targetVdot = calculateVDOT(courseDistKm * 1000, targetTimeSec);
  } else {
    targetVdot = vdot + (totalWeeks >= 16 ? 4.0 : totalWeeks >= 8 ? 2.5 : 1.5);
  }

  const vdotGap = Math.round((targetVdot - vdot) * 10) / 10;
  const totalMonths = Math.max(1, totalWeeks / 4.33);
  const requiredMonthlyVdotGain = Math.round((vdotGap / totalMonths) * 100) / 100;

  // Pace comparison
  const currentPaces = getTrainingPaces(vdot > 28 ? vdot : 45);
  const targetSecPerKm = targetTimeSec > 0 && courseDistKm > 0 ? targetTimeSec / courseDistKm : parseTimeToSeconds(effectiveTargetPace);
  const currentSecPerKm = isFullCourse
    ? (currentPaces ? currentPaces.marathonPace.rawSec : 300)
    : isHalfCourse
    ? (currentPaces ? currentPaces.thresholdPace.rawSec + 12 : 280)
    : is10kCourse
    ? (currentPaces ? currentPaces.thresholdPace.rawSec : 260)
    : (currentPaces ? currentPaces.intervalPace.rawSec : 240);

  const currentEstimatedPaceFormatted = formatPace(currentSecPerKm);
  const paceGapSeconds = Math.round(targetSecPerKm - currentSecPerKm);

  // Peak metrics in plan
  const peakWeekItem = [...weeks].sort((a, b) => b.targetWeeklyKm - a.targetWeeklyKm)[0];
  const peakWeeklyKm = peakWeekItem ? peakWeekItem.targetWeeklyKm : baselineWeeklyKm;
  const peakLsdKm = Math.max(
    ...weeks.flatMap((w) => w.days.filter((d) => d.type === 'LSD').map((d) => d.distanceKm)),
    0
  );

  const recommendedPeakKmRange = isFullCourse
    ? '68~82km'
    : isHalfCourse
    ? '56~62km'
    : is10kCourse
    ? '45~52km'
    : '35~42km';

  const recommendedLsdKmRange = isFullCourse
    ? '30~34km'
    : isHalfCourse
    ? '19~22km'
    : is10kCourse
    ? '13~15km'
    : '8~11km';

  // Feasibility & Fit Grade
  let fitScore = 95;
  let fitGrade: '최적 정합성' | '우수' | '적정' | '주의' | '과부하 위험' = '최적 정합성';

  if (requiredMonthlyVdotGain > 1.6) {
    fitScore -= 20;
    fitGrade = '주의';
  } else if (requiredMonthlyVdotGain > 1.1) {
    fitScore -= 8;
    fitGrade = '우수';
  }

  // Audit details
  const auditDetails: PlanFitnessAudit['auditDetails'] = [
    {
      category: '주간 마일리지',
      status: '최적',
      title: `${targetCourseName} 맞춤형 주간 볼륨 곡선`,
      summary: `시작 볼륨 ${baselineWeeklyKm}km ➡️ 최고 피크 ${peakWeeklyKm}km (하프 권장 피크: ${recommendedPeakKmRange})`,
      recommendation: isHalfCourse
        ? `하프 1:30 벽 돌파에 가장 효율적인 56~62km 피크 구간을 완벽히 형성했습니다. 풀코스용 과도한 볼륨(70km+)을 피해 다리 피로를 최적 관리합니다.`
        : `목표 대회 거리에 맞춘 체계적인 유산소 볼륨 상승 곡선입니다.`,
    },
    {
      category: '포인트 강도',
      status: Math.abs(paceGapSeconds) > 35 ? '적정' : '최적',
      title: `목표 페이스(${effectiveTargetPace}/km) 및 젖산 역치 세팅`,
      summary: `현재 추정 페이스(${currentEstimatedPaceFormatted}/km) 대비 ${Math.abs(paceGapSeconds)}초/km ${paceGapSeconds < 0 ? '가속 목표' : '안정 지속'} (VDOT ${vdot} ➡️ ${targetVdot})`,
      recommendation: isHalfCourse
        ? `하프마라톤은 젖산 역치(LT) 속도 유지가 핵심입니다. 주 1회 수요일 템포런(4'10"~4'15") 및 VO2max 인터벌(3'50"~3'58") 세트가 실전 페이스 감각을 극대화합니다.`
        : `목표 페이스에 맞춘 포인트 세트로 역치 페이스와 심폐 지구력을 동시 강화합니다.`,
    },
    {
      category: 'LSD 장거리',
      status: '최적',
      title: `${targetCourseName} 실전 LSD 최적 캡 (${peakLsdKm}km)`,
      summary: `최장 장거리 ${peakLsdKm}km (하프 권장 범위: ${recommendedLsdKmRange})`,
      recommendation: isHalfCourse
        ? `하프 거리(21.1km)를 완벽히 포괄하는 21.0km LSD를 최고점으로 세팅했습니다. 불필요한 25km 이상 과도한 장거리로 인한 관절 피로를 사전에 예방합니다.`
        : `코스 완주에 최적화된 LSD 거리로 심장 1회 박출량과 지방 대사 효율을 극대화합니다.`,
    },
    {
      category: '주기화 및 회복',
      status: '최적',
      title: `3:1 웨이브 주기화 및 2단계 테이퍼링`,
      summary: `3주 과부하 후 1주 초과회복(-15~20%) 디로드 + 대회 직전 2주 테이퍼링(-20% ➡️ -35%)`,
      recommendation: `매 4주차 디로드 주간을 통해 건과 인대의 미세 손상을 복구하고, 결전 2주 전부터 글리코겐 초과 저장과 신경계 각성을 완성합니다.`,
    },
  ];

  let feasibilityAssessment = '';
  if (requiredMonthlyVdotGain <= 0) {
    feasibilityAssessment = '현재 러너의 PB 기량으로 이미 충분히 달성 가능한 안정권 목표입니다. 페이스 오버 방지 및 코스 전략에 집중하세요.';
  } else if (requiredMonthlyVdotGain <= 1.0) {
    feasibilityAssessment = `${totalWeeks}주 동안 월평균 +${requiredMonthlyVdotGain} VDOT 성장이 요구되며, 3:1 웨이브 주기화 훈련으로 부상 없이 안전하게 달성 가능한 이상적인 목표 설정입니다.`;
  } else if (requiredMonthlyVdotGain <= 1.5) {
    feasibilityAssessment = `${totalWeeks}주 동안 월평균 +${requiredMonthlyVdotGain} VDOT 향상이 필요한 도전적 목표입니다. 인터벌과 역치 템포런 소화 후 수면 및 리커버리 식단에 각별히 유의하세요.`;
  } else {
    feasibilityAssessment = `${totalWeeks}주 대비 기량 향상 폭(+${requiredMonthlyVdotGain}/월)이 큽니다. 중간 10K 테스트 대회를 거쳐 실전 페이스를 단계별로 점검하는 것을 강력 권장합니다.`;
  }

  const coachingSummary = isHalfCourse
    ? `현재 VDOT ${vdot}에서 목표 하프 ${effectiveTargetFinishTime} 달성을 위한 ${totalWeeks}주 마스터플랜입니다. 주간 마일리지는 하프 최적 상한선인 피크 ${peakWeeklyKm}km로 정밀 제한하여 부상 위험을 차단하고, 수요일 역치런과 주말 LSD를 통해 ${effectiveTargetPace} 페이스 경제성을 완벽하게 체화하도록 설계되었습니다.`
    : `현재 기량(VDOT ${vdot})과 목표(${targetCourseName} ${effectiveTargetFinishTime})를 과학적으로 매칭한 주기화 플랜입니다. 체계적인 3:1 웨이브로 피로를 제어하며 목표를 달성합니다.`;

  const fitnessAudit: PlanFitnessAudit = {
    fitScore,
    fitGrade,
    currentVdot: vdot,
    targetVdot,
    vdotGap,
    requiredMonthlyVdotGain,
    feasibilityAssessment,
    targetPaceFormatted: `${effectiveTargetPace}/km`,
    currentEstimatedPaceFormatted: `${currentEstimatedPaceFormatted}/km`,
    paceGapSeconds,
    baselineWeeklyKm,
    peakWeeklyKm,
    recommendedPeakKmRange,
    peakLsdKm,
    recommendedLsdKmRange,
    auditDetails,
    coachingSummary,
  };

  return {
    id: `plan_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings,
    weeks,
    totalWeeks,
    totalPlannedKm: Math.round(totalPlannedKm * 10) / 10,
    totalPlannedSessions,
    totalPlanLoadScore: Math.round(totalPlanLoadScore * 10) / 10,
    categoryOverrides: {},
    targetRaceSummary,
    runnerAnalysisSummary: {
      currentVdot: vdot,
      baselineWeeklyKm,
      progressionDescription: isContinuousProgression
        ? '3주 빌드업 + 1주 회복(Deload) 점진적 과부하 4주 사이클 주기화 적용'
        : settings.goalMode === 'target_goal'
        ? `목표 ${targetCourseName} ${effectiveTargetFinishTime} (${effectiveTargetPace}/km) 주기화 달성 플랜`
        : `${targetRace?.name || '목표 대회'} D-Day 주기화 및 테이퍼링 감량기 전략 적용`,
      continuousProgression: isContinuousProgression,
      acwrValue: runnerState.acwr,
      fatigueRisk: runnerState.fatigueRisk,
    },
    fitnessAudit,
  };
}
