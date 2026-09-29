import { WeeklyPlanDay, WorkoutStage, TrainingSession, RunnerStateAnalysis, RunningShoe, SpeedWorkoutType } from '../types';
import { getTrainingPaces, formatPace } from './vdot';
import { attachShoeRecommendationsToPlan } from './shoeRecommender';

export type DayOfWeek = '월요일' | '화요일' | '수요일' | '목요일' | '금요일' | '토요일' | '일요일';

export interface PlanCustomOptions {
  trainingDays: DayOfWeek[]; // User selected running days (e.g. ['화요일', '목요일', '토요일', '일요일'])
  speedDay: DayOfWeek | '없음'; // Day for speed/interval/tempo point workout
  speedWorkoutType: SpeedWorkoutType; // Specific speed point
  longRunDay: DayOfWeek | '없음'; // Day for long slow distance point workout
  targetRaceCourse?: string; // 풀코스, 하프, 10K, 5K
  weeklyMileageGoal?: number; // Target weekly volume in km
  trainingSessions?: TrainingSession[]; // User's actual logged sessions for in-depth workload & trend analysis
  shoes?: RunningShoe[]; // User's owned running shoes for rotation recommendation
}

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
 * Helper to get Monday-Sunday week key (YYYY-MM-DD) for grouping sessions
 * If date is Sun(0), Monday is 6 days prior. If Mon(1), Monday is today.
 */
