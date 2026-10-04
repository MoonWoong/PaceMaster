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
} from '../types';
import { getTrainingPaces, formatPace, parseTimeToSeconds } from './vdot';
import { attachShoeRecommendationsToPlan } from './shoeRecommender';
import { analyzeRunnerState } from './trainingPlanGenerator';

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
 * Infer course distance in km with precision
 */
export function parseCourseKm(courseName: string): number {
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
  goals?: RunningGoals
): { pace: string; finishTime: string } {
  const dist = parseCourseKm(courseName);

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
 * Comprehensive Training Plan Generator
 */
export function generateComprehensivePlan(params: {
  vdot: number;
  settings: TrainingPlanPeriodSettings;
  trainingSessions: TrainingSession[];
  shoes: RunningShoe[];
  races: RegisteredRace[];
  goals?: RunningGoals;
}): ComprehensiveTrainingPlan {
  const { vdot, settings, trainingSessions, shoes, races, goals } = params;

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
  let startMonday = getMonday(settings.startDate ? new Date(settings.startDate) : new Date());
  let totalWeeks = settings.durationWeeks || 8;

  // Target race matching (if goalMode is 'race')
  let targetRace: RegisteredRace | undefined = undefined;
  if (settings.goalMode === 'race' && settings.targetRaceId) {
    targetRace = races.find((r) => r.id === settings.targetRaceId);
  }
  if (!targetRace && settings.goalMode === 'race') {
    const todayStr = formatDate(new Date());
    const upcomingRaces = races
      .filter((r) => r.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    targetRace = upcomingRaces.find((r) => r.isTarget || r.priority === 'A') || upcomingRaces[0];
  }

  // Duration preset calculations
  if (settings.durationPreset === 'to_target_race' && targetRace) {
    const raceDate = new Date(targetRace.date);
    const diffMs = raceDate.getTime() - startMonday.getTime();
    const diffWeeks = Math.max(2, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
    totalWeeks = Math.min(24, diffWeeks);
  } else if (settings.durationPreset === 'custom' && settings.endDate) {
    const end = new Date(settings.endDate);
    const diffMs = end.getTime() - startMonday.getTime();
    const diffWeeks = Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
    totalWeeks = Math.min(26, diffWeeks);
  }

  totalWeeks = Math.max(1, Math.min(26, totalWeeks));

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
  const todayStr = formatDate(new Date());

  for (let w = 1; w <= totalWeeks; w++) {
    const weekMonday = new Date(startMonday.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000);
    const weekSunday = new Date(weekMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
    const startDateStr = formatDate(weekMonday);
    const endDateStr = formatDate(weekSunday);

    const isCurrentWeek = todayStr >= startDateStr && todayStr <= endDateStr;

    // Check if any registered race takes place in this week!
    const raceInThisWeek = races.find((r) => r.date >= startDateStr && r.date <= endDateStr);

    // Determine Periodization Phase & Focus
    let phase: PlanPeriodizationPhase = '스피드/지구력 빌드업기 (Build)';
    let phaseBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    let phaseDescription = '심폐 지구력 및 스피드 지속력 향상 훈련';
    let focus = '주간 거리 및 포인트 훈련을 통한 러닝 체력 증진';
    let volumeMultiplier = 1.0;

    if (settings.goalMode === 'race' || settings.goalMode === 'target_goal') {
      const weeksToTarget = totalWeeks - w;

      if (weeksToTarget === 0) {
        phase = '대회 직전 조정기 (Race Week)';
        phaseBadgeColor = 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold';
        phaseDescription = '결전의 날! 가벼운 리듬 점검 및 글리코겐 충전';
        focus = `${settings.goalMode === 'race' ? targetRace?.name || '목표 대회' : `목표 ${targetCourseName}`} 완주 및 목표 페이스(${effectiveTargetPace}) 실전 달성`;
        volumeMultiplier = 0.55;
      } else if (weeksToTarget === 1) {
        phase = '테이퍼링 감량기 (Tapering)';
        phaseBadgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
        phaseDescription = '훈련량 40% 감량 및 근육 회복 극대화';
        focus = '피로 누적 해소, 짧고 날카로운 질주로 신경계 각성 유지';
        volumeMultiplier = 0.65;
      } else if (weeksToTarget === 2) {
        phase = '테이퍼링 감량기 (Tapering)';
        phaseBadgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
        phaseDescription = '훈련량 20% 1차 감량 및 영양 보충';
        focus = '장거리 거리 서서히 단축, 목표 페이스 적응 훈련';
        volumeMultiplier = 0.8;
      } else if (weeksToTarget <= 4) {
        phase = '목표 페이스 특화기 (Peak)';
        phaseBadgeColor = 'bg-purple-100 text-purple-900 border-purple-300';
        phaseDescription = '목표 페이스 락온 및 최고 피크 볼륨';
        focus = `목표 페이스(${effectiveTargetPace}) 집중 지속주 및 젖산 역치 강화`;
        volumeMultiplier = 1.15;
      } else if (w <= Math.max(1, Math.floor(totalWeeks * 0.35))) {
        phase = '기초 유산소 구축기 (Base)';
        phaseBadgeColor = 'bg-sky-100 text-sky-900 border-sky-300';
        phaseDescription = '유산소 기초 체력 및 관절/인대 지구력 형성';
        focus = '무리 없는 편안한 이지런 마일리지 적립 및 모세혈관 발달';
        volumeMultiplier = 0.9 + (w - 1) * 0.05;
      } else {
        phase = '스피드/지구력 빌드업기 (Build)';
        phaseBadgeColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
        phaseDescription = '주간 마일리지 점진 증량 및 인터벌/템포런 확장';
        focus = 'VO2max 인터벌 세트 및 점진적 주말 LSD 거리 확장';
        volumeMultiplier = 1.05 + ((w % 3) * 0.05);
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
        volumeMultiplier = 0.75 + (mesocycleIndex - 1) * 0.04;
      } else if (cycleWeek === 1) {
        phase = '지속 점진적 과부하 (Progression)';
        phaseBadgeColor = 'bg-blue-100 text-blue-900 border-blue-300';
        phaseDescription = `사이클 ${mesocycleIndex} 1단계: 새로운 기준선 안정화 (기준 VDOT ${vdot + (mesocycleIndex - 1) * 0.5})`;
        focus = '새로운 마일리지 적응 및 안정적인 Zone 2 유산소 베이스 정립';
        volumeMultiplier = 1.0 + (mesocycleIndex - 1) * 0.05;
      } else if (cycleWeek === 2) {
        phase = '스피드/지구력 빌드업기 (Build)';
        phaseBadgeColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
        phaseDescription = `사이클 ${mesocycleIndex} 2단계: 볼륨 및 인터벌 강도 +6% 점진적 상승`;
        focus = '젖산 역치 템포런 및 중거리 LSD 빌드업';
        volumeMultiplier = 1.06 + (mesocycleIndex - 1) * 0.05;
      } else {
        phase = '목표 페이스 특화기 (Peak)';
        phaseBadgeColor = 'bg-indigo-100 text-indigo-900 border-indigo-300';
        phaseDescription = `사이클 ${mesocycleIndex} 3단계: 사이클 최고 마일리지 도전`;
        focus = '스피드 지속력 극대화 및 최고 장거리 LSD 소화';
        volumeMultiplier = 1.12 + (mesocycleIndex - 1) * 0.05;
      }
    }

    // Intermediate Tune-up race adjustment
    if (raceInThisWeek && settings.goalMode === 'race' && targetRace && raceInThisWeek.id !== targetRace.id) {
      phase = '스피드/지구력 빌드업기 (Build)';
      phaseBadgeColor = 'bg-orange-100 text-orange-900 border-orange-300 font-bold';
      phaseDescription = `중간 점검 튠업 대회 (${raceInThisWeek.name}) 포함 주간`;
      focus = `실전 레이스 감각 점검 및 대회 당일 페이스 테스트 (${raceInThisWeek.priority || 'B'}등급)`;
      volumeMultiplier = Math.min(volumeMultiplier, 0.85);
    }

    // Calculate Week Target Mileage
    const targetWeeklyKm = Math.round(baselineWeeklyKm * volumeMultiplier * 10) / 10;
    totalPlannedKm += targetWeeklyKm;

    // Training days setup
    const trainingDays = settings.trainingDays && settings.trainingDays.length > 0
      ? settings.trainingDays
      : (['화요일', '목요일', '토요일', '일요일'] as DayOfWeek[]);
    const speedDay = settings.speedDay || '화요일';
    const longRunDay = settings.longRunDay || '일요일';

    // Rotate speed workout type for this week!
    const activeSpeedType = speedTypes[(w - 1) % speedTypes.length];

    const isRaceWeek = phase === '대회 직전 조정기 (Race Week)';
    const isTaper = phase === '테이퍼링 감량기 (Tapering)';
    const isDeload = phase === '회복 및 디로드 (Recovery)';

    let longRunKm = Math.round(targetWeeklyKm * (isDeload ? 0.32 : isTaper ? 0.35 : 0.42) * 10) / 10;
    longRunKm = Math.max(8.0, Math.min(32.0, longRunKm));

    let speedKm = Math.round(targetWeeklyKm * (isRaceWeek ? 0.15 : isDeload ? 0.18 : 0.22) * 10) / 10;
    speedKm = Math.max(5.0, Math.min(14.0, speedKm));

    const pointSum = (trainingDays.includes(longRunDay as DayOfWeek) ? longRunKm : 0) +
                     (trainingDays.includes(speedDay as DayOfWeek) ? speedKm : 0);
    const otherDays = trainingDays.filter((d) => d !== longRunDay && d !== speedDay);
    const baseJogKm = otherDays.length > 0
      ? Math.max(4.0, Math.round(((targetWeeklyKm - pointSum) / otherDays.length) * 10) / 10)
      : 6.0;

    const days: WeeklyPlanDay[] = DAY_ORDER.map((dayName, idx) => {
      const dayDate = new Date(weekMonday.getTime() + idx * 24 * 60 * 60 * 1000);
      const dateStr = formatDate(dayDate);
      const dayShort = DAY_SHORT_MAP[dayName];

      const matchedSession = trainingSessions.find((s) => s.date === dateStr);

      // Check if there is an actual registered race on this specific day!
      const raceOnThisDay = races.find((r) => r.date === dateStr);
      if (raceOnThisDay) {
        totalPlannedSessions++;
        const raceDist = parseCourseKm(raceOnThisDay.course);
        const isMainTarget = targetRace && raceOnThisDay.id === targetRace.id;

        // ACCURATELY CALCULATE PACE FOR THIS SPECIFIC RACE!
        const thisRacePaceInfo = isMainTarget
          ? { pace: effectiveTargetPace, finishTime: effectiveTargetFinishTime }
          : calculateSpecificRacePace(
              raceOnThisDay.course,
              raceOnThisDay.targetTime,
              undefined,
              vdot,
              goals
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

      // If not a chosen training day, it's a Rest day
      if (!trainingDays.includes(dayName)) {
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
          isCompleted: !!matchedSession,
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
              zone: 'Zone 1',
              focus: '심박 안정화 및 하체 피로 털기 스트레칭',
            },
          ];
        } else if (isDeload) {
          lsdTitle = `회복 디로드 저강도 LSD (${longRunKm}km)`;
          lsdPace = `${easyMax} ~ 6'30"`;
          lsdZone = 'Zone 2 (회복 유산소)';
          lsdDesc = `디로드 주간입니다. 무리 없는 편안한 페이스(${easyMax})로 달려 하체 관절의 부담을 줄이고 심폐 지구력을 편안하게 유지합니다.`;
          lsdStages = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅으로 몸을 풀고 호흡 안정',
            },
            {
              step: `2단계: 본운동 회복형 이지 LSD (${mainTotalKm}km)`,
              distanceKm: mainTotalKm,
              pace: easyMax,
              zone: 'Zone 2',
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
          // Peak Phase: Marathon-Pace build-up LSD
          const part1Km = Math.round(mainTotalKm * 0.6 * 10) / 10;
          const part2Km = Math.round((mainTotalKm - part1Km) * 10) / 10;
          lsdTitle = `마라톤 목표 페이스 빌드업 LSD (${longRunKm}km)`;
          lsdPace = `${easyMin} ~ ${effectiveTargetPace}`;
          lsdZone = 'Zone 2~3 (실전 마라톤 페이스 감각)';
          lsdDesc = `초반 ${part1Km}km는 안정적인 이지런(${easyMin} ~ ${easyMax})으로 달리고, 후반 ${part2Km}km는 실전 목표 페이스(${effectiveTargetPace})로 락온하여 후반 글리코겐 고갈 저항력을 기릅니다.`;
          lsdStages = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '체온 상승 및 관절 윤활액 분비 유도, 가벼운 호흡 리듬 정착',
            },
            {
              step: `2단계: 본훈련 1구간 유산소 지속주 (${part1Km}km)`,
              distanceKm: part1Km,
              pace: `${easyMin} ~ ${easyMax}`,
              zone: 'Zone 2',
              focus: '안정된 보폭과 케이던스(180spm) 유지, 지방 대사 최적화 및 5km마다 뉴트리션 섭취',
            },
            {
              step: `3단계: 본훈련 2구간 목표 페이스 락온 (${part2Km}km)`,
              distanceKm: part2Km,
              pace: effectiveTargetPace,
              zone: 'Zone 3~4',
              focus: `후반 피로 상황에서 실전 목표 페이스(${effectiveTargetPace}) 사수 훈련, 코어 중심 안정적 주행`,
            },
            {
              step: `4단계: 쿨다운 (${cooldownKm}km)`,
              distanceKm: cooldownKm,
              pace: `${easyMax} ~ 6'40"`,
              zone: 'Zone 1 (회복)',
              focus: '심박수를 점진적으로 떨어뜨리고 가벼운 햄스트링/종아리 스트레칭',
            },
          ];
        } else {
          // Regular Base / Build Phase
          lsdTitle = `유산소 지구력 장거리 LSD (${longRunKm}km)`;
          lsdPace = `${easyMin} ~ ${easyMax}`;
          lsdZone = 'Zone 2 (지구력)';
          lsdDesc = `장거리 주행력을 키우는 핵심 주말 포인트 훈련입니다. 이지 페이스(${easyMin} ~ ${easyMax})로 정속 주행하며 심폐 지구력을 극대화합니다.`;
          lsdStages = [
            {
              step: `1단계: 워밍업 (${warmupKm}km)`,
              distanceKm: warmupKm,
              pace: easyMax,
              zone: 'Zone 1~2',
              focus: '가벼운 조깅으로 관절 윤활액 분비 및 체온 상승 유도',
            },
            {
              step: `2단계: 본운동 LSD 정속 지속주 (${mainTotalKm}km)`,
              distanceKm: mainTotalKm,
              pace: `${easyMin} ~ ${easyMax}`,
              zone: 'Zone 2',
              focus: '일정한 보폭과 규칙적인 케이던스(180spm 내외) 유지, 5km마다 수분/전해질 보충 연습',
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
          isCompleted: !!matchedSession,
          stages: lsdStages,
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
            isCompleted: !!matchedSession,
            stages: hillStages,
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
            isCompleted: !!matchedSession,
            stages,
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
            isCompleted: !!matchedSession,
            stages,
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
            title: `롱 크루즈 인터벌 ${reps}세트 (${speedKm}km)`,
            distanceKm: speedKm,
            targetPace: thresholdPace,
            targetZone: 'Zone 4~5 (크루즈 인터벌)',
            description: `워밍업 ${warmupKm}km 후 1500m 질주(${thresholdPace}) + 500m 조깅 휴식 ${reps}세트 반복 + 쿨다운 ${cooldownKm}km.`,
            purpose: '젖산 역치 지속력과 심폐 한계 극복 능력을 동시에 강화하는 중장거리 핵심 인터벌',
            intensity: '높음',
            isCompleted: !!matchedSession,
            stages,
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

        // E. Buildup Run (빌드업주)
        if (activeSpeedType === '빌드업주') {
          const sec1Dist = Math.round(speedKm * 0.35 * 10) / 10;
          const sec2Dist = Math.round(speedKm * 0.40 * 10) / 10;
          const sec3Dist = Math.round((speedKm - sec1Dist - sec2Dist) * 10) / 10;

          const stages: WorkoutStage[] = [
            {
              step: `1구간: 워밍업 & 초반 이지런 (${sec1Dist}km)`,
              distanceKm: sec1Dist,
              pace: `${easyMax} ~ ${easyMin}`,
              zone: 'Zone 2',
              focus: '릴랙스한 주법으로 점진적 체온 및 심박수 상승, 무리 없는 안정 주행',
            },
            {
              step: `2구간: 본훈련 1구간 목표 페이스 정속 (${sec2Dist}km)`,
              distanceKm: sec2Dist,
              pace: effectiveTargetPace,
              zone: 'Zone 3',
              focus: `일정한 보폭과 리드미컬한 호흡 유지, 실전 목표 페이스(${effectiveTargetPace}) 감각 완벽 체화`,
            },
            {
              step: `3구간: 본훈련 2구간 역치 가속 피니시 (${sec3Dist}km)`,
              distanceKm: sec3Dist,
              pace: thresholdPace,
              zone: 'Zone 4',
              focus: `피로 속에서도 무너지지 않는 코어 유지와 강한 팔치기로 역치 페이스(${thresholdPace}) 네거티브 스플릿 피니시`,
            },
          ];
          normalizeStagesDistance(stages, speedKm);

          return {
            day: dayName,
            dayShort,
            dateStr,
            type: '템포런',
            title: `점진적 가속 빌드업주 (${speedKm}km)`,
            distanceKm: speedKm,
            targetPace: `${easyMin} → ${effectiveTargetPace} → ${thresholdPace}`,
            targetZone: 'Zone 2 → Zone 4',
            description: `이지런(${easyMin})으로 시작하여 중반 목표 페이스(${effectiveTargetPace})를 거쳐 마지막 구간은 역치 페이스(${thresholdPace})로 가속 완주합니다.`,
            purpose: '후반 가속 능력(Negative Split) 및 심리적 자신감 고취, 점진적 젖산 대사 적응력 배양',
            intensity: '높음',
            isCompleted: !!matchedSession,
            stages,
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
            isCompleted: !!matchedSession,
            stages,
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

        // G. Standard Tempo Run (젖산 역치 템포런)
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
          title: `젖산 역치(LT) 템포런 (${speedKm}km)`,
          distanceKm: speedKm,
          targetPace: thresholdPace,
          targetZone: 'Zone 4 (역치 페이스)',
          description: `워밍업 ${warmupKm}km 후 본훈련으로 역치 페이스(${thresholdPace}) ${mainKm}km 정속 지속주 진행 + 쿨다운 ${cooldownKm}km. 젖산 축적을 억제하고 페이스를 유지하는 감각을 기릅니다.`,
          purpose: '젖산 역치(Lactate Threshold) 지점을 상향 이동시켜, 마라톤 후반에도 페이스 저하 없이 쾌적하게 질주할 수 있는 지구력 배양',
          intensity: '높음',
          isCompleted: !!matchedSession,
          stages,
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

      // Base Aerobic / Recovery Running Day (조깅 / 회복주)
      const isRecoveryDay = otherDays.indexOf(dayName) === 0 && otherDays.length > 1;
      const workoutDist = isRecoveryDay ? Math.max(4.0, Math.round(baseJogKm * 0.8 * 10) / 10) : baseJogKm;
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
        isCompleted: !!matchedSession,
        stages: jogStages,
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
    });

    // Attach shoe rotation recommendations to days
    const daysWithShoes = attachShoeRecommendationsToPlan(days, shoes, trainingSessions);

    // Calculate completed km for this week
    const completedKm = Math.round(
      daysWithShoes.reduce((sum, d) => sum + (d.actualSession ? d.actualSession.totalDistanceKm : 0), 0) * 10
    ) / 10;

    weeks.push({
      weekNumber: w,
      startDateStr,
      endDateStr,
      weekLabel: `${w}주차 (${startDateStr.slice(5).replace('-', '/')} ~ ${endDateStr.slice(5).replace('-', '/')})`,
      phase,
      phaseBadgeColor,
      phaseDescription,
      focus,
      targetWeeklyKm,
      completedKm,
      days: daysWithShoes,
      raceInThisWeek,
      isCurrentWeek,
    });
  }

  // Target race summary
  const targetRaceSummary =
    targetRace
      ? {
          raceName: targetRace.name,
          raceDate: targetRace.date,
          dDayWeeks: Math.max(0, Math.ceil((new Date(targetRace.date).getTime() - new Date().getTime()) / (7 * 86400000))),
          course: targetCourseName,
          priority: targetRace.priority || 'A',
          targetTime: effectiveTargetFinishTime,
          targetPace: effectiveTargetPace,
        }
      : settings.goalMode === 'target_goal' && settings.targetCourse
      ? {
          raceName: `목표 ${settings.targetCourse} 기록 달성`,
          raceDate: settings.endDate || formatDate(new Date(startMonday.getTime() + (totalWeeks * 7 - 1) * 86400000)),
          dDayWeeks: totalWeeks,
          course: settings.targetCourse,
          priority: 'A',
          targetTime: effectiveTargetFinishTime,
          targetPace: effectiveTargetPace,
        }
      : undefined;

  return {
    id: `plan_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings,
    weeks,
    totalWeeks,
    totalPlannedKm: Math.round(totalPlannedKm * 10) / 10,
    totalPlannedSessions,
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
  };
}
