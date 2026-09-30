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
  course: string; // 풀, 하프, 10K 등
  location: string;
  websiteUrl?: string;
  isTarget?: boolean;
  targetTime?: string; // specific target time e.g. "03:15:00"
  createdAt: string;
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
  | '빌드업주';

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
}

export interface WeeklyPlanDay {
  day: string; // 월요일, 화요일, ...
  dayShort: string; // Mon, Tue, ...
  dateStr?: string; // YYYY-MM-DD
  type: '조깅' | '템포런' | '인터벌' | 'LSD' | '회복주' | '휴식';
  title: string;
  distanceKm: number;
  targetPace: string;
  targetZone: string;
  description: string;
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

export interface MarathonEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: '토요일' | '일요일';
  region: '서울' | '경기/인천' | '강원' | '충청/대전' | '전라/광주' | '경상/대구/부산' | '제주';
  courses: ('풀' | '하프' | '10K' | '5K')[];
  location: string;
  websiteUrl: string;
  status: '접수중' | '접수예정' | '마감임박' | '접수마감';
}
