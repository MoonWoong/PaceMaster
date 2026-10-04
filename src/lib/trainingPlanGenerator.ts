import { WeeklyPlanDay, WorkoutStage, TrainingSession, RunnerStateAnalysis, RunningShoe, SpeedWorkoutType, RegisteredRace, RunningGoals, RaceWeightDetail } from '../types';
import { getTrainingPaces, formatPace, parseTimeToSeconds } from './vdot';
import { attachShoeRecommendationsToPlan } from './shoeRecommender';

export type DayOfWeek = '월요일' | '화요일' | '수요일' | '목요일' | '금요일' | '토요일' | '일요일';

export interface TargetRacePlanAnalysis {
  raceId?: string;
  raceName: string;
  raceDate: string;
  course: string;
  dDayDays: number;
  dDayWeeks: number;
  targetFinishTime: string;
  targetRacePace: string;
  targetPaceRawSec: number;
  courseDistKm: number;
  racePriority: 'A' | 'B' | 'C';
  importanceGrade: 'A-Race (메인 목표)' | 'B-Race (중간 점검)' | 'C-Race (연습 대회)';
  paceIntensityLevel: '고강도 목표 (High)' | '중상 강도 (Moderate-High)' | '중강도 (Moderate)' | '안정 완주 (Endurance)' | '이지런 연장 부하 (Easy Cruise)';
  taperingVolumeCutPct: number; // e.g. 12, 20, 35, 55
  taperingIntensityStrategy: string;
  taperingSpeedRepNote: string;
  taperingLsdDistKm: number;
  taperScaleNote?: string;
  periodizationPhase: '기초 유산소 구축기 (Base)' | '스피드/지구력 빌드업기 (Build)' | '목표 페이스 특화기 (Peak)' | '테이퍼링 감량기 (Tapering)' | '대회 직전 조정기 (Race Week)';
  phaseDescription: string;
  strategicAdvice: string;
  isRaceThisWeek: boolean;
  raceDayOfWeek?: DayOfWeek;
  isEasyRunCruiseLoad?: boolean; // 10km 6'00" 페이스 등 평소 이지런 연장 부하 여부
  easyRunCruiseNote?: string; // 이지런 연장 부하 맞춤 설명
}

