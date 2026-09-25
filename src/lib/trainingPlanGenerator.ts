import { WeeklyPlanDay, WorkoutStage, TrainingSession, RunnerStateAnalysis } from '../types';
import { getTrainingPaces, formatPace } from './vdot';

export type DayOfWeek = '월요일' | '화요일' | '수요일' | '목요일' | '금요일' | '토요일' | '일요일';

export interface PlanCustomOptions {
  trainingDays: DayOfWeek[]; // User selected running days (e.g. ['화요일', '목요일', '토요일', '일요일'])
  speedDay: DayOfWeek | '없음'; // Day for speed/interval/tempo point workout
  speedWorkoutType: '인터벌' | '템포런' | '변속주(파틀렉)' | '빌드업주'; // Specific speed point
  longRunDay: DayOfWeek | '없음'; // Day for long slow distance point workout
  targetRaceCourse?: string; // 풀코스, 하프, 10K, 5K
  weeklyMileageGoal?: number; // Target weekly volume in km
  trainingSessions?: TrainingSession[]; // User's actual logged sessions for in-depth workload & trend analysis
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
 */
function getWeekMondayDate(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 is Sun, 1 is Mon
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * In-depth Runner Workload & Training State Analyzer
 * Evaluates:
 * 1. 4-Week Rolling Weekly Mileage Trend
 * 2. ACWR (Acute:Chronic Workload Ratio) for Overuse/Fatigue Risk Assessment
 * 3. Recent Longest Run endurance capacity
 * 4. Tailored Volume & Point workout distance adjustment parameters
 */
export function analyzeRunnerState(
  trainingSessions: TrainingSession[] = [],
  targetRaceCourse: string = '풀코스'
): RunnerStateAnalysis {
  const isFullCourse = targetRaceCourse.includes('풀') || targetRaceCourse.includes('42');
  const isHalfCourse = targetRaceCourse.includes('하프') || targetRaceCourse.includes('21');
  const is10k = targetRaceCourse.includes('10');

  // Fallback defaults if no logged sessions
  const defaultTargetLsd = isFullCourse ? 26 : isHalfCourse ? 18 : is10k ? 14 : 10;
  const defaultWeeklyBase = isFullCourse ? 48 : isHalfCourse ? 38 : is10k ? 28 : 20;

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
    };
  }

  // 1. Group sessions by Monday-Sunday calendar week
  const weekMap: Record<string, { monday: Date; distance: number; sessions: TrainingSession[] }> = {};

  for (const session of trainingSessions) {
    const monday = getWeekMondayDate(session.date);
    const key = monday.toISOString().slice(0, 10);
    if (!weekMap[key]) {
      weekMap[key] = { monday, distance: 0, sessions: [] };
    }
    weekMap[key].distance += session.totalDistanceKm || 0;
    weekMap[key].sessions.push(session);
  }

  // Sort weeks ascending chronologically
  const sortedWeeks = Object.values(weekMap).sort(
    (a, b) => a.monday.getTime() - b.monday.getTime()
  );

  // Take the most recent up to 4 weeks
  const recentWeeks = sortedWeeks.slice(-4);
  const recent4WeeksDistances = recentWeeks.map((w) => {
    const mMonth = String(w.monday.getMonth() + 1).padStart(2, '0');
    const mDate = String(w.monday.getDate()).padStart(2, '0');
    return {
      weekLabel: `${mMonth}/${mDate}주`,
      distanceKm: Math.round(w.distance * 10) / 10,
    };
  });

  const lastWeekData = recentWeeks[recentWeeks.length - 1];
  const lastWeekDistance = lastWeekData ? Math.round(lastWeekData.distance * 10) / 10 : 0;
  
  // Previous week before the last week (for acute vs immediate prev)
  const prevWeekData = recentWeeks.length >= 2 ? recentWeeks[recentWeeks.length - 2] : null;
  const prevWeekDistance = prevWeekData ? prevWeekData.distance : lastWeekDistance;

