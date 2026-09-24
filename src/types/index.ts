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
  laps: TrainingLap[];
  createdAt: string;
}

export interface WeeklyPlanDay {
  day: string; // 월요일, 화요일, ...
  dayShort: string; // Mon, Tue, ...
  type: '조깅' | '템포런' | '인터벌' | 'LSD' | '회복주' | '휴식';
  title: string;
  distanceKm: number;
  targetPace: string;
  targetZone: string;
  description: string;
  intensity: '낮음' | '보통' | '높음' | '휴식';
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
