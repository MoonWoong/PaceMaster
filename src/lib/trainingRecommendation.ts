import { TrainingSession, WeeklyPlanDay, WorkoutStage, RunningShoe } from '../types';
import { getTrainingPaces, formatPace } from './vdot';
import { attachShoeRecommendationsToPlan } from './shoeRecommender';

export type IntensityLevel = '회복' | '유지' | '강화';

export interface DailyRoutinePlan extends WeeklyPlanDay {
  paceRangeText?: string;
  heartRateGuidance?: string;
}

export interface IntensityRoutinePackage {
  level: IntensityLevel;
  levelEnglish: string;
  tagline: string;
  volumeRatioText: string;
  targetWeeklyKm: number;
  longRunKm: number;
  speedVolumeKm: number;
  summary: string;
  recommendedFor: string;
  keyBenefits: string[];
  days: DailyRoutinePlan[];
}

export interface RecommendationAnalysis {
  recommendedLevel: IntensityLevel;
  acwr: number;
  acuteLoadKm: number;
  chronicLoadKm: number;
  lastWeekDistance: number;
  lastWeekLabel: string;
  mileageTrend: '증가세' | '안정유지' | '감소세' | '초기빌드';
  trendRatio: number;
  recentLongestRunKm: number;
  recommendationReason: string;
  vdotInsight: string;
  vdotPaces: {
    easyPace: string;
    marathonPace: string;
    tempoPace: string;
    intervalPace: string;
  };
  routines: Record<IntensityLevel, IntensityRoutinePackage>;
}

/**
 * Helper to get Monday Date of a given string or Date
 */