  // 4-week average weekly distance
  const sumRecentDist = recentWeeks.reduce((acc, w) => acc + w.distance, 0);
  const avgWeeklyMileage4Weeks = Math.round((sumRecentDist / Math.max(recentWeeks.length, 1)) * 10) / 10;

  // Peak weekly distance
  const peakWeeklyDistance = Math.round(
    Math.max(...sortedWeeks.map((w) => w.distance), lastWeekDistance) * 10
  ) / 10;

  // Recent longest run in last 4 weeks (or all sessions if fewer)
  const recentSessions = recentWeeks.flatMap((w) => w.sessions);
  const longestRunSession = recentSessions.reduce(
    (max, s) => (s.totalDistanceKm > max ? s.totalDistanceKm : max),
    0
  );
  const recentLongestRunKm = Math.round(longestRunSession * 10) / 10;

  // 2. Mileage Trend Calculation
  let trendRatio = 0;
  if (avgWeeklyMileage4Weeks > 0) {
    trendRatio = Math.round(((lastWeekDistance - avgWeeklyMileage4Weeks) / avgWeeklyMileage4Weeks) * 100);
  }

  let mileageTrend: '증가세' | '안정유지' | '감소세' | '초기빌드' = '안정유지';
  if (recentWeeks.length < 2) {
    mileageTrend = '초기빌드';
  } else if (trendRatio >= 10) {
    mileageTrend = '증가세';
  } else if (trendRatio <= -10) {
    mileageTrend = '감소세';
  } else {
    mileageTrend = '안정유지';
  }

  // 3. ACWR (Acute:Chronic Workload Ratio)
  // Acute: last week's volume
  // Chronic: rolling 4-week average
  const acuteLoadKm = lastWeekDistance;
  const chronicLoadKm = avgWeeklyMileage4Weeks > 0 ? avgWeeklyMileage4Weeks : acuteLoadKm;
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

  // 4. Detailed Mileage & Intensity Adaptive Adjustment Logic
  // Principles (10% Rule + ACWR Safe Progression):
  // Never jump weekly volume by more than 10~15% above last week or 4-week average
  // Long run shouldn't exceed 30~35% of total weekly volume or +2~3km over recent longest run
  let targetWeeklyVolume = 0;
  let mileageAdjustmentNote = '';
  let intensityAdjustmentNote = '';

  if (acwr > 1.3) {
    // Overload danger: throttle back volume slightly (-5%~-10%) to absorb fatigue
    targetWeeklyVolume = Math.round(lastWeekDistance * 0.92);
    mileageAdjustmentNote = `최근 주간 부하(ACWR ${acwr})가 1.3을 초과하여 부상 위험 구간에 진입했습니다. 과부하 방지 및 피로 흡수를 위해 주간 마일리지를 약 8% 하향 조정한 ${targetWeeklyVolume}km로 안전하게 리셋합니다.`;
    intensityAdjustmentNote = '인터벌 질주 반복수와 고강도 지속주 거리를 축소하고 보강 운동 및 완전 휴식에 비중을 둡니다.';
  } else if (acwr < 0.8) {
    // Under-training or post-recovery: safely ramp up (+10%) from current level
    const baseRef = Math.max(lastWeekDistance, chronicLoadKm * 0.8);
    targetWeeklyVolume = Math.round(Math.min(baseRef * 1.1, defaultWeeklyBase));
    mileageAdjustmentNote = `최근 마일리지가 일시적 감소 상태(ACWR ${acwr})입니다. 무리한 급증을 피하고 10% 증량 안전 법칙을 적용하여 단계적으로 ${targetWeeklyVolume}km까지 회복 빌드업합니다.`;
    intensityAdjustmentNote = '고강도 질주보다는 Zone 2 유산소 베이스 조깅의 비중을 높여 기초 심폐 용적을 재충전합니다.';
  } else {
    // Optimal Sweet Spot (0.8 ~ 1.3): Controlled progressive overload (+5% ~ +10%)
    if (mileageTrend === '증가세') {
      targetWeeklyVolume = Math.round(Math.min(lastWeekDistance * 1.05, defaultWeeklyBase * 1.15));
      mileageAdjustmentNote = `꾸준한 주간 마일리지 상승세(최근 4주 평균 ${avgWeeklyMileage4Weeks}km ➡️ 지난주 ${lastWeekDistance}km)를 적극 반영하여 안전 권장 상한(+5%)인 ${targetWeeklyVolume}km로 최적 세팅되었습니다.`;
      intensityAdjustmentNote = '탁월한 훈련 적응력을 보이고 있어 계획된 포인트(스피드/장거리) 강도를 100% 온전히 소화하도록 배분합니다.';
    } else {
      targetWeeklyVolume = Math.round(Math.max(lastWeekDistance, avgWeeklyMileage4Weeks));
      mileageAdjustmentNote = `안정적인 훈련 지속성(ACWR ${acwr}, 최근 4주 평균 ${avgWeeklyMileage4Weeks}km)을 감안하여 몸에 부담 없는 ${targetWeeklyVolume}km로 밸런스를 맞추었습니다.`;
      intensityAdjustmentNote = '목표 대회 페이스에 맞춘 정밀 인터벌/템포런 훈련을 핵심 포인트로 배치합니다.';
    }
  }