export function getWeekMondayDate(dateStrOrDate: string | Date): Date {
  const d = typeof dateStrOrDate === 'string' ? new Date(dateStrOrDate) : new Date(dateStrOrDate);
  if (isNaN(d.getTime())) return new Date();
  const day = d.getDay(); // 0 is Sun, 1 is Mon, 2 is Tue, ... 6 is Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Infer running workout type from session title or distance
 */
export function inferWorkoutType(
  title: string,
  distanceKm: number
): '조깅' | '템포런' | '인터벌' | 'LSD' | '회복주' | '휴식' {
  const t = (title || '').toLowerCase();
  if (
    t.includes('인터벌') ||
    t.includes('interval') ||
    t.includes('질주') ||
    t.includes('야소') ||
    t.includes('트랙') ||
    t.includes('speed')
  ) {
    return '인터벌';
  }
  if (
    t.includes('템포') ||
    t.includes('tempo') ||
    t.includes('역치') ||
    t.includes('threshold') ||
    t.includes('지속주') ||
    t.includes('빌드업')
  ) {
    return '템포런';
  }
  if (t.includes('lsd') || t.includes('장거리') || t.includes('long') || distanceKm >= 20) {
    return 'LSD';
  }
  if (t.includes('회복') || t.includes('리커버리') || t.includes('recovery')) {
    return '회복주';
  }
  return '조깅';
}

/**
 * In-depth Runner Workload & Training State Analyzer
 * Evaluates:
 * 1. 월요일~일요일 기준 직전 주간(지난주) 완료 마일리지 & 최근 4주 완료 주간 마일리지 추세
 * 2. ACWR (Acute:Chronic Workload Ratio) for Overuse/Fatigue Risk Assessment (지난주 / 최근 4주 평균)
 * 3. 이번 주 실훈련 기록(예: 월요일 훈련) 실시간 감지 및 남은 요일 잔여 볼륨 자동 산출
 * 4. Recent Longest Run endurance capacity
 * 5. Tailored Volume & Point workout distance adjustment parameters
 */
export function analyzeRunnerState(
  trainingSessions: TrainingSession[] = [],
  targetRaceCourse: string = '풀코스',
  refDate: Date = new Date()
): RunnerStateAnalysis {
  const isFullCourse = targetRaceCourse.includes('풀') || targetRaceCourse.includes('42');
  const isHalfCourse = targetRaceCourse.includes('하프') || targetRaceCourse.includes('21');
  const is10k = targetRaceCourse.includes('10');

  // Fallback defaults if no logged sessions
  const defaultTargetLsd = isFullCourse ? 26 : isHalfCourse ? 18 : is10k ? 14 : 10;
  const defaultWeeklyBase = isFullCourse ? 48 : isHalfCourse ? 38 : is10k ? 28 : 20;

  // Determine current active week Monday
  let currentWeekMonday = getWeekMondayDate(refDate);
  let currentWeekSunday = new Date(currentWeekMonday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

  // If training sessions exist and all are far older than 60 days, calibrate to latest session's week
  if (trainingSessions && trainingSessions.length > 0) {
    const latestDate = trainingSessions.reduce((max, s) => {
      const d = new Date(s.date);
      return !isNaN(d.getTime()) && d > max ? d : max;
    }, new Date(0));

    if (refDate.getTime() - latestDate.getTime() > 60 * 24 * 60 * 60 * 1000) {
      currentWeekMonday = getWeekMondayDate(latestDate);
      currentWeekSunday = new Date(currentWeekMonday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    }
  }

  // Last Week (월요일 00:00:00 ~ 일요일 23:59:59.999 기준)
  const lastWeekMonday = new Date(currentWeekMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekSunday = new Date(currentWeekMonday.getTime() - 1);
  const lastWeekLabel = `${String(lastWeekMonday.getMonth() + 1).padStart(2, '0')}.${String(
    lastWeekMonday.getDate()
  ).padStart(2, '0')}(월) ~ ${String(lastWeekSunday.getMonth() + 1).padStart(2, '0')}.${String(
    lastWeekSunday.getDate()
  ).padStart(2, '0')}(일)`;

  if (!trainingSessions || trainingSessions.length === 0) {
    return {
      recent4WeeksDistances: [],
      avgWeeklyMileage4Weeks: defaultWeeklyBase,
      lastWeekDistance: defaultWeeklyBase,
      peakWeeklyDistance: defaultWeeklyBase,
      mileageTrend: '초기빌드',
      trendRatio: 0,
      acuteLoadKm: defaultWeeklyBase,
      chronicLoadKm: defaultWeeklyBase,
      acwr: 1.0,
      fatigueRisk: '안전(스위트스팟)',
      recentLongestRunKm: defaultTargetLsd * 0.75,
      recommendedWeeklyKm: defaultWeeklyBase,
      mileageAdjustmentNote: '누적 훈련 데이터가 없어 목표 코스 기준 표준 가이드라인 볼륨으로 산출되었습니다.',
      intensityAdjustmentNote: '기본 훈련 강도로 시작하며 점진적인 빌드업을 권장합니다.',
      longRunRecommendedKm: defaultTargetLsd,
      speedVolumeRecommendedKm: isFullCourse ? 10 : isHalfCourse ? 9 : 8,
      lastWeekLabel,
      thisWeekLoggedKm: 0,
      thisWeekSessionsCount: 0,
      thisWeekDaysDone: [],
      remainingWeeklyPlanKm: defaultWeeklyBase,
    };
  }

  // 1. Group sessions by 4 Completed Weeks (Week -4, Week -3, Week -2, Week -1 지난주)
  const completed4Weeks: {
    weekLabel: string;
    monday: Date;
    sunday: Date;
    distanceKm: number;
    sessions: TrainingSession[];
  }[] = [];

  for (let i = 4; i >= 1; i--) {
    const wMonday = new Date(currentWeekMonday.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const wSunday = new Date(wMonday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    const mMonth = String(wMonday.getMonth() + 1).padStart(2, '0');
    const mDate = String(wMonday.getDate()).padStart(2, '0');
    const isImmediateLastWeek = i === 1;

    const wSessions = trainingSessions.filter((s) => {
      const sDate = new Date(s.date);
      return !isNaN(sDate.getTime()) && sDate >= wMonday && sDate <= wSunday;
    });

    const wDist = Math.round(wSessions.reduce((sum, s) => sum + (s.totalDistanceKm || 0), 0) * 10) / 10;

    completed4Weeks.push({
      weekLabel: isImmediateLastWeek ? `${mMonth}/${mDate}주 (지난주)` : `${mMonth}/${mDate}주`,
      monday: wMonday,
      sunday: wSunday,
      distanceKm: wDist,
      sessions: wSessions,
    });
  }

  // 2. Identify sessions logged in THIS WEEK (이번 주 실훈련 기록)
  const thisWeekSessions = trainingSessions.filter((s) => {
    const sDate = new Date(s.date);
    return !isNaN(sDate.getTime()) && sDate >= currentWeekMonday && sDate <= currentWeekSunday;
  });

  const thisWeekLoggedKm = Math.round(
    thisWeekSessions.reduce((sum, s) => sum + (s.totalDistanceKm || 0), 0) * 10
  ) / 10;

  const thisWeekDaysDone: DayOfWeek[] = [];
  thisWeekSessions.forEach((s) => {
    const sDate = new Date(s.date);
    const dayNum = sDate.getDay();
    const dayMap: Record<number, DayOfWeek> = {
      1: '월요일',
      2: '화요일',
      3: '수요일',
      4: '목요일',
      5: '금요일',
      6: '토요일',
      0: '일요일',
    };
    const dayName = dayMap[dayNum];
    if (dayName && !thisWeekDaysDone.includes(dayName)) {
      thisWeekDaysDone.push(dayName);
    }
  });

  // Last week's completed distance (월~일 기준 지난주)
  const lastWeekData = completed4Weeks[3];
  let lastWeekDistance = lastWeekData.distanceKm;

  // Fallback if all 4 completed weeks are 0 but user has historical sessions
  const totalCompletedDist = completed4Weeks.reduce((sum, w) => sum + w.distanceKm, 0);
  if (totalCompletedDist === 0 && trainingSessions.length > 0) {
    const allDist = trainingSessions.reduce((sum, s) => sum + (s.totalDistanceKm || 0), 0);
    lastWeekDistance = Math.min(Math.round((allDist / Math.max(1, trainingSessions.length / 3)) * 10) / 10, defaultWeeklyBase);
  }

  // 4-week average weekly distance based strictly on completed weeks
  const nonZeroWeeks = completed4Weeks.filter((w) => w.distanceKm > 0);
  const avgWeeklyMileage4Weeks =
    nonZeroWeeks.length > 0
      ? Math.round(
          (completed4Weeks.reduce((acc, w) => acc + w.distanceKm, 0) /
            Math.max(nonZeroWeeks.length, 1)) *
            10
        ) / 10
      : lastWeekDistance > 0
      ? lastWeekDistance
      : defaultWeeklyBase;

  // Peak weekly distance across all logged weeks
  const allWeekMap: Record<string, number> = {};
  for (const session of trainingSessions) {
    const monday = getWeekMondayDate(session.date);
    const key = monday.toISOString().slice(0, 10);
    allWeekMap[key] = (allWeekMap[key] || 0) + (session.totalDistanceKm || 0);
  }
  const peakWeeklyDistance = Math.round(
    Math.max(
      ...Object.values(allWeekMap),
      lastWeekDistance,
      avgWeeklyMileage4Weeks
    ) * 10
  ) / 10;

  // Recent longest run in last 4 weeks or all sessions
  const recentSessions = completed4Weeks.flatMap((w) => w.sessions);
  const longestSource = recentSessions.length > 0 ? recentSessions : trainingSessions;
  const longestRunSession = longestSource.reduce(
    (max, s) => (s.totalDistanceKm > max ? s.totalDistanceKm : max),
    0
  );
  const recentLongestRunKm = Math.round(longestRunSession * 10) / 10;

  // 3. Mileage Trend Calculation (Last Week vs 4-Week Average)
  let trendRatio = 0;
  if (avgWeeklyMileage4Weeks > 0) {
    trendRatio = Math.round(((lastWeekDistance - avgWeeklyMileage4Weeks) / avgWeeklyMileage4Weeks) * 100);
  }

  let mileageTrend: '증가세' | '안정유지' | '감소세' | '초기빌드' = '안정유지';
  if (nonZeroWeeks.length < 2 && trainingSessions.length <= 3) {
    mileageTrend = '초기빌드';
  } else if (trendRatio >= 10) {
    mileageTrend = '증가세';
  } else if (trendRatio <= -10) {
    mileageTrend = '감소세';
  } else {
    mileageTrend = '안정유지';
  }

  // 4. ACWR (Acute:Chronic Workload Ratio)
  // Acute: Last completed week's volume (월~일 지난주)
  // Chronic: rolling 4-week average of completed weeks
  const acuteLoadKm = lastWeekDistance;
  const chronicLoadKm = avgWeeklyMileage4Weeks > 0 ? avgWeeklyMileage4Weeks : defaultWeeklyBase;
  const acwr = chronicLoadKm > 0 ? Math.round((acuteLoadKm / chronicLoadKm) * 100) / 100 : 1.0;

  let fatigueRisk: '안전(스위트스팟)' | '주의(과부하 위험)' | '부족(언더트레이닝)' | '회복권장' = '안전(스위트스팟)';
  if (acwr > 1.35) {
    fatigueRisk = '주의(과부하 위험)';
  } else if (acwr < 0.75) {
    fatigueRisk = '부족(언더트레이닝)';
  } else if (acwr >= 0.8 && acwr <= 1.25) {
    fatigueRisk = '안전(스위트스팟)';
  } else {
    fatigueRisk = acwr > 1.25 ? '주의(과부하 위험)' : '회복권장';
  }

  // 5. Detailed Mileage & Intensity Adaptive Adjustment Logic
  let targetWeeklyVolume = 0;
  let mileageAdjustmentNote = '';
  let intensityAdjustmentNote = '';

  if (acwr > 1.3) {
    // Overload danger: throttle back volume slightly (-5%~-10%) to absorb fatigue
    targetWeeklyVolume = Math.round(lastWeekDistance * 0.92);
    mileageAdjustmentNote = `지난주 주간 부하(ACWR ${acwr})가 1.3을 초과하여 주의 구간입니다. 피로 흡수를 위해 주간 마일리지를 하향 조정한 ${targetWeeklyVolume}km로 안전하게 리셋합니다.`;
    intensityAdjustmentNote = '인터벌 질주 반복수와 고강도 지속주 거리를 축소하고 보강 운동 및 완전 휴식에 비중을 둡니다.';
  } else if (acwr < 0.8) {
    // Under-training: safely ramp up (+10%) from current level
    const baseRef = Math.max(lastWeekDistance, chronicLoadKm * 0.85);
    targetWeeklyVolume = Math.round(Math.min(baseRef * 1.1, defaultWeeklyBase));
    mileageAdjustmentNote = `지난주 마일리지가 일시적 감소 상태(ACWR ${acwr})였습니다. 10% 증량 안전 법칙을 적용하여 단계적으로 ${targetWeeklyVolume}km까지 회복 빌드업합니다.`;
    intensityAdjustmentNote = '고강도 질주보다는 Zone 2 유산소 베이스 조깅의 비중을 높여 기초 심폐 용적을 재충전합니다.';
  } else {
    // Optimal Sweet Spot (0.8 ~ 1.3)
    if (mileageTrend === '증가세') {
      targetWeeklyVolume = Math.round(Math.min(lastWeekDistance * 1.05, defaultWeeklyBase * 1.15));
      mileageAdjustmentNote = `안정적인 주간 마일리지 상승세(최근 4주 평균 ${avgWeeklyMileage4Weeks}km ➡️ 지난주 ${lastWeekDistance}km)를 반영하여 안전 권장 상한(+5%)인 ${targetWeeklyVolume}km로 세팅되었습니다.`;
      intensityAdjustmentNote = '탁월한 훈련 적응력을 보이고 있어 계획된 포인트(스피드/장거리) 강도를 온전히 소화하도록 배분합니다.';
    } else {
      targetWeeklyVolume = Math.round(Math.max(lastWeekDistance, avgWeeklyMileage4Weeks));
      mileageAdjustmentNote = `안정적인 훈련 지속성(ACWR ${acwr}, 최근 4주 평균 ${avgWeeklyMileage4Weeks}km)을 감안하여 몸에 부담 없는 ${targetWeeklyVolume}km로 밸런스를 맞추었습니다.`;
      intensityAdjustmentNote = '목표 대회 페이스에 맞춘 정밀 인터벌/템포런 훈련을 핵심 포인트로 배치합니다.';
    }
  }

  // Ensure minimum threshold
  targetWeeklyVolume = Math.max(targetWeeklyVolume, isFullCourse ? 32 : isHalfCourse ? 24 : 18);

  const remainingWeeklyPlanKm = Math.max(0, Math.round((targetWeeklyVolume - thisWeekLoggedKm) * 10) / 10);

  // If sessions were completed this week (e.g. Monday), reflect in AI notes
  if (thisWeekLoggedKm > 0) {
    mileageAdjustmentNote += ` 이번 주 이미 완료된 훈련(${thisWeekDaysDone.join(', ')} 총 ${thisWeekLoggedKm}km)이 실시간 반영되어, 남은 요일은 잔여 ${remainingWeeklyPlanKm}km에 맞춰 안전하게 자동 재배분되었습니다.`;
    intensityAdjustmentNote += ` ${thisWeekDaysDone.join(', ')} 실훈련 완료 피로도를 감안하여, 남은 요일의 포인트 훈련과 회복 조깅이 황금 비율로 재설정되었습니다.`;
  }

  // 6. Adaptive Long Run & Speed Run Distances
  const maxSafeLongRun = Math.round(
    Math.min(
      defaultTargetLsd,
      targetWeeklyVolume * 0.4,
      Math.max(recentLongestRunKm + 3, defaultTargetLsd * 0.65)
    )
  );
  const longRunRecommendedKm = Math.max(maxSafeLongRun, isFullCourse ? 18 : isHalfCourse ? 12 : 8);

  const speedVolumeRecommendedKm = isFullCourse
    ? targetWeeklyVolume >= 42 ? 10 : 8
    : isHalfCourse
    ? targetWeeklyVolume >= 34 ? 9 : 8
    : 8;

  const recent4WeeksDistances = completed4Weeks.map((w) => ({
    weekLabel: w.weekLabel,
    distanceKm: w.distanceKm,
  }));

  return {
    recent4WeeksDistances,
    avgWeeklyMileage4Weeks,
    lastWeekDistance,
    peakWeeklyDistance,
    mileageTrend,
    trendRatio,
    acuteLoadKm,
    chronicLoadKm,
    acwr,
    fatigueRisk,
    recentLongestRunKm,
    recommendedWeeklyKm: targetWeeklyVolume,
    mileageAdjustmentNote,
    intensityAdjustmentNote,
    longRunRecommendedKm,
    speedVolumeRecommendedKm,
    lastWeekLabel,
    thisWeekLoggedKm,
    thisWeekSessionsCount: thisWeekSessions.length,
    thisWeekDaysDone,
    remainingWeeklyPlanKm,
  };
}

/**
 * AI Weekly Training Schedule Generator
 * Tailors daily workouts based on current VDOT, target race, customized training days,
 * and user-specified Point workouts (Speed workout & Long-distance workout).
 */
export function generateWeeklyTrainingPlan(
  vdot: number = 45,
  targetRaceCourse: string = '풀코스',
  options?: Partial<PlanCustomOptions>
): WeeklyPlanDay[] {
  const paces = getTrainingPaces(vdot > 28 ? vdot : 45);

  const easyMin = paces ? paces.easyPaceRange.min : "5'40\"";
  const easyMax = paces ? paces.easyPaceRange.max : "6'15\"";
  const tempoPace = paces ? paces.thresholdPace.pace : "4'35\"";
  const marathonPace = paces ? paces.marathonPace.pace : "4'55\"";
  const intervalPace = paces ? paces.intervalPace.pace : "4'05\"";

  const rawEasySec = paces ? paces.easyPaceRange.rawMinSec : 340;
  const rawTempoSec = paces ? paces.thresholdPace.rawSec : 275;
  const rawIntervalSec = paces ? paces.intervalPace.rawSec : 245;

  const isFullCourse = targetRaceCourse.includes('풀') || targetRaceCourse.includes('42');
  const isHalfCourse = targetRaceCourse.includes('하프') || targetRaceCourse.includes('21');
  const is10k = targetRaceCourse.includes('10');

  // If training sessions are provided, perform in-depth workload and state analysis
  const analysis = options?.trainingSessions
    ? analyzeRunnerState(options.trainingSessions, targetRaceCourse)
    : null;

  // Defaults if options not provided
  const trainingDays =
    options?.trainingDays && options.trainingDays.length > 0
      ? options.trainingDays
      : (['화요일', '목요일', '토요일', '일요일'] as DayOfWeek[]);

  const speedDay = options?.speedDay ?? '수요일';
  const speedWorkoutType = options?.speedWorkoutType ?? '인터벌';
  const longRunDay = options?.longRunDay ?? '일요일';

  // Determine active current week Monday
  let currentWeekMonday = getWeekMondayDate(new Date());
  if (options?.trainingSessions && options.trainingSessions.length > 0) {
    const latestDate = options.trainingSessions.reduce((max, s) => {
      const d = new Date(s.date);
      return !isNaN(d.getTime()) && d > max ? d : max;
    }, new Date(0));

    if (new Date().getTime() - latestDate.getTime() > 60 * 24 * 60 * 60 * 1000) {
      currentWeekMonday = getWeekMondayDate(latestDate);
    }
  }

  // Pre-scan 7 days of this week to find completed sessions
  const weekDaysInfo = DAY_ORDER.map((dayName, idx) => {
    const dayDate = new Date(currentWeekMonday.getTime() + idx * 24 * 60 * 60 * 1000);
    const y = dayDate.getFullYear();
    const m = String(dayDate.getMonth() + 1).padStart(2, '0');
    const d = String(dayDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const sessionForDay = options?.trainingSessions?.find((s) => {
      if (s.date === dateStr) return true;
      const sd = new Date(s.date);
      return (
        !isNaN(sd.getTime()) &&
        sd.getFullYear() === dayDate.getFullYear() &&
        sd.getMonth() === dayDate.getMonth() &&
        sd.getDate() === dayDate.getDate()
      );
    });

    return {
      dayName,
      dayShort: DAY_SHORT_MAP[dayName],
      dayDate,
      dateStr,
      sessionForDay,
    };
  });

  const completedDayNames = weekDaysInfo.filter((d) => !!d.sessionForDay).map((d) => d.dayName);
  const completedKmThisWeek = Math.round(
    weekDaysInfo.reduce((sum, d) => sum + (d.sessionForDay ? d.sessionForDay.totalDistanceKm : 0), 0) * 10
  ) / 10;

  // Remaining running days (not yet completed)
  const remainingRunningDays = trainingDays.filter((d) => !completedDayNames.includes(d));

  // Distances dynamically adjusted to user state analysis or fallback defaults
  const totalTargetWeeklyKm = analysis ? analysis.recommendedWeeklyKm : (isFullCourse ? 48 : isHalfCourse ? 38 : 28);
  const remainingKm = Math.max(0, Math.round((totalTargetWeeklyKm - completedKmThisWeek) * 10) / 10);

  // Point workout target distances
  const hasRemainingLongRun = remainingRunningDays.includes(longRunDay as DayOfWeek);
  const hasRemainingSpeed = remainingRunningDays.includes(speedDay as DayOfWeek);

  let targetLsdDist = analysis ? analysis.longRunRecommendedKm : isFullCourse ? 26 : isHalfCourse ? 18 : is10k ? 14 : 10;
  let targetSpeedDist = analysis ? analysis.speedVolumeRecommendedKm : isFullCourse ? 10 : isHalfCourse ? 9 : 8;

  // If remainingKm is tight, scale points safely so total does not exceed safe volume
  if (remainingKm > 0 && hasRemainingLongRun && targetLsdDist > remainingKm * 0.6) {
    targetLsdDist = Math.max(10, Math.round(remainingKm * 0.5));
  }

  const defaultLsdDist = targetLsdDist;
  const defaultSpeedDist = targetSpeedDist;

  const pointRunsSum = (hasRemainingLongRun ? targetLsdDist : 0) + (hasRemainingSpeed ? targetSpeedDist : 0);
  const otherRemainingDaysCount = remainingRunningDays.filter(d => d !== longRunDay && d !== speedDay).length;

  const remainingForBaseRuns = Math.max(0, remainingKm - pointRunsSum);
  const standardJogDist = otherRemainingDaysCount > 0
    ? Math.max(4.0, Math.round((remainingForBaseRuns / otherRemainingDaysCount) * 10) / 10)
    : 8.0;
  const recoveryDist = Math.max(Math.round(standardJogDist * 0.65 * 10) / 10, 4.0);

  const rawPlan: WeeklyPlanDay[] = weekDaysInfo.map(({ dayName, dayShort, dateStr, sessionForDay }) => {
    // If this day already has an actual completed session, display it directly!
    if (sessionForDay) {
      const actualType = inferWorkoutType(sessionForDay.title, sessionForDay.totalDistanceKm);
      return {
        day: dayName,
        dayShort,
        dateStr,
        type: actualType,
        title: `[실제 기록 완료] ${sessionForDay.title}`,
        distanceKm: sessionForDay.totalDistanceKm,
        targetPace: sessionForDay.avgPace || "-'--\"",
        targetZone: sessionForDay.avgHr
          ? `평균 ${sessionForDay.avgHr}bpm (최고 ${sessionForDay.maxHr || sessionForDay.avgHr}bpm)`
          : '실훈련 페이스',
        description: `실제 기록 완료된 훈련입니다. (${sessionForDay.totalDistanceKm}km / 완주: ${sessionForDay.totalTime} / 평균페이스: ${sessionForDay.avgPace}/km${sessionForDay.avgHr ? ` / 평균심박: ${sessionForDay.avgHr}bpm` : ''}${sessionForDay.shoeName ? ` / 착용화: ${sessionForDay.shoeName}` : ''})`,
        intensity:
          (sessionForDay.avgHr && sessionForDay.avgHr > 165) || sessionForDay.totalDistanceKm >= 20
            ? '높음'
            : sessionForDay.totalDistanceKm >= 10
            ? '보통'
            : '낮음',
        isCompleted: true,
        actualSession: {
          id: sessionForDay.id,
          title: sessionForDay.title,
          totalDistanceKm: sessionForDay.totalDistanceKm,
          avgPace: sessionForDay.avgPace,
          avgHr: sessionForDay.avgHr,
          maxHr: sessionForDay.maxHr,
          shoeName: sessionForDay.shoeName,
          date: sessionForDay.date,
        },
      };
    }

    const isRunningDay = trainingDays.includes(dayName);

    // 1. If not an active running day, it's a Rest day
    if (!isRunningDay) {
      return {
        day: dayName,
        dayShort,
        type: '휴식',
        title: '완전 휴식 (Rest & Recovery)',
        distanceKm: 0,
        targetPace: '-',
        targetZone: '-',
        description: '폼롤러 근막 이완, 햄스트링/종아리 스트레칭 및 영양 보충. 포인트 훈련 피로 회복.',
        intensity: '휴식',
      };
    }

    // 2. Point 1: Long Run Day
    if (dayName === longRunDay) {
      const warmupDist = 2;
      const mainDist = defaultLsdDist - 4;
      const cooldownDist = 2;
      const lsdStages: WorkoutStage[] = [
        {
          step: `1구간 (초반 1~${warmupDist}km)`,
          distanceKm: warmupDist,
          pace: easyMax,
          zone: 'Zone 1~2',
          focus: '워밍업 및 체온 상승, 가벼운 호흡 리듬 조성',
        },
        {
          step: `2구간 (본운동 ${warmupDist + 1}~${warmupDist + mainDist}km)`,
          distanceKm: mainDist,
          pace: `${marathonPace} ~ ${easyMin}`,
          zone: 'Zone 2 (지속주)',
          focus: '지방 대사 최적화 및 5km마다 뉴트리션 섭취 시뮬레이션',
        },
        {
          step: `3구간 (후반 마무리 ${defaultLsdDist - cooldownDist + 1}~${defaultLsdDist}km)`,
          distanceKm: cooldownDist,
          pace: marathonPace,
          zone: 'Zone 2~3',
          focus: '후반 다리 피로 누적 상황에서 자세와 케이던스 집중 유지',
        },
      ];

      return {
        day: dayName,
        dayShort,
        type: 'LSD',
        title: `[포인트: 장거리] 주말 장거리 지속주(LSD) ${defaultLsdDist}km`,
        distanceKm: defaultLsdDist,
        targetPace: `${marathonPace} ~ ${easyMin}`,
        targetZone: 'Zone 2~3 (마라톤 페이스)',
        description: `${targetRaceCourse} 완주를 위한 심폐 및 글리코겐 고갈 적응 훈련. 5km/10km/15km 지점 수분 및 뉴트리션 섭취 시뮬레이션.`,
        intensity: '높음',
        stages: lsdStages,
      };
    }

    // 3. Point 2: Speed Workout Day
    if (dayName === speedDay) {
      if (speedWorkoutType === '인터벌') {
        const intervalReps = defaultSpeedDist >= 10 ? 8 : 6;
        const warmupKm = 2;
        const repsKm = intervalReps * 0.6; // 400m sprint + 200m rest = 600m
        const cooldownKm = Math.round((defaultSpeedDist - warmupKm - repsKm) * 10) / 10;

        const intervalStages: WorkoutStage[] = [
          {
            step: '워밍업 (1~2km)',
            distanceKm: warmupKm,
            pace: `${easyMin} ~ ${easyMax}`,
            zone: 'Zone 1~2',
            focus: '가벼운 조깅 + 동적 스트레칭 및 50m 질주 2회',
          },
          {
            step: `본세트 (400m 질주 x ${intervalReps}회)`,
            distanceKm: repsKm,
            pace: intervalPace,
            zone: 'Zone 5 (무산소)',
            focus: `트랙 400m ${intervalPace} 페이스 유지, 세트 간 200m(90초) 조깅 휴식`,
          },
          {
            step: `쿨다운 (${defaultSpeedDist - cooldownKm + 1}~${defaultSpeedDist}km)`,
            distanceKm: cooldownKm,
            pace: easyMax,
            zone: 'Zone 1 (회복)',
            focus: '심박 안정화 및 젖산 배출을 위한 가벼운 조깅',
          },
        ];

        return {
          day: dayName,
          dayShort,
          type: '인터벌',
          title: `[포인트: 스피드] VO2max 트랙 인터벌 (400m x ${intervalReps}회)`,
          distanceKm: defaultSpeedDist,
          targetPace: intervalPace,
          targetZone: 'Zone 5 (무산소/VO2max)',
          description: `워밍업 2km + 트랙 400m 질주(${intervalPace} 페이스) 및 200m 불완전 휴식 90초 ${intervalReps}회 반복 + 쿨다운 ${cooldownKm}km. 심폐 환기량 극대화.`,
          intensity: '높음',
          stages: intervalStages,
        };
      } else if (speedWorkoutType === '800m 인터벌') {
        const reps = defaultSpeedDist >= 12 ? 6 : defaultSpeedDist >= 9 ? 5 : 4;
        const warmupKm = 2;
        const repWorkKm = 0.8;
        const repRestKm = 0.4;
        const mainWorkVolume = reps * (repWorkKm + repRestKm);
        const cooldownKm = Math.max(1, Math.round((defaultSpeedDist - warmupKm - mainWorkVolume) * 10) / 10);
        const actualTotalDist = Math.round((warmupKm + mainWorkVolume + cooldownKm) * 10) / 10;

        const yassoStages: WorkoutStage[] = [
          {
            step: '워밍업 (1~2km)',
            distanceKm: warmupKm,
            pace: `${easyMin} ~ ${easyMax}`,
            zone: 'Zone 1~2',
            focus: '가벼운 조깅 + 고관절 가동성 스트레칭 및 80m 질주 2회',
          },
          {
            step: `본세트 (800m 질주 x ${reps}회)`,
            distanceKm: Math.round(mainWorkVolume * 10) / 10,
            pace: intervalPace,
            zone: 'Zone 5 (VO2max / 야소 800)',
            focus: `트랙 800m(2바퀴) ${intervalPace} 일정한 페이스 유지, 세트 간 400m(2분~2분30초) 불완전 회복 조깅`,
          },
          {
            step: `쿨다운 (${actualTotalDist - cooldownKm + 0.1}~${actualTotalDist}km)`,
            distanceKm: cooldownKm,
            pace: easyMax,
            zone: 'Zone 1 (회복)',
            focus: '심박 안정화, 체온 회복 및 젖산 완충을 위한 조깅',
          },
        ];

        return {
          day: dayName,
          dayShort,
          type: '인터벌',
          title: `[포인트: 스피드] 800m 야소 인터벌 (800m x ${reps}회)`,
          distanceKm: actualTotalDist,
          targetPace: intervalPace,
          targetZone: 'Zone 5 (VO2max / 야소 800)',
          description: `워밍업 2km + 트랙 800m 질주(${intervalPace} 페이스) 및 400m(약 2분 15초) 불완전 회복 조깅 ${reps}세트 반복 + 쿨다운 ${cooldownKm}km. 풀코스 목표 서브 달성을 위한 핵심 심폐 지구력 및 젖산 내성 극대화.`,
          intensity: '높음',
          stages: yassoStages,
        };
      } else if (speedWorkoutType === '1~3k 인터벌') {
        const isLongVolume = defaultSpeedDist >= 12;
        const repDistKm = isLongVolume ? 2 : 1; // 1km or 2km repeats
        const reps = isLongVolume ? (defaultSpeedDist >= 14 ? 4 : 3) : (defaultSpeedDist >= 9 ? 5 : 4);
        const restKm = 0.4; // 400m jog
        const warmupKm = 2;
        const mainWorkVolume = reps * (repDistKm + restKm);
        const cooldownKm = Math.max(1, Math.round((defaultSpeedDist - warmupKm - mainWorkVolume) * 10) / 10);
        const actualTotalDist = Math.round((warmupKm + mainWorkVolume + cooldownKm) * 10) / 10;

        const cruiseStages: WorkoutStage[] = [
          {
            step: '워밍업 (1~2km)',
            distanceKm: warmupKm,
            pace: `${easyMin} ~ ${easyMax}`,
            zone: 'Zone 1~2',
            focus: '가벼운 조깅 + 호흡 리듬 정렬 및 동적 스트레칭',
          },
          {
            step: `본세트 (${repDistKm}km 롱 인터벌 x ${reps}회)`,
            distanceKm: Math.round(mainWorkVolume * 10) / 10,
            pace: `${tempoPace} ~ ${intervalPace}`,
            zone: 'Zone 4~5 (크루즈 역치 인터벌)',
            focus: `${repDistKm}km 정속 크루즈 주행(${tempoPace}), 세트 간 400m(90초~2분) 불완전 회복 조깅`,
          },
          {
            step: `쿨다운 (${actualTotalDist - cooldownKm + 0.1}~${actualTotalDist}km)`,
            distanceKm: cooldownKm,
            pace: easyMax,
            zone: 'Zone 1 (회복)',
            focus: '정리 운동 및 심폐 젖산 회복',
          },
        ];

        return {
          day: dayName,
          dayShort,
          type: '인터벌',
          title: `[포인트: 스피드] 1~3k 롱 크루즈 인터벌 (${repDistKm}km x ${reps}회)`,
          distanceKm: actualTotalDist,
          targetPace: `${tempoPace} ~ ${intervalPace}`,
          targetZone: 'Zone 4~5 (크루즈 역치 인터벌)',
          description: `워밍업 2km + ${repDistKm}km 롱 크루즈 인터벌(${tempoPace}) ${reps}회 반복 (세트 간 400m 조깅 휴식) + 쿨다운 ${cooldownKm}km. 하프/풀코스 실전 레이스 페이스 지구력 및 역치 한계 속도 적응.`,
          intensity: '높음',
          stages: cruiseStages,
        };
      } else if (speedWorkoutType === '템포런') {
        const warmupKm = 2;
        const cooldownKm = 1;
        const mainTempoKm = defaultSpeedDist - (warmupKm + cooldownKm);

        const tempoStages: WorkoutStage[] = [
          {
            step: `1단계: 워밍업 (1~${warmupKm}km)`,
            distanceKm: warmupKm,
            pace: easyMax,
            zone: 'Zone 2 (유산소 기초)',
            focus: '체온 상승 및 심박수 점진적 상승 준비',
          },
          {
            step: `2단계: 젖산역치 지속주 (${warmupKm + 1}~${warmupKm + mainTempoKm}km, ${mainTempoKm}km)`,
            distanceKm: mainTempoKm,
            pace: tempoPace,
            zone: 'Zone 4 (젖산 역치)',
            focus: `T-Pace(${tempoPace}) 정속 주행으로 젖산 분해 및 페이스 억제 능력 강화`,
          },
          {
            step: `3단계: 쿨다운 (${defaultSpeedDist - cooldownKm + 1}~${defaultSpeedDist}km)`,
            distanceKm: cooldownKm,
            pace: easyMax,
            zone: 'Zone 1 (회복)',
            focus: '호흡 정상화 및 정리 운동',
          },
        ];

        return {
          day: dayName,
          dayShort,
          type: '템포런',
          title: `[포인트: 스피드] 젖산 역치(Threshold) ${defaultSpeedDist}km 템포런`,
          distanceKm: defaultSpeedDist,
          targetPace: tempoPace,
          targetZone: 'Zone 4 (젖산 역치)',
          description: `워밍업 2km + T-Pace 지속주 ${mainTempoKm}km(${tempoPace}) + 쿨다운 1km. 젖산 축적 억제 및 페이스 유지력 극대화.`,
          intensity: '높음',
          stages: tempoStages,
        };
      } else if (speedWorkoutType === '변속주(파틀렉)') {
        const warmupKm = 2;
        const cooldownKm = 1;
        const mainFartlekKm = defaultSpeedDist - (warmupKm + cooldownKm);

        const fartlekStages: WorkoutStage[] = [
          {
            step: `1단계: 워밍업 (1~${warmupKm}km)`,
            distanceKm: warmupKm,
            pace: easyMax,
            zone: 'Zone 2',
            focus: '가벼운 조깅 및 관절 가동성 확보',
          },
          {
            step: `2단계: 파틀렉 인터벌 (${warmupKm + 1}~${warmupKm + mainFartlekKm}km, ${mainFartlekKm}km)`,
            distanceKm: mainFartlekKm,
            pace: `${intervalPace} ↔ ${easyMin}`,
            zone: 'Zone 3~5',
            focus: '3분 쾌속 질주 + 2분 회복 조깅 6~7회 교대 반복',
          },
          {
            step: `3단계: 쿨다운 (${defaultSpeedDist - cooldownKm + 1}~${defaultSpeedDist}km)`,
            distanceKm: cooldownKm,
            pace: easyMax,
            zone: 'Zone 1',
            focus: '근육 이완 및 심박수 안정화',
          },
        ];

        return {
          day: dayName,
          dayShort,
          type: '인터벌',
          title: `[포인트: 스피드] 파틀렉(Fartlek) 변속주 ${defaultSpeedDist}km`,
          distanceKm: defaultSpeedDist,
          targetPace: `${intervalPace} ~ ${easyMin}`,
          targetZone: 'Zone 3~5 (심박 변동)',
          description: `워밍업 2km + 빠른 질주 3분(${intervalPace})과 회복 조깅 2분 교대 반복 ${mainFartlekKm}km + 쿨다운 1km. 지형과 페이스 변화에 대한 스피드 적응력 향상.`,
          intensity: '높음',
          stages: fartlekStages,
        };
      } else {
        // 빌드업주 (Negative Split Progression Run)
        // Mathematically accurate build-up:
        // Divides total distance (e.g. 9km or 10km) into 3~4 distinct progressive blocks.
        const totalDist = defaultSpeedDist;
        const stages: WorkoutStage[] = [];

        if (totalDist === 9) {
          // 9km: Exactly three 3km blocks (1~3km, 4~6km, 7~9km)
          const step1Sec = Math.round(rawEasySec); // e.g. 5'30" (Zone 2)
          const step2Sec = Math.round((rawEasySec + rawTempoSec) / 2); // e.g. 5'00" (Zone 3 M-Pace)
          const step3Sec = Math.round(rawTempoSec); // e.g. 4'32" (Zone 4 T-Pace)

          stages.push(
            {
              step: '1구간 (1~3km, 3km)',
              distanceKm: 3,
              pace: formatPace(step1Sec),
              zone: 'Zone 2 (유산소 이지)',
              focus: `시작 페이스 ${formatPace(step1Sec)} 정속 주행으로 호흡과 다리 리듬 세팅`,
            },
            {
              step: '2구간 (4~6km, 3km)',
              distanceKm: 3,
              pace: formatPace(step2Sec),
              zone: 'Zone 3 (마라톤 템포)',
              focus: `페이스를 km당 약 ${step1Sec - step2Sec}초 올려 ${formatPace(step2Sec)}로 빌드업 가속`,
            },
            {
              step: '3구간 (7~9km, 3km)',
              distanceKm: 3,
              pace: formatPace(step3Sec),
              zone: 'Zone 4 (젖산 역치)',
              focus: `최종 타겟 역치 페이스 ${formatPace(step3Sec)}로 힘차게 밀고 나가며 피니시`,
            }
          );
        } else if (totalDist === 10) {
          // 10km: 2km x 5 stages or 2km/3km/3km/2km
          // 4 stages: 1~3km (3km), 4~6km (3km), 7~8km (2km), 9~10km (2km)
          const p1 = Math.round(rawEasySec);
          const p2 = Math.round(rawEasySec - (rawEasySec - rawTempoSec) * 0.33);
          const p3 = Math.round(rawEasySec - (rawEasySec - rawTempoSec) * 0.67);
          const p4 = Math.round(rawTempoSec);

          stages.push(
            {
              step: '1구간 (1~3km, 3km)',
              distanceKm: 3,
              pace: formatPace(p1),
              zone: 'Zone 2 (유산소 기초)',
              focus: '편안한 이지 페이스로 출발하여 심폐 예열',
            },
            {
              step: '2구간 (4~6km, 3km)',
              distanceKm: 3,
              pace: formatPace(p2),
              zone: 'Zone 3 (하프 마라톤 페이스)',
              focus: '자세 정렬 및 가속, 일정한 피폭 유지',
            },
            {
              step: '3구간 (7~8km, 2km)',
              distanceKm: 2,
              pace: formatPace(p3),
              zone: 'Zone 3~4 (고강도 유산소)',
              focus: '호흡을 깊게 유지하며 역치 직전 강도로 페이스업',
            },
            {
              step: '4구간 (9~10km, 2km)',
              distanceKm: 2,
              pace: formatPace(p4),
              zone: 'Zone 4 (젖산 역치 피니시)',
              focus: `최고 스피드 구간! 젖산 역치(${formatPace(p4)}) 페이스로 완주`,
            }
          );
        } else {
          // 8km or other distance: 2km x 4 stages
          const p1 = Math.round(rawEasySec);
          const p2 = Math.round(rawEasySec - (rawEasySec - rawTempoSec) * 0.35);
          const p3 = Math.round(rawEasySec - (rawEasySec - rawTempoSec) * 0.7);
          const p4 = Math.round(rawTempoSec);

          stages.push(
            {
              step: '1구간 (1~2km, 2km)',
              distanceKm: 2,
              pace: formatPace(p1),
              zone: 'Zone 2 (출발)',
              focus: '편안한 이지 페이스로 호흡 정렬',
            },
            {
              step: '2구간 (3~4km, 2km)',
              distanceKm: 2,
              pace: formatPace(p2),
              zone: 'Zone 3 (가속)',
              focus: '케이던스를 올리며 템포 페이스 진입',
            },
            {
              step: '3구간 (5~6km, 2km)',
              distanceKm: 2,
              pace: formatPace(p3),
              zone: 'Zone 3~4 (빌드업)',
              focus: '피로 저항력을 시험하며 강도 유지',
            },
            {
              step: '4구간 (7~8km, 2km)',
              distanceKm: 2,
              pace: formatPace(p4),
              zone: 'Zone 4 (피니시)',
              focus: `역치 페이스(${formatPace(p4)})로 피니시`,
            }
          );
        }

        const startPace = stages[0].pace;
        const finishPace = stages[stages.length - 1].pace;
        const stageDescriptions = stages
          .map((s) => `${s.step}: ${s.pace}`)
          .join(' ➡️ ');

        return {
          day: dayName,
          dayShort,
          type: '템포런',
          title: `[포인트: 스피드] 네거티브 스플릿 빌드업 ${totalDist}km`,
          distanceKm: totalDist,
          targetPace: `${startPace} ➡️ ${finishPace}`,
          targetZone: 'Zone 2 ➡️ Zone 4',
          description: `총 ${totalDist}km를 ${stages.length}단계로 분할하여 점진적으로 가속합니다: [${stageDescriptions}]. 후반부 피로 누적 상황에서의 페이스 인내력과 질주 능력을 극대화합니다.`,
          intensity: '높음',
          stages,
        };
      }
    }

    // 4. Other training days: Recovery or Aerobic Zone 2 Jogging
    // Check if the previous day was a hard point run
    const dayIdx = DAY_ORDER.indexOf(dayName);
    const prevDayName = DAY_ORDER[(dayIdx + 6) % 7];
    const prevWasHard = prevDayName === speedDay || prevDayName === longRunDay;

    if (prevWasHard) {
      return {
        day: dayName,
        dayShort,
        type: '회복주',
        title: '젖산 배출 리커버리 회복주 & 스트레칭',
        distanceKm: recoveryDist,
        targetPace: easyMax,
        targetZone: 'Zone 1 (회복심박)',
        description: '포인트 훈련 후 근육통 완화 및 혈류 순환을 돕는 가벼운 회복 러닝. 코호흡 유지 필수.',
        intensity: '낮음',
      };
    }

    // Standard aerobic base run
    return {
      day: dayName,
      dayShort,
      type: '조깅',
      title: '유산소 기초(Aerobic Base) Zone 2 조깅 & 질주',
      distanceKm: standardJogDist,
      targetPace: `${easyMin} ~ ${easyMax}`,
      targetZone: 'Zone 2 (유산소)',
      description: '미토콘드리아 발달을 위한 편안한 대화 가능 페이스. 종료 전 100m 쾌속 질주(Strides) 4회로 신경계 자극.',
      intensity: '보통',
    };
  });

  if (options && options.shoes && options.shoes.length > 0) {
    return attachShoeRecommendationsToPlan(rawPlan, options.shoes, options.trainingSessions || []);
  }

  return rawPlan;
}

/**
 * Synchronize any weekly plan with actual logged sessions for this week
 * - Marks completed training days with real workout metrics and removes recommended shoes
 * - Dynamically adapts remaining uncompleted days based on completed mileage and fatigue balance
 */
export function enrichWeeklyPlanWithActualSessions(
  plan: WeeklyPlanDay[],
  trainingSessions: TrainingSession[] = [],
  analysis?: RunnerStateAnalysis | null
): WeeklyPlanDay[] {
  if (!plan || plan.length === 0) return plan;

  let currentWeekMonday = getWeekMondayDate(new Date());
  if (trainingSessions && trainingSessions.length > 0) {
    const latestDate = trainingSessions.reduce((max, s) => {
      const d = new Date(s.date);
      return !isNaN(d.getTime()) && d > max ? d : max;
    }, new Date(0));

    if (new Date().getTime() - latestDate.getTime() > 60 * 24 * 60 * 60 * 1000) {
      currentWeekMonday = getWeekMondayDate(latestDate);
    }
  }

  const endOfWeek = new Date(currentWeekMonday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  const thisWeekSessions = trainingSessions.filter((s) => {
    const sd = new Date(s.date);
    return !isNaN(sd.getTime()) && sd >= currentWeekMonday && sd <= endOfWeek;
  });

  const completedKmThisWeek = Math.round(
    thisWeekSessions.reduce((sum, s) => sum + (s.totalDistanceKm || 0), 0) * 10
  ) / 10;

  // Identify completed days
  const completedDayIndices: number[] = [];
  thisWeekSessions.forEach((s) => {
    const sd = new Date(s.date);
    const dayDiff = Math.floor((sd.getTime() - currentWeekMonday.getTime()) / (24 * 60 * 60 * 1000));
    if (dayDiff >= 0 && dayDiff < 7 && !completedDayIndices.includes(dayDiff)) {
      completedDayIndices.push(dayDiff);
    }
  });

  const totalTargetWeeklyKm =
    analysis?.recommendedWeeklyKm ||
    Math.round(plan.reduce((sum, d) => sum + (d.distanceKm || 0), 0) * 10) / 10;
  const remainingKm = Math.max(0, Math.round((totalTargetWeeklyKm - completedKmThisWeek) * 10) / 10);

  const uncompletedRunningDays = plan.filter(
    (d, i) => !completedDayIndices.includes(i) && d.type !== '휴식'
  );
  const originalRemainingSum = Math.round(
    uncompletedRunningDays.reduce((sum, d) => sum + (d.distanceKm || 0), 0) * 10
  ) / 10;

  return plan.map((pDay, idx) => {
    const dayDate = new Date(currentWeekMonday.getTime() + idx * 24 * 60 * 60 * 1000);
    const y = dayDate.getFullYear();
    const m = String(dayDate.getMonth() + 1).padStart(2, '0');
    const d = String(dayDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const sessionForDay = thisWeekSessions.find((s) => {
      if (s.date === dateStr) return true;
      const sd = new Date(s.date);
      return (
        !isNaN(sd.getTime()) &&
        sd.getFullYear() === dayDate.getFullYear() &&
        sd.getMonth() === dayDate.getMonth() &&
        sd.getDate() === dayDate.getDate()
      );
    });

    // 1. Completed Training Day -> Show actual workout data and remove recommended shoes
    if (sessionForDay) {
      return {
        ...pDay,
        dateStr,
        isCompleted: true,
        recommendedShoe: undefined, // 훈련계획에서 기록된 훈련을 보여줄 땐 추천 신발 제외
        type: inferWorkoutType(sessionForDay.title, sessionForDay.totalDistanceKm),
        title: `[실제 기록 완료] ${sessionForDay.title}`,
        distanceKm: sessionForDay.totalDistanceKm,
        targetPace: sessionForDay.avgPace || "-'--\"",
        targetZone: sessionForDay.avgHr
          ? `평균 ${sessionForDay.avgHr}bpm (최고 ${sessionForDay.maxHr || sessionForDay.avgHr}bpm)`
          : '실훈련 페이스',
        description: `실제 기록 완료된 훈련입니다. (${sessionForDay.totalDistanceKm}km / 완주: ${sessionForDay.totalTime} / 평균페이스: ${sessionForDay.avgPace}/km${sessionForDay.avgHr ? ` / 평균심박: ${sessionForDay.avgHr}bpm` : ''}${sessionForDay.shoeName ? ` / 착용화: ${sessionForDay.shoeName}` : ''})`,
        intensity:
          (sessionForDay.avgHr && sessionForDay.avgHr > 165) || sessionForDay.totalDistanceKm >= 20
            ? ('높음' as const)
            : sessionForDay.totalDistanceKm >= 10
            ? ('보통' as const)
            : ('낮음' as const),
        actualSession: {
          id: sessionForDay.id,
          title: sessionForDay.title,
          totalDistanceKm: sessionForDay.totalDistanceKm,
          avgPace: sessionForDay.avgPace,
          avgHr: sessionForDay.avgHr,
          maxHr: sessionForDay.maxHr,
          shoeName: sessionForDay.shoeName,
          date: sessionForDay.date,
        },
      };
    }

    // 2. Uncompleted Rest Day
    if (pDay.type === '휴식') {
      return {
        ...pDay,
        dateStr,
        isCompleted: false,
      };
    }

    // 3. Uncompleted Running Day -> Dynamically tuned if this week already has completed runs
    let adjustedDist = pDay.distanceKm;
    let adjustedDesc = pDay.description;

    if (completedKmThisWeek > 0 && originalRemainingSum > 0 && remainingKm > 0) {
      adjustedDist = Math.max(
        4.0,
        Math.round(((pDay.distanceKm / originalRemainingSum) * remainingKm) * 10) / 10
      );
      if (!adjustedDesc.includes('실훈련 반영')) {
        adjustedDesc = `[이번 주 실훈련(${completedKmThisWeek}km) 소화 반영 맞춤] 주간 잔여 권장 볼륨 ${remainingKm}km에 맞추어 조율된 세션입니다. ${pDay.description}`;
      }
    }

    return {
      ...pDay,
      dateStr,
      isCompleted: false,
      distanceKm: adjustedDist,
      description: adjustedDesc,
    };
  });
}