export interface PlanCustomOptions {
  trainingDays: DayOfWeek[]; // User selected running days (e.g. ['화요일', '목요일', '토요일', '일요일'])
  speedDay: DayOfWeek | '없음'; // Day for speed/interval/tempo point workout
  speedWorkoutType: SpeedWorkoutType; // Specific speed point
  longRunDay: DayOfWeek | '없음'; // Day for long slow distance point workout
  targetRaceCourse?: string; // 풀코스, 하프, 10K, 5K
  weeklyMileageGoal?: number; // Target weekly volume in km
  trainingSessions?: TrainingSession[]; // User's actual logged sessions for in-depth workload & trend analysis
  shoes?: RunningShoe[]; // User's owned running shoes for rotation recommendation
  races?: RegisteredRace[]; // Registered upcoming races
  goals?: RunningGoals; // User's running goals
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
 * Helper to rescale workout stages mathematically so their sum matches exact total distance
 */
export function rescaleWorkoutStages(stages: WorkoutStage[], newTotalDist: number): WorkoutStage[] {
  if (!stages || stages.length === 0 || newTotalDist <= 0) return stages;
  const oldTotal = stages.reduce((acc, s) => acc + (s.distanceKm || 0), 0);
  if (oldTotal <= 0) return stages;

  let accumulated = 0;
  return stages.map((stg, idx) => {
    const isLast = idx === stages.length - 1;
    const stageDist = isLast
      ? Math.max(0.5, Math.round((newTotalDist - accumulated) * 10) / 10)
      : Math.max(0.5, Math.round(((stg.distanceKm / oldTotal) * newTotalDist) * 10) / 10);

    const startKm = Math.round(accumulated * 10) / 10;
    accumulated += stageDist;
    const endKm = Math.round(accumulated * 10) / 10;

    let baseStep = stg.step;
    const parenIndex = baseStep.indexOf('(');
    if (parenIndex !== -1) {
      baseStep = baseStep.slice(0, parenIndex).trim();
    }
    const updatedStep = `${baseStep} (${startKm} ~ ${endKm}km, ${stageDist}km)`;

    return {
      ...stg,
      step: updatedStep,
      distanceKm: stageDist,
    };
  });
}

/**
 * Synchronize a day plan's title, distanceKm, and workout stages to maintain strict mathematical consistency
 */
export function synchronizeWorkoutDistanceTitleStages(
  dayPlan: WeeklyPlanDay,
  exactDistanceKm: number
): WeeklyPlanDay {
  const dist = Math.round(exactDistanceKm * 10) / 10;
  let newTitle = dayPlan.title;

  // Replace any existing \d+(\.\d+)?km in the title to exact dist km
  if (/\b\d+(\.\d+)?km\b/.test(newTitle)) {
    newTitle = newTitle.replace(/\b\d+(\.\d+)?km\b/g, `${dist}km`);
  }

  let newStages = dayPlan.stages;
  if (newStages && newStages.length > 0) {
    newStages = rescaleWorkoutStages(newStages, dist);
  }

  return {
    ...dayPlan,
    title: newTitle,
    distanceKm: dist,
    stages: newStages,
  };
}

/**
 * Analyzes a single registered race against goals and periodization
 */
export function analyzeSingleRacePlan(
  targetRace: RegisteredRace,
  goals?: RunningGoals,
  targetCourseFallback: string = '풀코스'
): TargetRacePlanAnalysis {
  const now = new Date();
  const todayMs = now.getTime();
  const raceDate = new Date(targetRace.date);
  const diffDays = Math.max(0, Math.ceil((raceDate.getTime() - todayMs) / (1000 * 60 * 60 * 24)));
  const diffWeeks = Math.ceil(diffDays / 7);

  // Determine course distance in km
  let courseDistKm = 42.195;
  const crs = (targetRace.course || targetCourseFallback).toLowerCase();
  if (crs.includes('하프') || crs.includes('21')) courseDistKm = 21.0975;
  else if (crs.includes('10')) courseDistKm = 10.0;
  else if (crs.includes('5')) courseDistKm = 5.0;

  // Determine target finish time and pace
  let finishTime = targetRace.targetTime || '';
  if (!finishTime && goals) {
    if (courseDistKm >= 40) finishTime = goals.targetFull || '03:29:59';
    else if (courseDistKm >= 20) finishTime = goals.targetHalf || '01:39:59';
    else finishTime = goals.target10k || '00:44:59';
  }
  if (!finishTime) {
    finishTime = courseDistKm >= 40 ? '03:29:59' : courseDistKm >= 20 ? '01:39:59' : '00:44:59';
  }

  const finishSec = parseTimeToSeconds(finishTime);
  const targetPaceRawSec = finishSec > 0 && courseDistKm > 0 ? Math.round(finishSec / courseDistKm) : 298;
  const targetPace = formatPace(targetPaceRawSec);

  // Pace Intensity Level (목표 페이스의 강도 등급 판정)
  let paceIntensityLevel: TargetRacePlanAnalysis['paceIntensityLevel'] = '중강도 (Moderate)';
  if (courseDistKm >= 40) {
    if (targetPaceRawSec <= 285) paceIntensityLevel = '고강도 목표 (High)'; // Sub-3:20
    else if (targetPaceRawSec <= 315) paceIntensityLevel = '중상 강도 (Moderate-High)'; // Sub-3:42
    else if (targetPaceRawSec <= 360) paceIntensityLevel = '중강도 (Moderate)'; // Sub-4:13
    else paceIntensityLevel = '안정 완주 (Endurance)';
  } else if (courseDistKm >= 20) {
    if (targetPaceRawSec <= 270) paceIntensityLevel = '고강도 목표 (High)'; // Sub-1:35
    else if (targetPaceRawSec <= 300) paceIntensityLevel = '중상 강도 (Moderate-High)'; // Sub-1:45
    else if (targetPaceRawSec <= 345) paceIntensityLevel = '중강도 (Moderate)'; // Sub-2:00
    else paceIntensityLevel = '안정 완주 (Endurance)';
  } else if (courseDistKm >= 9) {
    if (targetPaceRawSec <= 260) paceIntensityLevel = '고강도 목표 (High)'; // Sub-43m
    else if (targetPaceRawSec <= 290) paceIntensityLevel = '중상 강도 (Moderate-High)'; // Sub-48m
    else if (targetPaceRawSec <= 330) paceIntensityLevel = '중강도 (Moderate)'; // Sub-55m
    else paceIntensityLevel = '안정 완주 (Endurance)';
  } else {
    if (targetPaceRawSec <= 270) paceIntensityLevel = '고강도 목표 (High)';
    else if (targetPaceRawSec <= 310) paceIntensityLevel = '중상 강도 (Moderate-High)';
    else paceIntensityLevel = '중강도 (Moderate)';
  }

  // Check if race day falls within this active week (Monday ~ Sunday)
  const currentWeekMonday = getWeekMondayDate(now);
  const currentWeekSunday = new Date(currentWeekMonday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  const isRaceThisWeek = raceDate >= currentWeekMonday && raceDate <= currentWeekSunday;
  const dayNameList: DayOfWeek[] = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const raceDayOfWeek = dayNameList[raceDate.getDay()];
  const isMondayRace = raceDayOfWeek === '월요일';

  // Check if this is an Easy Run Cruise Load (평소 이지런 연장 부하 - 예: 10km 6'00" 페이스 등)
  // 조건: 12km 이하(5k~10k) 코스이면서 목표 페이스가 약 5:45~6:00+ (>= 345초) 수준의 이지런/조깅 완주 부하
  const is10kOrLess = courseDistKm <= 12;
  const isPaceAround6MinOrEasy = targetPaceRawSec >= 345;
  const isEasyRunCruiseLoad = is10kOrLess && isPaceAround6MinOrEasy;

  if (isEasyRunCruiseLoad) {
    paceIntensityLevel = '이지런 연장 부하 (Easy Cruise)';
  }

  // Extract user-selected race priority (A, B, C)
  const racePriority: 'A' | 'B' | 'C' =
    targetRace.priority === 'C' || targetRace.importance?.includes('C')
      ? 'C'
      : targetRace.priority === 'B' || targetRace.importance?.includes('B')
      ? 'B'
      : 'A';

  const importanceGrade: 'A-Race (메인 목표)' | 'B-Race (중간 점검)' | 'C-Race (연습 대회)' =
    racePriority === 'C'
      ? 'C-Race (연습 대회)'
      : racePriority === 'B'
      ? 'B-Race (중간 점검)'
      : 'A-Race (메인 목표)';

  // Determine Periodization Phase and Fine-Grained Tapering Modulation based on D-Day, Importance (A/B/C) & Pace Intensity
  let periodizationPhase: TargetRacePlanAnalysis['periodizationPhase'];
  let phaseDescription = '';
  let strategicAdvice = '';
  let taperingVolumeCutPct = 0;
  let taperingIntensityStrategy = '';
  let taperingSpeedRepNote = '';
  let taperingLsdDistKm = courseDistKm >= 40 ? 26 : courseDistKm >= 20 ? 18 : 12;
  let taperScaleNote = '';
  let easyRunCruiseNote = '';

  if (diffDays <= 7 || isRaceThisWeek) {
    periodizationPhase = '대회 직전 조정기 (Race Week)';

    if (isEasyRunCruiseLoad) {
      if (isMondayRace) {
        taperingVolumeCutPct = 0; // 월요일 10km 6'00 페이스는 감량 배제(0%), 100% 정상 마일리지 가동!
        taperingLsdDistKm = Math.max(courseDistKm, 14);
        taperingSpeedRepNote = '가벼운 4~5km 조깅 및 코호흡';
        taperScaleNote = '월요일 10km 6’00 페이스 ➡️ 평소 이지런 연장 부하(Zone 2) 반영: 테이퍼링 감량 배제(0%) & 정상 마일리지 100% 가동';
        taperingIntensityStrategy = `[월요일 10km 6’00 이지런 연장 부하 분석] 6’00 페이스는 심박수 Zone 2(유산소 조깅) 영역으로, 평소 일상 이지런 대비 거리만 2~3km 늘어난 가벼운 부하입니다. 젖산 축적과 근육 피로가 거의 없으므로 무리한 사전 감량(20~30%)은 오히려 심폐 지구력 리듬을 잃게 만듭니다. 따라서 주간 볼륨 100%를 온전히 유지하며, 전날(일요일) 3~4km 가벼운 조깅 또는 휴식만으로 최상의 컨디션을 맞춥니다.`;
        phaseDescription = `대회 D-${diffDays}일(월요일 이지런 연장 레이스): 평소 이지런 연장선으로 감량 없이 100% 정상 마일리지를 가동합니다. (${taperScaleNote})`;
        strategicAdvice = `월요일 10km 6’00 대회는 평소 주말 이지런의 자연스러운 연장선입니다. 일요일에 무리한 LSD 대신 3~4km 가벼운 조깅이나 휴식으로 다리를 가볍게 하고, 월요일 대회를 주초 상쾌한 유산소 크루즈주로 완주하세요. 화요일 가벼운 리커버리 후 수요일부터 정상 포인트 훈련으로 즉시 복귀할 수 있습니다.`;
      } else {
        taperingVolumeCutPct = 5;
        taperingLsdDistKm = Math.max(courseDistKm, 14);
        taperingSpeedRepNote = '가벼운 4~5km 조깅 및 코호흡';
        taperScaleNote = '10km 6’00 페이스 ➡️ 평소 이지런 연장 부하(Zone 2) 반영: 감량 최소화(-5%) & 정상 마일리지 95~100% 가동';
        taperingIntensityStrategy = `[10km 6’00 이지런 연장 부하] 6’00 페이스는 심박수 Zone 2(유산소 조깅) 영역으로, 평소 일상 이지런 대비 거리만 2~3km 늘어난 가벼운 부하입니다. 과도한 조기 감량을 배제하고 주간 볼륨(95~100%)을 온전히 유지하며 대회 전날 가벼운 3~4km 리듬 조깅만 소화합니다.`;
        phaseDescription = `대회 D-${diffDays}일(이지런 연장 완주주): 주간 마일리지 95~100% 유지 단계입니다. (${taperScaleNote})`;
        strategicAdvice = `10km 6’00 대회는 평소 이지런보다 거리가 살짝 늘어난 유산소 부하입니다. 별도의 과도한 테이퍼링 감량이 불필요하며, 정상 마일리지를 소화하며 편안한 유산소 완주 리듬을 즐기세요.`;
      }
      easyRunCruiseNote = `💡 러너 분석 반영: 10km 6’00 페이스는 평소 이지런보다 거리가 살짝 늘어난 유산소(Zone 2) 부하입니다. 젖산 축적 및 근육 손상이 미미하므로 무리한 조기 감량(20~30%) 없이 주간 마일리지를 95~100% 온전히 유지합니다.`;
    } else if (racePriority === 'C') {
      if (paceIntensityLevel === '안정 완주 (Endurance)') {
        taperingVolumeCutPct = 12; // 최소 감량!
        taperingLsdDistKm = isRaceThisWeek ? courseDistKm : Math.min(courseDistKm, 16);
        taperingSpeedRepNote = '가벼운 5km 조깅 및 코호흡 유지';
        taperScaleNote = '중요도(C-Race) 및 안정 완주 강도 반영 ➡️ 테이퍼링 감량 최소화(-12%)로 평소 훈련 마일리지 보존';
        taperingIntensityStrategy = `[C-Race · 완주 목표 최소 감량] 중요도와 목표 강도가 모두 낮으므로 과도한 조기 테이퍼링을 배제하고 주간 볼륨(-12%)을 온전히 유지하며 대회 전일 1~2일만 가볍게 컨디션을 정돈합니다.`;
      } else if (paceIntensityLevel === '중강도 (Moderate)') {
        taperingVolumeCutPct = 18;
        taperingLsdDistKm = isRaceThisWeek ? courseDistKm : Math.min(courseDistKm, 14);
        taperingSpeedRepNote = '가벼운 5km 조깅 + 100m 스트라이드 2회';
        taperScaleNote = '중요도(C-Race) 반영 ➡️ 테이퍼링 감량폭 축소(-18%)';
        taperingIntensityStrategy = `[C-Race 훈련주 감량 축소] 일상 훈련의 연장선으로 테이퍼링을 -18%로 최소화하여 주간 지구력 흐름을 보존합니다.`;
      } else {
        taperingVolumeCutPct = 26;
        taperingLsdDistKm = isRaceThisWeek ? courseDistKm : Math.min(courseDistKm, 12);
        taperingSpeedRepNote = `목표 페이스(${targetPace}) 300m 2회 리듬 점검`;
        taperScaleNote = 'C-Race이지만 고강도 목표 반영 ➡️ 미니 테이퍼링(-26%)';
        taperingIntensityStrategy = `[C-Race 훈련 레이스 감량] 빠른 주행에 따른 부상 방지를 위해 -26% 미니 테이퍼링을 적용합니다.`;
      }
    } else if (racePriority === 'B') {
      if (paceIntensityLevel === '안정 완주 (Endurance)') {
        taperingVolumeCutPct = 22;
        taperingLsdDistKm = isRaceThisWeek ? courseDistKm : Math.min(courseDistKm, 12);
        taperingSpeedRepNote = '가벼운 4km 조깅 및 가동성 스트레칭';
        taperScaleNote = 'B-Race 점검 & 완주 목표 반영 ➡️ 테이퍼링 감량 축소(-22%)';
        taperingIntensityStrategy = `[B-Race 완주 점검 감량] 중간 점검 레이스로 주간 볼륨을 -22%만 가볍게 정돈하여 주간 지구력을 유지합니다.`;
      } else if (paceIntensityLevel === '중강도 (Moderate)') {
        taperingVolumeCutPct = 30;
        taperingLsdDistKm = isRaceThisWeek ? courseDistKm : Math.min(courseDistKm, 10);
        taperingSpeedRepNote = `목표 페이스(${targetPace}) 400m 2회`;
        taperScaleNote = 'B-Race 중간 점검 반영 ➡️ 미니 테이퍼링(-30%)';
        taperingIntensityStrategy = `[B-Race 페이스 점검 감량] 실전 페이스 감각을 확인하되 훈련 흐름을 깨지 않도록 -30% 미니 감량을 진행합니다.`;
      } else {
        taperingVolumeCutPct = 38;
        taperingLsdDistKm = isRaceThisWeek ? courseDistKm : Math.min(courseDistKm, 9);
        taperingSpeedRepNote = `목표 페이스(${targetPace}) 300m 3회 리듬 점검`;
        taperScaleNote = 'B-Race 고강도 점검 반영 ➡️ 테이퍼링(-38%)';
        taperingIntensityStrategy = `[B-Race 고강도 점검 감량] 기록 점검 레이스를 위해 주간 볼륨 -38% 감량으로 피로를 배출합니다.`;
      }
    } else {
      // A-Race (메인 목표)
      if (paceIntensityLevel === '안정 완주 (Endurance)') {
        taperingVolumeCutPct = 35;
        taperingLsdDistKm = isRaceThisWeek ? courseDistKm : 9;
        taperingSpeedRepNote = '가벼운 4km 조깅 및 코호흡';
        taperScaleNote = 'A-Race 메인 목표 & 안정 완주 반영 ➡️ 테이퍼링(-35%)';
        taperingIntensityStrategy = `[A-Race 안정 완주 감량] 결승선까지 체력을 온전히 보존하기 위해 주간 볼륨 -35% 감량 및 수면/글리코겐을 충전합니다.`;
      } else if (paceIntensityLevel === '중강도 (Moderate)') {
        taperingVolumeCutPct = 45;
        taperingLsdDistKm = isRaceThisWeek ? courseDistKm : 9;
        taperingSpeedRepNote = '가벼운 4km 조깅 후 100m 스트라이드 2회';
        taperScaleNote = 'A-Race 메인 목표 반영 ➡️ 표준 정밀 테이퍼링(-45%)';
        taperingIntensityStrategy = `[A-Race 중강도 완주 감량] 메인 레이스 피킹을 위해 주간 볼륨 -45% 감량 및 관절/건 컨디션을 최고치로 리셋합니다.`;
      } else if (paceIntensityLevel === '중상 강도 (Moderate-High)') {
        taperingVolumeCutPct = 52;
        taperingLsdDistKm = isRaceThisWeek ? courseDistKm : 8;
        taperingSpeedRepNote = `목표 페이스(${targetPace}) 300m 3회 리듬 점검`;
        taperScaleNote = 'A-Race 중상 강도 목표 반영 ➡️ 심화 테이퍼링(-52%)';
        taperingIntensityStrategy = `[A-Race 중상 강도 목표 감량] 주간 볼륨 -52% 집중 감량. 가벼운 이지 조깅과 ${targetPace} 리듬만 짧게 점검하여 다리의 생생함을 극대화합니다.`;
      } else {
        taperingVolumeCutPct = 58;
        taperingLsdDistKm = isRaceThisWeek ? courseDistKm : 7;
        taperingSpeedRepNote = `목표 페이스(${targetPace}) 200m 3회 질주 (신경계 자극, 젖산 차단)`;
        taperScaleNote = 'A-Race 초고강도 목표(Sub-3급) 반영 ➡️ 최고치 초강력 테이퍼링(-58%)';
        taperingIntensityStrategy = `[A-Race 고강도 특화 감량] 주간 볼륨 -58% 초강력 감량! 글리코겐 완전 충전 및 피로를 완전히 배출하며 신경계 발화 감각을 최상으로 유지합니다.`;
      }
    }

    phaseDescription = `대회 D-${diffDays}일(${importanceGrade}): 가벼운 리듬 조깅과 글리코겐 충전 주간입니다. (${taperScaleNote})`;
    strategicAdvice = isRaceThisWeek
      ? `이번 주 ${raceDayOfWeek} 결승의 날입니다! 주중 볼륨을 ${taperingVolumeCutPct}% 감량하고, 목표 페이스(${targetPace})로 스타트하여 흔들림 없이 피니시 라인까지 달리세요.`
      : `주간 볼륨을 평소 대비 ${taperingVolumeCutPct}% 감량하고, ${taperingSpeedRepNote}로 근육 텐션을 가볍게 유지하세요.`;
  } else if (diffDays <= 21) {
    const isWeek2 = diffDays <= 14;

    if (isEasyRunCruiseLoad) {
      periodizationPhase = isWeek2 ? '목표 페이스 특화기 (Peak)' : '스피드/지구력 빌드업기 (Build)';
      taperingVolumeCutPct = 0;
      taperingLsdDistKm = courseDistKm >= 20 ? 18 : 14;
      taperScaleNote = '10km 6’00 이지런 연장 부하 ➡️ 2~3주 전 조기 감량 배제(0%), 정상 마일리지 100% 빌드업 지속';
      taperingIntensityStrategy = `[이지런 연장 부하 감량 배제] 10km 6’00 페이스는 평소 이지런 수준의 유산소 부하이므로 2~3주 전 테이퍼링 감량을 완전히 배제하고 100% 마일리지를 지속합니다.`;
      phaseDescription = `대회 D-${diffDays}일(이지런 연장 대비): 조기 감량 없이 100% 정상 마일리지를 지속합니다. (${taperScaleNote})`;
      strategicAdvice = `평소와 동일하게 주간 마일리지를 충실히 소화하며 편안한 유산소 베이스를 쌓으세요.`;
      easyRunCruiseNote = `💡 러너 분석 반영: 10km 6’00 페이스는 평소 이지런보다 거리가 살짝 늘어난 유산소(Zone 2) 부하입니다. 조기 감량 없이 100% 정상 마일리지를 지속합니다.`;
    } else if (racePriority === 'C') {
      if (isWeek2) {
        if (paceIntensityLevel === '안정 완주 (Endurance)' || paceIntensityLevel === '중강도 (Moderate)') {
          // No tapering for C-race with low/moderate intensity!
          periodizationPhase = '목표 페이스 특화기 (Peak)';
          taperingVolumeCutPct = 0;
          taperingLsdDistKm = courseDistKm >= 40 ? 26 : courseDistKm >= 20 ? 18 : 14;
          taperScaleNote = '중요도(C-Race) & 완주 강도 반영 ➡️ 2주 전 조기 감량 배제(0%), 주간 마일리지 100% 지속';
          taperingIntensityStrategy = `[C-Race 완주 목표 감량 배제] 중요도와 강도가 낮아 2주 전 조기 감량 시 심폐 능력 손실 우려가 있으므로, 주간 마일리지 100%를 온전히 유지합니다.`;
          phaseDescription = `대회 D-${diffDays}일(C-Race 2주전): 연습 대회이므로 장기 테이퍼링 없이 정상 마일리지를 소화합니다. (${taperScaleNote})`;
          strategicAdvice = `주간 마일리지를 온전히 유지하며, 편안한 조깅과 LSD(${taperingLsdDistKm}km)로 지구력을 계속 쌓아가세요.`;
        } else {
          periodizationPhase = '테이퍼링 감량기 (Tapering)';
          taperingVolumeCutPct = 8;
          taperingLsdDistKm = Math.min(courseDistKm, 20);
          taperScaleNote = 'C-Race 고강도 목표 반영 ➡️ 2주차 극소 감량(-8%)';
          taperingIntensityStrategy = `[C-Race 2주차 극소 감량] 주간 볼륨 -8%만 살짝 덜어내며 훈련 흐름을 유지합니다.`;
          phaseDescription = `대회 D-${diffDays}일(C-Race 2주차): 미니 조율(-8%) 단계입니다.`;
          strategicAdvice = `LSD는 ${taperingLsdDistKm}km 수준으로 가볍게 조절하고 일상 훈련을 지속하세요.`;
        }
      } else {
        // Week 1 (D-15~21) for C-Race -> 0% cut, pure build/peak!
        periodizationPhase = '스피드/지구력 빌드업기 (Build)';
        taperingVolumeCutPct = 0;
        taperingLsdDistKm = courseDistKm >= 40 ? 26 : courseDistKm >= 20 ? 18 : 14;
        taperScaleNote = 'C-Race 연습 대회: 3주 전 감량 배제(0%), 정상 훈련 마일리지 지속';
        taperingIntensityStrategy = `[C-Race 3주전 감량 배제] 훈련 흐름 보존을 위해 조기 감량을 전혀 두지 않고 마일리지 빌드업을 지속합니다.`;
        phaseDescription = `대회 D-${diffDays}일(C-Race 3주전): 장기 테이퍼링 배제, 정상 유산소 훈련 지속 단계입니다.`;
        strategicAdvice = `주간 마일리지를 충실히 유지하며 유산소 베이스와 역치 템포런을 소화하세요.`;
      }
    } else if (racePriority === 'B') {
      if (isWeek2) {
        periodizationPhase = '테이퍼링 감량기 (Tapering)';
        if (paceIntensityLevel === '안정 완주 (Endurance)') {
          taperingVolumeCutPct = 8;
          taperingLsdDistKm = Math.min(courseDistKm, 20);
          taperScaleNote = 'B-Race 완주 목표 반영 ➡️ 2주차 미니 감량(-8%)';
        } else if (paceIntensityLevel === '중강도 (Moderate)') {
          taperingVolumeCutPct = 14;
          taperingLsdDistKm = Math.min(courseDistKm, 18);
          taperScaleNote = 'B-Race 중강도 점검 반영 ➡️ 2주차 미니 감량(-14%)';
        } else {
          taperingVolumeCutPct = 20;
          taperingLsdDistKm = Math.min(courseDistKm, 16);
          taperScaleNote = 'B-Race 고강도 점검 반영 ➡️ 2주차 감량(-20%)';
        }
        taperingIntensityStrategy = `[B-Race 2주차 점검 감량] 볼륨 -${taperingVolumeCutPct}% 미니 감량으로 실전 점검 컨디션을 맞춥니다.`;
        phaseDescription = `대회 D-${diffDays}일(B-Race 점검 2주차): 미니 감량(-${taperingVolumeCutPct}%) 단계입니다. (${taperScaleNote})`;
        strategicAdvice = `LSD를 ${taperingLsdDistKm}km로 가볍게 정돈하고 페이스 리듬을 점검하세요.`;
      } else {
        // Week 1 for B-Race -> 0% cut
        periodizationPhase = '목표 페이스 특화기 (Peak)';
        taperingVolumeCutPct = 0;
        taperingLsdDistKm = courseDistKm >= 40 ? 26 : courseDistKm >= 20 ? 18 : 14;
        taperScaleNote = 'B-Race 점검 대회: 3주 전 감량 배제(0%), 정상 피크 훈련 지속';
        taperingIntensityStrategy = `[B-Race 3주전 정상 가동] 점검 레이스 3주 전이므로 테이퍼링 없이 주간 마일리지를 온전히 소화합니다.`;
        phaseDescription = `대회 D-${diffDays}일(B-Race 3주전): 정상 마일리지 및 피크 페이스 훈련 단계입니다.`;
        strategicAdvice = `주간 마일리지를 100% 가동하며 대회 목표 페이스 적응도를 점검하세요.`;
      }
    } else {
      // A-Race
      periodizationPhase = '테이퍼링 감량기 (Tapering)';
      if (isWeek2) {
        if (paceIntensityLevel === '고강도 목표 (High)') {
          taperingVolumeCutPct = 38;
          taperingLsdDistKm = Math.min(courseDistKm, 14);
          taperScaleNote = 'A-Race 고강도 목표 반영 ➡️ 2주차 집중 감량(-38%)';
        } else if (paceIntensityLevel === '중상 강도 (Moderate-High)') {
          taperingVolumeCutPct = 30;
          taperingLsdDistKm = Math.min(courseDistKm, 16);
          taperScaleNote = 'A-Race 중상 강도 반영 ➡️ 2주차 감량(-30%)';
        } else if (paceIntensityLevel === '중강도 (Moderate)') {
          taperingVolumeCutPct = 24;
          taperingLsdDistKm = Math.min(courseDistKm, 18);
          taperScaleNote = 'A-Race 중강도 완주 반영 ➡️ 2주차 감량(-24%)';
        } else {
          taperingVolumeCutPct = 18;
          taperingLsdDistKm = Math.min(courseDistKm, 20);
          taperScaleNote = 'A-Race 완주 목표 반영 ➡️ 2주차 온건 감량(-18%)';
        }
        taperingIntensityStrategy = `[A-Race 2주차 테이퍼링] 주간 볼륨 -${taperingVolumeCutPct}% 감량 및 LSD ${taperingLsdDistKm}km 축소. 피로를 제거하고 스피드 감각을 날카롭게 보존합니다.`;
        phaseDescription = `대회 D-${diffDays}일(테이퍼링 2주차): 주간 볼륨 ${taperingVolumeCutPct}% 감량 단계입니다. (${taperScaleNote})`;
        strategicAdvice = `LSD 거리를 ${taperingLsdDistKm}km로 축소하고, 가벼운 포인트 훈련으로 피로는 털어내고 페이스 감각을 살려두세요.`;
      } else {
        // Week 1 (D-15~21)
        if (paceIntensityLevel === '고강도 목표 (High)') {
          taperingVolumeCutPct = 22;
          taperingLsdDistKm = Math.min(courseDistKm, 18);
          taperScaleNote = 'A-Race 고강도 목표 반영 ➡️ 1주차 점진 감량(-22%)';
        } else if (paceIntensityLevel === '중상 강도 (Moderate-High)') {
          taperingVolumeCutPct = 18;
          taperingLsdDistKm = Math.min(courseDistKm, 20);
          taperScaleNote = 'A-Race 중상 강도 반영 ➡️ 1주차 감량(-18%)';
        } else if (paceIntensityLevel === '중강도 (Moderate)') {
          taperingVolumeCutPct = 14;
          taperingLsdDistKm = Math.min(courseDistKm, 22);
          taperScaleNote = 'A-Race 중강도 반영 ➡️ 1주차 감량(-14%)';
        } else {
          taperingVolumeCutPct = 10;
          taperingLsdDistKm = Math.min(courseDistKm, 24);
          taperScaleNote = 'A-Race 완주 목표 반영 ➡️ 1주차 최소 감량(-10%)';
        }
        taperingIntensityStrategy = `[A-Race 1주차 테이퍼링] 주간 볼륨 -${taperingVolumeCutPct}% 감량 시작, 긴장 완화와 에너지 비축을 시작합니다.`;
        phaseDescription = `대회 D-${diffDays}일(테이퍼링 1주차): 점진적 감량기 진입(-${taperingVolumeCutPct}%). (${taperScaleNote})`;
        strategicAdvice = `LSD를 ${taperingLsdDistKm}km로 조절하고, 대회 페이스 주행 시 심박수를 차분히 관찰하세요.`;
      }
    }
  } else if (diffDays <= 56) {
    periodizationPhase = '목표 페이스 특화기 (Peak)';
    taperingVolumeCutPct = 0;
    taperingLsdDistKm = courseDistKm >= 40 ? 28 : courseDistKm >= 20 ? 20 : 14;
    taperingSpeedRepNote = `야소 800m / 역치 템포런 전출력 소화`;
    taperScaleNote = `피크기: 주간 마일리지 100% 가동 (${importanceGrade})`;
    taperingIntensityStrategy = `[피크기 페이스 특화] 주간 마일리지 100% 가동. 목표 페이스(${targetPace}) 지속 능력을 최고치로 끌어올리는 핵심 승부처입니다.`;
    phaseDescription = `대회 D-${diffWeeks}주전: 대회 코스 목표 페이스(${targetPace}) 집중 적응과 후반 페이스 유지력을 극대화하는 피크 훈련기입니다.`;
    strategicAdvice = `주말 LSD 후반 6~8km를 대회 목표 페이스(${targetPace})로 달리는 빌드업주와 야소 800m / 역치 템포런으로 경기력을 최고치로 끌어올립니다.`;
  } else if (diffDays <= 112) {
    periodizationPhase = '스피드/지구력 빌드업기 (Build)';
    taperingVolumeCutPct = 0;
    taperingLsdDistKm = courseDistKm >= 40 ? 24 : 16;
    taperingSpeedRepNote = `VO2max 인터벌 & 점진적 마일리지 증량`;
    taperScaleNote = `빌드업기: 심폐 엔진 및 역치(LT) 페이스 확장`;
    taperingIntensityStrategy = `[빌드업기 체계적 증량] 심폐 엔진 및 역치(LT) 페이스 확장 훈련.`;
    phaseDescription = `대회 D-${diffWeeks}주전: 심폐 지구력과 젖산 역치(LT) 페이스를 끌어올려 탄탄한 훈련 기반을 쌓는 점진적 증량기입니다.`;
    strategicAdvice = `주간 마일리지를 전주 대비 5~10% 점진 증량하고, 주 1회 역치 템포런과 인터벌을 통해 심폐 한계치(VO2Max)를 확장하세요.`;
  } else {
    periodizationPhase = '기초 유산소 구축기 (Base)';
    taperingVolumeCutPct = 0;
    taperingLsdDistKm = courseDistKm >= 40 ? 22 : 14;
    taperScaleNote = `베이스 구축기: Zone 2 80% 이상 유지`;
    taperingSpeedRepNote = `유산소 이지 조깅 + 질주 4회`;
    taperingIntensityStrategy = `[베이스 구축기 엔진 빌딩] Zone 2 80% 이상 유지로 심혈관계 모세혈관 발달.`;
    phaseDescription = `대회 D-${diffDays}일(약 ${diffWeeks}주): 2027 경주마라톤 정조준 장기 기초 유산소(Zone 2) 엔진 구축 및 부상 방지 마일리지 축적 단계입니다.`;
    strategicAdvice = `편안한 호흡의 이지런(Zone 2) 비중을 80% 이상 유지하여 모세혈관과 미토콘드리아를 증식하고, 하체 건/인대 결합조직을 튼튼히 보강하세요.`;
  }

  return {
    raceId: targetRace.id,
    raceName: targetRace.name,
    raceDate: targetRace.date,
    course: targetRace.course || targetCourseFallback,
    dDayDays: diffDays,
    dDayWeeks: diffWeeks,
    targetFinishTime: finishTime,
    targetRacePace: targetPace,
    targetPaceRawSec,
    courseDistKm,
    racePriority,
    importanceGrade,
    paceIntensityLevel,
    taperingVolumeCutPct,
    taperingIntensityStrategy,
    taperingSpeedRepNote,
    taperingLsdDistKm,
    taperScaleNote,
    periodizationPhase,
    phaseDescription,
    strategicAdvice,
    isRaceThisWeek,
    raceDayOfWeek,
    isEasyRunCruiseLoad,
    easyRunCruiseNote,
  };
}

/**
 * Analyzes ALL upcoming registered races, sorted chronologically from nearest date to farthest.
 * Each race is evaluated with its importance (A/B/C) and goal pace intensity.
 */
export function analyzeAllUpcomingRacesForTrainingPlan(
  races: RegisteredRace[] = [],
  goals?: RunningGoals,
  targetCourseFallback: string = '풀코스'
): TargetRacePlanAnalysis[] {
  if (!races || races.length === 0) return [];

  const now = new Date();
  const todayMs = now.getTime();

  // Find upcoming races strictly sorted by proximity (가장 가까운 대회부터 우선 정렬)
  const upcomingRaces = [...races]
    .filter((r) => {
      const raceDate = new Date(r.date);
      return !isNaN(raceDate.getTime()) && raceDate.getTime() >= todayMs - 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (upcomingRaces.length === 0) {
    const pastRaces = [...races].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (pastRaces.length > 0) {
      upcomingRaces.push(pastRaces[0]);
    }
  }

  return upcomingRaces.map((race) => analyzeSingleRacePlan(race, goals, targetCourseFallback));
}

/**
 * Analyzes registered upcoming races & running goals to determine the runner's periodization phase
 * and target race pace for smart periodized training plan generation.
 * (가장 가까운 참가대회부터 우선 추출하여 중요도 및 강도 분석)
 */
export function analyzeTargetRaceForTrainingPlan(
  races: RegisteredRace[] = [],
  goals?: RunningGoals,
  targetCourseFallback: string = '풀코스'
): TargetRacePlanAnalysis | null {
  const allAnalyses = analyzeAllUpcomingRacesForTrainingPlan(races, goals, targetCourseFallback);
  return allAnalyses.length > 0 ? allAnalyses[0] : null;
}

/**
 * In-depth Runner Workload & Training State Analyzer
 * Evaluates:
 * 1. 월요일~일요일 기준 직전 주간(지난주) 완료 마일리지 & 최근 4주 완료 주간 마일리지 추세
 * 2. ACWR (Acute:Chronic Workload Ratio) for Overuse/Fatigue Risk Assessment (지난주 / 최근 4주 평균)
 * 3. 이번 주 실훈련 기록(예: 월요일 훈련) 실시간 감지 및 남은 요일 잔여 볼륨 자동 산출
 * 4. Recent Longest Run endurance capacity
 * 5. 사용자 명시 참가 대회 데이터의 중요도(A/B/C-Race), 목표 페이스 강도 및 주기화/테이퍼링 복합 가중치 반영
 */
export function analyzeRunnerState(
  trainingSessions: TrainingSession[] = [],
  targetRaceCourse: string = '풀코스',
  refDate: Date = new Date(),
  races: RegisteredRace[] = [],
  goals?: RunningGoals
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

  // Evaluate Target Race Plan & Weighting (가장 가까운 참가대회부터 중요도, 강도 분석)
  const targetRacePlan = analyzeTargetRaceForTrainingPlan(races, goals, targetRaceCourse);
  const matchedTargetRace = targetRacePlan
    ? races.find((r) => r.id === targetRacePlan.raceId || (r.name === targetRacePlan.raceName && r.date === targetRacePlan.raceDate))
    : [...races].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] || null;
  const targetRace = matchedTargetRace;

  let importanceGrade: RaceWeightDetail['importanceGrade'] =
    targetRacePlan?.importanceGrade || 'A-Race (메인 목표)';
  let importanceWeight =
    targetRacePlan?.racePriority === 'C' ? 1.0 : targetRacePlan?.racePriority === 'B' ? 1.1 : 1.25;

  if (targetRace && !targetRacePlan) {
    if (targetRace.priority === 'C' || targetRace.importance?.includes('C')) {
      importanceGrade = 'C-Race (연습 대회)';
      importanceWeight = 1.0;
    } else if (targetRace.priority === 'B' || targetRace.importance?.includes('B')) {
      importanceGrade = 'B-Race (중간 점검)';
      importanceWeight = 1.1;
    } else {
      importanceGrade = 'A-Race (메인 목표)';
      importanceWeight = 1.25;
    }
  }

  if (!trainingSessions || trainingSessions.length === 0) {
    let baseWeeklyKm = defaultWeeklyBase;
    let lsdDist = defaultTargetLsd;
    let speedDist = isFullCourse ? 10 : isHalfCourse ? 9 : 8;

    if (targetRacePlan) {
      if (targetRacePlan.taperingVolumeCutPct > 0) {
        baseWeeklyKm = Math.round(baseWeeklyKm * (1 - targetRacePlan.taperingVolumeCutPct / 100));
        lsdDist = targetRacePlan.taperingLsdDistKm;
        speedDist = targetRacePlan.isRaceThisWeek ? 4 : 6;
      }
    }

    const raceWeightDetail: RaceWeightDetail | undefined = targetRacePlan
      ? {
          raceName: targetRacePlan.raceName,
          raceDate: targetRacePlan.raceDate,
          course: targetRacePlan.course,
          dDayDays: targetRacePlan.dDayDays,
          dDayWeeks: targetRacePlan.dDayWeeks,
          periodizationPhase: targetRacePlan.periodizationPhase,
          importanceGrade,
          importanceWeight,
          paceIntensityLevel: targetRacePlan.paceIntensityLevel,
          targetRacePace: targetRacePlan.targetRacePace,
          taperingVolumeCutPct: targetRacePlan.taperingVolumeCutPct,
          taperingLsdDistKm: targetRacePlan.taperingLsdDistKm,
          taperScaleNote: targetRacePlan.taperScaleNote,
          weightedGuidance: `[${importanceGrade} · ${targetRacePlan.paceIntensityLevel}] ${targetRacePlan.raceName} (D-${targetRacePlan.dDayDays}일, ${targetRacePlan.course}) 대비: ${targetRacePlan.periodizationPhase} 반영 (가중치 x${importanceWeight}${targetRacePlan.taperingVolumeCutPct > 0 ? `, 테이퍼링 -${targetRacePlan.taperingVolumeCutPct}%` : ', 100% 정상 가동'})`,
          isEasyRunCruiseLoad: targetRacePlan.isEasyRunCruiseLoad,
          easyRunCruiseNote: targetRacePlan.easyRunCruiseNote,
        }
      : undefined;

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
      recommendedWeeklyKm: baseWeeklyKm,
      mileageAdjustmentNote: targetRacePlan
        ? `[목표 대회 가중치 반영] ${targetRacePlan.raceName} (D-${targetRacePlan.dDayDays}일, ${importanceGrade})의 ${targetRacePlan.periodizationPhase} 및 ${targetRacePlan.paceIntensityLevel} (${targetRacePlan.targetRacePace}/km) 목표 강도가 반영되어 주간 볼륨 ${baseWeeklyKm}km로 산출되었습니다.`
        : '누적 훈련 데이터가 없어 목표 코스 기준 표준 가이드라인 볼륨으로 산출되었습니다.',
      intensityAdjustmentNote: targetRacePlan
        ? `[대회 페이스 강도 가중치] ${targetRacePlan.taperingIntensityStrategy || '목표 페이스에 맞춘 점진적 인터벌 훈련 권장'}`
        : '기본 훈련 강도로 시작하며 점진적인 빌드업을 권장합니다.',
      longRunRecommendedKm: lsdDist,
      speedVolumeRecommendedKm: speedDist,
      lastWeekLabel,
      thisWeekLoggedKm: 0,
      thisWeekSessionsCount: 0,
      thisWeekDaysDone: [],
      remainingWeeklyPlanKm: baseWeeklyKm,
      raceWeightDetail,
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
    targetWeeklyVolume = Math.round(lastWeekDistance * 0.92);
    mileageAdjustmentNote = `지난주 주간 부하(ACWR ${acwr})가 1.3을 초과하여 주의 구간입니다. 피로 흡수를 위해 주간 마일리지를 하향 조정한 ${targetWeeklyVolume}km로 안전하게 리셋합니다.`;
    intensityAdjustmentNote = '인터벌 질주 반복수와 고강도 지속주 거리를 축소하고 보강 운동 및 완전 휴식에 비중을 둡니다.';
  } else if (acwr < 0.8) {
    const baseRef = Math.max(lastWeekDistance, chronicLoadKm * 0.85);
    targetWeeklyVolume = Math.round(Math.min(baseRef * 1.1, defaultWeeklyBase));
    mileageAdjustmentNote = `지난주 마일리지가 일시적 감소 상태(ACWR ${acwr})였습니다. 10% 증량 안전 법칙을 적용하여 단계적으로 ${targetWeeklyVolume}km까지 회복 빌드업합니다.`;
    intensityAdjustmentNote = '고강도 질주보다는 Zone 2 유산소 베이스 조깅의 비중을 높여 기초 심폐 용적을 재충전합니다.';
  } else {
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

  // Incorporate Target Race Importance, Goal Pace Intensity, and Periodization Weighting!
  let raceWeightDetail: RaceWeightDetail | undefined = undefined;

  if (targetRacePlan) {
    // 1) Periodization Volume Modulation
    if (targetRacePlan.taperingVolumeCutPct > 0) {
      const taperVol = Math.round(targetWeeklyVolume * (1 - targetRacePlan.taperingVolumeCutPct / 100));
      const minSafe = targetRacePlan.isRaceThisWeek ? targetRacePlan.courseDistKm + 6 : 14;
      targetWeeklyVolume = Math.max(minSafe, taperVol);
    } else if (targetRacePlan.periodizationPhase.includes('Peak')) {
      targetWeeklyVolume = Math.round(targetWeeklyVolume * 1.12);
    } else if (targetRacePlan.periodizationPhase.includes('Build')) {
      targetWeeklyVolume = Math.round(targetWeeklyVolume * 1.05);
    }

    raceWeightDetail = {
      raceId: targetRacePlan.raceId,
      raceName: targetRacePlan.raceName,
      raceDate: targetRacePlan.raceDate,
      course: targetRacePlan.course,
      dDayDays: targetRacePlan.dDayDays,
      dDayWeeks: targetRacePlan.dDayWeeks,
      periodizationPhase: targetRacePlan.periodizationPhase,
      racePriority: targetRacePlan.racePriority,
      importanceGrade,
      importanceWeight,
      paceIntensityLevel: targetRacePlan.paceIntensityLevel,
      targetRacePace: targetRacePlan.targetRacePace,
      taperingVolumeCutPct: targetRacePlan.taperingVolumeCutPct,
      taperingLsdDistKm: targetRacePlan.taperingLsdDistKm,
      taperScaleNote: targetRacePlan.taperScaleNote,
      weightedGuidance: `[${importanceGrade} · ${targetRacePlan.paceIntensityLevel}] ${targetRacePlan.raceName} (D-${targetRacePlan.dDayDays}일, ${targetRacePlan.course}): ${targetRacePlan.periodizationPhase} 반영 (가중치 x${importanceWeight}${targetRacePlan.taperingVolumeCutPct > 0 ? `, 감량 -${targetRacePlan.taperingVolumeCutPct}%` : ', 100% 볼륨 가동'}${targetRacePlan.taperScaleNote ? ` · ${targetRacePlan.taperScaleNote}` : ''})`,
      isEasyRunCruiseLoad: targetRacePlan.isEasyRunCruiseLoad,
      easyRunCruiseNote: targetRacePlan.easyRunCruiseNote,
    };

    mileageAdjustmentNote = `[참가 대회 가중치 & 테이퍼링 정밀 조율] ${targetRacePlan.raceName} (${importanceGrade}, ${targetRacePlan.paceIntensityLevel}) 대비: ${targetRacePlan.taperScaleNote || `${targetRacePlan.periodizationPhase} 반영`}. 주간 볼륨 ${targetWeeklyVolume}km 세팅. ${mileageAdjustmentNote}`;
    intensityAdjustmentNote = `[대회 페이스 강도 조율] ${targetRacePlan.taperingIntensityStrategy || '목표 대회 페이스에 맞춘 정밀 인터벌/템포런 훈련을 핵심 포인트로 배치합니다.'} ${intensityAdjustmentNote}`;
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
  let maxSafeLongRun = Math.round(
    Math.min(
      defaultTargetLsd,
      targetWeeklyVolume * 0.4,
      Math.max(recentLongestRunKm + 3, defaultTargetLsd * 0.65)
    )
  );

  if (targetRacePlan) {
    if (targetRacePlan.isRaceThisWeek) {
      maxSafeLongRun = targetRacePlan.courseDistKm;
    } else if (targetRacePlan.taperingLsdDistKm > 0 && targetRacePlan.taperingVolumeCutPct > 0) {
      maxSafeLongRun = targetRacePlan.taperingLsdDistKm;
    } else if (targetRacePlan.periodizationPhase.includes('Peak')) {
      maxSafeLongRun = isFullCourse ? 30 : isHalfCourse ? 20 : 14;
    }
  }

  const longRunRecommendedKm = Math.max(maxSafeLongRun, isFullCourse ? 18 : isHalfCourse ? 12 : 8);

  let speedVolumeRecommendedKm = isFullCourse
    ? targetWeeklyVolume >= 42 ? 10 : 8
    : isHalfCourse
    ? targetWeeklyVolume >= 34 ? 9 : 8
    : 8;

  if (targetRacePlan) {
    if (targetRacePlan.isRaceThisWeek) {
      speedVolumeRecommendedKm = targetRacePlan.paceIntensityLevel === '고강도 목표 (High)' ? 4 : 5;
    } else if (targetRacePlan.taperingVolumeCutPct > 0) {
      speedVolumeRecommendedKm = targetRacePlan.dDayDays <= 14 ? 6 : 7;
    } else if (targetRacePlan.paceIntensityLevel === '고강도 목표 (High)') {
      speedVolumeRecommendedKm = Math.min(12, speedVolumeRecommendedKm + 1);
    }
  }

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
    raceWeightDetail,
  };
}

/**
 * AI Weekly Training Schedule Generator
 * Tailors daily workouts based on current VDOT, target race schedule & target pace,
 * customized training days, and user-specified Point workouts (Speed workout & Long-distance workout).
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

  // Analyze registered race schedule & target pace
  const targetRacePlan = analyzeTargetRaceForTrainingPlan(options?.races, options?.goals, targetRaceCourse);
  const effectiveRacePace = targetRacePlan?.targetRacePace || marathonPace;

  // If training sessions are provided, perform in-depth workload and state analysis with race weighting
  const analysis = options?.trainingSessions
    ? analyzeRunnerState(options.trainingSessions, targetRaceCourse, new Date(), options?.races, options?.goals)
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
  let totalTargetWeeklyKm = analysis ? analysis.recommendedWeeklyKm : (isFullCourse ? 48 : isHalfCourse ? 38 : 28);

  // Apply Target Race Periodization & Tapering Modulation based on Target Pace Intensity
  const isTaperingPhase = targetRacePlan && (targetRacePlan.periodizationPhase === '테이퍼링 감량기 (Tapering)' || targetRacePlan.periodizationPhase === '대회 직전 조정기 (Race Week)');
  const isRaceWeek = targetRacePlan?.periodizationPhase === '대회 직전 조정기 (Race Week)';

  if (targetRacePlan && isTaperingPhase && targetRacePlan.taperingVolumeCutPct > 0) {
    const rawTaperVol = Math.round(totalTargetWeeklyKm * (1 - targetRacePlan.taperingVolumeCutPct / 100));
    const minSafeVol = targetRacePlan.isRaceThisWeek
      ? targetRacePlan.courseDistKm + 6
      : isRaceWeek ? 14 : isFullCourse ? 22 : isHalfCourse ? 18 : 14;
    totalTargetWeeklyKm = Math.max(minSafeVol, rawTaperVol);
  }

  const remainingKm = Math.max(0, Math.round((totalTargetWeeklyKm - completedKmThisWeek) * 10) / 10);

  // Point workout target distances
  const hasRemainingLongRun = remainingRunningDays.includes(longRunDay as DayOfWeek);
  const hasRemainingSpeed = remainingRunningDays.includes(speedDay as DayOfWeek);

  let targetLsdDist = analysis ? analysis.longRunRecommendedKm : isFullCourse ? 26 : isHalfCourse ? 18 : is10k ? 14 : 10;
  let targetSpeedDist = analysis ? analysis.speedVolumeRecommendedKm : isFullCourse ? 10 : isHalfCourse ? 9 : 8;

  // Modulate LSD and Speed Workout by Target Pace Tapering Parameters
  if (targetRacePlan && isTaperingPhase && targetRacePlan.taperingLsdDistKm > 0) {
    targetLsdDist = targetRacePlan.taperingLsdDistKm;
    if (isRaceWeek) {
      targetSpeedDist = targetRacePlan.paceIntensityLevel === '고강도 목표 (High)' ? 4 : 5;
    } else if (targetRacePlan.dDayDays <= 14) {
      targetSpeedDist = targetRacePlan.paceIntensityLevel === '고강도 목표 (High)' ? 6 : 7;
    }
  }

  // If remainingKm is tight, scale points safely so total does not exceed safe volume
  if (remainingKm > 0 && hasRemainingLongRun && !targetRacePlan?.isRaceThisWeek && targetLsdDist > remainingKm * 0.6) {
    targetLsdDist = Math.max(isRaceWeek ? 6 : 10, Math.round(remainingKm * 0.5));
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
        description: isTaperingPhase
          ? `대회 D-${targetRacePlan.dDayDays}일 테이퍼링 휴식일. 폼롤러 근막 이완과 탄수화물 영양 보충, 깊은 수면으로 글리코겐을 충전합니다.`
          : '폼롤러 근막 이완, 햄스트링/종아리 스트레칭 및 영양 보충. 포인트 훈련 피로 회복.',
        intensity: '휴식',
      };
    }

    // 2. Point 1: Long Run Day
    if (dayName === longRunDay) {
      // Check if race is this week and falls on this weekend
      if (targetRacePlan?.isRaceThisWeek && (dayName === targetRacePlan.raceDayOfWeek || (!targetRacePlan.raceDayOfWeek && dayName === longRunDay))) {
        const raceDist = targetRacePlan.courseDistKm;
        const p1 = Math.min(5, Math.round(raceDist * 0.15 * 10) / 10);
        const p2 = Math.round((raceDist * 0.6) * 10) / 10;
        const p3 = Math.round((raceDist - p1 - p2) * 10) / 10;
        const raceStages: WorkoutStage[] = [
          {
            step: `1구간: 출발~초반 (0 ~ ${p1}km, ${p1}km)`,
            distanceKm: p1,
            pace: targetRacePlan.targetRacePace,
            zone: 'Zone 3 (흥분 억제)',
            focus: '오버페이스 절대 금지! 출발 인파 속에서 심박을 안정화하고 목표 페이스에 차분히 안착',
          },
          {
            step: `2구간: 중반 정속 순항 (${p1} ~ ${Math.round((p1 + p2) * 10) / 10}km, ${p2}km)`,
            distanceKm: p2,
            pace: targetRacePlan.targetRacePace,
            zone: 'Zone 3~4 (정속 크루징)',
            focus: '5km마다 스포츠 음료 및 에너지젤 규칙적 섭취, 일정한 피치와 호흡 유지',
          },
          {
            step: `3구간: 승부처 & 피니시 (${Math.round((p1 + p2) * 10) / 10} ~ ${raceDist}km, ${p3}km)`,
            distanceKm: p3,
            pace: targetRacePlan.targetRacePace,
            zone: 'Zone 4 (젖산 내성 극복)',
            focus: '후반 허벅지 피로를 코어와 팔치기로 극복하며 감격의 목표 기록 결승선 피니시!',
          },
        ];

        return {
          day: dayName,
          dayShort,
          dateStr,
          type: 'LSD',
          title: `[🏆 D-DAY 목표 대회] ${targetRacePlan.raceName} (${targetRacePlan.course} ${raceDist}km)`,
          distanceKm: raceDist,
          targetPace: targetRacePlan.targetRacePace,
          targetZone: '실전 마라톤 레이스',
          description: `드디어 결승의 날입니다! 그동안 흘린 땀방울을 믿고, 목표 기록 ${targetRacePlan.targetFinishTime} (${targetRacePlan.targetRacePace}/km) 완주를 위해 페이스를 지키며 달리세요.`,
          intensity: '높음',
          stages: raceStages,
        };
      }

      const isTaper = isTaperingPhase;
      const actualLsdDist = defaultLsdDist;
      const warmupDist = actualLsdDist <= 8 ? 1.5 : 2.0;
      const cooldownDist = actualLsdDist <= 8 ? 1.5 : 2.0;
      const mainDist = Math.max(1, Math.round((actualLsdDist - warmupDist - cooldownDist) * 10) / 10);

      const lsdStages: WorkoutStage[] = [
        {
          step: `1구간: 워밍업 (0 ~ ${warmupDist}km, ${warmupDist}km)`,
          distanceKm: warmupDist,
          pace: easyMax,
          zone: 'Zone 1~2',
          focus: isTaper ? '워밍업 및 가벼운 다리 털기, 체온 상승' : '워밍업 및 체온 상승, 가벼운 호흡 리듬 조성',
        },
        {
          step: `2구간: 본운동 (${warmupDist} ~ ${Math.round((warmupDist + mainDist) * 10) / 10}km, ${mainDist}km)`,
          distanceKm: mainDist,
          pace: isTaper ? effectiveRacePace : `${easyMin} ~ ${easyMax}`,
          zone: isTaper ? 'Zone 3 (레이스 페이스 점검)' : 'Zone 2 (지속주)',
          focus: isTaper
            ? `${targetRacePlan.raceName} 목표 페이스(${effectiveRacePace}) 정밀 락온 및 리듬 점검`
            : targetRacePlan
            ? `${targetRacePlan.raceName} 목표 페이스(${effectiveRacePace}) 적응 및 5km마다 뉴트리션 섭취 시뮬레이션`
            : '지방 대사 최적화 및 5km마다 뉴트리션 섭취 시뮬레이션',
        },
        {
          step: `3구간: 후반 마무리 (${Math.round((warmupDist + mainDist) * 10) / 10} ~ ${actualLsdDist}km, ${cooldownDist}km)`,
          distanceKm: cooldownDist,
          pace: isTaper ? easyMax : effectiveRacePace,
          zone: isTaper ? 'Zone 1 (회복)' : 'Zone 2~3',
          focus: isTaper ? '심박 안정화 및 근육 긴장 완화' : '후반 다리 피로 누적 상황에서 자세와 케이던스 집중 유지',
        },
      ];

      const lsdTitle = isTaper
        ? `[대회 테이퍼링 · 목표 페이스(${effectiveRacePace}) 점검] ${targetRacePlan.raceName.slice(0, 10)} D-${targetRacePlan.dDayDays}일 LSD ${actualLsdDist}km`
        : targetRacePlan
        ? `[포인트: 장거리] ${targetRacePlan.raceName.slice(0, 14)} D-${targetRacePlan.dDayDays}일 대비 LSD ${actualLsdDist}km`
        : `[포인트: 장거리] 주말 장거리 지속주(LSD) ${actualLsdDist}km`;

      const lsdDesc = isTaper
        ? `대회 D-${targetRacePlan.dDayDays}일 테이퍼링 감량 LSD입니다. 목표 페이스(${effectiveRacePace}/km) 감각을 점검하고 피로를 털어내기 위해 주행 거리를 ${actualLsdDist}km로 축소 조율했습니다.`
        : targetRacePlan
        ? `${targetRacePlan.raceName} (${targetRacePlan.course}) 대비 ${targetRacePlan.periodizationPhase}. 목표 페이스(${effectiveRacePace}/km) 감각 유지 및 에너지 대사 적응.`
        : `${targetRaceCourse} 완주를 위한 심폐 및 글리코겐 고갈 적응 훈련. 5km/10km/15km 지점 수분 및 뉴트리션 섭취 시뮬레이션.`;

      return {
        day: dayName,
        dayShort,
        type: 'LSD',
        title: lsdTitle,
        distanceKm: actualLsdDist,
        targetPace: isTaper ? `${effectiveRacePace}` : `${easyMin} ~ ${easyMax}`,
        targetZone: isTaper ? 'Zone 2~3 (테이퍼링 점검)' : 'Zone 2~3 (마라톤 페이스)',
        description: lsdDesc,
        intensity: isTaper && actualLsdDist <= 14 ? '보통' : '높음',
        stages: lsdStages,
      };
    }

    // 3. Point 2: Speed Workout Day
    if (dayName === speedDay) {
      const isTaper = isTaperingPhase;
      const isRaceWeekTaper = isRaceWeek;

      if (speedWorkoutType === '인터벌') {
        let intervalReps = defaultSpeedDist >= 10 ? 8 : 6;
        if (isRaceWeekTaper) {
          intervalReps = 3;
        } else if (isTaper) {
          intervalReps = targetRacePlan?.dDayDays <= 14 ? (targetRacePlan?.paceIntensityLevel === '고강도 목표 (High)' ? 4 : 5) : 6;
        }

        const warmupKm = 2.0;
        const repsKm = Math.round(intervalReps * 0.6 * 10) / 10; // 400m sprint + 200m rest = 600m
        const cooldownKm = Math.max(1.0, Math.round((defaultSpeedDist - warmupKm - repsKm) * 10) / 10);
        const actualSpeedDist = Math.round((warmupKm + repsKm + cooldownKm) * 10) / 10;

        const intervalStages: WorkoutStage[] = [
          {
            step: `1단계: 워밍업 (0 ~ ${warmupKm}km, ${warmupKm}km)`,
            distanceKm: warmupKm,
            pace: `${easyMin} ~ ${easyMax}`,
            zone: 'Zone 1~2',
            focus: '가벼운 조깅 + 동적 스트레칭 및 50m 질주 2회',
          },
          {
            step: `2단계: 본세트 400m 질주 x ${intervalReps}회 (${warmupKm} ~ ${Math.round((warmupKm + repsKm) * 10) / 10}km, ${repsKm}km)`,
            distanceKm: repsKm,
            pace: isTaper ? effectiveRacePace : intervalPace,
            zone: isTaper ? 'Zone 4 (레이스 텐션)' : 'Zone 5 (무산소)',
            focus: isTaper
              ? `트랙 400m 목표 레이스 페이스(${effectiveRacePace}) 정밀 유지, 세트 간 200m(2분 완전 회복 조깅/걷기)`
              : `트랙 400m ${intervalPace} (대회 목표 대비 +스피드) 페이스 유지, 세트 간 200m(90초) 조깅 휴식`,
          },
          {
            step: `3단계: 쿨다운 (${Math.round((warmupKm + repsKm) * 10) / 10} ~ ${actualSpeedDist}km, ${cooldownKm}km)`,
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
          title: isTaper
            ? `[대회 테이퍼링 감량 인터벌] ${effectiveRacePace} 텐션 유지 ${actualSpeedDist}km (400m x ${intervalReps}회)`
            : targetRacePlan
            ? `[포인트: 스피드] ${targetRacePlan.raceName.slice(0, 10)} 대비 VO2max 인터벌 ${actualSpeedDist}km (400m x ${intervalReps}회)`
            : `[포인트: 스피드] VO2max 트랙 인터벌 ${actualSpeedDist}km (400m x ${intervalReps}회)`,
          distanceKm: actualSpeedDist,
          targetPace: isTaper ? effectiveRacePace : intervalPace,
          targetZone: isTaper ? 'Zone 4 (레이스 페이스 텐션)' : 'Zone 5 (무산소/VO2max)',
          description: isTaper
            ? `대회 D-${targetRacePlan.dDayDays}일 감량 인터벌. 세트 수를 ${intervalReps}회로 축소하여 피로 축적을 막고 목표 페이스(${effectiveRacePace}) 신경계 발화 텐션만 날카롭게 유지합니다.`
            : `워밍업 ${warmupKm}km + 트랙 400m 질주(${intervalPace} 페이스) 및 200m 불완전 휴식 90초 ${intervalReps}회 반복 + 쿨다운 ${cooldownKm}km. 심폐 환기량 극대화.`,
          intensity: isRaceWeekTaper ? '보통' : '높음',
          stages: intervalStages,
        };
      } else if (speedWorkoutType === '800m 인터벌') {
        let reps = defaultSpeedDist >= 12 ? 6 : defaultSpeedDist >= 9 ? 5 : 4;
        if (isRaceWeekTaper) reps = 2;
        else if (isTaper) reps = targetRacePlan?.dDayDays <= 14 ? 3 : 4;

        const warmupKm = 2.0;
        const repWorkKm = 0.8;
        const repRestKm = 0.4;
        const mainWorkVolume = Math.round(reps * (repWorkKm + repRestKm) * 10) / 10;
        const cooldownKm = Math.max(1.0, Math.round((defaultSpeedDist - warmupKm - mainWorkVolume) * 10) / 10);
        const actualTotalDist = Math.round((warmupKm + mainWorkVolume + cooldownKm) * 10) / 10;

        const yassoStages: WorkoutStage[] = [
          {
            step: `1단계: 워밍업 (0 ~ ${warmupKm}km, ${warmupKm}km)`,
            distanceKm: warmupKm,
            pace: `${easyMin} ~ ${easyMax}`,
            zone: 'Zone 1~2',
            focus: '가벼운 조깅 + 고관절 가동성 스트레칭 및 80m 질주 2회',
          },
          {
            step: `2단계: 본세트 800m 질주 x ${reps}회 (${warmupKm} ~ ${Math.round((warmupKm + mainWorkVolume) * 10) / 10}km, ${mainWorkVolume}km)`,
            distanceKm: mainWorkVolume,
            pace: isTaper ? effectiveRacePace : intervalPace,
            zone: isTaper ? 'Zone 4~5 (대회 페이스 점검)' : 'Zone 5 (VO2max / 야소 800)',
            focus: isTaper
              ? `트랙 800m ${effectiveRacePace} 일정한 레이스 페이스 감각 유지, 세트 간 400m(2분30초) 넉넉한 휴식`
              : `트랙 800m(2바퀴) ${intervalPace} 일정한 페이스 유지, 세트 간 400m(2분~2분30초) 불완전 회복 조깅`,
          },
          {
            step: `3단계: 쿨다운 (${Math.round((warmupKm + mainWorkVolume) * 10) / 10} ~ ${actualTotalDist}km, ${cooldownKm}km)`,
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
          title: isTaper
            ? `[대회 테이퍼링 감량 인터벌] 800m 페이스 점검 ${actualTotalDist}km (800m x ${reps}회)`
            : `[포인트: 스피드] 800m 야소 인터벌 ${actualTotalDist}km (800m x ${reps}회)`,
          distanceKm: actualTotalDist,
          targetPace: isTaper ? effectiveRacePace : intervalPace,
          targetZone: isTaper ? 'Zone 4~5 (대회 페이스 점검)' : 'Zone 5 (VO2max / 야소 800)',
          description: isTaper
            ? `대회 D-${targetRacePlan.dDayDays}일 테이퍼링 인터벌. 세트 수를 ${reps}회로 축소하여 다리 피로를 완전히 풀면서 목표 페이스(${effectiveRacePace}) 리듬을 유지합니다.`
            : `워밍업 ${warmupKm}km + 트랙 800m 질주(${intervalPace} 페이스) 및 400m 불완전 회복 조깅 ${reps}세트 반복 + 쿨다운 ${cooldownKm}km.`,
          intensity: isRaceWeekTaper ? '보통' : '높음',
          stages: yassoStages,
        };
      } else if (speedWorkoutType === '1~3k 인터벌') {
        const isLongVolume = defaultSpeedDist >= 12;
        const repDistKm = isLongVolume ? 2 : 1; // 1km or 2km repeats
        const reps = isLongVolume ? (defaultSpeedDist >= 14 ? 4 : 3) : (defaultSpeedDist >= 9 ? 5 : 4);
        const restKm = 0.4; // 400m jog
        const warmupKm = 2.0;
        const mainWorkVolume = Math.round(reps * (repDistKm + restKm) * 10) / 10;
        const cooldownKm = Math.max(1.0, Math.round((defaultSpeedDist - warmupKm - mainWorkVolume) * 10) / 10);
        const actualTotalDist = Math.round((warmupKm + mainWorkVolume + cooldownKm) * 10) / 10;

        const cruiseStages: WorkoutStage[] = [
          {
            step: `1단계: 워밍업 (0 ~ ${warmupKm}km, ${warmupKm}km)`,
            distanceKm: warmupKm,
            pace: `${easyMin} ~ ${easyMax}`,
            zone: 'Zone 1~2',
            focus: '가벼운 조깅 + 호흡 리듬 정렬 및 동적 스트레칭',
          },
          {
            step: `2단계: 본세트 ${repDistKm}km 롱 크루즈 x ${reps}회 (${warmupKm} ~ ${Math.round((warmupKm + mainWorkVolume) * 10) / 10}km, ${mainWorkVolume}km)`,
            distanceKm: mainWorkVolume,
            pace: `${tempoPace} ~ ${intervalPace}`,
            zone: 'Zone 4~5 (크루즈 역치 인터벌)',
            focus: `${repDistKm}km 정속 크루즈 주행(${tempoPace}), 세트 간 400m(90초~2분) 불완전 회복 조깅`,
          },
          {
            step: `3단계: 쿨다운 (${Math.round((warmupKm + mainWorkVolume) * 10) / 10} ~ ${actualTotalDist}km, ${cooldownKm}km)`,
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
          title: `[포인트: 스피드] 1~3k 롱 크루즈 인터벌 ${actualTotalDist}km (${repDistKm}km x ${reps}회)`,
          distanceKm: actualTotalDist,
          targetPace: `${tempoPace} ~ ${intervalPace}`,
          targetZone: 'Zone 4~5 (크루즈 역치 인터벌)',
          description: `워밍업 ${warmupKm}km + ${repDistKm}km 롱 크루즈 인터벌(${tempoPace}) ${reps}회 반복 (세트 간 400m 조깅 휴식) + 쿨다운 ${cooldownKm}km. 하프/풀코스 실전 레이스 페이스 지구력 및 역치 한계 속도 적응.`,
          intensity: '높음',
          stages: cruiseStages,
        };
      } else if (speedWorkoutType === '템포런') {
        const warmupKm = defaultSpeedDist <= 7 ? 1.5 : 2.0;
        const cooldownKm = 1.0;
        const mainTempoKm = Math.max(2.0, Math.round((defaultSpeedDist - warmupKm - cooldownKm) * 10) / 10);
        const actualTotalDist = Math.round((warmupKm + mainTempoKm + cooldownKm) * 10) / 10;

        const tempoStages: WorkoutStage[] = [
          {
            step: `1단계: 워밍업 (0 ~ ${warmupKm}km, ${warmupKm}km)`,
            distanceKm: warmupKm,
            pace: easyMax,
            zone: 'Zone 2 (유산소 기초)',
            focus: '체온 상승 및 심박수 점진적 상승 준비',
          },
          {
            step: `2단계: 젖산역치 지속주 (${warmupKm} ~ ${Math.round((warmupKm + mainTempoKm) * 10) / 10}km, ${mainTempoKm}km)`,
            distanceKm: mainTempoKm,
            pace: tempoPace,
            zone: 'Zone 4 (젖산 역치)',
            focus: `T-Pace(${tempoPace}) 정속 주행으로 젖산 분해 및 페이스 억제 능력 강화`,
          },
          {
            step: `3단계: 쿨다운 (${Math.round((warmupKm + mainTempoKm) * 10) / 10} ~ ${actualTotalDist}km, ${cooldownKm}km)`,
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
          title: `[포인트: 스피드] 젖산 역치(Threshold) ${actualTotalDist}km 템포런`,
          distanceKm: actualTotalDist,
          targetPace: tempoPace,
          targetZone: 'Zone 4 (젖산 역치)',
          description: `워밍업 ${warmupKm}km + T-Pace 지속주 ${mainTempoKm}km(${tempoPace}) + 쿨다운 ${cooldownKm}km. 젖산 축적 억제 및 페이스 유지력 극대화.`,
          intensity: '높음',
          stages: tempoStages,
        };
      } else if (speedWorkoutType === '변속주(파틀렉)') {
        const warmupKm = defaultSpeedDist <= 7 ? 1.5 : 2.0;
        const cooldownKm = 1.0;
        const mainFartlekKm = Math.max(2.0, Math.round((defaultSpeedDist - warmupKm - cooldownKm) * 10) / 10);
        const actualTotalDist = Math.round((warmupKm + mainFartlekKm + cooldownKm) * 10) / 10;

        const fartlekStages: WorkoutStage[] = [
          {
            step: `1단계: 워밍업 (0 ~ ${warmupKm}km, ${warmupKm}km)`,
            distanceKm: warmupKm,
            pace: easyMax,
            zone: 'Zone 2',
            focus: '가벼운 조깅 및 관절 가동성 확보',
          },
          {
            step: `2단계: 파틀렉 인터벌 (${warmupKm} ~ ${Math.round((warmupKm + mainFartlekKm) * 10) / 10}km, ${mainFartlekKm}km)`,
            distanceKm: mainFartlekKm,
            pace: `${intervalPace} ↔ ${easyMin}`,
            zone: 'Zone 3~5',
            focus: '3분 쾌속 질주 + 2분 회복 조깅 6~7회 교대 반복',
          },
          {
            step: `3단계: 쿨다운 (${Math.round((warmupKm + mainFartlekKm) * 10) / 10} ~ ${actualTotalDist}km, ${cooldownKm}km)`,
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
          title: `[포인트: 스피드] 파틀렉(Fartlek) 변속주 ${actualTotalDist}km`,
          distanceKm: actualTotalDist,
          targetPace: `${intervalPace} ~ ${easyMin}`,
          targetZone: 'Zone 3~5 (심박 변동)',
          description: `워밍업 ${warmupKm}km + 빠른 질주 3분(${intervalPace})과 회복 조깅 2분 교대 반복 ${mainFartlekKm}km + 쿨다운 ${cooldownKm}km. 지형과 페이스 변화에 대한 스피드 적응력 향상.`,
          intensity: '높음',
          stages: fartlekStages,
        };
      } else {
        // 빌드업주 (Negative Split Progression Run)
        const totalDist = Math.round(defaultSpeedDist * 10) / 10;
        const stages: WorkoutStage[] = [];
        const numStages = totalDist >= 10 ? 4 : 3;

        const paceSteps = [
          { label: 'Zone 2 (출발)', sec: rawEasySec },
          { label: 'Zone 3 (순항)', sec: Math.round(rawEasySec - (rawEasySec - rawTempoSec) * (numStages === 4 ? 0.35 : 0.5)) },
          { label: 'Zone 3~4 (가속)', sec: Math.round(rawEasySec - (rawEasySec - rawTempoSec) * (numStages === 4 ? 0.70 : 0.85)) },
          { label: 'Zone 4 (피니시)', sec: rawTempoSec },
        ];

        let accumulatedKm = 0;
        for (let s = 0; s < numStages; s++) {
          const isLast = s === numStages - 1;
          const stageDist = isLast
            ? Math.max(0.5, Math.round((totalDist - accumulatedKm) * 10) / 10)
            : Math.max(0.5, Math.round((totalDist / numStages) * 10) / 10);

          const startKm = Math.round(accumulatedKm * 10) / 10;
          accumulatedKm += stageDist;
          const endKm = Math.round(accumulatedKm * 10) / 10;

          const pInfo = paceSteps[numStages === 3 ? (s === 0 ? 0 : s === 1 ? 1 : 3) : s];
          stages.push({
            step: `${s + 1}구간 (${startKm} ~ ${endKm}km, ${stageDist}km)`,
            distanceKm: stageDist,
            pace: formatPace(pInfo.sec),
            zone: pInfo.label,
            focus: isLast
              ? `최종 타겟 역치 페이스(${formatPace(pInfo.sec)})로 강력하게 밀고 나가며 피니시`
              : s === 0
              ? '편안한 이지 페이스로 호흡과 다리 리듬 세팅'
              : '케이던스와 보폭을 점진적으로 올리며 가속 주행',
          });
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
        title: isTaperingPhase
          ? `[대회 테이퍼링 회복주] 젖산 배출 & 근막 이완 ${recoveryDist}km`
          : '젖산 배출 리커버리 회복주 & 스트레칭',
        distanceKm: recoveryDist,
        targetPace: easyMax,
        targetZone: 'Zone 1 (회복심박)',
        description: isTaperingPhase
          ? `대회 D-${targetRacePlan?.dDayDays}일을 앞두고 피로를 풀고 관절을 신선하게 유지하는 초경량 회복 조깅입니다.`
          : '포인트 훈련 후 근육통 완화 및 혈류 순환을 돕는 가벼운 회복 러닝. 코호흡 유지 필수.',
        intensity: '낮음',
      };
    }

    // Standard aerobic base run
    return {
      day: dayName,
      dayShort,
      type: '조깅',
      title: isTaperingPhase
        ? `[대회 테이퍼링 컨디셔닝 조깅] 글리코겐 보존 Zone 2 ${standardJogDist}km`
        : '유산소 기초(Aerobic Base) Zone 2 조깅 & 질주',
      distanceKm: standardJogDist,
      targetPace: `${easyMin} ~ ${easyMax}`,
      targetZone: 'Zone 2 (유산소)',
      description: isTaperingPhase
        ? `대회 D-${targetRacePlan?.dDayDays}일 대비 근육 손상 없이 체내 글리코겐을 충전 보존하는 부드러운 이지 조깅입니다.`
        : '미토콘드리아 발달을 위한 편안한 대화 가능 페이스. 종료 전 100m 쾌속 질주(Strides) 4회로 신경계 자극.',
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
  analysis?: RunnerStateAnalysis | null,
  targetRacePlan?: TargetRacePlanAnalysis | null
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

  let totalTargetWeeklyKm =
    analysis?.recommendedWeeklyKm ||
    Math.round(plan.reduce((sum, d) => sum + (d.distanceKm || 0), 0) * 10) / 10;

  if (targetRacePlan && targetRacePlan.taperingVolumeCutPct > 0) {
    const rawTaperVol = Math.round(totalTargetWeeklyKm * (1 - targetRacePlan.taperingVolumeCutPct / 100));
    const minSafeVol = targetRacePlan.isRaceThisWeek ? targetRacePlan.courseDistKm + 6 : 14;
    totalTargetWeeklyKm = Math.max(minSafeVol, rawTaperVol);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const remainingKm = Math.max(0, Math.round((totalTargetWeeklyKm - completedKmThisWeek) * 10) / 10);

  // Future or today uncompleted running days (not in the past, not completed, not rest)
  const futureRunningDays = plan.filter((d, i) => {
    const dayDate = new Date(currentWeekMonday.getTime() + i * 24 * 60 * 60 * 1000);
    const dayDateStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime();
    const isPast = dayDateStart < todayStart;
    return !isPast && !completedDayIndices.includes(i) && d.type !== '휴식';
  });

  const futurePlannedSum = Math.round(
    futureRunningDays.reduce((sum, d) => sum + (d.distanceKm || 0), 0) * 10
  ) / 10;

  return plan.map((pDay, idx) => {
    const dayDate = new Date(currentWeekMonday.getTime() + idx * 24 * 60 * 60 * 1000);
    const y = dayDate.getFullYear();
    const m = String(dayDate.getMonth() + 1).padStart(2, '0');
    const d = String(dayDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const dayDateStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime();
    const isPastDay = dayDateStart < todayStart;

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

    // 2. Past Day with NO training record -> Automatically convert to Rest / Missed
    if (isPastDay) {
      if (pDay.type === '휴식') {
        return {
          ...pDay,
          dateStr,
          isCompleted: false,
          title: '휴식 및 컨디셔닝 (경과)',
          description: '계획된 휴식일이 경과되었습니다. 근육 피로를 풀고 컨디션을 안정적으로 유지합니다.',
        };
      }

      // Past unlogged running day: Convert to Rest/Missed to prevent impossible training load spikes
      return {
        ...pDay,
        dateStr,
        isCompleted: false,
        type: '휴식',
        title: `[훈련 미실시] 휴식 / 누락 전환 (${pDay.type})`,
        distanceKm: 0,
        targetPace: '-',
        targetZone: '휴식 (비가동)',
        intensity: '낮음',
        stages: undefined,
        recommendedShoe: undefined,
        description: `해당 요일(${pDay.day})은 러닝 기록이 없어 '휴식(누락)'으로 자동 전환되었습니다. 지난 미실시 훈련량을 남은 요일에 무리하게 몰아서 보충하지 않도록 남은 기간 부하를 안전하게 재조율했습니다.`,
      };
    }

    // 3. Today or Future Planned Rest Day
    if (pDay.type === '휴식') {
      return {
        ...pDay,
        dateStr,
        isCompleted: false,
      };
    }

    // 4. Today or Future Uncompleted Running Day -> Dynamically re-analyzed with safe load caps
    let adjustedDist = pDay.distanceKm;
    let adjustedDesc = pDay.description;
    let adjustedTitle = pDay.title;
    let adjustedStages = pDay.stages ? [...pDay.stages] : undefined;

    if (futurePlannedSum > 0) {
      // Calculate safe scale factor:
      // Even if past days were missed, NEVER spike training load beyond +12% (prevent injury)
      // And don't drop below 85% if regular volume is desired
      const rawScale = remainingKm > 0 ? remainingKm / futurePlannedSum : 1.0;
      const safeScale = Math.min(1.12, Math.max(0.85, rawScale));

      adjustedDist = Math.max(
        4.0,
        Math.round((pDay.distanceKm * safeScale) * 10) / 10
      );

      // Safe upper caps based on workout type
      if (pDay.type === '조깅') {
        adjustedDist = Math.min(12.0, adjustedDist);
      } else if (pDay.type === '템포런') {
        adjustedDist = Math.min(12.0, adjustedDist);
      } else if (pDay.type === '회복주') {
        adjustedDist = Math.min(7.0, adjustedDist);
      } else if (pDay.type === 'LSD') {
        adjustedDist = Math.min(22.0, adjustedDist);
      }

      if (!adjustedDesc.includes('안전 부하 재분석')) {
        adjustedDesc = `[남은 기간 안전 부하 재분석] 지난 요일 누락으로 인한 급격한 훈련 부하 쏠림과 부상을 방지하기 위해, 남은 요일의 권장 거리(${adjustedDist}km)를 과도한 증량 없이 안전 한도(+12% 이내)로 균형 있게 배치했습니다. ${pDay.description}`;
      }
    }

    // Always guarantee that title distance, stage distances, and distanceKm match 100%
    if (adjustedDist > 0) {
      const synched = synchronizeWorkoutDistanceTitleStages(
        {
          ...pDay,
          title: adjustedTitle,
          description: adjustedDesc,
          stages: adjustedStages,
          distanceKm: adjustedDist,
        },
        adjustedDist
      );
      adjustedTitle = synched.title;
      adjustedStages = synched.stages;
      adjustedDist = synched.distanceKm;
    }

    return {
      ...pDay,
      dateStr,
      isCompleted: false,
      title: adjustedTitle,
      distanceKm: adjustedDist,
      stages: adjustedStages,
      description: adjustedDesc,
    };
  });
}

