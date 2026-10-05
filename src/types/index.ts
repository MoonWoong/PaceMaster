export type ShoeCategory = '데일리' | '스피드' | '장거리' | '레이싱' | '트레일';

export interface PhysicalInfo {
  height: number; // cm
  weight: number; // kg
  age: number; // years
  updatedAt?: string;
}

export interface RunningShoe {
  id: string;
  name: string;
  brand: string;
  category: ShoeCategory;
  size?: string; // 신발 사이즈 (mm, e.g. "270mm" or "270")
  mileage: number; // km
  maxMileage?: number; // target lifespan km (default 600-800km)
  review: string; // 한줄평
  createdAt: string;
}

export interface RegisteredRace {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  course: string; // 풀, 하프, 10K, 기타 등
  customDistanceKm?: number; // 기타 코스 직접 입력 거리 (km, 예: 7.5, 32)
  location: string;
  websiteUrl?: string;
  isTarget?: boolean;
  targetTime?: string; // specific target time e.g. "03:15:00"
  priority?: 'A' | 'B' | 'C'; // 대회 중요도 우선순위: A(메인목표), B(중간점검), C(연습대회)
  importance?: 'A-Race (메인 목표)' | 'B-Race (중간 점검)' | 'C-Race (연습 대회)' | string;
  createdAt: string;

  // Actual Race Record, Bib Number & History
  bibNumber?: string; // 배번호 (예: "#11111", "A-1024")
  actualRecord?: string; // 실제 완주 기록 (예: "01:29:45", "03:15:20")
  actualPace?: string; // 실제 평균 페이스 (예: "4'15\"")
  rank?: string; // 대회 순위 (예: "전체 142위 / 3,500명", "연령대 18위")
  status?: 'scheduled' | 'completed' | 'dnf' | 'dns'; // 대회 참가 상태
  raceReview?: string; // 참가 대회 소감 및 후기
  certificateUrl?: string; // 모바일 기록증/사진 링크
}

export interface RunningRecords {
  pb5k: string; // "00:21:30"
  pb10k: string; // "00:44:15"
  pbHalf: string; // "01:38:20"
  pbFull: string; // "03:28:40"
  maxHr: number; // bpm e.g. 192
  thresholdHr: number; // bpm e.g. 172
  updatedAt?: string;
}

export interface RunningGoals {
  target10k: string; // "00:39:59"
  targetHalf: string; // "01:29:59"
  targetFull: string; // "03:09:59"
  targetRaceName?: string;
  updatedAt?: string;
}

export interface TrainingLap {
  lap: number | string;
  time: string;
  cumulativeTime: string;
  distanceKm: number;
  avgPace: string;
  avgGap?: string;
  avgHr: number;
  maxHr: number;
}

export interface TrainingSession {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  totalDistanceKm: number;
  totalTime: string;
  avgPace: string;
  avgHr: number;
  maxHr: number;
  notes?: string;
  shoeName?: string; // 착용 러닝화 (마일리지 연동 없음)
  shoeId?: string;
  laps: TrainingLap[];
  createdAt: string;
}

export type SpeedWorkoutType =
  | '인터벌'
  | '800m 인터벌'
  | '1~3k 인터벌'
  | '템포런'
  | '변속주(파틀렉)'
  | '빌드업주'
  | '언덕훈련';

export interface WeeklyPlanSettings {
  trainingDays: ('월요일' | '화요일' | '수요일' | '목요일' | '금요일' | '토요일' | '일요일')[];
  speedDay: '월요일' | '화요일' | '수요일' | '목요일' | '금요일' | '토요일' | '일요일' | '없음';
  speedWorkoutType: SpeedWorkoutType;
  longRunDay: '월요일' | '화요일' | '수요일' | '목요일' | '금요일' | '토요일' | '일요일' | '없음';
  targetRaceCourse?: '10K' | '하프' | '풀코스';
  updatedAt?: string;
}

export interface WorkoutStage {
  step: string; // e.g. "1단계 (1~3km)"
  distanceKm: number;
  pace: string;
  zone: string;
  focus: string;
}