function getWeekMondayDate(dateInput: Date | string): Date {
  const d = new Date(dateInput);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Analyzes weekly training data and VDOT to recommend training intensity and routines
 * Strictly evaluates prior completed week (월요일~일요일) and 4-week completed baseline
 */
export function analyzeAndRecommendTrainingIntensity(
  sessions: TrainingSession[] = [],
  vdot: number = 45,
  targetRaceCourse: string = '풀코스',
  shoes?: RunningShoe[],
  refDate: Date = new Date()
): RecommendationAnalysis {
  const effectiveVdot = Math.max(28, Math.min(85, vdot));
  const paces = getTrainingPaces(effectiveVdot);

  const easyMin = paces ? paces.easyPaceRange.min : "5'40\"";
  const easyMax = paces ? paces.easyPaceRange.max : "6'15\"";
  const easyRange = `${easyMin} ~ ${easyMax}`;
  const tempoPace = paces ? paces.thresholdPace.pace : "4'35\"";
  const marathonPace = paces ? paces.marathonPace.pace : "4'55\"";
  const intervalPace = paces ? paces.intervalPace.pace : "4'05\"";

  const isFullCourse = targetRaceCourse.includes('풀') || targetRaceCourse.includes('42');
  const isHalfCourse = targetRaceCourse.includes('하프') || targetRaceCourse.includes('21');

  // Baseline standard volume by course
  const defaultBaseVolume = isFullCourse ? 46 : isHalfCourse ? 36 : 26;

  // Determine current active week Monday
  let currentWeekMonday = getWeekMondayDate(refDate);

  if (sessions && sessions.length > 0) {
    const latestDate = sessions.reduce((max, s) => {
      const d = new Date(s.date);
      return !isNaN(d.getTime()) && d > max ? d : max;
    }, new Date(0));

    if (refDate.getTime() - latestDate.getTime() > 60 * 24 * 60 * 60 * 1000) {
      currentWeekMonday = getWeekMondayDate(latestDate);
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

  // 1. Group sessions strictly by 4 completed weeks (Week -4, Week -3, Week -2, Week -1 [지난주])
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

    const wSessions = sessions.filter((s) => {
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

  // Last week's completed distance (월~일 기준 지난주 = Week -1)
  const lastWeekData = completed4Weeks[3];
  let lastWeekDistance = lastWeekData ? lastWeekData.distanceKm : defaultBaseVolume;

  // Fallback if all 4 completed weeks are 0 but user has historical sessions
  const totalCompletedDist = completed4Weeks.reduce((sum, w) => sum + w.distanceKm, 0);
  if (totalCompletedDist === 0 && sessions.length > 0) {
    const allDist = sessions.reduce((sum, s) => sum + (s.totalDistanceKm || 0), 0);
    lastWeekDistance = Math.min(
      Math.round((allDist / Math.max(1, sessions.length / 3)) * 10) / 10,
      defaultBaseVolume
    );
  } else if (totalCompletedDist === 0) {
    lastWeekDistance = defaultBaseVolume;
  }

  // 4-week average weekly distance based strictly on completed weeks
  const nonZeroWeeks = completed4Weeks.filter((w) => w.distanceKm > 0);
  const chronicLoadKm =
    nonZeroWeeks.length > 0
      ? Math.round(
          (nonZeroWeeks.reduce((sum, w) => sum + w.distanceKm, 0) / nonZeroWeeks.length) * 10
        ) / 10
      : defaultBaseVolume;

  const acuteLoadKm = lastWeekDistance;

  // ACWR (Acute:Chronic Workload Ratio)
  const acwr = chronicLoadKm > 0 ? Math.round((acuteLoadKm / chronicLoadKm) * 100) / 100 : 1.0;

  // Trend ratio
  let trendRatio = 0;
  if (chronicLoadKm > 0) {
    trendRatio = Math.round(((acuteLoadKm - chronicLoadKm) / chronicLoadKm) * 100);
  }

  let mileageTrend: '증가세' | '안정유지' | '감소세' | '초기빌드' = '안정유지';
  if (nonZeroWeeks.length < 2) {
    mileageTrend = '초기빌드';
  } else if (trendRatio >= 10) {
    mileageTrend = '증가세';
  } else if (trendRatio <= -10) {
    mileageTrend = '감소세';
  } else {
    mileageTrend = '안정유지';
  }

  // Find recent longest run
  const recentSessions = completed4Weeks.flatMap((w) => w.sessions);
  const recentLongestRunKm =
    recentSessions.length > 0
      ? Math.round(Math.max(...recentSessions.map((s) => s.totalDistanceKm || 0)) * 10) / 10
      : isFullCourse ? 22 : 14;

  // 2. Determine Recommended Level ('회복' | '유지' | '강화')
  let recommendedLevel: IntensityLevel = '유지';
  let recommendationReason = '';

  // Sports Science Decision Matrix (Gabbett ACWR + 3:1 Periodization Cycle):
  // Rule A: Overload / Danger Zone (ACWR > 1.25 or last week surged > 20%) -> 회복
  if (acwr > 1.25 || (completed4Weeks.length >= 2 && trendRatio >= 22)) {
    recommendedLevel = '회복';
    recommendationReason = `직전 주간(${lastWeekLabel}) 완료 마일리지(${lastWeekDistance}km)를 분석한 결과, 훈련 부하가 급증하여 ACWR 지수가 ${acwr}(위험/과부하 경계)에 도달했습니다. 피로 누적으로 인한 건·인대 손상을 방지하고 직전 훈련 효과를 온전히 흡수하는 '초회복(Supercompensation)'을 위해 다음 주는 훈련량을 약 25% 줄인 '회복' 단계를 강력히 추천합니다.`;
  }
  // Rule B: Consecutive build for 3+ weeks -> Periodized recovery week
  else if (
    completed4Weeks.length >= 3 &&
    completed4Weeks.slice(-3).every((w, i, arr) => i === 0 || w.distanceKm >= arr[i - 1].distanceKm * 0.95)
  ) {
    recommendedLevel = '회복';
    recommendationReason = `최근 3주간 직전 주(${lastWeekDistance}km)까지 마일리지를 꾸준히 증량하며 신체 부하를 축적해왔습니다. 잭 대니얼스 및 엘리트 주기화 훈련 원칙(3주 빌드 + 1주 디로드)에 따라, 피로를 털어내고 신체 능력을 한 단계 끌어올릴 '회복' 주간을 권장합니다.`;
  }
  // Rule C: Sweet spot (0.85 <= ACWR <= 1.18) with stable base -> 강화
  else if (acwr >= 0.85 && acwr <= 1.18 && chronicLoadKm >= 20) {
    recommendedLevel = '강화';
    recommendationReason = `직전 주간(${lastWeekLabel} ${lastWeekDistance}km) 분석 결과, 급성 부하와 만성 부하 비율(ACWR ${acwr})이 부상 위험이 가장 낮고 신체 적응력이 뛰어난 '스위트스팟(0.8~1.2)'에 머물고 있습니다. VDOT ${effectiveVdot} 엔진을 바탕으로 볼륨을 약 +8~10% 점진적으로 증량하여 스피드 지구력과 유산소 파워를 끌어올릴 최적의 타이밍입니다.`;
  }
  // Rule D: Under-training (ACWR < 0.80) or other normal transitions -> 유지
  else {
    recommendedLevel = '유지';
    recommendationReason = `직전 주간(${lastWeekLabel} ${lastWeekDistance}km) 마일리지(ACWR ${acwr})는 안정적인 적응 상태입니다. 급격한 볼륨 변화 없이 현재 획득한 VDOT 페이스 감각과 주간 주행 거리를 공고히 다지는 '유지' 단계를 추천합니다.`;
  }

  // 3. Target Volumes for each intensity
  const baseKm = Math.max(chronicLoadKm, 24);
  const recoveryTargetKm = Math.round(baseKm * 0.72); // -28%
  const maintenanceTargetKm = Math.round(baseKm * 1.0); // 100%
  const buildTargetKm = Math.round(Math.min(baseKm * 1.09, baseKm + 6)); // +9% safe overload

  // VDOT Insight
  const vdotInsight = `현재 VDOT ${effectiveVdot} 기준 추천 유산소 이지 페이스는 ${easyRange}/km, 젖산 역치 템포런은 ${tempoPace}/km, 인터벌 질주는 ${intervalPace}/km입니다.`;

  // 4. Generate 7-day routines for each of the 3 levels

  // --- Routine 1: 회복 (Recovery / De-load) ---
  const recoveryLongRun = Math.round(Math.min(recentLongestRunKm * 0.65, isFullCourse ? 16 : 10));
  const recoveryJog1 = Math.round((recoveryTargetKm - recoveryLongRun) * 0.35);
  const recoveryJog2 = Math.round((recoveryTargetKm - recoveryLongRun) * 0.35);
  const recoveryStridesDist = Math.max(4, recoveryTargetKm - recoveryLongRun - recoveryJog1 - recoveryJog2);

  const recoveryDays: DailyRoutinePlan[] = [
    {
      day: '월요일',
      dayShort: 'MON',
      type: '휴식',
      title: '완전 휴식 및 전신 리셋',
      distanceKm: 0,
      targetPace: '-',
      targetZone: '-',
      description: '가벼운 폼롤러 마사지, 둔근/장요근 정적 스트레칭, 충분한 수면(8시간 권장).',
      intensity: '휴식',
    },
    {
      day: '화요일',
      dayShort: 'TUE',
      type: '조깅',
      title: 'Zone 1~2 초경량 회복주 (Recovery Jog)',
      distanceKm: recoveryJog1,
      targetPace: easyMax,
      targetZone: 'Zone 1~2 (최대심박 60-70%)',
      description: '숨이 전혀 차지 않는 대화 가능한 페이스로 가볍게 혈류를 촉진하는 조깅.',
      intensity: '낮음',
    },
    {
      day: '수요일',
      dayShort: 'WED',
      type: '휴식',
      title: '동적 회복 및 코어 보강',
      distanceKm: 0,
      targetPace: '-',
      targetZone: '-',
      description: '플랭크, 버드독 등 가벼운 코어 운동과 고관절 모빌리티 운동.',
      intensity: '휴식',
    },
    {
      day: '목요일',
      dayShort: 'THU',
      type: '회복주',
      title: '유산소 기초 조깅 + 질주(Strides)',
      distanceKm: recoveryStridesDist,
      targetPace: easyRange,
      targetZone: 'Zone 2 (유산소 기초)',
      description: '가볍게 조깅 후 본운동 마무리 단계에서 80m 질주(Strides) 4~5회로 신경계 리듬 활성화.',
      intensity: '낮음',
      stages: [
        {
          step: '1구간 (이지 조깅)',
          distanceKm: recoveryStridesDist - 1,
          pace: easyMax,
          zone: 'Zone 2',
          focus: '편안한 착지와 자세 유지',
        },
        {
          step: '2구간 (80m 질주 4회)',
          distanceKm: 1,
          pace: intervalPace,
          zone: 'Zone 3~4',
          focus: '피로 없이 다리 회전력(케이던스)만 살리기',
        },
      ],
    },
    {
      day: '금요일',
      dayShort: 'FRI',
      type: '휴식',
      title: '영양 충전 및 완전 휴식',
      distanceKm: 0,
      targetPace: '-',
      targetZone: '-',
      description: '탄수화물 및 양질의 단백질 섭취로 글리코겐 완충.',
      intensity: '휴식',
    },
    {
      day: '토요일',
      dayShort: 'SAT',
      type: '조깅',
      title: '가벼운 쉐이크아웃 조깅 (Shakeout Run)',
      distanceKm: recoveryJog2,
      targetPace: easyMax,
      targetZone: 'Zone 1 (회복)',
      description: '주말 러닝 전 몸을 부드럽게 풀어주는 가벼운 모닝 조깅.',
      intensity: '낮음',
    },
    {
      day: '일요일',
      dayShort: 'SUN',
      type: 'LSD',
      title: '가벼운 중거리 이지런 (Easy Long Run)',
      distanceKm: recoveryLongRun,
      targetPace: easyRange,
      targetZone: 'Zone 2 (유산소 지속)',
      description: '무리한 장거리 대신 평소의 65% 수준 거리로 기분 좋게 마무리하는 일요일 러닝.',
      intensity: '보통',
    },
  ];

  // --- Routine 2: 유지 (Maintenance / Steady Base) ---
  const maintLongRun = Math.round(Math.min(recentLongestRunKm, isFullCourse ? 22 : 16));
  const maintSpeedDist = isFullCourse ? 8 : 7;
  const maintJog1 = Math.round((maintenanceTargetKm - maintLongRun - maintSpeedDist) * 0.55);
  const maintJog2 = Math.max(5, maintenanceTargetKm - maintLongRun - maintSpeedDist - maintJog1);

  const maintenanceDays: DailyRoutinePlan[] = [
    {
      day: '월요일',
      dayShort: 'MON',
      type: '휴식',
      title: '완전 휴식 (Rest & Muscle Recovery)',
      distanceKm: 0,
      targetPace: '-',
      targetZone: '-',
      description: '하체 근육 이완과 컨디션 정돈.',
      intensity: '휴식',
    },
    {
      day: '화요일',
      dayShort: 'TUE',
      type: '조깅',
      title: '유산소 베이스 조깅 (Aerobic Base Run)',
      distanceKm: maintJog1,
      targetPace: easyRange,
      targetZone: 'Zone 2 (심박 130~145)',
      description: '안정적인 심폐 지구력과 미토콘드리아 기초 유지 조깅.',
      intensity: '낮음',
    },
    {
      day: '수요일',
      dayShort: 'WED',
      type: '템포런',
      title: '젖산 역치 템포런 (Threshold Cruise Intervals)',
      distanceKm: maintSpeedDist,
      targetPace: tempoPace,
      targetZone: 'Zone 4 (젖산 역치)',
      description: '워밍업 2km + [T페이스 2km × 2회 (휴식 90초)] + 쿨다운 1.5km로 젖산 분해 능력 유지.',
      intensity: '보통',
      stages: [
        {
          step: '워밍업 2km',
          distanceKm: 2,
          pace: easyMax,
          zone: 'Zone 2',
          focus: '점진적 페이스업',
        },
        {
          step: '본운동 4km (역치 지속주)',
          distanceKm: 4,
          pace: tempoPace,
          zone: 'Zone 4',
          focus: '젖산 역치 페이스 집중 유지',
        },
        {
          step: '쿨다운 1.5~2km',
          distanceKm: maintSpeedDist - 6,
          pace: easyMax,
          zone: 'Zone 1',
          focus: '호흡 정상화',
        },
      ],
    },
    {
      day: '목요일',
      dayShort: 'THU',
      type: '휴식',
      title: '능동적 휴식 (Active Recovery)',
      distanceKm: 0,
      targetPace: '-',
      targetZone: '-',
      description: '가벼운 산책 또는 하체 폼롤러 스트레칭.',
      intensity: '휴식',
    },
    {
      day: '금요일',
      dayShort: 'FRI',
      type: '조깅',
      title: '회복 조깅 + 가벼운 질주 (Easy Run + Strides)',
      distanceKm: maintJog2,
      targetPace: easyRange,
      targetZone: 'Zone 2',
      description: '주말 장거리를 앞두고 다리의 무거움을 털어내는 리듬 러닝.',
      intensity: '낮음',
    },
    {
      day: '토요일',
      dayShort: 'SAT',
      type: '휴식',
      title: '주말 훈련 전 컨디션 조절',
      distanceKm: 0,
      targetPace: '-',
      targetZone: '-',
      description: '수분 섭취와 탄수화물 식단 준비.',
      intensity: '휴식',
    },
    {
      day: '일요일',
      dayShort: 'SUN',
      type: 'LSD',
      title: '안정적인 주말 지속 장거리 (Steady Long Run)',
      distanceKm: maintLongRun,
      targetPace: `${easyMin} ~ ${marathonPace}`,
      targetZone: 'Zone 2 ~ Zone 3 초반',
      description: '마라톤 페이스 감각을 익히고 지방 연소 효율을 유지하는 중장거리 지속주.',
      intensity: '보통',
    },
  ];

  // --- Routine 3: 강화 (Build / Progressive Overload) ---
  const buildLongRun = Math.round(Math.min(recentLongestRunKm + 2.5, isFullCourse ? 26 : 18));
  const buildIntervalDist = isFullCourse ? 10 : 8.5;
  const buildTempoDist = isFullCourse ? 9 : 7.5;
  const buildJogDist = Math.max(6, buildTargetKm - buildLongRun - buildIntervalDist - buildTempoDist);

  const buildDays: DailyRoutinePlan[] = [
    {
      day: '월요일',
      dayShort: 'MON',
      type: '휴식',
      title: '주초 완전 휴식 및 에너지 충전',
      distanceKm: 0,
      targetPace: '-',
      targetZone: '-',
      description: '고강도 훈련 주간 시작 전 글리코겐과 정신력 완충.',
      intensity: '휴식',
    },
    {
      day: '화요일',
      dayShort: 'TUE',
      type: '인터벌',
      title: 'VO2max 스피드 인터벌 (1000m 반복 질주)',
      distanceKm: buildIntervalDist,
      targetPace: intervalPace,
      targetZone: 'Zone 5 (무산소·최대산소섭취량)',
      description: '워밍업 2km + [1,000m 질주 × 5회 (휴식 200m 조깅)] + 쿨다운 2km. 최대 유산소 파워 자극.',
      intensity: '높음',
      stages: [
        {
          step: '1단계: 워밍업 2km',
          distanceKm: 2,
          pace: easyMax,
          zone: 'Zone 2',
          focus: '동적 스트레칭 및 심폐 워밍업',
        },
        {
          step: '2단계: 1000m 인터벌 5세트',
          distanceKm: 6,
          pace: intervalPace,
          zone: 'Zone 5',
          focus: '정확한 랩 타임 준수 및 폭발적 추진력',
        },
        {
          step: '3단계: 쿨다운 2km',
          distanceKm: buildIntervalDist - 8,
          pace: easyMax,
          zone: 'Zone 1',
          focus: '젖산 분해 조깅 및 호흡 정리',
        },
      ],
    },
    {
      day: '수요일',
      dayShort: 'WED',
      type: '휴식',
      title: '고강도 인터벌 후 적극적 회복',
      distanceKm: 0,
      targetPace: '-',
      targetZone: '-',
      description: '충분한 수분 섭취, 단백질 보충, 가벼운 하체 스트레칭.',
      intensity: '휴식',
    },
    {
      day: '목요일',
      dayShort: 'THU',
      type: '템포런',
      title: '마라톤 레이스 페이스 빌드업 템포런',
      distanceKm: buildTempoDist,
      targetPace: `${marathonPace} ~ ${tempoPace}`,
      targetZone: 'Zone 3 ~ Zone 4',
      description: '워밍업 2km + M페이스 3km + T페이스 2km + 쿨다운. 레이스 후반부 페이스 유지력 단련.',
      intensity: '높음',
      stages: [
        {
          step: '워밍업 2km',
          distanceKm: 2,
          pace: easyMax,
          zone: 'Zone 2',
          focus: '자세 정렬',
        },
        {
          step: 'M-Pace 지속주 3km',
          distanceKm: 3,
          pace: marathonPace,
          zone: 'Zone 3',
          focus: '대회 목표 페이스 몸에 새기기',
        },
        {
          step: 'T-Pace 가속 2km',
          distanceKm: 2,
          pace: tempoPace,
          zone: 'Zone 4',
          focus: '젖산 내성 한계 돌파',
        },
        {
          step: '쿨다운',
          distanceKm: buildTempoDist - 7,
          pace: easyMax,
          zone: 'Zone 1',
          focus: '마무리',
        },
      ],
    },
    {
      day: '금요일',
      dayShort: 'FRI',
      type: '조깅',
      title: '유산소 베이스 회복 조깅 (Recovery Aerobic Run)',
      distanceKm: buildJogDist,
      targetPace: easyMax,
      targetZone: 'Zone 2 (심박 130~140)',
      description: '주말 핵심 LSD를 앞두고 가볍게 땀을 내며 혈액순환 촉진.',
      intensity: '낮음',
    },
    {
      day: '토요일',
      dayShort: 'SAT',
      type: '휴식',
      title: '장거리(LSD) 대비 카보로딩 & 휴식',
      distanceKm: 0,
      targetPace: '-',
      targetZone: '-',
      description: '충분한 수분 및 전해질 섭취, 주말 러닝 장비 점검.',
      intensity: '휴식',
    },
    {
      day: '일요일',
      dayShort: 'SUN',
      type: 'LSD',
      title: '피크 장거리 점진주 (Progressive Overload LSD)',
      distanceKm: buildLongRun,
      targetPace: `${easyMin} ~ ${marathonPace}`,
      targetZone: 'Zone 2 ~ Zone 3',
      description: '이전 최장 거리 대비 2~3km 점진적 증량. 후반 5km는 마라톤 페이스로 가속하여 정신력 강화.',
      intensity: '높음',
      stages: [
        {
          step: '초반 1~5km',
          distanceKm: 5,
          pace: easyMax,
          zone: 'Zone 2 초반',
          focus: '호흡 안정화 및 에너지 비축',
        },
        {
          step: '중반 6~18km',
          distanceKm: buildLongRun - 10,
          pace: easyMin,
          zone: 'Zone 2 지속',
          focus: '5km마다 에너지젤 섭취 시뮬레이션',
        },
        {
          step: '후반 5km 빌드업',
          distanceKm: 5,
          pace: marathonPace,
          zone: 'Zone 3 (M-Pace)',
          focus: '피로 상황에서 케이던스와 피치 유지',
        },
      ],
    },
  ];

  // 4. Attach smart shoe recommendations to routines if shoes provided
  const finalRecoveryDays = shoes && shoes.length > 0
    ? attachShoeRecommendationsToPlan(recoveryDays, shoes, sessions)
    : recoveryDays;
  const finalMaintenanceDays = shoes && shoes.length > 0
    ? attachShoeRecommendationsToPlan(maintenanceDays, shoes, sessions)
    : maintenanceDays;
  const finalBuildDays = shoes && shoes.length > 0
    ? attachShoeRecommendationsToPlan(buildDays, shoes, sessions)
    : buildDays;

  return {
    recommendedLevel,
    acwr,
    acuteLoadKm,
    chronicLoadKm,
    lastWeekDistance,
    lastWeekLabel,
    mileageTrend,
    trendRatio,
    recentLongestRunKm,
    recommendationReason,
    vdotInsight,
    vdotPaces: {
      easyPace: easyRange,
      marathonPace,
      tempoPace,
      intervalPace,
    },
    routines: {
      회복: {
        level: '회복',
        levelEnglish: 'Recovery / Deload',
        tagline: '피로 완벽 해소 & 초회복 유도',
        volumeRatioText: `전주 대비 약 -25% (${recoveryTargetKm}km)`,
        targetWeeklyKm: recoveryTargetKm,
        longRunKm: recoveryLongRun,
        speedVolumeKm: 0,
        summary: '부상 없는 롱런을 위해 근피로와 관절 부하를 완전히 털어내는 디로드 주간입니다.',
        recommendedFor: '최근 3주 이상 증량했거나 ACWR 1.25 초과 과부하 위험 시',
        keyBenefits: [
          '근육 및 건·인대 미세 손상 완벽 치유',
          '글리코겐 저장소 완전 재충전 및 초회복 유도',
          '질주(Strides)로 다리 회전력 감각 보존',
        ],
        days: finalRecoveryDays,
      },
      유지: {
        level: '유지',
        levelEnglish: 'Maintenance & Stability',
        tagline: '유산소 베이스 공고화 & 리듬 적응',
        volumeRatioText: `현재 볼륨 유지 (${maintenanceTargetKm}km)`,
        targetWeeklyKm: maintenanceTargetKm,
        longRunKm: maintLongRun,
        speedVolumeKm: maintSpeedDist,
        summary: '현재 획득한 VDOT 페이스와 체력을 안정적으로 다지는 밸런스 주간입니다.',
        recommendedFor: '현재 마일리지 적응기를 갖거나 대회 직전 리듬 유지 시',
        keyBenefits: [
          '안정적인 주간 마일리지 리듬 정착',
          '주 1회 크루즈 역치 인터벌로 젖산 내성 유지',
          '부상 위험 0%의 최적 밸런스 유지',
        ],
        days: finalMaintenanceDays,
      },
      강화: {
        level: '강화',
        levelEnglish: 'Progressive Overload / Build',
        tagline: 'VDOT 파워 극대화 & 한계 돌파',
        volumeRatioText: `전주 대비 +8~10% 증량 (${buildTargetKm}km)`,
        targetWeeklyKm: buildTargetKm,
        longRunKm: buildLongRun,
        speedVolumeKm: buildIntervalDist,
        summary: '10% 안전 증량 룰을 준수하며 VO2max 인터벌과 장거리 볼륨을 끌어올립니다.',
        recommendedFor: 'ACWR 스위트스팟(0.85~1.18) 상태에서 PB 단축을 노릴 때',
        keyBenefits: [
          'VO2max 1000m 인터벌로 유산소 파워 천장 개방',
          '최장 거리 LSD 확장을 통한 후반 지구력 극대화',
          '대회 목표 기록 달성을 위한 실전 레이스 감각 완성',
        ],
        days: finalBuildDays,
      },
    },
  };
}