  // Ensure minimum threshold
  targetWeeklyVolume = Math.max(targetWeeklyVolume, isFullCourse ? 32 : isHalfCourse ? 24 : 18);

  // 5. Adaptive Long Run & Speed Run Distances
  // Long run: cannot exceed 33% of weekly volume or (recentLongestRun + 3km)
  const maxSafeLongRun = Math.round(
    Math.min(
      defaultTargetLsd,
      targetWeeklyVolume * 0.4,
      Math.max(recentLongestRunKm + 3, defaultTargetLsd * 0.65)
    )
  );
  const longRunRecommendedKm = Math.max(maxSafeLongRun, isFullCourse ? 18 : isHalfCourse ? 12 : 8);

  // Speed run volume adjusted
  const speedVolumeRecommendedKm = isFullCourse
    ? targetWeeklyVolume >= 42 ? 10 : 8
    : isHalfCourse
    ? targetWeeklyVolume >= 34 ? 9 : 8
    : 8;

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

  // Distances dynamically adjusted to user state analysis or fallback defaults
  const defaultLsdDist = analysis ? analysis.longRunRecommendedKm : isFullCourse ? 26 : isHalfCourse ? 18 : is10k ? 14 : 10;
  // Speed workouts: dynamically adjusted
  const defaultSpeedDist = analysis ? analysis.speedVolumeRecommendedKm : isFullCourse ? 10 : isHalfCourse ? 9 : 8;

  // Calculate remaining volume to distribute among aerobic/recovery runs
  const totalTargetWeeklyKm = analysis ? analysis.recommendedWeeklyKm : (isFullCourse ? 48 : isHalfCourse ? 38 : 28);
  const pointRunsSum = (trainingDays.includes(longRunDay as DayOfWeek) ? defaultLsdDist : 0) +
                       (trainingDays.includes(speedDay as DayOfWeek) ? defaultSpeedDist : 0);
  const otherDaysCount = trainingDays.filter(d => d !== longRunDay && d !== speedDay).length;

  // Determine standard base jog and recovery distances proportionally
  const remainingKm = Math.max(totalTargetWeeklyKm - pointRunsSum, otherDaysCount * 4);
  const standardJogDist = otherDaysCount > 0 ? Math.round((remainingKm / otherDaysCount) * 10) / 10 : 8.0;
  const recoveryDist = Math.max(Math.round(standardJogDist * 0.65 * 10) / 10, 4.0);

  return DAY_ORDER.map((dayName) => {
    const dayShort = DAY_SHORT_MAP[dayName];
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
}