export interface RecommendedShoeInfo {
  shoeId?: string;
  shoeName: string;
  brand?: string;
  category?: ShoeCategory;
  reason: string;
}

export interface RaceWeightDetail {
  raceId?: string;
  raceName: string;
  raceDate: string;
  course: string;
  dDayDays: number;
  dDayWeeks: number;
  periodizationPhase: string;
  racePriority?: 'A' | 'B' | 'C';
  importanceGrade: 'A-Race (메인 목표)' | 'B-Race (중간 점검)' | 'C-Race (연습 대회)';
  importanceWeight: number; // e.g. 1.3
  paceIntensityLevel: string; // e.g. '고강도 목표 (High)'
  targetRacePace: string;
  taperingVolumeCutPct: number;
  taperingLsdDistKm: number;
  taperScaleNote?: string;
  weightedGuidance: string;
  isEasyRunCruiseLoad?: boolean; // 10km 6'00" 페이스 등 평소 이지런 연장 부하 여부
  easyRunCruiseNote?: string; // 이지런 연장 부하에 따른 테이퍼링 감량 배제/최소화 과학적 근거 설명
}

export interface RunnerStateAnalysis {
  // Weekly mileage trend
  recent4WeeksDistances: { weekLabel: string; distanceKm: number }[];
  avgWeeklyMileage4Weeks: number; // e.g. 35.0 km
  lastWeekDistance: number; // e.g. 31.8 km
  peakWeeklyDistance: number; // e.g. 40.6 km
  mileageTrend: '증가세' | '안정유지' | '감소세' | '초기빌드';
  trendRatio: number; // percentage change vs 4-week average
  
  // Training Intensity & ACWR (Acute:Chronic Workload Ratio)
  acuteLoadKm: number; // Last 7 days / last week
  chronicLoadKm: number; // 4-week rolling weekly average
  acwr: number; // acuteLoad / chronicLoad (0.8~1.3 is sweet spot)
  fatigueRisk: '안전(스위트스팟)' | '주의(과부하 위험)' | '부족(언더트레이닝)' | '회복권장';
  
  // Longest recent run
  recentLongestRunKm: number;
  
  // Adjusted Plan Guidance
  recommendedWeeklyKm: number;
  mileageAdjustmentNote: string;
  intensityAdjustmentNote: string;
  longRunRecommendedKm: number;
  speedVolumeRecommendedKm: number;
  lastWeekLabel?: string; // e.g. "09/21~09/27 (월~일)"
  thisWeekLoggedKm?: number; // e.g. 10.5 km run so far this week
  thisWeekSessionsCount?: number;
  thisWeekDaysDone?: string[]; // e.g. ['월요일']
  remainingWeeklyPlanKm?: number; // e.g. 29.5 km
  
  // Registered Target Race weighting reflection
  raceWeightDetail?: RaceWeightDetail;
}

export interface WeeklyPlanDay {
  day: string; // 월요일, 화요일, ...
  dayShort: string; // Mon, Tue, ...
  dateStr?: string; // YYYY-MM-DD
  type: '조깅' | '템포런' | '인터벌' | 'LSD' | '회복주' | '휴식' | '대회' | '언덕훈련';
  title: string;
  distanceKm: number;
  targetPace: string;
  targetZone: string;
  description: string;
  purpose?: string; // 상세 훈련 목적 (심폐 적응, 젖산 역치, 근지구력 등)
  intensity: '낮음' | '보통' | '높음' | '휴식';
  stages?: WorkoutStage[];
  recommendedShoe?: RecommendedShoeInfo;
  isCompleted?: boolean;
  actualSession?: {
    id: string;
    title: string;
    totalDistanceKm: number;
    avgPace: string;
    avgHr?: number;
    maxHr?: number;
    shoeName?: string;
    date: string;
  };
}

export type PlanPeriodizationPhase =
  | '기초 유산소 구축기 (Base)'
  | '스피드/지구력 빌드업기 (Build)'
  | '목표 페이스 특화기 (Peak)'
  | '테이퍼링 감량기 (Tapering)'
  | '대회 직전 조정기 (Race Week)'
  | '회복 및 디로드 (Recovery)'
  | '지속 점진적 과부하 (Progression)';

