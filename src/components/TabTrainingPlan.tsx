import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarRange,
  Calendar,
  Sparkles,
  Trophy,
  Target,
  Zap,
  TrendingUp,
  Clock,
  Footprints,
  ShieldCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Award,
  Layers,
  Flame,
  CheckSquare,
  X,
  ArrowRight,
} from 'lucide-react';
import {
  ComprehensiveTrainingPlan,
  TrainingPlanPeriodSettings,
  PlanWeek,
  WeeklyPlanDay,
  RegisteredRace,
  RunningGoals,
  RunningShoe,
  TrainingSession,
  RunningRecords,
  SpeedWorkoutType,
  IntensityCategory,
} from '../types';
import { WeeklyTrainingLoadCard, enrichPlanWithTrainingLoads } from './WeeklyTrainingLoadCard';
import {
  generateComprehensivePlan,
  formatDate,
  getMonday,
  getTodayDateStr,
  getNextMondayStr,
  parseLocalDate,
  parseCourseKm,
  calculateSpecificRacePace,
  DayOfWeek,
} from '../lib/comprehensivePlanGenerator';
import { parseTimeToSeconds, formatSecondsToTime, formatPace } from '../lib/vdot';
import { calculateDDay } from '../lib/marathonData';
import { verifyRunnerSecurityKey } from '../lib/security';

const STORAGE_KEY_PLAN_SETTINGS = 'pacemaster_training_plan_settings';

export interface StoredPlanSettings {
  durationPreset: 'to_target_race' | '4weeks' | '8weeks' | '12weeks' | '16weeks' | 'custom';
  startDateMode: 'today' | 'next_monday' | 'custom';
  startDate: string;
  endDate: string;
  goalMode: 'race' | 'target_goal' | 'continuous_progression';
  targetRaceId: string;
  targetCourse: string;
  customDistanceKm: string;
  targetTime: string;
  targetPace: string;
  trainingDays: DayOfWeek[];
  speedDay: DayOfWeek | '없음';
  speedWorkoutTypes: SpeedWorkoutType[];
  longRunDay: DayOfWeek | '없음';
  baseWeeklyKm: string;
  updatedAt?: string;
}

const loadStoredPlanSettings = (
  savedPlan: ComprehensiveTrainingPlan | null,
  nearestTargetRace: RegisteredRace | undefined,
  upcomingRaces: RegisteredRace[] = []
): StoredPlanSettings => {
  let fromStorage: Partial<StoredPlanSettings> | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLAN_SETTINGS);
    if (raw) {
      fromStorage = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse saved plan settings from localStorage', e);
  }

  const s = savedPlan?.settings;
  const today = getTodayDateStr();
  const nextMon = getNextMondayStr();

  // Validate targetRaceId: it MUST exist in upcomingRaces!
  // If stored race has passed or is invalid, fallback to nearest upcoming race!
  const storedRaceId = fromStorage?.targetRaceId !== undefined ? fromStorage.targetRaceId : s?.targetRaceId;
  const isStoredRaceStillUpcoming = upcomingRaces.some((r) => r.id === storedRaceId);
  const targetRaceId = isStoredRaceStillUpcoming
    ? (storedRaceId || '')
    : (nearestTargetRace?.id || '');

  const matchedRace = upcomingRaces.find((r) => r.id === targetRaceId) || nearestTargetRace;

  // Determine start date and mode
  let startMode: 'today' | 'next_monday' | 'custom' = fromStorage?.startDateMode || 'next_monday';
  let initialStartDate = nextMon;

  // If the target race is sooner than next Monday, force startMode to 'today'!
  if (matchedRace && matchedRace.date < nextMon) {
    startMode = 'today';
    initialStartDate = today;
  } else if (startMode === 'today') {
    initialStartDate = today;
  } else if (startMode === 'next_monday') {
    initialStartDate = nextMon;
  } else if (fromStorage?.startDate && fromStorage.startDate >= today) {
    initialStartDate = fromStorage.startDate;
  } else if (s?.startDate && s.startDate >= today) {
    initialStartDate = s.startDate;
  }

  const goalMode = fromStorage?.goalMode || s?.goalMode || (nearestTargetRace ? 'race' : 'continuous_progression');
  const targetCourse = isStoredRaceStillUpcoming
    ? (fromStorage?.targetCourse || s?.targetCourse || matchedRace?.course || '10K')
    : (matchedRace?.course || '10K');
  const customDistanceKm = fromStorage?.customDistanceKm || '10';
  const targetTime = isStoredRaceStillUpcoming
    ? (fromStorage?.targetTime || s?.targetTime || matchedRace?.targetTime || '00:59:59')
    : (matchedRace?.targetTime || '00:59:59');
  const targetPace = isStoredRaceStillUpcoming
    ? (fromStorage?.targetPace || s?.targetPace || "5'59\"")
    : "5'59\"";
  const durationPreset = fromStorage?.durationPreset || s?.durationPreset || (nearestTargetRace ? 'to_target_race' : '12weeks');
  const endDate = durationPreset === 'to_target_race' && matchedRace
    ? matchedRace.date
    : (fromStorage?.endDate || s?.endDate || (matchedRace?.date || ''));
  const trainingDays = fromStorage?.trainingDays || s?.trainingDays || ['화요일', '목요일', '토요일', '일요일'];
  const speedDay = fromStorage?.speedDay !== undefined ? fromStorage.speedDay : (s?.speedDay !== undefined ? s.speedDay : '화요일');
  const speedWorkoutTypes = fromStorage?.speedWorkoutTypes || s?.speedWorkoutTypes || ['인터벌', '언덕훈련', '템포런'];
  const longRunDay = fromStorage?.longRunDay !== undefined ? fromStorage.longRunDay : (s?.longRunDay !== undefined ? s.longRunDay : '일요일');
  const baseWeeklyKm = fromStorage?.baseWeeklyKm || (s?.baseWeeklyKm ? String(s.baseWeeklyKm) : '36');

  return {
    durationPreset,
    startDateMode: startMode,
    startDate: initialStartDate,
    endDate,
    goalMode,
    targetRaceId,
    targetCourse,
    customDistanceKm,
    targetTime,
    targetPace,
    trainingDays,
    speedDay,
    speedWorkoutTypes,
    longRunDay,
    baseWeeklyKm,
    updatedAt: fromStorage?.updatedAt || s?.updatedAt,
  };
};

interface TabTrainingPlanProps {
  currentVDOT: number;
  races: RegisteredRace[];
  goals: RunningGoals;
  shoes: RunningShoe[];
  sessions: TrainingSession[];
  records: RunningRecords;
  savedPlan: ComprehensiveTrainingPlan | null;
  onSavePlan: (plan: ComprehensiveTrainingPlan) => Promise<void>;
  onOpenLogWorkout?: (dateStr?: string, defaultTitle?: string, defaultDist?: number) => void;
}

const ALL_DAYS: DayOfWeek[] = [
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
  '일요일',
];

export interface PointWorkoutDefinition {
  id: SpeedWorkoutType;
  label: string;
  desc: string;
  icon: string;
  tier: 'low' | 'moderate' | 'high';
  tierLabel: string;
  zoneBadge: string;
  badgeBg: string;
}

