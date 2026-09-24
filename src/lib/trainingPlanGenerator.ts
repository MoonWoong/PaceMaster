import { WeeklyPlanDay } from '../types';
import { getTrainingPaces } from './vdot';

export type DayOfWeek = '월요일' | '화요일' | '수요일' | '목요일' | '금요일' | '토요일' | '일요일';

export interface PlanCustomOptions {
  trainingDays: DayOfWeek[]; // User selected running days (e.g. ['화요일', '목요일', '토요일', '일요일'])
  speedDay: DayOfWeek | '없음'; // Day for speed/interval/tempo point workout
  speedWorkoutType: '인터벌' | '템포런' | '변속주(파틀렉)' | '빌드업주'; // Specific speed point
  longRunDay: DayOfWeek | '없음'; // Day for long slow distance point workout
  targetRaceCourse?: string; // 풀코스, 하프, 10K, 5K
  weeklyMileageGoal?: number; // Target weekly volume in km
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

  const isFullCourse = targetRaceCourse.includes('풀') || targetRaceCourse.includes('42');
  const isHalfCourse = targetRaceCourse.includes('하프') || targetRaceCourse.includes('21');
  const is10k = targetRaceCourse.includes('10');

  // Distances adjusted to goal race
  const defaultLsdDist = isFullCourse ? 26 : isHalfCourse ? 18 : is10k ? 14 : 10;
  const defaultSpeedDist = isFullCourse ? 11 : isHalfCourse ? 9 : 8;

  // Defaults if options not provided
  const trainingDays =
    options?.trainingDays && options.trainingDays.length > 0
      ? options.trainingDays
      : (['화요일', '목요일', '토요일', '일요일'] as DayOfWeek[]);

  const speedDay = options?.speedDay ?? '화요일';
  const speedWorkoutType = options?.speedWorkoutType ?? '인터벌';
  const longRunDay = options?.longRunDay ?? '일요일';

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
      };
    }

    // 3. Point 2: Speed Workout Day
    if (dayName === speedDay) {
      if (speedWorkoutType === '인터벌') {
        return {
          day: dayName,
          dayShort,
          type: '인터벌',
          title: `[포인트: 스피드] VO2max 트랙 인터벌 (400m x 8~10회)`,
          distanceKm: defaultSpeedDist,
          targetPace: intervalPace,
          targetZone: 'Zone 5 (무산소/VO2max)',
          description: `워밍업 2km + 트랙 400m 질주(${intervalPace} 페이스) 및 200m 불완전 휴식 90초 반복 + 쿨다운 2km. 심폐 환기량 극대화.`,
          intensity: '높음',
        };
      } else if (speedWorkoutType === '템포런') {
        return {
          day: dayName,
          dayShort,
          type: '템포런',
          title: `[포인트: 스피드] 젖산 역치(Threshold) ${defaultSpeedDist}km 템포런`,
          distanceKm: defaultSpeedDist,
          targetPace: tempoPace,
          targetZone: 'Zone 4 (젖산 역치)',
          description: `워밍업 2km + T-Pace 지속주 ${defaultSpeedDist - 3}km(${tempoPace}) + 쿨다운 1km. 젖산 축적 억제 및 페이스 유지력 극대화.`,
          intensity: '높음',
        };
      } else if (speedWorkoutType === '변속주(파틀렉)') {
        return {
          day: dayName,
          dayShort,
          type: '인터벌',
          title: `[포인트: 스피드] 파틀렉(Fartlek) 변속주 ${defaultSpeedDist}km`,
          distanceKm: defaultSpeedDist,
          targetPace: `${intervalPace} ~ ${easyMin}`,
          targetZone: 'Zone 3~5 (심박 변동)',
          description: `빠른 질주 3분(${intervalPace}) + 회복 조깅 2분 교대 반복. 지형과 페이스 변화에 대한 스피드 적응력 향상.`,
          intensity: '높음',
        };
      } else {
        // 빌드업주
        return {
          day: dayName,
          dayShort,
          type: '템포런',
          title: `[포인트: 스피드] 네거티브 스플릿 빌드업 ${defaultSpeedDist}km`,
          distanceKm: defaultSpeedDist,
          targetPace: `${easyMin} ➡️ ${tempoPace}`,
          targetZone: 'Zone 2 ➡️ Zone 4',
          description: `초반 이지 페이스(${easyMin})로 출발하여 2km마다 10초씩 가속, 마지막 2km는 역치 페이스(${tempoPace})로 피니시.`,
          intensity: '높음',
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
        distanceKm: 5.0,
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
      distanceKm: 8.0,
      targetPace: `${easyMin} ~ ${easyMax}`,
      targetZone: 'Zone 2 (유산소)',
      description: '미토콘드리아 발달을 위한 편안한 대화 가능 페이스. 종료 전 100m 쾌속 질주(Strides) 4회로 신경계 자극.',
      intensity: '보통',
    };
  });
}