export type TrainingPlanDurationPreset =
  | 'to_target_race'
  | '4weeks'
  | '8weeks'
  | '12weeks'
  | '16weeks'
  | 'custom';

export interface PlanWeek {
  weekNumber: number; // 1부터 시작
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string; // YYYY-MM-DD
  weekLabel: string; // e.g. "1주차 (10/05~10/11)"
  phase: PlanPeriodizationPhase;
  phaseBadgeColor: string;
  phaseDescription: string;
  focus: string; // 주간 핵심 목표
  targetWeeklyKm: number;
  completedKm?: number;
  days: WeeklyPlanDay[];
  raceInThisWeek?: RegisteredRace;
  isCurrentWeek?: boolean;
}

export interface TrainingPlanPeriodSettings {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  durationWeeks: number;
  durationPreset: TrainingPlanDurationPreset;
  targetRaceId?: string; // 선택된 목표 대회 ID
  targetRaceName?: string;
  targetCourse?: string; // '풀코스' | '하프' | '10K' | '5K' | '지속발전'
  targetTime?: string;
  targetPace?: string; // e.g. "4'30\"/km" or "5'00\""
  goalMode: 'race' | 'target_goal' | 'continuous_progression'; // 특정 참가대회 vs 목표 거리/페이스 직접 설정 vs 현상태 기준 지속 발전
  trainingDays: ('월요일' | '화요일' | '수요일' | '목요일' | '금요일' | '토요일' | '일요일')[];
  speedDay: '월요일' | '화요일' | '수요일' | '목요일' | '금요일' | '토요일' | '일요일' | '없음';
  speedWorkoutType?: SpeedWorkoutType;
  speedWorkoutTypes?: SpeedWorkoutType[]; // 다중 선택 목록 (로테이션 회전 적용)
  longRunDay: '월요일' | '화요일' | '수요일' | '목요일' | '금요일' | '토요일' | '일요일' | '없음';
  baseWeeklyKm?: number;
  updatedAt?: string;
}

export interface PlanFitnessAudit {
  fitScore: number; // 0 ~ 100
  fitGrade: '최적 정합성' | '우수' | '적정' | '주의' | '과부하 위험';
  currentVdot: number;
  targetVdot: number;
  vdotGap: number;
  requiredMonthlyVdotGain: number;
  feasibilityAssessment: string;
  targetPaceFormatted: string;
  currentEstimatedPaceFormatted: string;
  paceGapSeconds: number;
  baselineWeeklyKm: number;
  peakWeeklyKm: number;
  recommendedPeakKmRange: string;
  peakLsdKm: number;
  recommendedLsdKmRange: string;
  auditDetails: {
    category: '주간 마일리지' | '포인트 강도' | 'LSD 장거리' | '주기화 및 회복';
    status: '최적' | '적정' | '주의';
    title: string;
    summary: string;
    recommendation: string;
  }[];
  coachingSummary: string;
}

export interface ComprehensiveTrainingPlan {
  id: string;
  createdAt: string;
  updatedAt: string;
  settings: TrainingPlanPeriodSettings;
  weeks: PlanWeek[];
  totalWeeks: number;
  totalPlannedKm: number;
  totalPlannedSessions: number;
  targetRaceSummary?: {
    raceName: string;
    raceDate: string;
    dDayWeeks: number;
    course: string;
    priority: string;
    targetTime?: string;
    targetPace?: string;
  };
  runnerAnalysisSummary: {
    currentVdot: number;
    baselineWeeklyKm: number;
    progressionDescription: string;
    continuousProgression: boolean;
    acwrValue: number;
    fatigueRisk: string;
  };
  fitnessAudit?: PlanFitnessAudit;
}

export interface MarathonEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  region: '서울' | '경기/인천' | '강원' | '충청/대전' | '전라/광주' | '경상/대구/부산' | '제주' | '해외' | string;
  courses: ('풀' | '하프' | '10K' | '5K')[];
  location: string;
  websiteUrl: string;
  status: '접수중' | '접수예정' | '마감임박' | '접수마감';
  isOverseas?: boolean;
  host?: string;
}