const SPEED_WORKOUT_TYPES: PointWorkoutDefinition[] = [
  // 🟢 저강도 포인트 (존3 구간 - Zone 3 Aerobic Power)
  {
    id: '존3 마라톤 페이스주',
    label: '존3 마라톤 페이스주 (M-Pace)',
    desc: '풀코스 목표 페이스 정속 지속주. 젖산 축적 없이 유산소 파워와 실전 순항 리듬을 최적화',
    icon: '🎯',
    tier: 'low',
    tierLabel: '저 - 존3구간',
    zoneBadge: 'Zone 3 (마라톤 페이스)',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  {
    id: '존3 모더레이트런',
    label: '존3 모더레이트런 (Steady)',
    desc: '이지런(Zone 2)보다 빠르고 역치(Zone 4)보다 안정적인 중간 유산소 지구력 자극주',
    icon: '🟢',
    tier: 'low',
    tierLabel: '저 - 존3구간',
    zoneBadge: 'Zone 3 (모더레이트 유산소)',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  {
    id: '존3 유산소 역치주',
    label: '존3 유산소 역치주 (AeT)',
    desc: '유산소 역치(AeT) 부근으로 달려 지방 대사율과 심폐 베이스를 극한까지 끌어올림',
    icon: '🔋',
    tier: 'low',
    tierLabel: '저 - 존3구간',
    zoneBadge: 'Zone 3 (유산소 역치 AeT)',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },

  // 🟡 중강도 포인트 (역치 구간 - Zone 4 Threshold)
  {
    id: '템포런',
    label: '젖산 역치(LT) 템포런',
    desc: '젖산 축적 억제 및 대회 페이스 유지력 향상 20~40분 역치 지속주',
    icon: '🔥',
    tier: 'moderate',
    tierLabel: '중 - 역치구간',
    zoneBadge: 'Zone 4 (젖산역치 페이스)',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    id: '크루즈 인터벌',
    label: '크루즈 인터벌 (LT Cruise)',
    desc: '1~2km 역치 페이스 질주 + 짧은 1분 조깅 휴식 반복. 젖산 역치 자극을 안전하게 분할 누적',
    icon: '🚢',
    tier: 'moderate',
    tierLabel: '중 - 역치구간',
    zoneBadge: 'Zone 4 (크루즈 역치)',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    id: '빌드업주',
    label: '빌드업주 (점진 가속)',
    desc: '이지런에서 시작하여 후반부 역치/대회 페이스까지 점진적 가속 (네거티브 스플릿)',
    icon: '📈',
    tier: 'moderate',
    tierLabel: '중 - 역치구간',
    zoneBadge: 'Zone 3~4 (점진 가속)',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    id: '변속주(파틀렉)',
    label: '파틀렉 (자유 변속주)',
    desc: '지형과 속도 변화를 즐기는 유산소 변속 달리기 (질주와 조깅의 유연한 반복)',
    icon: '🔄',
    tier: 'moderate',
    tierLabel: '중 - 역치구간',
    zoneBadge: 'Zone 3~4 (자유 변속)',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
  },

  // 🔴 고강도 포인트 (역치 이상 인터벌 등 - Zone 5 VO2max & Anaerobic)
  {
    id: '인터벌',
    label: '1000m 인터벌 (VO2max)',
    desc: '최대 산소 섭취량 극대화 (1000m 질주 + 400m 조깅 휴식 4~6세트)',
    icon: '⚡',
    tier: 'high',
    tierLabel: '고 - 역치 이상 인터벌',
    zoneBadge: 'Zone 5 (VO2max)',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  {
    id: '800m 인터벌',
    label: '800m 야소 인터벌',
    desc: '마라톤 완주 시간 예측 및 스피드 피치 강화 (800m 질주 + 400m 회복)',
    icon: '⏱️',
    tier: 'high',
    tierLabel: '고 - 역치 이상 인터벌',
    zoneBadge: 'Zone 5 (야소 800)',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  {
    id: '1~3k 인터벌',
    label: '1~3km 롱 인터벌',
    desc: '하프/풀코스 후반 스피드 내구성 배양 지속 질주 (1500m~3000m 반복)',
    icon: '🚀',
    tier: 'high',
    tierLabel: '고 - 역치 이상 인터벌',
    zoneBadge: 'Zone 4~5 (롱 인터벌)',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  {
    id: '언덕훈련',
    label: '언덕 파워 질주 (Hill Repeats)',
    desc: '경사도 5~8% 언덕 전력 질주로 하지 근력·심폐·케이던스 폭발력 강화',
    icon: '⛰️',
    tier: 'high',
    tierLabel: '고 - 역치 이상 인터벌',
    zoneBadge: 'Zone 4~5 (언덕 파워)',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  {
    id: '400m 숏 인터벌',
    label: '400m 숏 인터벌 (Speed Reps)',
    desc: '트랙 400m 쾌속 질주 + 200m 걷기/조깅 휴식 8~12세트. 러닝 이코노미와 최고 속도 향상',
    icon: '💨',
    tier: 'high',
    tierLabel: '고 - 역치 이상 인터벌',
    zoneBadge: 'Zone 5+ (무산소 스피드)',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
  },
];

export const TabTrainingPlan: React.FC<TabTrainingPlanProps> = ({
  currentVDOT,
  races,
  goals,
  shoes,
  sessions,
  records,
  savedPlan,
  onSavePlan,
  onOpenLogWorkout,
}) => {
  // View Mode: 'weekly' | 'monthly'
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');

  // Generator & Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedAlert, setCopiedAlert] = useState(false);

  // Selected Day Detail Modal (for calendar or quick inspect)
  const [selectedDayDetail, setSelectedDayDetail] = useState<{
    day: WeeklyPlanDay;
    weekLabel: string;
    phase: string;
  } | null>(null);

  // Expanded days accordion state in weekly view
  const [expandedDayKeys, setExpandedDayKeys] = useState<Record<string, boolean>>({});

  // Active Week Selection
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);

  // Goal & Fitness Audit Panel expansion state
  const [isAuditExpanded, setIsAuditExpanded] = useState<boolean>(true);

  // Active Month for Monthly View
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());

  // Upcoming races strictly today or future, excluding completed and past races
  const upcomingRaces = useMemo(() => {
    const todayStr = getTodayDateStr();
    return races
      .filter((r) => {
        if (!r.date || r.status === 'completed' || r.actualRecord) return false;
        const dDay = calculateDDay(r.date, todayStr);
        return !dDay.isPassed && dDay.daysDiff >= 0;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [races]);

  // Default nearest upcoming race
  const nearestTargetRace = useMemo(() => {
    return upcomingRaces.find((r) => r.isTarget || r.priority === 'A') || upcomingRaces[0];
  }, [upcomingRaces]);

  // Form State for Plan Generation (restored from recent settings)
  const initialLoadedSettings = useMemo(() => {
    return loadStoredPlanSettings(savedPlan, nearestTargetRace, upcomingRaces);
  }, [savedPlan, nearestTargetRace, upcomingRaces]);

  const [formDurationPreset, setFormDurationPreset] = useState<
    'to_target_race' | '4weeks' | '8weeks' | '12weeks' | '16weeks' | 'custom'
  >(() => initialLoadedSettings.durationPreset);
  const [formStartDateMode, setFormStartDateMode] = useState<'today' | 'next_monday' | 'custom'>(
    () => initialLoadedSettings.startDateMode
  );
  const [formStartDate, setFormStartDate] = useState<string>(() => initialLoadedSettings.startDate);
  const [formEndDate, setFormEndDate] = useState<string>(() => initialLoadedSettings.endDate);
  const [formGoalMode, setFormGoalMode] = useState<'race' | 'target_goal' | 'continuous_progression'>(
    () => initialLoadedSettings.goalMode
  );
  const [formTargetRaceId, setFormTargetRaceId] = useState<string>(() => initialLoadedSettings.targetRaceId);
  const [formTargetCourse, setFormTargetCourse] = useState<string>(
    () => initialLoadedSettings.targetCourse
  );
  const [formCustomDistanceKm, setFormCustomDistanceKm] = useState<string>(() => initialLoadedSettings.customDistanceKm);
  const [formTargetTime, setFormTargetTime] = useState<string>(() => initialLoadedSettings.targetTime);
  const [formTargetPace, setFormTargetPace] = useState<string>(() => initialLoadedSettings.targetPace);
  const [formTrainingDays, setFormTrainingDays] = useState<DayOfWeek[]>(() => initialLoadedSettings.trainingDays);
  const [formSpeedDay, setFormSpeedDay] = useState<DayOfWeek | '없음'>(() => initialLoadedSettings.speedDay);
  // Multi-selection speed workout types:
  const [formSpeedTypes, setFormSpeedTypes] = useState<SpeedWorkoutType[]>(() => initialLoadedSettings.speedWorkoutTypes);
  const [speedTypeTierFilter, setSpeedTypeTierFilter] = useState<'all' | 'low' | 'moderate' | 'high'>('all');
  const [formLongRunDay, setFormLongRunDay] = useState<DayOfWeek | '없음'>(() => initialLoadedSettings.longRunDay);
  const [formBaseWeeklyKm, setFormBaseWeeklyKm] = useState<string>(() => initialLoadedSettings.baseWeeklyKm);

  // Helper to persist current form state to localStorage
  const persistCurrentFormSettings = (override?: Partial<StoredPlanSettings>) => {
    const updated: StoredPlanSettings = {
      durationPreset: override?.durationPreset ?? formDurationPreset,
      startDateMode: override?.startDateMode ?? formStartDateMode,
      startDate: override?.startDate ?? formStartDate,
      endDate: override?.endDate ?? formEndDate,
      goalMode: override?.goalMode ?? formGoalMode,
      targetRaceId: override?.targetRaceId ?? formTargetRaceId,
      targetCourse: override?.targetCourse ?? formTargetCourse,
      customDistanceKm: override?.customDistanceKm ?? formCustomDistanceKm,
      targetTime: override?.targetTime ?? formTargetTime,
      targetPace: override?.targetPace ?? formTargetPace,
      trainingDays: override?.trainingDays ?? formTrainingDays,
      speedDay: override?.speedDay ?? formSpeedDay,
      speedWorkoutTypes: override?.speedWorkoutTypes ?? formSpeedTypes,
      longRunDay: override?.longRunDay ?? formLongRunDay,
      baseWeeklyKm: override?.baseWeeklyKm ?? formBaseWeeklyKm,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY_PLAN_SETTINGS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save plan settings to localStorage', e);
    }
  };

  // Auto-persist whenever settings change
  useEffect(() => {
    persistCurrentFormSettings();
  }, [
    formDurationPreset,
    formStartDateMode,
    formStartDate,
    formEndDate,
    formGoalMode,
    formTargetRaceId,
    formTargetCourse,
    formCustomDistanceKm,
    formTargetTime,
    formTargetPace,
    formTrainingDays,
    formSpeedDay,
    formSpeedTypes,
    formLongRunDay,
    formBaseWeeklyKm,
  ]);

  const handleSelectStartDatePreset = (mode: 'today' | 'next_monday') => {
    setFormStartDateMode(mode);
    if (mode === 'today') {
      setFormStartDate(getTodayDateStr());
    } else {
      setFormStartDate(getNextMondayStr());
    }
  };

  // Real-time synchronization handlers
  const handleTargetTimeChange = (newTimeStr: string, currentCourse: string) => {
    setFormTargetTime(newTimeStr);
    const effectiveCourse = currentCourse === '직접입력' ? `${formCustomDistanceKm || '10'}km` : currentCourse;
    const dist = parseCourseKm(effectiveCourse);
    const totalSec = parseTimeToSeconds(newTimeStr);
    if (totalSec > 0 && dist > 0) {
      setFormTargetPace(formatPace(totalSec / dist));
    }
  };

  const handleTargetPaceChange = (newPaceStr: string, currentCourse: string) => {
    setFormTargetPace(newPaceStr);
    const effectiveCourse = currentCourse === '직접입력' ? `${formCustomDistanceKm || '10'}km` : currentCourse;
    const dist = parseCourseKm(effectiveCourse);
    const clean = newPaceStr.replace('/km', '').trim();
    const parts = clean.split("'");
    if (parts.length >= 2) {
      const min = parseInt(parts[0], 10);
      const sec = parseInt(parts[1].replace('"', ''), 10) || 0;
      if (!isNaN(min) && !isNaN(sec)) {
        const paceSec = min * 60 + sec;
        const totalSec = Math.round(paceSec * dist);
        setFormTargetTime(formatSecondsToTime(totalSec, true));
      }
    }
  };

  const handleCourseChange = (newCourse: string, customKm?: string) => {
    setFormTargetCourse(newCourse);
    const effectiveCourse = newCourse === '직접입력' ? `${customKm || formCustomDistanceKm || '10'}km` : newCourse;
    const dist = parseCourseKm(effectiveCourse);
    const totalSec = parseTimeToSeconds(formTargetTime);
    if (totalSec > 0 && dist > 0) {
      setFormTargetPace(formatPace(totalSec / dist));
    } else {
      const rec = calculateSpecificRacePace(effectiveCourse, undefined, undefined, currentVDOT, goals);
      setFormTargetTime(rec.finishTime);
      setFormTargetPace(rec.pace);
    }
  };

  // Target race currently selected in the form or fallback
  const targetForPreset = useMemo(() => {
    return upcomingRaces.find((r) => r.id === formTargetRaceId) || nearestTargetRace;
  }, [upcomingRaces, formTargetRaceId, nearestTargetRace]);

  const targetRaceDDayInfo = useMemo(() => {
    return targetForPreset ? calculateDDay(targetForPreset.date) : null;
  }, [targetForPreset]);

  const calculatedWeeksToRace = useMemo(() => {
    if (!targetForPreset) return 12;
    const sDate = formStartDate ? parseLocalDate(formStartDate) : new Date();
    const sMon = getMonday(sDate);
    const rDate = parseLocalDate(targetForPreset.date);
    const rMon = getMonday(rDate);
    const diffMs = rMon.getTime() - sMon.getTime();
    return Math.max(1, Math.min(104, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1));
  }, [targetForPreset, formStartDate]);

  const handleSelectToTargetRacePreset = () => {
    setFormDurationPreset('to_target_race');
    if (targetForPreset) {
      setFormEndDate(targetForPreset.date);
      if (formStartDateMode === 'next_monday' && targetForPreset.date < getNextMondayStr()) {
        setFormStartDateMode('today');
        setFormStartDate(getTodayDateStr());
      }
    }
  };

  const handleSelectRace = (raceId: string) => {
    setFormTargetRaceId(raceId);
    const r = upcomingRaces.find((item) => item.id === raceId) || races.find((item) => item.id === raceId);
    if (r) {
      setFormTargetCourse(r.course);
      const dist = parseCourseKm(r.course);
      if (r.targetTime) {
        setFormTargetTime(r.targetTime);
        const sec = parseTimeToSeconds(r.targetTime);
        if (sec > 0 && dist > 0) {
          setFormTargetPace(formatPace(sec / dist));
        }
      } else {
        const rec = calculateSpecificRacePace(r.course, undefined, undefined, currentVDOT, goals);
        setFormTargetTime(rec.finishTime);
        setFormTargetPace(rec.pace);
      }
      if (formDurationPreset === 'to_target_race') {
        setFormEndDate(r.date);
        if (formStartDateMode === 'next_monday' && r.date < getNextMondayStr()) {
          setFormStartDateMode('today');
          setFormStartDate(getTodayDateStr());
        }
      }
    }
  };

  const toggleSpeedType = (typeId: SpeedWorkoutType) => {
    if (formSpeedTypes.includes(typeId)) {
      if (formSpeedTypes.length > 1) {
        setFormSpeedTypes(formSpeedTypes.filter((t) => t !== typeId));
      }
    } else {
      setFormSpeedTypes([...formSpeedTypes, typeId]);
    }
  };

  // Local state for optimistic updates during one-click intensity conversions
  const [optimisticPlan, setOptimisticPlan] = useState<ComprehensiveTrainingPlan | null>(null);

  useEffect(() => {
    setOptimisticPlan(null);
  }, [savedPlan]);

  // Initialize or fallback active plan
  const baseActivePlan = useMemo<ComprehensiveTrainingPlan>(() => {
    if (savedPlan && savedPlan.weeks && savedPlan.weeks.length > 0) {
      return savedPlan;
    }
    // Generate an intelligent initial plan automatically
    const initRace = nearestTargetRace;
    const initCourse = initRace?.course || '10K';
    const initDist = parseCourseKm(initCourse);
    const initTime = initRace?.targetTime || '00:59:59';
    const initTotalSec = parseTimeToSeconds(initTime);
    const initPace = initTotalSec > 0 && initDist > 0 ? formatPace(initTotalSec / initDist) : "5'59\"";

    const initialSettings: TrainingPlanPeriodSettings = {
      startDate: formStartDate,
      endDate: formEndDate,
      durationWeeks: 12,
      durationPreset: formGoalMode === 'race' && initRace ? 'to_target_race' : '12weeks',
      targetRaceId: initRace?.id,
      targetRaceName: initRace?.name,
      targetCourse: initCourse,
      targetTime: initTime,
      targetPace: initPace,
      goalMode: formGoalMode,
      trainingDays: formTrainingDays,
      speedDay: formSpeedDay,
      speedWorkoutType: formSpeedTypes[0] || '인터벌',
      speedWorkoutTypes: formSpeedTypes,
      longRunDay: formLongRunDay,
      baseWeeklyKm: parseFloat(formBaseWeeklyKm) || 36,
      updatedAt: new Date().toISOString(),
    };
    const initialPlan = generateComprehensivePlan({
      vdot: currentVDOT,
      settings: initialSettings,
      trainingSessions: sessions,
      shoes,
      races,
      goals,
    });
    return enrichPlanWithTrainingLoads(
      initialPlan,
      currentVDOT,
      {},
      sessions,
      'actual'
    );
  }, [savedPlan, currentVDOT, sessions, shoes, races, goals]);

  const activePlan = optimisticPlan || baseActivePlan;

  // Handle One-Click Category Override (고강도 / 중강도 / 저강도(존3) / 장거리 / 회복/휴식)
  const handleUpdateCategoryOverride = async (dayKey: string, newCat: IntensityCategory) => {
    const nextOverrides: Record<string, IntensityCategory> = {
      ...(activePlan.categoryOverrides || {}),
      [dayKey]: newCat,
    };
    const updatedPlan = enrichPlanWithTrainingLoads(
      activePlan,
      currentVDOT || activePlan.runnerAnalysisSummary?.currentVdot || 38,
      nextOverrides,
      sessions,
      'actual'
    );
    setOptimisticPlan(updatedPlan);
    await onSavePlan(updatedPlan);
  };

  const handleResetCategoryOverrides = async () => {
    const updatedPlan = enrichPlanWithTrainingLoads(
      { ...activePlan, categoryOverrides: {} },
      currentVDOT || activePlan.runnerAnalysisSummary?.currentVdot || 38,
      {},
      sessions,
      'actual'
    );
    setOptimisticPlan(updatedPlan);
    await onSavePlan(updatedPlan);
  };

  // Auto-enrich any existing plan that was saved before training load fields were added
  useEffect(() => {
    if (savedPlan && savedPlan.weeks && savedPlan.weeks.length > 0) {
      const isMissingLoads =
        savedPlan.totalPlanLoadScore === undefined ||
        savedPlan.weeks.some(
          (w) => w.totalLoadScore === undefined || w.days.some((d) => d.trainingLoad === undefined)
        );

      if (isMissingLoads) {
        const enriched = enrichPlanWithTrainingLoads(
          savedPlan,
          currentVDOT || savedPlan.runnerAnalysisSummary?.currentVdot || 38,
          savedPlan.categoryOverrides,
          sessions,
          'actual'
        );
        onSavePlan(enriched);
      }
    }
  }, [savedPlan, currentVDOT, sessions, onSavePlan]);

  // Set initial active week to current week
  useEffect(() => {
    if (activePlan && activePlan.weeks) {
      const curIdx = activePlan.weeks.findIndex((w) => w.isCurrentWeek);
      if (curIdx >= 0) {
        setSelectedWeekIdx(curIdx);
      }
    }
  }, [activePlan]);

  // Handle Generate New Plan
  const handleGeneratePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formTrainingDays.length === 0) {
      alert('최소 1일 이상의 훈련 요일을 선택해주세요.');
      return;
    }

    const authorized = await verifyRunnerSecurityKey('AI 러닝 훈련 계획표 생성');
    if (!authorized) return;

    setIsGenerating(true);
    try {
      let durationWeeks = 12;
      if (formDurationPreset === 'to_target_race' && targetForPreset) {
        durationWeeks = calculatedWeeksToRace;
      } else if (formDurationPreset === '4weeks') durationWeeks = 4;
      else if (formDurationPreset === '8weeks') durationWeeks = 8;
      else if (formDurationPreset === '12weeks') durationWeeks = 12;
      else if (formDurationPreset === '16weeks') durationWeeks = 16;
      else if (formDurationPreset === 'custom' && formEndDate) {
        const sDate = formStartDate ? parseLocalDate(formStartDate) : new Date();
        const sMon = getMonday(sDate);
        const eDate = parseLocalDate(formEndDate);
        const eMon = getMonday(eDate);
        const diffMs = eMon.getTime() - sMon.getTime();
        durationWeeks = Math.max(1, Math.min(104, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1));
      }

      const effectiveEndDate =
        formDurationPreset === 'to_target_race' && targetForPreset
          ? targetForPreset.date
          : formEndDate;

      const matchedRace = upcomingRaces.find((r) => r.id === formTargetRaceId) || targetForPreset;
      const effectiveCourse = formGoalMode === 'continuous_progression'
        ? '지속발전'
        : formTargetCourse === '직접입력'
        ? `${formCustomDistanceKm || '10'}km`
        : formTargetCourse;

      const settings: TrainingPlanPeriodSettings = {
        startDate: formStartDate || formatDate(getMonday(new Date())),
        endDate: effectiveEndDate,
        durationWeeks,
        durationPreset: formDurationPreset,
        targetRaceId: formGoalMode === 'race' ? (matchedRace?.id || formTargetRaceId) : undefined,
        targetRaceName: formGoalMode === 'race' ? matchedRace?.name : undefined,
        targetCourse: effectiveCourse,
        targetTime: formGoalMode !== 'continuous_progression' ? formTargetTime : undefined,
        targetPace: formGoalMode !== 'continuous_progression' ? formTargetPace : undefined,
        goalMode: formGoalMode,
        trainingDays: formTrainingDays,
        speedDay: formSpeedDay,
        speedWorkoutType: formSpeedTypes[0] || '인터벌',
        speedWorkoutTypes: formSpeedTypes.length > 0 ? formSpeedTypes : ['인터벌', '언덕훈련', '템포런'],
        longRunDay: formLongRunDay,
        baseWeeklyKm: parseFloat(formBaseWeeklyKm) || 36,
        updatedAt: new Date().toISOString(),
      };

      const newPlan = generateComprehensivePlan({
        vdot: currentVDOT,
        settings,
        trainingSessions: sessions,
        shoes,
        races,
        goals,
      });

      const enrichedPlan = enrichPlanWithTrainingLoads(
        newPlan,
        currentVDOT,
        {},
        sessions,
        'actual'
      );

      setOptimisticPlan(enrichedPlan);
      await onSavePlan(enrichedPlan);
      setIsSettingsOpen(false);
      setSelectedWeekIdx(0);
    } catch (err) {
      console.error('Plan generation failed:', err);
      alert('플랜 생성 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle Day Accordion in Weekly View
  const toggleDayAccordion = (key: string) => {
    setExpandedDayKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Copy Plan Text Summary
  const handleCopyPlanSummary = () => {
    if (!activePlan) return;
    const lines = [
      `🏃 [PaceMaster 러닝 훈련 계획표]`,
      `기간: ${activePlan.weeks[0]?.startDateStr} ~ ${activePlan.weeks[activePlan.weeks.length - 1]?.endDateStr} (총 ${activePlan.totalWeeks}주)`,
      `목표: ${activePlan.settings.goalMode === 'race' ? `${activePlan.targetRaceSummary?.raceName || '대회'} (${activePlan.targetRaceSummary?.course || '풀코스'})` : '현상태 기준 3:1 점진적 지속 발전'}`,
      `총 계획 거리: ${activePlan.totalPlannedKm}km / 총 ${activePlan.totalPlannedSessions}회 세션`,
      `기준 VDOT: ${activePlan.runnerAnalysisSummary.currentVdot} | 주간 평균: ${activePlan.runnerAnalysisSummary.baselineWeeklyKm}km`,
      ``,
      ...activePlan.weeks.map(
        (w) =>
          `[${w.weekLabel}] ${w.phase} | 목표 ${w.targetWeeklyKm}km\n${w.days
            .filter((d) => d.type !== '휴식')
            .map((d) => `  - ${d.day}: ${d.title} (${d.distanceKm}km, ${d.targetPace})`)
            .join('\n')}`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedAlert(true);
    setTimeout(() => setCopiedAlert(false), 2500);
  };

  // Current active week data
  const currentWeek = activePlan.weeks[selectedWeekIdx] || activePlan.weeks[0];

  // Helper for workout type style
  const getWorkoutTypeColor = (type: string) => {
    switch (type) {
      case '인터벌':
        return {
          badge: 'bg-rose-100 text-rose-800 border-rose-300',
          dot: 'bg-rose-600',
          border: 'border-rose-200',
          bg: 'bg-rose-50/60',
        };
      case '템포런':
        return {
          badge: 'bg-amber-100 text-amber-800 border-amber-300',
          dot: 'bg-amber-600',
          border: 'border-amber-200',
          bg: 'bg-amber-50/60',
        };
      case 'LSD':
        return {
          badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
          dot: 'bg-indigo-600',
          border: 'border-indigo-200',
          bg: 'bg-indigo-50/60',
        };
      case '조깅':
        return {
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-600',
          border: 'border-emerald-200',
          bg: 'bg-emerald-50/60',
        };
      case '회복주':
        return {
          badge: 'bg-teal-100 text-teal-800 border-teal-300',
          dot: 'bg-teal-600',
          border: 'border-teal-200',
          bg: 'bg-teal-50/60',
        };
      case '언덕훈련':
        return {
          badge: 'bg-orange-100 text-orange-900 border-orange-300',
          dot: 'bg-orange-600',
          border: 'border-orange-200',
          bg: 'bg-orange-50/60',
        };
      case '대회':
        return {
          badge: 'bg-gradient-to-r from-rose-900 to-rose-950 text-amber-300 border-rose-700',
          dot: 'bg-amber-400',
          border: 'border-rose-300 ring-2 ring-rose-600/30',
          bg: 'bg-rose-50/80',
        };
      default: // 휴식
        return {
          badge: 'bg-stone-100 text-stone-600 border-stone-300',
          dot: 'bg-stone-400',
          border: 'border-stone-200',
          bg: 'bg-stone-50/50',
        };
    }
  };

  // Monthly Calendar Calculations
  const monthCalendarData = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth(); // 0-indexed

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sun, 1 is Mon...
    const totalDays = lastDayOfMonth.getDate();

    // Map all plan days into a date-indexed lookup
    const planDaysMap = new Map<string, { day: WeeklyPlanDay; week: PlanWeek }>();
    activePlan.weeks.forEach((w) => {
      w.days.forEach((d) => {
        if (d.dateStr) {
          planDaysMap.set(d.dateStr, { day: d, week: w });
        }
      });
    });

    const calendarCells: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      planItem?: { day: WeeklyPlanDay; week: PlanWeek };
    }> = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, dNum);
      const dStr = formatDate(prevDate);
      calendarCells.push({
        dateStr: dStr,
        dayNum: dNum,
        isCurrentMonth: false,
        isToday: dStr === formatDate(new Date()),
        planItem: planDaysMap.get(dStr),
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const curDate = new Date(year, month, d);
      const dStr = formatDate(curDate);
      calendarCells.push({
        dateStr: dStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dStr === formatDate(new Date()),
        planItem: planDaysMap.get(dStr),
      });
    }

    // Next month padding to reach multiple of 7
    const remaining = (7 - (calendarCells.length % 7)) % 7;
    for (let n = 1; n <= remaining; n++) {
      const nextDate = new Date(year, month + 1, n);
      const dStr = formatDate(nextDate);
      calendarCells.push({
        dateStr: dStr,
        dayNum: n,
        isCurrentMonth: false,
        isToday: dStr === formatDate(new Date()),
        planItem: planDaysMap.get(dStr),
      });
    }

    // Calculate month stats
    let monthPlannedKm = 0;
    let monthPointCount = 0;
    let monthSessionCount = 0;

    calendarCells.forEach((c) => {
      if (c.isCurrentMonth && c.planItem) {
        const item = c.planItem.day;
        monthPlannedKm += item.distanceKm;
        if (item.type !== '휴식') monthSessionCount++;
        if (['인터벌', '템포런', 'LSD', '대회'].includes(item.type)) monthPointCount++;
      }
    });

    return {
      year,
      month: month + 1,
      cells: calendarCells,
      monthPlannedKm: Math.round(monthPlannedKm * 10) / 10,
      monthSessionCount,
      monthPointCount,
    };
  }, [currentMonthDate, activePlan]);

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  // D-Day Countdown & Training Weeks Visual Progress Calculation
  const planProgressBarData = useMemo(() => {
    if (!activePlan || !activePlan.weeks || activePlan.weeks.length === 0) return null;

    const todayStr = getTodayDateStr();
    const todayDate = parseLocalDate(todayStr);

    const firstWeek = activePlan.weeks[0];
    const lastWeek = activePlan.weeks[activePlan.weeks.length - 1];
    const planStartDateStr = firstWeek.startDateStr;

    // Target race info
    const isRaceMode = activePlan.settings.goalMode === 'race' && !!activePlan.targetRaceSummary;
    const isTargetGoalMode = activePlan.settings.goalMode === 'target_goal';

    const targetTitle = activePlan.targetRaceSummary?.raceName || (
      isTargetGoalMode
        ? `목표 ${activePlan.settings.targetCourse || '10K'} 기록 달성`
        : '체계적 점진적 과부하 사이클 완성'
    );
    const targetCourse = activePlan.targetRaceSummary?.course || activePlan.settings.targetCourse || '마라톤';
    const targetDateStr = activePlan.targetRaceSummary?.raceDate || lastWeek.endDateStr;

    // D-Day calculation
    const dDayInfo = calculateDDay(targetDateStr, todayStr);
    const remainingDays = Math.max(0, dDayInfo.daysDiff);

    // Days calculation
    const startMs = parseLocalDate(planStartDateStr).getTime();
    const targetMs = parseLocalDate(targetDateStr).getTime();
    const todayMs = todayDate.getTime();

    const totalPlanDays = Math.max(1, Math.round((targetMs - startMs) / 86400000));
    const daysElapsed = Math.max(0, Math.min(totalPlanDays, Math.round((todayMs - startMs) / 86400000)));

    // Week progress calculation
    const currentWeekIdx = activePlan.weeks.findIndex((w) => w.isCurrentWeek);
    const totalWeeks = activePlan.totalWeeks;

    let currentWeekNum = 1;
    let daysIntoWeek = 1;

    if (currentWeekIdx >= 0) {
      currentWeekNum = currentWeekIdx + 1;
      const curWeekStart = parseLocalDate(activePlan.weeks[currentWeekIdx].startDateStr);
      daysIntoWeek = Math.max(1, Math.min(7, Math.round((todayMs - curWeekStart.getTime()) / 86400000) + 1));
    } else if (todayStr < planStartDateStr) {
      currentWeekNum = 0; // Not started yet
      daysIntoWeek = 0;
    } else {
      currentWeekNum = totalWeeks; // Completed
      daysIntoWeek = 7;
    }

    // Progress percentage that fills up as training weeks progress
    let progressPercent = 0;
    if (todayStr < planStartDateStr) {
      progressPercent = 0;
    } else if (todayStr >= targetDateStr || dDayInfo.isPassed) {
      progressPercent = 100;
    } else if (currentWeekIdx >= 0) {
      const fractionalWeeks = currentWeekIdx + (daysIntoWeek - 1) / 7;
      progressPercent = Math.min(100, Math.max(1, Math.round((fractionalWeeks / totalWeeks) * 100)));
    } else {
      progressPercent = Math.min(100, Math.max(1, Math.round((daysElapsed / totalPlanDays) * 100)));
    }

    // Active week phase
    const activeWeekObj = currentWeekIdx >= 0 ? activePlan.weeks[currentWeekIdx] : (todayStr < planStartDateStr ? firstWeek : lastWeek);
    const currentPhase = activeWeekObj?.phase || '빌드업기';

    // Mileage completed
    const totalCompletedKm = Math.round(activePlan.weeks.reduce((acc, w) => acc + (w.completedKm || 0), 0) * 10) / 10;
    const mileagePercent = activePlan.totalPlannedKm > 0 ? Math.min(100, Math.round((totalCompletedKm / activePlan.totalPlannedKm) * 100)) : 0;

    return {
      targetTitle,
      targetCourse,
      targetDateStr,
      planStartDateStr,
      dDayInfo,
      remainingDays,
      totalPlanDays,
      daysElapsed,
      totalWeeks,
      currentWeekNum,
      daysIntoWeek,
      progressPercent,
      currentPhase,
      totalCompletedKm,
      mileagePercent,
      isRaceMode,
    };
  }, [activePlan]);

  // Current Week Achievement Rate Data (주간 계획 거리 대비 기록한 훈련 거리)
  const currentWeekProgressData = useMemo(() => {
    if (!activePlan || !activePlan.weeks || activePlan.weeks.length === 0) return null;

    const todayStr = getTodayDateStr();
    const currentWeekIdx = activePlan.weeks.findIndex((w) => w.isCurrentWeek);
    const targetWeek =
      currentWeekIdx >= 0
        ? activePlan.weeks[currentWeekIdx]
        : todayStr < activePlan.weeks[0].startDateStr
        ? activePlan.weeks[0]
        : activePlan.weeks[activePlan.weeks.length - 1];

    if (!targetWeek) return null;

    // Planned distance for this week
    const plannedKm = Math.round(
      (targetWeek.targetWeeklyKm || targetWeek.days.reduce((s, d) => s + (d.distanceKm || 0), 0)) * 10
    ) / 10;

    // Recorded sessions during this week's date range
    const sessionsInWeek = sessions.filter(
      (s) => s.date >= targetWeek.startDateStr && s.date <= targetWeek.endDateStr
    );
    const sessionsKm = Math.round(
      sessionsInWeek.reduce((sum, s) => sum + (s.totalDistanceKm || 0), 0) * 10
    ) / 10;

    // Recorded from day actualSession
    const daysKm = Math.round(
      targetWeek.days.reduce((sum, d) => sum + (d.actualSession ? d.actualSession.totalDistanceKm : 0), 0) * 10
    ) / 10;

    const recordedKm = Math.round(
      Math.max(sessionsKm, daysKm, targetWeek.completedKm || 0) * 10
    ) / 10;

    const achievementPercent = plannedKm > 0
      ? Math.round((recordedKm / plannedKm) * 100)
      : recordedKm > 0
      ? 100
      : 0;

    const remainingKm = Math.max(0, Math.round((plannedKm - recordedKm) * 10) / 10);
    const overAchievedKm = recordedKm > plannedKm ? Math.round((recordedKm - plannedKm) * 10) / 10 : 0;

    // Daily breakdown for this week
    const dayProgressList = targetWeek.days.map((dayItem) => {
      const sessionOnDay = dayItem.dateStr ? sessions.find((s) => s.date === dayItem.dateStr) : undefined;
      const dayActualKm = sessionOnDay
        ? sessionOnDay.totalDistanceKm
        : dayItem.actualSession
        ? dayItem.actualSession.totalDistanceKm
        : 0;
      const isCompleted = dayItem.isCompleted || !!dayItem.actualSession || !!sessionOnDay;
      const isToday = !!dayItem.dateStr && dayItem.dateStr === todayStr;

      return {
        ...dayItem,
        sessionOnDay,
        dayActualKm,
        isCompleted,
        isToday,
      };
    });

    const completedWorkoutsCount = dayProgressList.filter((d) => d.isCompleted && d.dayActualKm > 0).length;
    const plannedWorkoutDaysCount = dayProgressList.filter((d) => d.distanceKm > 0).length;

    return {
      weekNumber: targetWeek.weekNumber,
      weekLabel: targetWeek.weekLabel,
      startDateStr: targetWeek.startDateStr,
      endDateStr: targetWeek.endDateStr,
      phase: targetWeek.phase,
      phaseBadgeColor: targetWeek.phaseBadgeColor,
      focus: targetWeek.focus,
      plannedKm,
      recordedKm,
      achievementPercent,
      remainingKm,
      overAchievedKm,
      completedWorkoutsCount,
      plannedWorkoutDaysCount,
      days: dayProgressList,
      sessionsInWeek,
    };
  }, [activePlan, sessions]);

  return (
    <div id="training-plan-section" tabIndex={-1} className="space-y-6 text-stone-800 animate-fadeIn focus:outline-none scroll-mt-6">
      {/* 1. Header Banner & Plan Executive Summary */}
      <section className="glass-panel rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-emerald-600/30 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-800 text-white flex items-center gap-1 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                AI 맞춤 주기화 계획표
              </span>
              {activePlan.settings.goalMode === 'race' && activePlan.targetRaceSummary ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-rose-700" />
                  {activePlan.targetRaceSummary.raceName} ({activePlan.targetRaceSummary.course}) {activePlan.targetRaceSummary.dDayText} · {activePlan.targetRaceSummary.raceDate}
                </span>
              ) : activePlan.settings.goalMode === 'target_goal' && activePlan.targetRaceSummary ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-amber-800" />
                  목표 {activePlan.targetRaceSummary.course} {activePlan.targetRaceSummary.targetTime ? `[기록 ${activePlan.targetRaceSummary.targetTime}]` : ''} ({activePlan.targetRaceSummary.targetPace}/km)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-700" />
                  3:1 점진적 과부하 지속 발전 모드
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight font-athletic">
              {activePlan.settings.goalMode === 'race' && activePlan.targetRaceSummary
                ? `${activePlan.targetRaceSummary.raceName} ${activePlan.totalWeeks}주 완성 마스터 플랜`
                : activePlan.settings.goalMode === 'target_goal' && activePlan.targetRaceSummary
                ? `목표 ${activePlan.targetRaceSummary.course} ${activePlan.targetRaceSummary.targetTime ? `[${activePlan.targetRaceSummary.targetTime}]` : ''} (${activePlan.targetRaceSummary.targetPace}/km) ${activePlan.totalWeeks}주 플랜`
                : `체계적 지속 발전 러닝 훈련 계획표 (${activePlan.totalWeeks}주)`}
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              기간: <span className="font-semibold text-stone-800">{activePlan.weeks[0]?.startDateStr} ~ {activePlan.weeks[activePlan.weeks.length - 1]?.endDateStr}</span>
              {activePlan.targetRaceSummary?.raceDate && (
                <span className="text-rose-900 font-medium"> (대회일: {activePlan.targetRaceSummary.raceDate})</span>
              )}
              {' · '}
              {activePlan.runnerAnalysisSummary.progressionDescription}
            </p>
          </div>

          {/* Action Buttons: Settings Modal & Copy Summary */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={handleCopyPlanSummary}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 transition-colors shadow-2xs cursor-pointer select-none"
              title="전체 훈련 계획 텍스트 복사"
            >
              {copiedAlert ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">복사 완료</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                  <span>플랜 복사</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-800 to-emerald-950 hover:from-emerald-700 hover:to-emerald-900 text-white shadow-md shadow-emerald-950/20 cursor-pointer transition-all select-none"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-300" />
              <span>플랜 맞춤 설정 / 재생성</span>
            </button>
          </div>
        </div>

        {/* 4 Key Summary Indicator Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="p-3.5 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
            <div className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
              <CalendarRange className="w-3.5 h-3.5 text-emerald-700" />
              총 훈련 기간
            </div>
            <div className="text-lg sm:text-xl font-black text-stone-900 font-athletic mt-1">
              {activePlan.totalWeeks}
              <span className="text-xs font-bold text-stone-500 ml-1">주간</span>
            </div>
            <div className="text-[10px] text-stone-500 mt-0.5">
              총 {activePlan.totalPlannedSessions}회 러닝 세션
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
            <div className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
              <Footprints className="w-3.5 h-3.5 text-blue-700" />
              총 계획 마일리지
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-900 font-athletic mt-1">
              {activePlan.totalPlannedKm}
              <span className="text-xs font-bold text-stone-500 ml-1">km</span>
            </div>
            <div className="text-[10px] text-stone-500 mt-0.5">
              주간 평균 {Math.round((activePlan.totalPlannedKm / activePlan.totalWeeks) * 10) / 10}km
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
            <div className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-rose-700" />
              기준 러닝 엔진 (VDOT)
            </div>
            <div className="text-lg sm:text-xl font-black text-rose-900 font-athletic mt-1">
              VDOT {activePlan.runnerAnalysisSummary.currentVdot}
            </div>
            <div className="text-[10px] text-stone-500 mt-0.5">
              {activePlan.settings.goalMode === 'race' && activePlan.targetRaceSummary
                ? `목표 페이스: ${activePlan.targetRaceSummary.targetPace}/km (${activePlan.targetRaceSummary.targetTime || ''})`
                : activePlan.settings.goalMode === 'target_goal' && activePlan.targetRaceSummary
                ? `목표 페이스: ${activePlan.targetRaceSummary.targetPace}/km (${activePlan.targetRaceSummary.course})`
                : '4주마다 점진적 +0.5 상향'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
            <div className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
              피로도 & 부하 상태
            </div>
            <div className="text-sm sm:text-base font-extrabold text-stone-900 mt-1 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  activePlan.runnerAnalysisSummary.fatigueRisk.includes('안전')
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
              />
              <span>{activePlan.runnerAnalysisSummary.fatigueRisk}</span>
            </div>
            <div className="text-[10px] text-stone-500 mt-0.5">
              ACWR 지수 {activePlan.runnerAnalysisSummary.acwrValue} (부상 방지)
            </div>
          </div>
        </div>

        {/* Visual Progress Bar: Remaining days until target race & week progression */}
        {planProgressBarData && (
          <div className="mt-5 pt-5 border-t border-stone-200/90 space-y-3.5">
            {/* Top Row: Title, Target Race Info & D-Day Counter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-300 flex-shrink-0 shadow-2xs">
                  <Trophy className="w-4 h-4 text-rose-700" />
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-sm sm:text-base font-black text-stone-900 tracking-tight">
                      {planProgressBarData.targetTitle}
                    </strong>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                      {planProgressBarData.targetCourse}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span>훈련 시작: <strong className="text-stone-700 font-mono">{planProgressBarData.planStartDateStr}</strong></span>
                    <span>→</span>
                    <span>대회 결전: <strong className="text-rose-900 font-mono font-bold">{planProgressBarData.targetDateStr}</strong></span>
                  </div>
                </div>
              </div>

              {/* D-Day & Progress % Badges */}
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                {planProgressBarData.dDayInfo.isToday ? (
                  <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 text-white font-black text-xs sm:text-sm shadow-md animate-pulse flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-200" />
                    <span>🏆 D-Day 오늘 대회 결전일!</span>
                  </span>
                ) : !planProgressBarData.dDayInfo.isPassed ? (
                  <span className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 font-black text-xs sm:text-sm shadow-2xs flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-rose-700" />
                    <span>{planProgressBarData.dDayInfo.text}</span>
                    <span className="text-[11px] font-normal text-rose-800/80">({planProgressBarData.remainingDays}일 남음)</span>
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-300 text-stone-700 font-bold text-xs sm:text-sm shadow-2xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>대회 완주 ({planProgressBarData.dDayInfo.text})</span>
                  </span>
                )}

                <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-950 border border-emerald-300 font-black text-xs sm:text-sm font-athletic shadow-2xs">
                  {planProgressBarData.progressPercent}% 진행
                </span>
              </div>
            </div>

            {/* Main Visual Progress Bar Track */}
            <div className="space-y-1.5">
              <div className="relative w-full h-5 sm:h-6 rounded-full bg-stone-100 p-0.5 border border-stone-300/80 shadow-inner overflow-hidden">
                {/* Background milestone ticks */}
                <div className="absolute inset-0 flex justify-between px-2 items-center pointer-events-none opacity-20 z-0">
                  <span className="h-full w-px bg-stone-400" />
                  <span className="h-full w-px bg-stone-400" />
                  <span className="h-full w-px bg-stone-400" />
                  <span className="h-full w-px bg-stone-400" />
                  <span className="h-full w-px bg-stone-400" />
                </div>

                {/* Filled Gradient Bar */}
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-500 via-amber-500 to-rose-600 transition-all duration-700 ease-out shadow-sm relative flex items-center justify-end pr-1 z-10"
                  style={{ width: `${Math.max(3, planProgressBarData.progressPercent)}%` }}
                >
                  {/* Subtle Shimmer highlight */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse rounded-full" />
                  
                  {/* Runner Pin on Bar Head */}
                  <span className="text-xs sm:text-sm select-none filter drop-shadow">
                    {planProgressBarData.progressPercent >= 100 ? '🏁' : '🏃'}
                  </span>
                </div>
              </div>

              {/* Progress Milestones Bar Legend */}
              <div className="flex items-center justify-between text-[10px] text-stone-500 font-mono px-1">
                <span className="flex items-center gap-1">
                  <span>🚩 플랜 시작 ({planProgressBarData.planStartDateStr.slice(5)})</span>
                </span>
                <span className="hidden sm:inline">
                  {planProgressBarData.currentWeekNum > 0 && planProgressBarData.currentWeekNum <= planProgressBarData.totalWeeks ? (
                    <strong className="text-emerald-800 font-sans font-bold">
                      📍 현재 {planProgressBarData.currentWeekNum}주차 진행 중 ({planProgressBarData.currentPhase.split(' ')[0]})
                    </strong>
                  ) : null}
                </span>
                <span className="flex items-center gap-1 font-bold text-rose-900">
                  <span>🏁 결전 레이스 ({planProgressBarData.targetDateStr.slice(5)})</span>
                </span>
              </div>
            </div>

            {/* 4 Mini Detail Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                <div className="text-[10px] text-stone-500 flex items-center gap-1 font-medium">
                  <Calendar className="w-3 h-3 text-emerald-700" />
                  대회까지 남은 일수
                </div>
                <div className="text-sm font-black text-rose-900 font-athletic mt-0.5">
                  {planProgressBarData.dDayInfo.isToday ? '오늘 당일 (0일)' : `${planProgressBarData.remainingDays}일`}
                </div>
                <div className="text-[10px] text-stone-500 font-mono">
                  {planProgressBarData.dDayInfo.text}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                <div className="text-[10px] text-stone-500 flex items-center gap-1 font-medium">
                  <TrendingUp className="w-3 h-3 text-blue-700" />
                  주차 진행 현황
                </div>
                <div className="text-sm font-black text-stone-900 font-athletic mt-0.5">
                  {planProgressBarData.currentWeekNum}
                  <span className="text-[11px] font-normal text-stone-500"> / {planProgressBarData.totalWeeks}주차</span>
                </div>
                <div className="text-[10px] text-stone-500 truncate">
                  {planProgressBarData.currentPhase.split(' ')[0]}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                <div className="text-[10px] text-stone-500 flex items-center gap-1 font-medium">
                  <Clock className="w-3 h-3 text-amber-700" />
                  누적 경과 일수
                </div>
                <div className="text-sm font-black text-stone-900 font-athletic mt-0.5">
                  {planProgressBarData.daysElapsed}
                  <span className="text-[11px] font-normal text-stone-500"> / {planProgressBarData.totalPlanDays}일</span>
                </div>
                <div className="text-[10px] text-stone-500 font-mono">
                  {planProgressBarData.progressPercent}% 타임라인
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                <div className="text-[10px] text-stone-500 flex items-center gap-1 font-medium">
                  <Footprints className="w-3 h-3 text-teal-700" />
                  훈련 마일리지 소화
                </div>
                <div className="text-sm font-black text-emerald-900 font-athletic mt-0.5">
                  {planProgressBarData.totalCompletedKm}
                  <span className="text-[11px] font-normal text-stone-500"> / {activePlan.totalPlannedKm}km</span>
                </div>
                <div className="text-[10px] text-stone-500 font-mono">
                  {planProgressBarData.mileagePercent}% 달성
                </div>
              </div>
            </div>

            {/* Current Week Achievement Section: 주간 계획 거리 대비 내가 기록한 훈련의 거리 */}
            {currentWeekProgressData && (
              <div className="pt-2">
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/70 border border-emerald-500/35 shadow-xs space-y-3.5">
                  {/* Top Bar: Title, Week Label, Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="p-1.5 rounded-lg bg-emerald-700 text-white shadow-2xs">
                        <Zap className="w-4 h-4 text-amber-300" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm sm:text-base font-extrabold text-stone-900 tracking-tight">
                            현재 {currentWeekProgressData.weekNumber}주차 달성률
                          </h4>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white text-stone-700 border border-emerald-300 font-mono shadow-2xs">
                            {currentWeekProgressData.startDateStr.slice(5)} ~ {currentWeekProgressData.endDateStr.slice(5)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${currentWeekProgressData.phaseBadgeColor}`}>
                            {currentWeekProgressData.phase.split(' ')[0]}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          주간 계획 거리 대비 내가 기록한 훈련의 거리 달성 현황
                        </p>
                      </div>
                    </div>

                    {/* Achievement Rate Pill */}
                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                      {currentWeekProgressData.achievementPercent >= 100 ? (
                        <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs sm:text-sm shadow-xs flex items-center gap-1.5 font-athletic">
                          <CheckCircle2 className="w-4 h-4 text-amber-200" />
                          <span>{currentWeekProgressData.achievementPercent}% 주간 목표 완수!</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-950 border border-emerald-300 font-black text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 font-athletic">
                          <Target className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{currentWeekProgressData.achievementPercent}% 달성 중</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Main Metric Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white/95 rounded-xl p-3 sm:p-3.5 border border-emerald-200/80 shadow-2xs">
                    {/* 1. 내가 기록한 훈련 거리 */}
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 flex-shrink-0">
                        <Footprints className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-stone-500 font-medium">내가 기록한 훈련 거리</div>
                        <div className="text-base sm:text-lg font-black text-emerald-900 font-athletic tracking-tight flex items-baseline gap-1">
                          <span>{currentWeekProgressData.recordedKm}</span>
                          <span className="text-xs font-semibold text-stone-500">km</span>
                        </div>
                      </div>
                    </div>

                    {/* 2. 주간 계획 목표 거리 */}
                    <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-stone-200/70 pt-2 sm:pt-0 sm:pl-3">
                      <div className="p-2.5 rounded-xl bg-stone-100 text-stone-700 flex-shrink-0">
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-stone-500 font-medium">주간 계획 목표 거리</div>
                        <div className="text-base sm:text-lg font-black text-stone-800 font-athletic tracking-tight flex items-baseline gap-1">
                          <span>{currentWeekProgressData.plannedKm}</span>
                          <span className="text-xs font-semibold text-stone-500">km</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. 목표 달성 및 잔여 현황 */}
                    <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-stone-200/70 pt-2 sm:pt-0 sm:pl-3">
                      <div className={`p-2.5 rounded-xl flex-shrink-0 ${currentWeekProgressData.achievementPercent >= 100 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {currentWeekProgressData.achievementPercent >= 100 ? (
                          <Award className="w-5 h-5 text-amber-700" />
                        ) : (
                          <TrendingUp className="w-5 h-5 text-blue-700" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-stone-500 font-medium">
                          {currentWeekProgressData.achievementPercent >= 100 ? '초과 달성 마일리지' : '이번 주 남은 거리'}
                        </div>
                        <div className={`text-base sm:text-lg font-black font-athletic tracking-tight flex items-baseline gap-1 ${
                          currentWeekProgressData.achievementPercent >= 100 ? 'text-amber-700' : 'text-blue-900'
                        }`}>
                          {currentWeekProgressData.achievementPercent >= 100 ? (
                            <>
                              <span>+{currentWeekProgressData.overAchievedKm}</span>
                              <span className="text-xs font-semibold text-stone-500">km 초과 완주</span>
                            </>
                          ) : (
                            <>
                              <span>{currentWeekProgressData.remainingKm}</span>
                              <span className="text-xs font-semibold text-stone-500">km 남음</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar Track */}
                  <div className="space-y-1">
                    <div className="relative w-full h-3.5 sm:h-4 rounded-full bg-stone-200/80 p-0.5 border border-stone-300/80 shadow-inner overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out shadow-xs relative flex items-center justify-end pr-1 ${
                          currentWeekProgressData.achievementPercent >= 100
                            ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(3, currentWeekProgressData.achievementPercent))}%`,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-pulse rounded-full" />
                        <span className="text-[9px] select-none filter drop-shadow">
                          {currentWeekProgressData.achievementPercent >= 100 ? '🎉' : '🏃'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-stone-500 font-mono px-0.5">
                      <span>0.0km (시작)</span>
                      <span className="font-bold text-emerald-900">
                        기록: {currentWeekProgressData.recordedKm}km / 계획: {currentWeekProgressData.plannedKm}km ({currentWeekProgressData.achievementPercent}%)
                      </span>
                      <span>목표 {currentWeekProgressData.plannedKm}km</span>
                    </div>
                  </div>

                  {/* 7-Day Mini Status Row */}
                  <div className="pt-1 border-t border-emerald-200/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-stone-700 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                        이번 주 요일별 훈련 현황
                        <span className="text-stone-400 font-normal">
                          (완료 {currentWeekProgressData.completedWorkoutsCount}회 / 계획 {currentWeekProgressData.plannedWorkoutDaysCount}회)
                        </span>
                      </span>
                      {onOpenLogWorkout && (
                        <button
                          type="button"
                          onClick={() => onOpenLogWorkout(getTodayDateStr())}
                          className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>오늘 훈련 기록</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                      {currentWeekProgressData.days.map((d, dayIdx) => {
                        return (
                          <div
                            key={d.dateStr || `${d.day}-${dayIdx}`}
                            className={`p-1.5 sm:p-2 rounded-xl text-center border transition-all ${
                              d.isToday
                                ? 'ring-2 ring-emerald-600 border-emerald-400 bg-emerald-50/90 shadow-2xs font-semibold'
                                : d.isCompleted && d.dayActualKm > 0
                                ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950'
                                : d.distanceKm > 0
                                ? 'bg-white border-stone-200 text-stone-700'
                                : 'bg-stone-50 border-stone-200/60 text-stone-400'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-[11px] font-bold">{d.dayShort}</span>
                              {d.isToday && (
                                <span className="text-[8px] px-1 rounded bg-emerald-700 text-white font-extrabold leading-tight">
                                  오늘
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-stone-400 font-mono mt-0.5">
                              {d.dateStr ? `${d.dateStr.slice(8)}일` : ''}
                            </div>
                            <div className="mt-1 text-[11px] font-black font-athletic">
                              {d.isCompleted && d.dayActualKm > 0 ? (
                                <span className="text-emerald-800 flex items-center justify-center gap-0.5">
                                  <Check className="w-3 h-3 text-emerald-700 inline" />
                                  {d.dayActualKm}k
                                </span>
                              ) : d.distanceKm > 0 ? (
                                <span className="text-stone-700">{d.distanceKm}k</span>
                              ) : (
                                <span className="text-stone-400 font-normal text-[10px]">휴식</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 1.5 Goal-Fitness Match Audit Report (목표-실력 정합성 & AI 코칭 진단 리포트) */}
      {activePlan.fitnessAudit && (
        <section className="glass-panel rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-emerald-500/30 bg-gradient-to-br from-emerald-950/5 via-white to-emerald-50/60 shadow-sm transition-all">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-200">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 rounded-xl bg-emerald-800 text-white shadow-xs">
                <Target className="w-4 h-4 text-amber-300" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-stone-900 font-athletic">
                    목표-실력 정합성 및 AI 코칭 진단 리포트
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                    {activePlan.fitnessAudit.fitGrade} ({activePlan.fitnessAudit.fitScore}점)
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  현재 러너의 PB 기량(VDOT {activePlan.fitnessAudit.currentVdot})과 목표({activePlan.settings.targetCourse || '하프'} {activePlan.settings.targetTime || '1:29:59'}) 간의 훈련 적합성을 과학적으로 검토했습니다.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAuditExpanded((prev) => !prev)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 shadow-2xs hover:bg-stone-50 transition-colors cursor-pointer"
            >
              <span>{isAuditExpanded ? '접기' : '상세 진단 보기'}</span>
              {isAuditExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {isAuditExpanded && (
            <div className="mt-4 space-y-4 animate-fadeIn">
              {/* 4 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1) VDOT Gap */}
                <div className="p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 mb-1">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                      VDOT 기량 간극
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                      월 +{activePlan.fitnessAudit.requiredMonthlyVdotGain}
                    </span>
                  </div>
                  <div className="text-lg font-black text-stone-900 font-athletic flex items-baseline gap-1.5">
                    <span className="text-stone-500 text-sm font-semibold">{activePlan.fitnessAudit.currentVdot}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-blue-800 text-xl font-bold">{activePlan.fitnessAudit.targetVdot}</span>
                    <span className="text-xs text-blue-600 font-bold">(+{activePlan.fitnessAudit.vdotGap})</span>
                  </div>
                  <div className="text-[11px] text-stone-600 mt-1 leading-snug">
                    {activePlan.fitnessAudit.feasibilityAssessment}
                  </div>
                </div>

                {/* 2) Target Pace Match */}
                <div className="p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 mb-1">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      목표 페이스 일치도
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                      {activePlan.fitnessAudit.paceGapSeconds < 0 ? `${Math.abs(activePlan.fitnessAudit.paceGapSeconds)}초 가속` : '정속'}
                    </span>
                  </div>
                  <div className="text-lg font-black text-stone-900 font-athletic flex items-baseline gap-1.5">
                    <span className="text-stone-500 text-sm font-semibold">{activePlan.fitnessAudit.currentEstimatedPaceFormatted}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-amber-800 text-xl font-bold">{activePlan.fitnessAudit.targetPaceFormatted}</span>
                  </div>
                  <div className="text-[11px] text-stone-600 mt-1 leading-snug">
                    수요일 역치 템포런(4&apos;10&quot;~4&apos;15&quot;) 및 인터벌(3&apos;50&quot;~3&apos;58&quot;)로 스피드 버퍼 확보
                  </div>
                </div>

                {/* 3) Weekly Mileage Cap */}
                <div className="p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 mb-1">
                    <span className="flex items-center gap-1">
                      <Footprints className="w-3.5 h-3.5 text-emerald-600" />
                      주간 볼륨 최적화
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800">
                      피크 {activePlan.fitnessAudit.peakWeeklyKm}km
                    </span>
                  </div>
                  <div className="text-lg font-black text-stone-900 font-athletic flex items-baseline gap-1.5">
                    <span className="text-stone-500 text-sm font-semibold">{activePlan.fitnessAudit.baselineWeeklyKm}km</span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-800 text-xl font-bold">{activePlan.fitnessAudit.peakWeeklyKm}km</span>
                  </div>
                  <div className="text-[11px] text-stone-600 mt-1 leading-snug">
                    하프 최적 권장 피크: <span className="font-bold text-stone-800">{activePlan.fitnessAudit.recommendedPeakKmRange}</span> (과도한 70km+ 배제로 부상 차단)
                  </div>
                </div>

                {/* 4) LSD Distance Cap */}
                <div className="p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 mb-1">
                    <span className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-purple-600" />
                      LSD 장거리 정밀 캡
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-800">
                      최장 {activePlan.fitnessAudit.peakLsdKm}km
                    </span>
                  </div>
                  <div className="text-lg font-black text-purple-900 font-athletic">
                    {activePlan.fitnessAudit.peakLsdKm}km <span className="text-xs font-semibold text-stone-500">(권장: {activePlan.fitnessAudit.recommendedLsdKmRange})</span>
                  </div>
                  <div className="text-[11px] text-stone-600 mt-1 leading-snug">
                    하프 대회 거리(21.1km)를 완벽 충족하며, 과도한 장거리로 인한 관절 피로를 사전에 방지
                  </div>
                </div>
              </div>

              {/* 4 Detailed Evaluation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activePlan.fitnessAudit.auditDetails.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-white/90 border border-stone-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {item.title}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                        {item.status}
                      </span>
                    </div>
                    <div className="text-[11px] font-medium text-stone-600 mb-1">
                      {item.summary}
                    </div>
                    <div className="text-[11px] text-emerald-900/90 bg-emerald-50/60 p-2 rounded-xl border border-emerald-100 leading-relaxed">
                      💡 {item.recommendation}
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Head Coach Directive */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-900 to-stone-900 text-white shadow-md border border-emerald-800/80">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-white/10 text-amber-300 shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider mb-0.5">
                      AI 러닝 헤드코치 종합 진단 총평
                    </div>
                    <p className="text-xs sm:text-sm text-stone-200 leading-relaxed font-medium">
                      {activePlan.fitnessAudit.coachingSummary}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 2. View Mode Switcher: 주간 뷰 (Weekly) vs 월간 뷰 (Monthly) */}
      <div className="flex items-center justify-between gap-3 bg-stone-100/90 p-1.5 rounded-2xl border border-stone-200">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode('weekly')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none ${
              viewMode === 'weekly'
                ? 'bg-white text-emerald-950 shadow-sm border border-stone-200 font-extrabold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <CalendarRange className="w-4 h-4 text-emerald-700" />
            <span>주간 상세 훈련 뷰 (Weekly)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none ${
              viewMode === 'monthly'
                ? 'bg-white text-emerald-950 shadow-sm border border-stone-200 font-extrabold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span>월간 캘린더 뷰 (Monthly)</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-stone-500 pr-2">
          <span>포인트 요일:</span>
          <span className="font-semibold text-rose-800">
            ⚡ {activePlan.settings.speedDay} ({activePlan.settings.speedWorkoutType})
          </span>
          <span>·</span>
          <span className="font-semibold text-indigo-800">
            🏃 {activePlan.settings.longRunDay} (LSD)
          </span>
        </div>
      </div>

      {/* 3. VIEW MODE A: Weekly View */}
      {viewMode === 'weekly' && currentWeek && (
        <div className="space-y-6">
          {/* Week Selector Ribbon / Pills */}
          <div className="glass-panel p-3.5 rounded-2xl border border-stone-200 bg-white/95">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-700" />
                주차별 주기화 타임라인
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedWeekIdx((prev) => Math.max(0, prev - 1))}
                  disabled={selectedWeekIdx === 0}
                  className="p-1 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="이전 주차"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-stone-800 px-1">
                  {selectedWeekIdx + 1} / {activePlan.totalWeeks}주
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedWeekIdx((prev) => Math.min(activePlan.weeks.length - 1, prev + 1))
                  }
                  disabled={selectedWeekIdx === activePlan.weeks.length - 1}
                  className="p-1 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="다음 주차"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Visual Week Pills Slider */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {activePlan.weeks.map((w, idx) => {
                const isSelected = selectedWeekIdx === idx;
                const hasRace = !!w.raceInThisWeek;

                return (
                  <button
                    key={w.weekNumber}
                    type="button"
                    onClick={() => setSelectedWeekIdx(idx)}
                    className={`flex-shrink-0 flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer select-none min-w-[125px] ${
                      isSelected
                        ? 'bg-emerald-900 text-white border-emerald-950 shadow-md ring-2 ring-emerald-600/30'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full text-[11px] font-bold">
                      <span className="flex items-center gap-1">
                        {w.weekNumber}주차
                        {w.isCurrentWeek && (
                          <span className={`text-[9px] px-1 py-0.2 rounded font-extrabold ${isSelected ? 'bg-amber-400 text-stone-900' : 'bg-emerald-700 text-white'}`}>
                            이번주
                          </span>
                        )}
                      </span>
                      {hasRace && (
                        <span className="text-amber-400 font-extrabold" title="대회 참가 주간">
                          🏆
                        </span>
                      )}
                    </div>
                    <div className={`text-[10px] truncate max-w-[110px] mt-0.5 ${isSelected ? 'text-emerald-200' : 'text-stone-500'}`}>
                      {w.startDateStr.slice(5).replace('-', '/')} ~ {w.endDateStr.slice(5).replace('-', '/')}
                    </div>
                    <div className="flex items-center justify-between w-full mt-1.5 pt-1 border-t border-white/10 text-[10px] font-athletic font-bold">
                      <span>{w.targetWeeklyKm}km</span>
                      <span className={`text-[9px] font-normal truncate max-w-[60px] ${isSelected ? 'text-emerald-200' : 'text-stone-500'}`}>
                        {w.phase.split(' ')[0]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Week Headline & Guidance Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-950 to-stone-900 text-white shadow-md border border-emerald-800/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-xl bg-white/15 text-amber-300 font-bold text-xs border border-white/20">
                  {currentWeek.weekLabel}
                </span>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${currentWeek.phaseBadgeColor}`}>
                  {currentWeek.phase}
                </span>
                {currentWeek.isCurrentWeek && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[11px] font-bold">
                    진행 중인 주간
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 sm:gap-4 text-xs flex-wrap">
                <div>
                  <span className="text-stone-300">주간 목표 볼륨: </span>
                  <span className="text-base font-black text-amber-300 font-athletic">
                    {currentWeek.targetWeeklyKm}km
                  </span>
                </div>
                {currentWeek.totalLoadScore !== undefined && (
                  <div className="flex items-center gap-1.5 bg-stone-800/80 px-2.5 py-1 rounded-xl border border-stone-700/60" title="플랜에 저장된 주간 총 훈련 부하">
                    <span className="text-stone-300 text-xs">주간 부하: </span>
                    <span className="text-base font-black text-rose-300 font-athletic flex items-center gap-1">
                      <Flame className="w-4 h-4 text-rose-400" />
                      {currentWeek.totalLoadScore}pt
                    </span>
                  </div>
                )}
                {currentWeek.completedKm !== undefined && currentWeek.completedKm > 0 && (
                  <div>
                    <span className="text-stone-300">실제 완료: </span>
                    <span className="text-base font-black text-emerald-300 font-athletic">
                      {currentWeek.completedKm}km
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 text-xs sm:text-sm text-stone-200 flex items-start gap-2">
              <Target className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">이번 주 훈련 목적 & 전략: </span>
                <span>{currentWeek.focus}</span>
                <div className="text-stone-400 text-xs mt-0.5">{currentWeek.phaseDescription}</div>
              </div>
            </div>

            {/* Race in this week alert */}
            {currentWeek.raceInThisWeek && (
              <div className="mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-600/50 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏆</span>
                  <div>
                    <span className="font-extrabold text-amber-300">
                      [대회 주간] {currentWeek.raceInThisWeek.name} ({currentWeek.raceInThisWeek.course})
                    </span>
                    <span className="text-rose-200 ml-2">대회일: {currentWeek.raceInThisWeek.date}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-rose-800 text-white font-bold text-[11px]">
                  {currentWeek.raceInThisWeek.priority || 'A'}등급 레이스
                </span>
              </div>
            )}
          </div>

          {/* Weekly Training Load & Intensity Distribution Visualization (Interval vs Recovery vs Long Run) */}
          <WeeklyTrainingLoadCard
            currentWeek={currentWeek}
            allWeeks={activePlan.weeks}
            selectedWeekIdx={selectedWeekIdx}
            onSelectWeek={(idx) => setSelectedWeekIdx(idx)}
            runnerVdot={currentVDOT || activePlan.runnerAnalysisSummary?.currentVdot || 38}
            sessions={sessions}
            categoryOverrides={activePlan.categoryOverrides || {}}
            onUpdateCategoryOverride={handleUpdateCategoryOverride}
            onResetCategoryOverrides={handleResetCategoryOverrides}
          />

          {/* 7-Day Workout Cards (월 ~ 일) */}
          <div className="space-y-3.5">
            {currentWeek.days.map((dayItem, dIdx) => {
              const dayKey = `${currentWeek.weekNumber}_${dayItem.day}`;
              const isExpanded = expandedDayKeys[dayKey] ?? true; // Default expanded for great detail
              const typeColor = getWorkoutTypeColor(dayItem.type);
              const isPointWorkout = ['인터벌', '템포런', 'LSD', '대회', '언덕훈련'].includes(dayItem.type);

              return (
                <div
                  key={dayKey}
                  className={`rounded-2xl border transition-all ${typeColor.border} ${typeColor.bg} bg-white shadow-2xs overflow-hidden`}
                >
                  {/* Card Header Row */}
                  <div
                    onClick={() => toggleDayAccordion(dayKey)}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none hover:bg-stone-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Day of Week Badge */}
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-white border border-stone-200/80 shadow-2xs flex-shrink-0">
                        <span className="text-[10px] font-bold text-stone-500 uppercase">
                          {dayItem.dayShort}
                        </span>
                        <span className="text-sm font-black text-stone-900 font-athletic">
                          {dayItem.day.slice(0, 1)}
                        </span>
                        {dayItem.dateStr && (
                          <span className="text-[9px] text-stone-400">
                            {dayItem.dateStr.slice(8)}일
                          </span>
                        )}
                      </div>

                      {/* Title & Workout Type Badge */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${typeColor.badge} flex items-center gap-1`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${typeColor.dot}`} />
                            {dayItem.type}
                          </span>

                          {/* Stored Training Load Badge */}
                          {dayItem.trainingLoad !== undefined && dayItem.distanceKm > 0 && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-stone-100 text-stone-800 border border-stone-200 flex items-center gap-1 shadow-2xs"
                              title={`플랜에 저장된 부하값: ${dayItem.trainingLoad}pt (${dayItem.loadMultiplier || 1.0}x 배수)${dayItem.userCategoryOverride ? ' [원클릭 수동 강도 변환 반영됨]' : ''}`}
                            >
                              <Flame className="w-3 h-3 text-amber-500" />
                              <span>부하 {dayItem.trainingLoad}pt</span>
                              {dayItem.loadMultiplier ? (
                                <span className="text-[9px] text-stone-500 font-normal">({dayItem.loadMultiplier}x)</span>
                              ) : null}
                              {dayItem.userCategoryOverride && (
                                <span className="text-[9px] text-teal-700 bg-teal-50 px-1 rounded font-bold border border-teal-200">
                                  수동
                                </span>
                              )}
                            </span>
                          )}

                          {isPointWorkout && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-stone-900 text-amber-300">
                              포인트 훈련
                            </span>
                          )}

                          {dayItem.isCompleted && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              실제 기록 완료
                            </span>
                          )}
                        </div>

                        <h4 className="text-base sm:text-lg font-bold text-stone-900 mt-1">
                          {dayItem.title}
                        </h4>
                      </div>
                    </div>

                    {/* Right Metrics & Pace Strip */}
                    <div className="flex items-center gap-4 text-right flex-shrink-0 self-end md:self-center">
                      {dayItem.distanceKm > 0 ? (
                        <div>
                          <div className="text-lg sm:text-xl font-black text-stone-900 font-athletic">
                            {dayItem.distanceKm}
                            <span className="text-xs font-semibold text-stone-500 ml-0.5">km</span>
                          </div>
                          <div className="text-xs font-mono font-bold text-emerald-800">
                            {dayItem.targetPace}/km
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm font-bold text-stone-400">휴식일</div>
                      )}

                      <div className="text-stone-400">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Workout Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 border-t border-stone-200/60 bg-white/70 space-y-3.5">
                      {/* Description & Target Zone */}
                      <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                        {dayItem.description}
                      </p>

                      {/* 1. Detailed Training Purpose (상세 훈련 목적) */}
                      {dayItem.purpose && (
                        <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-xs flex items-start gap-2.5">
                          <Target className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-extrabold text-emerald-950">훈련 목적 & 생리학적 적응: </span>
                            <span className="text-emerald-900 font-medium">{dayItem.purpose}</span>
                          </div>
                        </div>
                      )}

                      {/* 2. Structured Workout Stages (워밍업 -> 본운동 -> 쿨다운) */}
                      {dayItem.stages && dayItem.stages.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-stone-700 flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5 text-stone-500" />
                              단계별 상세 세부 훈련 구성 (진행과정)
                            </span>
                            <span className="text-[11px] text-stone-500 font-mono">
                              총 {Math.round(dayItem.stages.reduce((sum, s) => sum + s.distanceKm, 0) * 10) / 10}km
                            </span>
                          </div>

                          <div className={`grid grid-cols-1 sm:grid-cols-2 ${dayItem.stages.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-2.5`}>
                            {dayItem.stages.map((stage, sIdx) => {
                              const isCool = stage.step.includes('쿨다운') || stage.step.includes('마무리') || (!stage.step.includes('본훈련') && !stage.step.includes('본운동') && !stage.step.includes('피니시') && sIdx === dayItem.stages!.length - 1);
                              const isWarm = stage.step.includes('워밍업') || (!isCool && sIdx === 0 && (stage.step.includes('1단계') || stage.step.includes('1구간')));
                              const isMain = !isCool && !isWarm;

                              return (
                                <div
                                  key={sIdx}
                                  className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all flex flex-col justify-between ${
                                    isMain
                                      ? 'bg-gradient-to-br from-amber-50/90 via-white to-amber-50/50 border-amber-300 ring-1 ring-amber-400/50 shadow-xs'
                                      : isWarm
                                      ? 'bg-sky-50/60 border-sky-200'
                                      : isCool
                                      ? 'bg-teal-50/50 border-teal-200'
                                      : 'bg-stone-50 border-stone-200'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="font-bold text-stone-900 truncate text-[11px]">
                                        {stage.step}
                                      </span>
                                      {isMain ? (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500 text-white flex-shrink-0 shadow-2xs">
                                          본훈련
                                        </span>
                                      ) : isWarm ? (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-sky-800 border border-sky-300 flex-shrink-0">
                                          워밍업
                                        </span>
                                      ) : isCool ? (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-100 text-teal-800 border border-teal-300 flex-shrink-0">
                                          쿨다운
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] font-mono font-bold bg-white/80 p-1 rounded-lg border border-stone-200/70 mb-1">
                                      <span className="text-stone-900 font-athletic text-xs">{stage.distanceKm}km</span>
                                      <span className={`px-1.5 py-0.2 rounded text-[11px] ${isMain ? 'text-amber-900 bg-amber-100/80 font-extrabold' : 'text-emerald-800 bg-emerald-50'}`}>
                                        {stage.pace}
                                      </span>
                                    </div>

                                    <div className="text-[10px] text-stone-500 flex items-center gap-1">
                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isMain ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                      <span className="truncate font-medium">{stage.zone}</span>
                                    </div>
                                  </div>

                                  <div className="text-[11px] text-stone-700 leading-snug pt-1.5 border-t border-stone-200/60 keep-all">
                                    {stage.focus}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 3. Recommended Shoe & Quick Action Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-stone-200/60 text-xs">
                        {/* Shoe Display: Actual Worn vs Recommended */}
                        {dayItem.actualSession?.shoeName ? (
                          <div className="flex items-center gap-2 text-stone-700">
                            <span className="p-1 rounded-md bg-emerald-100 text-emerald-800">
                              <Footprints className="w-3.5 h-3.5" />
                            </span>
                            <span>
                              실제 착용 러닝화:{' '}
                              <strong className="text-emerald-950 font-bold">
                                {dayItem.actualSession.shoeName}
                              </strong>
                              <span className="ml-1.5 px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black">
                                훈련 기록 연동
                              </span>
                            </span>
                          </div>
                        ) : dayItem.recommendedShoe ? (
                          <div className="flex items-center gap-2 text-stone-600">
                            <Footprints className="w-4 h-4 text-rose-700 flex-shrink-0" />
                            <span>
                              추천 러닝화:{' '}
                              <strong className="text-stone-900 font-semibold">
                                {dayItem.recommendedShoe.shoeName}
                              </strong>
                              {dayItem.recommendedShoe.category && (
                                <span className="ml-1 text-[11px] text-stone-500">
                                  ({dayItem.recommendedShoe.category})
                                </span>
                              )}
                              {' · '}
                              <span className="text-stone-500 text-[11px]">
                                {dayItem.recommendedShoe.reason}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <div className="text-stone-400">
                            권장 러닝화: {dayItem.type === '휴식' ? '해당 없음' : '데일리 쿠션화'}
                          </div>
                        )}

                        {/* Log Session Action Button */}
                        {dayItem.distanceKm > 0 && !dayItem.isCompleted && onOpenLogWorkout && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenLogWorkout(
                                dayItem.dateStr,
                                dayItem.title,
                                dayItem.distanceKm
                              )
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 transition-colors cursor-pointer select-none self-start sm:self-auto"
                          >
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                            <span>이 훈련 기록하기</span>
                          </button>
                        )}
                      </div>

                      {/* Actual Completed Session Comparison (if exists) */}
                      {dayItem.actualSession && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            <div>
                              <span className="font-bold text-emerald-950">
                                실제 완주 기록: {dayItem.actualSession.totalDistanceKm}km
                              </span>
                              <span className="text-emerald-800 ml-2">
                                (평균 페이스: {dayItem.actualSession.avgPace}
                                {dayItem.actualSession.avgHr ? ` / 심박: ${dayItem.actualSession.avgHr}bpm` : ''}
                                {dayItem.actualSession.shoeName ? ` / ${dayItem.actualSession.shoeName}` : ''})
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold text-[10px]">
                            달성 완료
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. VIEW MODE B: Monthly Calendar View */}
      {viewMode === 'monthly' && (
        <div className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-stone-200 bg-white/95 space-y-5">
          {/* Month Header & Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 cursor-pointer"
                title="이전 달"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <h3 className="text-xl sm:text-2xl font-black text-stone-900 font-athletic flex items-center gap-2">
                <span>{monthCalendarData.year}년</span>
                <span className="text-emerald-800">{monthCalendarData.month}월</span>
                <span className="text-xs font-normal text-stone-500 font-sans">훈련 캘린더</span>
              </h3>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 cursor-pointer"
                title="다음 달"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Monthly Stat Badges */}
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <div className="px-3 py-1.5 rounded-xl bg-stone-100 text-stone-700 border border-stone-200">
                월 계획 거리: <strong className="text-stone-900 font-athletic text-sm ml-1">{monthCalendarData.monthPlannedKm}km</strong>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                훈련 횟수: <strong className="font-athletic text-sm ml-1">{monthCalendarData.monthSessionCount}회</strong>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200">
                포인트 훈련: <strong className="font-athletic text-sm ml-1">{monthCalendarData.monthPointCount}회</strong>
              </div>
            </div>
          </div>

          {/* 7-Column Calendar Grid */}
          <div className="w-full">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-xs font-bold text-stone-500">
              <span className="text-rose-600">일 (SUN)</span>
              <span>월 (MON)</span>
              <span>화 (TUE)</span>
              <span>수 (WED)</span>
              <span>목 (THU)</span>
              <span>금 (FRI)</span>
              <span className="text-blue-600">토 (SAT)</span>
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {monthCalendarData.cells.map((cell, idx) => {
                const item = cell.planItem?.day;
                const week = cell.planItem?.week;
                const hasWorkout = item && item.distanceKm > 0;
                const isRace = item?.type === '대회';
                const isPoint = item && ['인터벌', '템포런', 'LSD', '대회'].includes(item.type);

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (item && week) {
                        setSelectedDayDetail({
                          day: item,
                          weekLabel: week.weekLabel,
                          phase: week.phase,
                        });
                      }
                    }}
                    className={`min-h-[78px] sm:min-h-[96px] p-1.5 sm:p-2 rounded-xl border flex flex-col justify-between transition-all ${
                      cell.isCurrentMonth
                        ? 'bg-white text-stone-800 border-stone-200/90 hover:border-emerald-600 hover:shadow-sm cursor-pointer'
                        : 'bg-stone-50/60 text-stone-400 border-stone-100 cursor-default'
                    } ${cell.isToday ? 'ring-2 ring-emerald-600 font-bold bg-emerald-50/20' : ''}`}
                  >
                    {/* Top Row: Date Number & Badges */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-athletic font-bold ${
                          cell.isToday ? 'text-emerald-700 font-extrabold' : ''
                        }`}
                      >
                        {cell.dayNum}
                      </span>

                      {cell.isToday && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-600 text-white font-bold">
                          오늘
                        </span>
                      )}

                      {isRace && (
                        <span className="text-xs" title="대회">
                          🏆
                        </span>
                      )}
                    </div>

                    {/* Workout Chip in Cell */}
                    {item && (
                      <div className="mt-1">
                        {item.type === '휴식' ? (
                          <div className="text-[10px] text-stone-400 truncate">휴식</div>
                        ) : (
                          <div
                            className={`p-1 rounded-md text-[10px] sm:text-[11px] font-bold leading-tight truncate ${
                              isRace
                                ? 'bg-rose-900 text-amber-300'
                                : isPoint
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            <div className="truncate">{item.type} {item.distanceKm}km</div>
                            <div className="text-[9px] font-mono opacity-80 truncate hidden sm:block">
                              {item.targetPace}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom Status / Checkmark */}
                    <div className="flex items-center justify-between text-[9px] text-stone-400 pt-0.5">
                      {item?.isCompleted ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> 완료
                        </span>
                      ) : (
                        <span />
                      )}
                      {week && (
                        <span className="text-[8px] opacity-60">
                          {week.weekNumber}W
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. Selected Day Detail Modal (from Monthly View click or preview) */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {selectedDayDetail.day.day} ({selectedDayDetail.day.dateStr})
                </span>
                <span className="text-xs text-stone-500 font-semibold">
                  {selectedDayDetail.weekLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayDetail(null)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded text-xs font-extrabold bg-stone-900 text-white">
                  {selectedDayDetail.day.type}
                </span>
                <span className="text-xs font-bold text-stone-500">
                  {selectedDayDetail.phase}
                </span>
              </div>
              <h3 className="text-lg font-bold text-stone-900">
                {selectedDayDetail.day.title}
              </h3>
            </div>

            {/* Metrics */}
            {selectedDayDetail.day.distanceKm > 0 ? (
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                <div>
                  <span className="text-stone-500">목표 거리:</span>
                  <div className="text-base font-black text-stone-900 font-athletic">
                    {selectedDayDetail.day.distanceKm}km
                  </div>
                </div>
                <div>
                  <span className="text-stone-500">목표 페이스:</span>
                  <div className="text-base font-black text-emerald-800 font-mono">
                    {selectedDayDetail.day.targetPace}/km
                  </div>
                </div>
                <div>
                  <span className="text-stone-500">훈련 부하:</span>
                  <div className="text-base font-black text-rose-600 font-athletic flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-rose-500" />
                    <span>{selectedDayDetail.day.trainingLoad ?? '-'}pt</span>
                    {selectedDayDetail.day.loadMultiplier ? (
                      <span className="text-[10px] text-stone-500 font-mono">({selectedDayDetail.day.loadMultiplier}x)</span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-stone-50 text-xs text-stone-500 font-semibold flex items-center justify-between">
                <span>완전 휴식 및 리커버리 데이입니다.</span>
                <span className="font-bold text-stone-700">부하: 0pt</span>
              </div>
            )}

            {/* Description & Purpose */}
            <div className="text-xs text-stone-700 leading-relaxed space-y-2">
              <p>{selectedDayDetail.day.description}</p>
              {selectedDayDetail.day.purpose && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-medium">
                  <strong>훈련 목적: </strong>
                  {selectedDayDetail.day.purpose}
                </div>
              )}
            </div>

            {/* Stages / Workout Progression (단계별 상세 훈련 구성 & 진행과정) */}
            {selectedDayDetail.day.stages && selectedDayDetail.day.stages.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-700" />
                    단계별 상세 세부 훈련 구성 (진행과정)
                  </span>
                  <span className="text-xs font-mono font-bold text-stone-600">
                    합계: {Math.round(selectedDayDetail.day.stages.reduce((s, st) => s + st.distanceKm, 0) * 10) / 10}km
                  </span>
                </div>

                {/* Progress bar visual */}
                <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden flex shadow-inner">
                  {selectedDayDetail.day.stages.map((stg, i) => {
                    const totalDist = Math.max(1, selectedDayDetail.day.distanceKm);
                    const pct = Math.max(8, Math.min(100, (stg.distanceKm / totalDist) * 100));
                    const isCool = stg.step.includes('쿨다운') || stg.step.includes('마무리') || (!stg.step.includes('본훈련') && !stg.step.includes('본운동') && !stg.step.includes('피니시') && i === selectedDayDetail.day.stages!.length - 1);
                    const isWarm = stg.step.includes('워밍업') || (!isCool && i === 0 && (stg.step.includes('1단계') || stg.step.includes('1구간')));
                    const isMain = !isCool && !isWarm;
                    return (
                      <div
                        key={i}
                        style={{ width: `${pct}%` }}
                        className={`h-full ${
                          isMain ? 'bg-amber-500' : isWarm ? 'bg-sky-400' : 'bg-teal-500'
                        }`}
                        title={`${stg.step}: ${stg.distanceKm}km`}
                      />
                    );
                  })}
                </div>

                <div className="space-y-2">
                  {selectedDayDetail.day.stages.map((stg, i) => {
                    const isCool = stg.step.includes('쿨다운') || stg.step.includes('마무리') || (!stg.step.includes('본훈련') && !stg.step.includes('본운동') && !stg.step.includes('피니시') && i === selectedDayDetail.day.stages!.length - 1);
                    const isWarm = stg.step.includes('워밍업') || (!isCool && i === 0 && (stg.step.includes('1단계') || stg.step.includes('1구간')));
                    const isMain = !isCool && !isWarm;

                    return (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                          isMain
                            ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-400/40'
                            : isWarm
                            ? 'bg-sky-50/70 border-sky-200'
                            : isCool
                            ? 'bg-teal-50/60 border-teal-200'
                            : 'bg-stone-50 border-stone-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-extrabold text-stone-900 text-xs">
                            {stg.step}
                          </span>
                          {isMain ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500 text-white shadow-2xs">
                              본훈련 핵심
                            </span>
                          ) : isWarm ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                              워밍업
                            </span>
                          ) : isCool ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                              쿨다운
                            </span>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-white/90 p-2 rounded-lg border border-stone-200/80 text-center font-mono">
                          <div>
                            <span className="text-[10px] text-stone-400 block font-sans">거리</span>
                            <span className="text-xs font-bold text-stone-900 font-athletic">{stg.distanceKm}km</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-stone-400 block font-sans">목표 페이스</span>
                            <span className={`text-xs font-bold ${isMain ? 'text-amber-900 font-extrabold' : 'text-emerald-800'}`}>
                              {stg.pace}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-stone-400 block font-sans">심박 강도</span>
                            <span className="text-[11px] font-bold text-stone-700 truncate block">
                              {stg.zone}
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] text-stone-700 leading-relaxed pt-1 border-t border-stone-200/60 keep-all">
                          {stg.focus}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shoe Recommendation */}
            {selectedDayDetail.day.recommendedShoe && (
              <div className="text-xs text-stone-600 pt-2 border-t border-stone-200">
                👟 추천 러닝화: <strong className="text-stone-900">{selectedDayDetail.day.recommendedShoe.shoeName}</strong> ({selectedDayDetail.day.recommendedShoe.reason})
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDayDetail(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-900 text-white cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Plan Customization & Generator Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-7 shadow-2xl border border-stone-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                      맞춤 러닝 훈련 계획표 설정
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <Check className="w-3 h-3 text-emerald-700" />
                      최근 설정값 자동 저장됨
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">
                    훈련 기간, 요일, 포인트 훈련, 목표 대회 및 지속 발전 여부를 설정합니다.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 rounded-xl hover:bg-stone-100 text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGeneratePlanSubmit} className="space-y-5">
              {/* Option 1: Goal Mode (Target Race vs Custom Target Goal vs Continuous Progression) */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2">
                  훈련 목적 / 목표 모드
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormGoalMode('race');
                      if (nearestTargetRace) {
                        handleSelectRace(nearestTargetRace.id);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formGoalMode === 'race'
                        ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/30'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sm text-stone-900">
                      <Trophy className="w-4 h-4 text-rose-700" />
                      <span>참가 대회 목표</span>
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1">
                      참가 대회 D-Day와 코스 맞춤 완주 전략
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormGoalMode('target_goal');
                      handleCourseChange(formTargetCourse || '10K');
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formGoalMode === 'target_goal'
                        ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/30'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sm text-stone-900">
                      <Target className="w-4 h-4 text-amber-800" />
                      <span>대회 없이 거리/페이스 설정</span>
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1">
                      대회가 없더라도 목표 거리와 기록/페이스 지정
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormGoalMode('continuous_progression')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formGoalMode === 'continuous_progression'
                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/30'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sm text-stone-900">
                      <TrendingUp className="w-4 h-4 text-blue-700" />
                      <span>현상태 기준 지속 발전</span>
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1">
                      목표 미설정 시 3:1 점진적 빌드업 주기화
                    </div>
                  </button>
                </div>
              </div>

              {/* Race Selection & Accurate Pace / Record Setting (if goalMode is 'race') */}
              {formGoalMode === 'race' && (
                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-rose-200/60">
                    <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-rose-700" />
                      참가 대회 및 목표 기록 / 페이스 정밀 설정
                    </span>
                    <span className="text-[11px] text-rose-700 font-semibold">실시간 상호 연동</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-rose-950">
                        목표 마라톤 대회 선택 (참가 예정 대회)
                      </label>
                      {upcomingRaces.length > 0 && (
                        <span className="text-[11px] text-rose-800 font-bold">
                          총 {upcomingRaces.length}개 예정 대회
                        </span>
                      )}
                    </div>
                    <select
                      value={formTargetRaceId}
                      onChange={(e) => handleSelectRace(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-rose-300 bg-white"
                    >
                      {upcomingRaces.length === 0 ? (
                        <option value="">참가 예정인 대회가 없습니다 (새 대회 등록 또는 직접 코스 선택)</option>
                      ) : (
                        upcomingRaces.map((r) => {
                          const dDay = calculateDDay(r.date);
                          return (
                            <option key={r.id} value={r.id}>
                              {r.name} ({r.course}) - {r.date} [{dDay.text}] [{r.priority || 'A'}등급] {r.targetTime ? `(목표 ${r.targetTime})` : ''}
                            </option>
                          );
                        })
                      )}
                    </select>
                    {upcomingRaces.length === 0 && (
                      <p className="text-[11px] text-rose-700 mt-1">
                        💡 완료되었거나 지난 대회가 제외되었습니다. 참가할 새 마라톤 대회를 '내 정보'에서 등록하시면 실시간 연동됩니다.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-rose-950 mb-1">
                      목표 코스 거리
                    </label>
                    <div className="flex gap-2">
                      {['풀코스', '하프', '10K', '5K'].map((course) => (
                        <button
                          key={course}
                          type="button"
                          onClick={() => handleCourseChange(course)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                            formTargetCourse.includes(course)
                              ? 'bg-rose-900 text-white border-rose-950 shadow-2xs'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          {course}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2-Way Synchronized Target Time & Pace Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-rose-900 mb-1">
                        🎯 목표 완주 기록 (hh:mm:ss)
                      </label>
                      <input
                        type="text"
                        value={formTargetTime}
                        onChange={(e) => handleTargetTimeChange(e.target.value, formTargetCourse)}
                        placeholder="예: 00:59:59 또는 03:29:59"
                        className="w-full px-3 py-2 rounded-xl text-sm font-mono font-bold text-stone-900 border border-rose-300 bg-white focus:ring-2 focus:ring-rose-500/30"
                      />
                      <span className="text-[10px] text-stone-500 mt-1 block">
                        기록 수정 시 아래 목표 페이스가 자동 계산됩니다.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-rose-900 mb-1">
                        ⚡ 목표 페이스 (분'초"/km)
                      </label>
                      <input
                        type="text"
                        value={formTargetPace}
                        onChange={(e) => handleTargetPaceChange(e.target.value, formTargetCourse)}
                        placeholder="예: 5'59&quot; 또는 4'58&quot;"
                        className="w-full px-3 py-2 rounded-xl text-sm font-mono font-bold text-emerald-900 border border-rose-300 bg-white focus:ring-2 focus:ring-rose-500/30"
                      />
                      <span className="text-[10px] text-stone-500 mt-1 block">
                        페이스 수정 시 위 완주 기록이 자동 계산됩니다.
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/80 border border-rose-200 text-[11px] text-stone-700 flex items-center gap-2">
                    <span className="text-base">💡</span>
                    <span>
                      선택 거리 <strong>{formTargetCourse}</strong> 기준: 완주 <strong>{formTargetTime}</strong> 달성을 위해 필수 목표 페이스는 <strong>{formTargetPace}/km</strong>입니다.
                    </span>
                  </div>
                </div>
              )}

              {/* Custom Target Goal Setting (if goalMode is 'target_goal' - 대회 없이 거리/페이스 설정) */}
              {formGoalMode === 'target_goal' && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-amber-200/80">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-amber-800" />
                      대회 없이 나만의 맞춤 목표 거리 & 페이스 설정
                    </span>
                    <span className="text-[11px] text-amber-800 font-semibold">100% 맞춤 설계</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-950 mb-1">
                      도전할 목표 거리
                    </label>
                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                      {[
                        { id: '10K', label: '10K (10km)' },
                        { id: '하프', label: '하프 (21.1km)' },
                        { id: '풀코스', label: '풀코스 (42.2km)' },
                        { id: '5K', label: '5K (5km)' },
                        { id: '직접입력', label: '직접 km 입력' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleCourseChange(item.id)}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                            formTargetCourse === item.id || (item.id !== '직접입력' && formTargetCourse.includes(item.id))
                              ? 'bg-amber-900 text-white border-amber-950 shadow-2xs'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {formTargetCourse === '직접입력' && (
                      <div className="flex items-center gap-2 mt-2">
                        <label className="text-xs text-stone-600 font-semibold">직접 입력 거리:</label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="100"
                          value={formCustomDistanceKm}
                          onChange={(e) => {
                            setFormCustomDistanceKm(e.target.value);
                            handleCourseChange('직접입력', e.target.value);
                          }}
                          className="w-24 px-3 py-1 rounded-xl text-xs font-bold border border-amber-300 bg-white"
                        />
                        <span className="text-xs font-bold text-stone-700">km</span>
                      </div>
                    )}
                  </div>

                  {/* 2-Way Synchronized Target Time & Pace Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-amber-950 mb-1">
                        🎯 목표 완주 기록 (hh:mm:ss)
                      </label>
                      <input
                        type="text"
                        value={formTargetTime}
                        onChange={(e) => handleTargetTimeChange(e.target.value, formTargetCourse)}
                        placeholder="예: 00:59:59"
                        className="w-full px-3 py-2 rounded-xl text-sm font-mono font-bold text-stone-900 border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500/30"
                      />
                      <span className="text-[10px] text-stone-500 mt-1 block">
                        시간 수정 시 목표 페이스가 자동 동기화됩니다.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-amber-950 mb-1">
                        ⚡ 목표 페이스 (분'초"/km)
                      </label>
                      <input
                        type="text"
                        value={formTargetPace}
                        onChange={(e) => handleTargetPaceChange(e.target.value, formTargetCourse)}
                        placeholder="예: 5'59&quot;"
                        className="w-full px-3 py-2 rounded-xl text-sm font-mono font-bold text-emerald-900 border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500/30"
                      />
                      <span className="text-[10px] text-stone-500 mt-1 block">
                        페이스 수정 시 완주 시간이 자동 동기화됩니다.
                      </span>
                    </div>
                  </div>

                  {/* Quick Milestone Presets */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      ⚡ 빠른 목표 프리셋 선택
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {formTargetCourse.includes('10') ? (
                        [
                          { time: '00:59:59', pace: "5'59\"", label: 'Sub-60 (59:59 / 5\'59")' },
                          { time: '00:49:59', pace: "4'59\"", label: 'Sub-50 (49:59 / 4\'59")' },
                          { time: '00:44:59', pace: "4'29\"", label: 'Sub-45 (44:59 / 4\'29")' },
                          { time: '00:39:59', pace: "3'59\"", label: 'Sub-40 (39:59 / 3\'59")' },
                        ].map((m) => (
                          <button
                            key={m.label}
                            type="button"
                            onClick={() => {
                              setFormTargetTime(m.time);
                              setFormTargetPace(m.pace);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-950 cursor-pointer transition-colors"
                          >
                            {m.label}
                          </button>
                        ))
                      ) : formTargetCourse.includes('하프') ? (
                        [
                          { time: '01:59:59', pace: "5'41\"", label: 'Sub-200 (1:59:59)' },
                          { time: '01:44:59', pace: "4'58\"", label: 'Sub-145 (1:44:59)' },
                          { time: '01:29:59', pace: "4'15\"", label: 'Sub-130 (1:29:59)' },
                        ].map((m) => (
                          <button
                            key={m.label}
                            type="button"
                            onClick={() => {
                              setFormTargetTime(m.time);
                              setFormTargetPace(m.pace);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-950 cursor-pointer transition-colors"
                          >
                            {m.label}
                          </button>
                        ))
                      ) : formTargetCourse.includes('풀') ? (
                        [
                          { time: '03:59:59', pace: "5'41\"", label: 'Sub-4 (3:59:59)' },
                          { time: '03:29:59', pace: "4'58\"", label: 'Sub-330 (3:29:59)' },
                          { time: '03:09:59', pace: "4'30\"", label: 'Sub-310 (3:09:59)' },
                          { time: '02:59:59', pace: "4'15\"", label: 'Sub-3 (2:59:59)' },
                        ].map((m) => (
                          <button
                            key={m.label}
                            type="button"
                            onClick={() => {
                              setFormTargetTime(m.time);
                              setFormTargetPace(m.pace);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-950 cursor-pointer transition-colors"
                          >
                            {m.label}
                          </button>
                        ))
                      ) : (
                        [
                          { time: '00:29:59', pace: "5'59\"", label: '5K Sub-30 (29:59)' },
                          { time: '00:24:59', pace: "4'59\"", label: '5K Sub-25 (24:59)' },
                          { time: '00:19:59', pace: "3'59\"", label: '5K Sub-20 (19:59)' },
                        ].map((m) => (
                          <button
                            key={m.label}
                            type="button"
                            onClick={() => {
                              setFormTargetTime(m.time);
                              setFormTargetPace(m.pace);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-950 cursor-pointer transition-colors"
                          >
                            {m.label}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Option 2: Duration Presets */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2">
                  훈련 기간 설정
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {formGoalMode === 'race' && targetForPreset && (
                    <button
                      type="button"
                      onClick={handleSelectToTargetRacePreset}
                      className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer text-left transition-all ${
                        formDurationPreset === 'to_target_race'
                          ? 'bg-emerald-900 text-white border-emerald-950 ring-2 ring-emerald-500/40 shadow-xs'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>🏆 대회 D-Day까지 ({calculatedWeeksToRace}주)</span>
                        {formDurationPreset === 'to_target_race' && (
                          <span className="text-[10px] text-amber-300 font-extrabold">선택됨</span>
                        )}
                      </div>
                      <div className="text-[10px] opacity-80 font-mono mt-0.5 truncate">
                        {targetForPreset.name} ({targetRaceDDayInfo?.text || targetForPreset.date})
                      </div>
                    </button>
                  )}

                  {[
                    { id: '4weeks', label: '4주 플랜', desc: '단기 스피드 빌드업' },
                    { id: '8weeks', label: '8주 플랜', desc: '중기 페이스 완성' },
                    { id: '12weeks', label: '12주 플랜', desc: '표준 마라톤 주기화' },
                    { id: '16weeks', label: '16주 플랜', desc: '풀코스 마스터' },
                    { id: 'custom', label: '직접 날짜 지정', desc: '시작일 ~ 종료일' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setFormDurationPreset(preset.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer text-left ${
                        formDurationPreset === preset.id
                          ? 'bg-emerald-900 text-white border-emerald-950'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      <div>{preset.label}</div>
                      <div className="text-[10px] opacity-75 font-normal">{preset.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Start Date selection: Today vs Next Monday vs Custom */}
                <div className="mt-3.5 p-3.5 bg-stone-50/90 rounded-2xl border border-stone-200 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-700" />
                      <span>플랜 시작 날짜 선택</span>
                    </label>
                    <span className="text-[11px] text-stone-600 font-mono">
                      선택된 시작일: <strong className="text-emerald-850 font-bold bg-white px-2 py-0.5 rounded-md border border-stone-200">{formStartDate}</strong>
                    </span>
                  </div>

                  {/* 3 Quick Choice Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectStartDatePreset('today')}
                      className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer text-left transition-all ${
                        formStartDateMode === 'today' || formStartDate === getTodayDateStr()
                          ? 'bg-emerald-900 text-white border-emerald-950 ring-2 ring-emerald-500/30 shadow-xs'
                          : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span>⚡ 오늘부터 시작</span>
                        </span>
                        {(formStartDateMode === 'today' || formStartDate === getTodayDateStr()) && (
                          <span className="text-[10px] text-amber-300 font-extrabold">선택됨</span>
                        )}
                      </div>
                      <div className="text-[10px] opacity-80 font-mono mt-0.5">{getTodayDateStr()} (오늘)</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectStartDatePreset('next_monday')}
                      className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer text-left transition-all ${
                        formStartDateMode === 'next_monday' || formStartDate === getNextMondayStr()
                          ? 'bg-emerald-900 text-white border-emerald-950 ring-2 ring-emerald-500/30 shadow-xs'
                          : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span>🗓️ 다음 월요일부터</span>
                        </span>
                        {(formStartDateMode === 'next_monday' || formStartDate === getNextMondayStr()) && (
                          <span className="text-[10px] text-amber-300 font-extrabold">권장</span>
                        )}
                      </div>
                      <div className="text-[10px] opacity-80 font-mono mt-0.5">{getNextMondayStr()} (주 시작)</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormStartDateMode('custom')}
                      className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer text-left transition-all col-span-2 sm:col-span-1 ${
                        formStartDateMode === 'custom' &&
                        formStartDate !== getTodayDateStr() &&
                        formStartDate !== getNextMondayStr()
                          ? 'bg-emerald-900 text-white border-emerald-950 ring-2 ring-emerald-500/30 shadow-xs'
                          : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>📅 직접 지정</span>
                        {formStartDateMode === 'custom' &&
                          formStartDate !== getTodayDateStr() &&
                          formStartDate !== getNextMondayStr() && (
                            <span className="text-[10px] text-amber-300 font-extrabold">직접선택</span>
                          )}
                      </div>
                      <div className="text-[10px] opacity-80 font-mono mt-0.5">{formStartDate || '캘린더 선택'}</div>
                    </button>
                  </div>

                  {/* Date Input verification / edit */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] text-stone-500 mb-1">시작일 캘린더 확인 및 변경</label>
                      <input
                        type="date"
                        value={formStartDate}
                        onChange={(e) => {
                          setFormStartDate(e.target.value);
                          setFormStartDateMode('custom');
                        }}
                        className="w-full px-3 py-1.5 rounded-xl text-xs font-semibold border border-stone-300 bg-white"
                      />
                    </div>
                    {formDurationPreset === 'custom' && (
                      <div>
                        <label className="block text-[11px] text-stone-500 mb-1">플랜 종료일</label>
                        <input
                          type="date"
                          value={formEndDate}
                          onChange={(e) => setFormEndDate(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl text-xs font-semibold border border-stone-300 bg-white"
                        />
                      </div>
                    )}
                    {formDurationPreset === 'to_target_race' && targetForPreset && (
                      <div>
                        <label className="block text-[11px] text-emerald-800 font-bold mb-1">
                          목표 대회일 (자동 종료일)
                        </label>
                        <div className="w-full px-3 py-1.5 rounded-xl text-xs font-mono font-bold border border-emerald-300 bg-emerald-50 text-emerald-950 flex items-center justify-between">
                          <span>{targetForPreset.date} ({targetRaceDDayInfo?.text})</span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-200/70 px-1.5 py-0.5 rounded font-sans">
                            {calculatedWeeksToRace}주 플랜
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Option 3: Training Days of Week */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2">
                  주간 훈련 요일 선택 (최소 1일 이상)
                </label>
                <div className="grid grid-cols-7 gap-1.5">
                  {ALL_DAYS.map((day) => {
                    const isSelected = formTrainingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (formTrainingDays.length > 1) {
                              setFormTrainingDays(formTrainingDays.filter((d) => d !== day));
                            }
                          } else {
                            setFormTrainingDays([...formTrainingDays, day]);
                          }
                        }}
                        className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200'
                        }`}
                      >
                        {day.slice(0, 1)}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-stone-500 mt-1">
                  선택됨: {formTrainingDays.join(', ')} ({formTrainingDays.length}일 러닝)
                </div>
              </div>

              {/* Option 4: Point Workout Days & Multi-Select Types (포인트 훈련 순환 배정 & 언덕훈련 포함) */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Speed Workout Day */}
                  <div>
                    <label className="block text-xs font-bold text-rose-900 mb-1">
                      ⚡ 스피드 포인트 훈련 요일
                    </label>
                    <select
                      value={formSpeedDay}
                      onChange={(e) => setFormSpeedDay(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-stone-300 bg-white"
                    >
                      <option value="없음">스피드 훈련 없음</option>
                      {ALL_DAYS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Long Run Day */}
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1">
                      🏃 장거리 포인트 (LSD) 요일
                    </label>
                    <select
                      value={formLongRunDay}
                      onChange={(e) => setFormLongRunDay(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-stone-300 bg-white"
                    >
                      <option value="없음">장거리 훈련 없음</option>
                      {ALL_DAYS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Point Workout Types Multi-Selection with 3-Tier Classification */}
                {formSpeedDay !== '없음' && (
                  <div className="space-y-2.5 pt-2 border-t border-stone-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <label className="block text-xs font-bold text-stone-900">
                          🎯 포인트 훈련 종류 다중 선택 &amp; 3대 강도 체계적 분류
                        </label>
                        <span className="text-[11px] text-stone-500">
                          저 - 존3구간 · 중 - 역치구간 · 고 - 역치 이상 인터벌 등 원하는 훈련 조합을 자유롭게 등록
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 self-start sm:self-auto">
                        {formSpeedTypes.length}개 선택됨
                      </span>
                    </div>

                    {/* Quick Preset Combos */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-stone-500">⚡ 추천 조합:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormSpeedTypes(['존3 마라톤 페이스주', '템포런', '인터벌', '언덕훈련'])
                        }
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 transition-all cursor-pointer"
                        title="저강도 존3 M페이스 + 중강도 역치 템포 + 고강도 인터벌 & 언덕의 균형 잡힌 풀코스 조합"
                      >
                        🎯 마라톤 풀코스 균형형
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormSpeedTypes(['존3 마라톤 페이스주', '존3 모더레이트런', '템포런', '크루즈 인터벌'])
                        }
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer"
                        title="부상 위험을 줄이고 유산소 베이스 및 젖산 역치를 집중 다지는 조합"
                      >
                        🟢 유산소 베이스 &amp; 역치 빌드
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormSpeedTypes(['인터벌', '800m 인터벌', '템포런', '400m 숏 인터벌'])
                        }
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-all cursor-pointer"
                        title="VO2max 및 스피드 피치를 빠르게 끌어올리는 고강도 중심 조합"
                      >
                        🔴 스피드 &amp; 인터벌 파워
                      </button>
                    </div>

                    {/* Tier Filter Tabs */}
                    <div className="flex items-center gap-1 pt-1 overflow-x-auto text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setSpeedTypeTierFilter('all')}
                        className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          speedTypeTierFilter === 'all'
                            ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        전체 보기 ({SPEED_WORKOUT_TYPES.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeedTypeTierFilter('low')}
                        className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          speedTypeTierFilter === 'low'
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <span>🟢 저 - 존3구간</span>
                        <span>(3)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeedTypeTierFilter('moderate')}
                        className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          speedTypeTierFilter === 'moderate'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <span>🟡 중 - 역치구간</span>
                        <span>(4)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeedTypeTierFilter('high')}
                        className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          speedTypeTierFilter === 'high'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                            : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <span>🔴 고 - 역치 이상 인터벌</span>
                        <span>(5)</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      {SPEED_WORKOUT_TYPES.filter(
                        (t) => speedTypeTierFilter === 'all' || t.tier === speedTypeTierFilter
                      ).map((t) => {
                        const isSelected = formSpeedTypes.includes(t.id);
                        const orderIdx = formSpeedTypes.indexOf(t.id);
                        return (
                          <div
                            key={t.id}
                            onClick={() => toggleSpeedType(t.id)}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-start justify-between gap-2 select-none ${
                              isSelected
                                ? 'bg-white border-emerald-600 shadow-2xs ring-1 ring-emerald-500/30'
                                : 'bg-white/60 border-stone-200 text-stone-500 hover:bg-white'
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm">{t.icon}</span>
                                <span className="font-bold text-xs text-stone-900 truncate">
                                  {t.label}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold border ${t.badgeBg}`}
                                >
                                  {t.tierLabel}
                                </span>
                              </div>
                              <div className="text-[10px] text-stone-500 line-clamp-1">
                                {t.desc}
                              </div>
                              <div className="text-[10px] font-mono text-stone-400">
                                {t.zoneBadge}
                              </div>
                            </div>

                            <div className="flex-shrink-0 flex items-center gap-1 pt-0.5">
                              {isSelected && (
                                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 w-5 h-5 rounded-full flex items-center justify-center">
                                  {orderIdx + 1}
                                </span>
                              )}
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-emerald-700 border-emerald-800 text-white'
                                    : 'border-stone-300'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Rotation Sequence Banner */}
                    <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-950 flex items-center gap-2">
                      <span className="text-base flex-shrink-0">🔄</span>
                      <div className="min-w-0">
                        <strong>주차별 순환 순서: </strong>
                        <span className="text-emerald-900">
                          {formSpeedTypes.map((type, i) => `${i + 1}주차: ${type}`).join(' → ')} (이후 반복)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Base Weekly Mileage (Optional) */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  시작 기준 주간 마일리지 (km)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="1"
                    min="15"
                    max="150"
                    value={formBaseWeeklyKm}
                    onChange={(e) => setFormBaseWeeklyKm(e.target.value)}
                    className="w-32 px-3 py-2 rounded-xl text-sm font-semibold border border-stone-300"
                  />
                  <span className="text-xs text-stone-500">
                    (최근 4주 러닝 기록 바탕 자동 추천, 수정 가능)
                  </span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-800 hover:bg-emerald-900 text-white shadow-md cursor-pointer transition-all"
                >
                  {isGenerating ? (
                    <span>플랜 수립 중...</span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>새로운 훈련 계획표 생성하기</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
