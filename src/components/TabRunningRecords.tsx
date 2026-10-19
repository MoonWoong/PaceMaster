import React, { useState, useMemo, useEffect, Suspense } from 'react';
import {
  Activity,
  Heart,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronRight,
  Trash2,
  Sparkles,
  Zap,
  Info,
  Calendar,
  Clock,
  Gauge,
  CheckCircle2,
  BarChart3,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Compass,
  Share2,
  Calculator,
  Save,
  Footprints,
  List,
  FileSpreadsheet,
  Target,
  Flame,
  SlidersHorizontal,
} from 'lucide-react';
import Papa from 'papaparse';
import {
  RunningRecords,
  RunningGoals,
  TrainingSession,
  TrainingLap,
  WeeklyPlanDay,
  WeeklyPlanSettings,
  RunnerStateAnalysis,
  RunningShoe,
  SpeedWorkoutType,
  RegisteredRace,
} from '../types';
import {
  estimateBestVDOT,
  getRunnerTier,
  formatPace,
} from '../lib/vdot';
import {
  generateWeeklyTrainingPlan,
  analyzeRunnerState,
  enrichWeeklyPlanWithActualSessions,
  analyzeTargetRaceForTrainingPlan,
  analyzeAllUpcomingRacesForTrainingPlan,
  TargetRacePlanAnalysis,
  DayOfWeek,
  PlanCustomOptions,
} from '../lib/trainingPlanGenerator';
import { attachShoeRecommendationsToPlan } from '../lib/shoeRecommender';
import { verifyRunnerSecurityKey } from '../lib/security';
import { calculateDDay } from '../lib/marathonData';
import { TrainingShareModal } from './TrainingShareModal';
import { TrainingIntensityRecommender } from './TrainingIntensityRecommender';
import { TrainingShoeModal } from './TrainingShoeModal';
import { TrainingCalendarView } from './TrainingCalendarView';
import { ShoeMileageAnalyticsCard } from './ShoeMileageAnalyticsCard';
import { CsvWorkoutUploadModal } from './CsvWorkoutUploadModal';

interface TabRunningRecordsProps {
  records: RunningRecords;
  goals: RunningGoals;
  trainingSessions: TrainingSession[];
  weeklyPlan: WeeklyPlanDay[];
  weeklyPlanSettings?: WeeklyPlanSettings;
  shoes?: RunningShoe[];
  races?: RegisteredRace[];
  onSaveRecords: (records: RunningRecords) => Promise<void>;
  onSaveGoals: (goals: RunningGoals) => Promise<void>;
  onAddTrainingSession: (
    session: Omit<TrainingSession, 'id' | 'createdAt'>
  ) => Promise<void>;
  onAddBatchTrainingSessions?: (
    items: Omit<TrainingSession, 'id' | 'createdAt'>[]
  ) => Promise<void>;
  onUpdateTrainingSession?: (sessionId: string, updates: Partial<TrainingSession>) => Promise<void>;
  onDeleteTrainingSession: (id: string) => Promise<void>;
  onClearAllTrainingSessions?: () => Promise<void>;
  onSaveWeeklyPlan: (plan: WeeklyPlanDay[], settings?: WeeklyPlanSettings) => Promise<void>;
  onUpdateRace?: (race: RegisteredRace) => Promise<void>;
  onOpenPaceCalculator?: () => void;
  onOpenTodayWorkoutModal?: () => void;
  onNavigateToShoes?: () => void;
  onNavigateToRaces?: () => void;
}

export const TabRunningRecords: React.FC<TabRunningRecordsProps> = ({
  records,
  goals,
  trainingSessions,
  weeklyPlan,
  weeklyPlanSettings,
  shoes = [],
  races = [],
  onSaveRecords,
  onSaveGoals,
  onAddTrainingSession,
  onAddBatchTrainingSessions,
  onUpdateTrainingSession,
  onDeleteTrainingSession,
  onClearAllTrainingSessions,
  onSaveWeeklyPlan,
  onUpdateRace,
  onOpenPaceCalculator,
  onOpenTodayWorkoutModal,
  onNavigateToShoes,
  onNavigateToRaces,
}) => {
  // Session Shoe Modal State
  const [shoeModalSession, setShoeModalSession] = useState<TrainingSession | null>(null);
  // Shoe Analytics Toggle State
  const [showShoeAnalytics, setShowShoeAnalytics] = useState<boolean>(false);
  // Selected distance for course adaptation
  const [evalSelectedDistance, setEvalSelectedDistance] = useState<'10K' | '하프' | '풀코스'>('풀코스');

  // Accordion expanded state for training sessions (최신 연도 기본 열림)
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({});
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  // Training Sessions View Mode: 'list' (리스트 보기) vs 'calendar' (달력 보기)
  const [sessionViewMode, setSessionViewMode] = useState<'list' | 'calendar'>('list');

  // Share Modal State
  const [sharingSession, setSharingSession] = useState<TrainingSession | null>(null);

  // CSV Workout Multi-upload Modal State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [pendingCsvItems, setPendingCsvItems] = useState<Omit<TrainingSession, 'id' | 'createdAt'>[]>([]);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);

  // Weekly Training Plan Customization State
  const [customTrainingDays, setCustomTrainingDays] = useState<DayOfWeek[]>(
    weeklyPlanSettings?.trainingDays && weeklyPlanSettings.trainingDays.length > 0
      ? (weeklyPlanSettings.trainingDays as DayOfWeek[])
      : ['화요일', '목요일', '토요일', '일요일']
  );
  const [customSpeedDay, setCustomSpeedDay] = useState<DayOfWeek | '없음'>(
    (weeklyPlanSettings?.speedDay as DayOfWeek | '없음') || '화요일'
  );
  const [customSpeedType, setCustomSpeedType] = useState<SpeedWorkoutType>(
    weeklyPlanSettings?.speedWorkoutType || '인터벌'
  );
  const [customLongRunDay, setCustomLongRunDay] = useState<DayOfWeek | '없음'>(
    (weeklyPlanSettings?.longRunDay as DayOfWeek | '없음') || '일요일'
  );
  const [isCustomizingPlan, setIsCustomizingPlan] = useState<boolean>(true);
  const [autoPointMode, setAutoPointMode] = useState<boolean>(true);
  const [showAdvancedPlanSettings, setShowAdvancedPlanSettings] = useState<boolean>(false);

  // Sync state if weeklyPlanSettings prop updates from DB
  useEffect(() => {
    if (weeklyPlanSettings) {
      if (weeklyPlanSettings.trainingDays && weeklyPlanSettings.trainingDays.length > 0) {
        setCustomTrainingDays(weeklyPlanSettings.trainingDays as DayOfWeek[]);
      }
      if (weeklyPlanSettings.speedDay) {
        setCustomSpeedDay(weeklyPlanSettings.speedDay as DayOfWeek | '없음');
      }
      if (weeklyPlanSettings.speedWorkoutType) {
        setCustomSpeedType(weeklyPlanSettings.speedWorkoutType);
      }
      if (weeklyPlanSettings.longRunDay) {
        setCustomLongRunDay(weeklyPlanSettings.longRunDay as DayOfWeek | '없음');
      }
      if (weeklyPlanSettings.targetRaceCourse) {
        setEvalSelectedDistance(weeklyPlanSettings.targetRaceCourse);
      }
    }
  }, [weeklyPlanSettings]);

  // 1. Calculations from records
  const currentBest = useMemo(() => {
    return estimateBestVDOT(records);
  }, [records]);

  const currentVDOT = currentBest.vdot;
  const runnerTier = useMemo(() => getRunnerTier(currentVDOT), [currentVDOT]);

  // 3. In-depth Runner Workload & Training State Analysis
  const runnerStateAnalysis = useMemo(() => {
    return analyzeRunnerState(trainingSessions, evalSelectedDistance, new Date(), races, goals);
  }, [trainingSessions, evalSelectedDistance, races, goals]);

  // Helper to parse date string (YYYY-MM-DD or YYYY.MM.DD) safely into year, month, day, and a noon-local Date object
  const parseDateParts = (dateStr: string): { year: number; month: number; day: number; date: Date } => {
    const clean = String(dateStr || '').replace(/\./g, '-').trim();
    const parts = clean.split('-');
    let y = 2026, m = 1, d = 1;
    if (parts.length >= 3) {
      y = parseInt(parts[0], 10) || 2026;
      m = parseInt(parts[1], 10) || 1;
      d = parseInt(parts[2], 10) || 1;
    }
    // Midday (12:00:00) avoids any UTC or Daylight Saving boundary shifts
    const date = new Date(y, m - 1, d, 12, 0, 0);
    return { year: y, month: m, day: d, date };
  };

  // Helper to get Monday-Sunday Week Range string for a given date
  // e.g. "2026.09.28 (월) ~ 10.04 (일)"
  const getMondayToSundayWeekInfo = (
    dateStr: string
  ): {
    weekKey: string;
    weekLabel: string;
    mondayDate: Date;
    isCrossMonth: boolean;
  } => {
    const { year: y, month: m, day: d, date } = parseDateParts(dateStr);
    const dayOfWeek = date.getDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
    // Diff to previous Monday: if Sun(0), diff is -6; if Mon(1), diff is 0; if Tue(2), diff is -1
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(y, m - 1, d + diffToMonday, 12, 0, 0);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 12, 0, 0);

    const mYear = monday.getFullYear();
    const mMonth = String(monday.getMonth() + 1).padStart(2, '0');
    const mDate = String(monday.getDate()).padStart(2, '0');

    const sMonth = String(sunday.getMonth() + 1).padStart(2, '0');
    const sDate = String(sunday.getDate()).padStart(2, '0');

    const weekKey = `${mYear}-${mMonth}-${mDate}`;
    const weekLabel = `${mYear}.${mMonth}.${mDate}(월) ~ ${sMonth}.${sDate}(일)`;
    const isCrossMonth = mMonth !== sMonth;

    return {
      weekKey,
      weekLabel,
      mondayDate: monday,
      isCrossMonth,
    };
  };

  // Map of full Monday~Sunday total weekly distance across all sessions
  const globalWeeklyDistanceMap = useMemo(() => {
    const map: Record<string, { totalDistance: number; totalSessions: number }> = {};
    for (const session of trainingSessions) {
      const { weekKey } = getMondayToSundayWeekInfo(session.date);
      if (!map[weekKey]) {
        map[weekKey] = { totalDistance: 0, totalSessions: 0 };
      }
      map[weekKey].totalDistance += session.totalDistanceKm || 0;
      map[weekKey].totalSessions += 1;
    }
    for (const k of Object.keys(map)) {
      map[k].totalDistance = Math.round(map[k].totalDistance * 100) / 100;
    }
    return map;
  }, [trainingSessions]);

  // 3. Group training sessions by Month and Monday~Sunday Weeks (All sorted descending by date)
  interface WeeklyGroup {
    weekKey: string;
    weekLabel: string;
    mondayDate: Date;
    weeklyDistance: number; // Combined total weekly distance
    monthSessionDistance: number; // Distance run in this particular month
    isCrossMonth?: boolean;
    sessions: TrainingSession[];
  }

  interface MonthlyGroup {
    monthKey: string;
    monthTitle: string;
    month: number;
    monthDate: Date;
    totalDistance: number;
    totalSessionsCount: number;
    weeks: WeeklyGroup[];
  }

  interface YearlyGroup {
    year: number;
    yearKey: string;
    yearTitle: string;
    totalDistance: number;
    totalSessionsCount: number;
    months: MonthlyGroup[];
  }

  const groupedYearlyTraining = useMemo(() => {
    // Deduplicate and sort all sessions descending by date first
    const seen = new Set<string>();
    const uniqueSessions: TrainingSession[] = [];
    for (const s of trainingSessions) {
      if (!s) continue;
      const sId = s.id ? String(s.id).trim() : `${s.date || ''}_${s.title || ''}_${s.totalDistanceKm || ''}`;
      if (!sId || seen.has(sId)) continue;
      seen.add(sId);
      uniqueSessions.push(s);
    }

    const sorted = uniqueSessions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Map: year -> monthKey -> month data
    const yearMonthMap: Record<
      number,
      Record<string, { monthDate: Date; monthTitle: string; month: number; weeksMap: Record<string, WeeklyGroup> }>
    > = {};

    for (const session of sorted) {
      const { year, month } = parseDateParts(session.date);
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const monthTitle = `${year}년 ${month}월`;
      const monthDate = new Date(year, month - 1, 1, 12, 0, 0);

      if (!yearMonthMap[year]) {
        yearMonthMap[year] = {};
      }

      if (!yearMonthMap[year][monthKey]) {
        yearMonthMap[year][monthKey] = {
          monthDate,
          monthTitle,
          month,
          weeksMap: {},
        };
      }

      const { weekKey, weekLabel, mondayDate, isCrossMonth } = getMondayToSundayWeekInfo(session.date);
      const combinedWeeklyDist = globalWeeklyDistanceMap[weekKey]?.totalDistance || 0;

      if (!yearMonthMap[year][monthKey].weeksMap[weekKey]) {
        yearMonthMap[year][monthKey].weeksMap[weekKey] = {
          weekKey,
          weekLabel,
          mondayDate,
          weeklyDistance: combinedWeeklyDist,
          monthSessionDistance: 0,
          isCrossMonth,
          sessions: [],
        };
      }

      yearMonthMap[year][monthKey].weeksMap[weekKey].sessions.push(session);
      yearMonthMap[year][monthKey].weeksMap[weekKey].monthSessionDistance += session.totalDistanceKm || 0;
    }

    // Convert to sorted YearlyGroup array descending by year
    const sortedYears = Object.keys(yearMonthMap)
      .map(Number)
      .sort((a, b) => b - a);

    const yearlyResult: YearlyGroup[] = sortedYears.map((year) => {
      const monthsObj = yearMonthMap[year];
      const monthKeys = Object.keys(monthsObj).sort((a, b) => b.localeCompare(a)); // Descending months

      const monthsResult: MonthlyGroup[] = monthKeys.map((mKey) => {
        const mData = monthsObj[mKey];
        // Sort weeks descending by Monday date
        const weeks = Object.values(mData.weeksMap).sort(
          (a, b) => b.mondayDate.getTime() - a.mondayDate.getTime()
        );

        // Within each week, sort sessions descending by date
        weeks.forEach((w) => {
          w.sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          w.monthSessionDistance = Math.round(w.monthSessionDistance * 100) / 100;
          w.weeklyDistance = globalWeeklyDistanceMap[w.weekKey]?.totalDistance || w.monthSessionDistance;
        });

        // Monthly total is the sum of sessions actually run in this month
        const totalDist = weeks.reduce((sum, w) => sum + w.monthSessionDistance, 0);
        const totalSessions = weeks.reduce((sum, w) => sum + w.sessions.length, 0);

        return {
          monthKey: mKey,
          monthTitle: mData.monthTitle,
          month: mData.month,
          monthDate: mData.monthDate,
          totalDistance: Math.round(totalDist * 100) / 100,
          totalSessionsCount: totalSessions,
          weeks,
        };
      });

      const yearDist = monthsResult.reduce((sum, m) => sum + m.totalDistance, 0);
      const yearSessions = monthsResult.reduce((sum, m) => sum + m.totalSessionsCount, 0);

      return {
        year,
        yearKey: String(year),
        yearTitle: `${year}년`,
        totalDistance: Math.round(yearDist * 100) / 100,
        totalSessionsCount: yearSessions,
        months: monthsResult,
      };
    });

    return yearlyResult;
  }, [trainingSessions, globalWeeklyDistanceMap]);

  // Target Race Schedule & Goal Pace Intensity Analysis (가장 가까운 대회부터 우선 정렬)
  const allUpcomingRacesAnalysis = useMemo<TargetRacePlanAnalysis[]>(() => {
    return analyzeAllUpcomingRacesForTrainingPlan(races, goals, evalSelectedDistance);
  }, [races, goals, evalSelectedDistance]);

  const [selectedAnalyzedRaceIndex, setSelectedAnalyzedRaceIndex] = useState<number>(0);

  // Active race analysis: default to closest upcoming race (index 0)
  const activeRaceIndex = selectedAnalyzedRaceIndex < allUpcomingRacesAnalysis.length ? selectedAnalyzedRaceIndex : 0;
  const targetRaceAnalysis = allUpcomingRacesAnalysis.length > 0 ? allUpcomingRacesAnalysis[activeRaceIndex] : null;

  // Auto-detected course based on upcoming registered races
  const autoDetectedCourse = useMemo<'10K' | '하프' | '풀코스'>(() => {
    if (targetRaceAnalysis?.course) {
      const c = targetRaceAnalysis.course;
      if (c.includes('10')) return '10K';
      if (c.includes('하프') || c.includes('21')) return '하프';
      return '풀코스';
    }
    const upcoming = (races || []).find((r) => {
      if (!r.date || r.status === 'completed' || r.actualRecord) return false;
      const d = calculateDDay(r.date);
      return !d.isPassed && d.daysDiff >= 0;
    });
    if (upcoming?.course) {
      const c = upcoming.course;
      if (c.includes('10')) return '10K';
      if (c.includes('하프') || c.includes('21')) return '하프';
      return '풀코스';
    }
    return evalSelectedDistance;
  }, [targetRaceAnalysis, races, evalSelectedDistance]);

  // Intelligent situation-adaptive speed workout type based on race D-Days, periodization phase, and workload
  const resolvedAutoSpeedType: SpeedWorkoutType = useMemo(() => {
    if (!targetRaceAnalysis) return '인터벌';
    if (targetRaceAnalysis.isRaceThisWeek) return '변속주(파틀렉)';

    // Directly respect the speed repetition note from race plan analysis
    const repNote = targetRaceAnalysis.taperingSpeedRepNote || '';
    if (repNote.includes('800m')) return '800m 인터벌';
    if (repNote.includes('400m') || repNote.includes('숏')) return '400m 숏 인터벌';
    if (repNote.includes('크루즈')) return '크루즈 인터벌';
    if (repNote.includes('1~3k')) return '1~3k 인터벌';
    if (repNote.includes('인터벌')) return '인터벌';
    if (repNote.includes('템포런') || repNote.includes('역치')) return '템포런';
    if (repNote.includes('파틀렉') || repNote.includes('변속주')) return '변속주(파틀렉)';
    if (repNote.includes('빌드업')) return '빌드업주';

    if (targetRaceAnalysis.periodizationPhase.includes('테이퍼링')) {
      return targetRaceAnalysis.dDayDays <= 7 ? '변속주(파틀렉)' : '크루즈 인터벌';
    }
    if (targetRaceAnalysis.periodizationPhase.includes('회복')) return '빌드업주';
    if (targetRaceAnalysis.periodizationPhase.includes('피크') || targetRaceAnalysis.periodizationPhase.includes('Peak')) {
      return (targetRaceAnalysis.course || '').includes('풀') ? '800m 인터벌' : '인터벌';
    }
    if (targetRaceAnalysis.periodizationPhase.includes('빌드업') || targetRaceAnalysis.periodizationPhase.includes('Build')) {
      return '인터벌';
    }
    if (targetRaceAnalysis.periodizationPhase.includes('기초') || targetRaceAnalysis.periodizationPhase.includes('Base')) {
      return '템포런';
    }
    if (targetRaceAnalysis.dDayWeeks <= 3) return '인터벌';
    return '1~3k 인터벌';
  }, [targetRaceAnalysis]);

  const effectiveSpeedType = autoPointMode ? resolvedAutoSpeedType : customSpeedType;
  const effectiveCourse = autoPointMode ? autoDetectedCourse : evalSelectedDistance;

  // Handle Weekly Plan Regenerate with Custom Options
  const handleGenerateWeeklyPlan = async () => {
    if (customTrainingDays.length === 0) {
      alert('최소 1일 이상의 훈련 요일을 선택해주세요.');
      return;
    }

    const ok = await verifyRunnerSecurityKey('AI 주간 훈련 계획 맞춤 생성');
    if (!ok) return;

    const settings: WeeklyPlanSettings = {
      trainingDays: customTrainingDays,
      speedDay: customSpeedDay,
      speedWorkoutType: effectiveSpeedType,
      longRunDay: customLongRunDay,
      targetRaceCourse: effectiveCourse,
      updatedAt: new Date().toISOString(),
    };

    const newPlan = generateWeeklyTrainingPlan(currentVDOT, effectiveCourse, {
      trainingDays: customTrainingDays,
      speedDay: customSpeedDay,
      speedWorkoutType: effectiveSpeedType,
      longRunDay: customLongRunDay,
      trainingSessions,
      shoes,
      races,
      goals,
    });
    await onSaveWeeklyPlan(newPlan, settings);
  };

  // Active weekly plan (if empty, generate default with custom options; enrich with shoe recommendations)
  const activePlan = useMemo(() => {
    if (weeklyPlan && weeklyPlan.length > 0) {
      const planWithShoes = attachShoeRecommendationsToPlan(weeklyPlan, shoes, trainingSessions);
      return enrichWeeklyPlanWithActualSessions(planWithShoes, trainingSessions, runnerStateAnalysis, targetRaceAnalysis, races);
    }
    return generateWeeklyTrainingPlan(currentVDOT, effectiveCourse, {
      trainingDays: customTrainingDays,
      speedDay: customSpeedDay,
      speedWorkoutType: effectiveSpeedType,
      longRunDay: customLongRunDay,
      trainingSessions,
      shoes,
      races,
      goals,
    });
  }, [
    weeklyPlan,
    currentVDOT,
    effectiveCourse,
    effectiveSpeedType,
    customTrainingDays,
    customSpeedDay,
    customLongRunDay,
    trainingSessions,
    shoes,
    races,
    goals,
    runnerStateAnalysis,
    targetRaceAnalysis,
  ]);

  // Helper to parse filename into date and training title
  // Example filename: "20260924_10km 빌드업 런.csv", "2026-09-24_템포런.csv", "2025.10.12_10km 인터벌.csv", "2026.10.02.csv"
  const parseFilename = (fileName: string): { dateStr: string; sessionTitle: string } => {
    const baseName = fileName.replace(/\.[^/.]+$/, '').trim();

    // 1. Matches YYYY.MM.DD, YYYY-MM-DD, YYYY_MM_DD with optional title (e.g. "2026.10.02", "2026-10-02_조깅", "2026.10.02 (1)")
    const dotOrDashMatch = baseName.match(/^(\d{4})[-._](\d{1,2})[-._](\d{1,2})(?:[_\s-]+(.*))?$/);
    if (dotOrDashMatch) {
      const year = dotOrDashMatch[1];
      const month = dotOrDashMatch[2].padStart(2, '0');
      const day = dotOrDashMatch[3].padStart(2, '0');
      const rawTitle = (dotOrDashMatch[4] || '').trim();
      const cleanTitle = rawTitle.replace(/^\(\d+\)$/, '').trim();
      return {
        dateStr: `${year}-${month}-${day}`,
        sessionTitle: cleanTitle || '가민 임포트 훈련',
      };
    }

    // 2. Matches 8-digit YYYYMMDD with optional title (e.g. "20261002", "20261002_훈련")
    const eightDigitMatch = baseName.match(/^(\d{4})(\d{2})(\d{2})(?:[_\s-]+(.*))?$/);
    if (eightDigitMatch) {
      const year = eightDigitMatch[1];
      const month = eightDigitMatch[2];
      const day = eightDigitMatch[3];
      const rawTitle = (eightDigitMatch[4] || '').trim();
      const cleanTitle = rawTitle.replace(/^\(\d+\)$/, '').trim();
      return {
        dateStr: `${year}-${month}-${day}`,
        sessionTitle: cleanTitle || '가민 임포트 훈련',
      };
    }

    // 3. Search for any date pattern embedded anywhere in filename (e.g. "garmin_2026-10-02_morning", "activity_2026.10.02")
    const embeddedMatch = baseName.match(/(\d{4})[-._](\d{1,2})[-._](\d{1,2})/);
    if (embeddedMatch) {
      const year = embeddedMatch[1];
      const month = embeddedMatch[2].padStart(2, '0');
      const day = embeddedMatch[3].padStart(2, '0');
      const cleanTitle = baseName
        .replace(/(\d{4})[-._](\d{1,2})[-._](\d{1,2})/, '')
        .replace(/^[_\s-]+|[_\s-]+$/g, '')
        .replace(/^\(\d+\)$/, '')
        .trim();
      return {
        dateStr: `${year}-${month}-${day}`,
        sessionTitle: cleanTitle || '가민 임포트 훈련',
      };
    }

    // 4. Fallback if underscore separated
    const underscoreIndex = baseName.indexOf('_');
    if (underscoreIndex !== -1) {
      const prefix = baseName.substring(0, underscoreIndex).trim();
      const titlePart = baseName.substring(underscoreIndex + 1).trim();
      if (/^\d{8}$/.test(prefix)) {
        return {
          dateStr: `${prefix.substring(0, 4)}-${prefix.substring(4, 6)}-${prefix.substring(6, 8)}`,
          sessionTitle: titlePart || '가민 임포트 훈련',
        };
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(prefix)) {
        return {
          dateStr: prefix,
          sessionTitle: titlePart || '가민 임포트 훈련',
        };
      }
    }

    // 5. Default fallback to current local date
    const now = new Date();
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    return {
      dateStr: `${localYear}-${localMonth}-${localDay}`,
      sessionTitle: baseName || '가민 임포트 훈련',
    };
  };

  // Helper to extract value by multiple possible keys (case-insensitive, whitespace trimmed, unit stripped)
  const getRowValue = (row: Record<string, any>, candidateKeys: string[]): string => {
    // 1. Direct exact key check
    for (const k of candidateKeys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
    }
    // 2. Normalized row keys (and unit stripped)
    const normalizedRowKeys = Object.keys(row).map((k) => {
      const lower = k.toLowerCase().replace(/[\s()_\[\]]/g, '');
      const stripped = lower.replace(/(?:bpm|min\/km|보\/분|ms|w\/kg|kcal|w|c|m|km)$/i, '');
      return {
        raw: k,
        norm: lower,
        stripped,
      };
    });
    for (const k of candidateKeys) {
      const targetNorm = k.toLowerCase().replace(/[\s()_\[\]]/g, '');
      const targetStripped = targetNorm.replace(/(?:bpm|min\/km|보\/분|ms|w\/kg|kcal|w|c|m|km)$/i, '');
      const found = normalizedRowKeys.find(
        (rk) =>
          rk.norm === targetNorm ||
          rk.stripped === targetStripped ||
          rk.norm.includes(targetNorm) ||
          rk.stripped.includes(targetStripped) ||
          targetNorm.includes(rk.norm) ||
          targetStripped.includes(rk.stripped)
      );
      if (
        found &&
        row[found.raw] !== undefined &&
        row[found.raw] !== null &&
        String(row[found.raw]).trim() !== ''
      ) {
        return String(row[found.raw]).trim();
      }
    }
    return '';
  };

  // Helper to parse distance in km
  const parseDistanceKm = (raw: string): number => {
    if (!raw) return 0;
    let clean = raw.replace(/[^\d.,]/g, '').trim();
    if (clean.includes(',') && !clean.includes('.')) {
      clean = clean.replace(',', '.');
    } else if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/,/g, '');
    }
    const val = parseFloat(clean);
    if (isNaN(val)) return 0;
    if (val > 250) {
      return Math.round((val / 1000) * 100) / 100;
    }
    return Math.round(val * 100) / 100;
  };

  // Helper to parse heart rate
  const parseHeartRate = (raw: string): number => {
    if (!raw) return 0;
    const num = parseInt(raw.replace(/[^\d]/g, ''), 10);
    return isNaN(num) ? 0 : num;
  };

  // Helper to format pace string to M'SS"
  const formatPace = (raw: string): string => {
    if (!raw || raw === '--' || raw === '-') return '';
    const clean = raw.trim();
    if (/^\d+[':]\d{2}"?$/.test(clean)) {
      const parts = clean.replace(/"/g, '').split(/[':]/);
      let mins = parseInt(parts[0], 10);
      let secs = parseInt(parts[1], 10);
      if (secs >= 60) {
        secs = 59;
      }
      return `${mins}'${secs.toString().padStart(2, '0')}"`;
    }
    const match = clean.match(/(\d+):(\d{2})(?::\d{2})?/);
    if (match) {
      let mins = parseInt(match[1], 10);
      let secs = parseInt(match[2], 10);
      if (secs >= 60) {
        secs = 59;
      }
      return `${mins}'${secs.toString().padStart(2, '0')}"`;
    }
    return clean;
  };

  // Helper to convert time string into total seconds
  const timeToSeconds = (timeStr: string): number => {
    if (!timeStr) return 0;
    const clean = timeStr.split('.')[0].trim();
    const parts = clean.split(':').map((p) => parseInt(p, 10));
    if (parts.some(isNaN)) return 0;
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  // Helper to convert seconds per km to M'SS" pace (내림 처리하여 5'60" 대신 5'59" 보장)
  const secondsToPace = (secondsPerKm: number): string => {
    if (!secondsPerKm || isNaN(secondsPerKm) || !isFinite(secondsPerKm) || secondsPerKm <= 0) {
      return "5'00\"";
    }
    const totalSec = Math.floor(secondsPerKm);
    const mins = Math.floor(totalSec / 60);
    const secs = Math.min(59, totalSec % 60);
    return `${mins}'${secs.toString().padStart(2, '0')}"`;
  };

  // Helper to normalize time string (e.g. "00:48:20" or "48:20")
  const normalizeTimeString = (raw: string): string => {
    if (!raw) return '00:00:00';
    const clean = raw.split('.')[0].trim();
    const parts = clean.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const mins = parts[0];
      const secs = parts[1];
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hours.toString().padStart(2, '0')}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return `${parts[0].toString().padStart(2, '0')}:${parts[1].toString().padStart(2, '0')}:${parts[2].toString().padStart(2, '0')}`;
    }
    return clean;
  };

  // Helper to parse a single CSV file with PapaParse
  const parseSingleCsvFile = (file: File): Promise<Omit<TrainingSession, 'id' | 'createdAt'>[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const data = (results.data as Record<string, any>[]).filter((row) => {
              return Object.values(row).some(
                (val) => val !== null && val !== undefined && String(val).trim() !== ''
              );
            });

            if (data.length === 0) {
              resolve([]);
              return;
            }

            // Extract date and title from filename
            const { dateStr: fileDate, sessionTitle: fileTitle } = parseFilename(file.name);

            // Check if the CSV is a multi-activity list (each row is a separate activity with '제목' or '활동 유형' column)
            const firstRow = data[0];
            const hasActivityTypeCol = Object.keys(firstRow).some((k) =>
              /활동\s*유형|activity\s*type/i.test(k)
            );
            const hasMultiDateRows =
              data.length > 2 &&
              data.some(
                (r, i) =>
                  i > 0 &&
                  getRowValue(r, ['날짜', 'date', '일자']) !==
                    getRowValue(data[0], ['날짜', 'date', '일자'])
              );

            if (hasActivityTypeCol && hasMultiDateRows) {
              const multiSessions: Omit<TrainingSession, 'id' | 'createdAt'>[] = [];
              for (const row of data) {
                const titleVal =
                  getRowValue(row, ['제목', 'title', '활동명', '이름', 'name']) || fileTitle;
                const rawDate = getRowValue(row, ['날짜', 'date', '일자', '시간', 'start time']);
                let itemDate = fileDate;
                if (rawDate) {
                  const m = rawDate.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
                  if (m) {
                    itemDate = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
                  }
                }
                const distKm = parseDistanceKm(
                  getRowValue(row, ['거리 km', '거리', 'distance', '총 거리'])
                );
                const timeStr = normalizeTimeString(
                  getRowValue(row, ['시간', 'time', '경과 시간', '이동 시간'])
                );
                const paceStr =
                  formatPace(
                    getRowValue(row, ['평균 페이스 min/km', '평균 페이스', 'avg pace', 'pace'])
                  ) || "5'00\"";
                const avgHr = parseHeartRate(
                  getRowValue(row, [
                    '평균 심박 bpm',
                    '평균 심박',
                    '평균심박',
                    '평균 심박수',
                    'avg hr',
                    'avg heart rate',
                    '심박',
                    'hr',
                    'bpm',
                  ])
                );
                const maxHr = parseHeartRate(
                  getRowValue(row, [
                    '최대심박 bpm',
                    '최대심박',
                    '최대 심박',
                    '최대 심박수',
                    'max hr',
                    'max heart rate',
                    '최고 심박',
                    '최고심박',
                    'peak hr',
                  ])
                );
                const cals = parseHeartRate(
                  getRowValue(row, ['칼로리 C', '칼로리', 'calories', '소모 칼로리'])
                );

                if (distKm > 0 || timeStr !== '00:00:00') {
                  multiSessions.push({
                    date: itemDate,
                    title: titleVal,
                    totalDistanceKm: distKm,
                    totalTime: timeStr,
                    avgPace: paceStr,
                    avgHr,
                    maxHr: maxHr > 0 ? maxHr : avgHr,
                    laps: [],
                    notes: cals > 0 ? `소모 칼로리: ${cals} kcal` : '',
                  });
                }
              }
              resolve(multiSessions);
              return;
            }

            // Standard Garmin Workout Lap CSV file (one workout with multiple lap rows)
            const laps: TrainingLap[] = [];
            let summaryRow: Record<string, any> | null = null;
            let cumSec = 0;

            data.forEach((row) => {
              const splitVal = getRowValue(row, ['구간', 'split', 'lap', '랩']);
              const isSummary =
                splitVal.includes('요약') ||
                splitVal.toLowerCase().includes('summary') ||
                splitVal.includes('합계') ||
                splitVal.includes('전체');

              if (isSummary) {
                summaryRow = row;
                return;
              }

              const lapDist = parseDistanceKm(
                getRowValue(row, ['거리 km', '거리', 'distance', '구간 거리', '총 거리'])
              );
              const lapTime = normalizeTimeString(
                getRowValue(row, ['시간', 'time', '구간 시간', '이동 시간'])
              );
              const lapPace = formatPace(
                getRowValue(row, ['평균 페이스 min/km', '평균 페이스', 'avg pace', 'pace'])
              );
              const lapGap = formatPace(
                getRowValue(row, ['평균 GAP min/km', '평균 gap', 'gap'])
              );
              const lapHr = parseHeartRate(
                getRowValue(row, [
                  '평균 심박 bpm',
                  '평균 심박',
                  '평균심박',
                  '평균 심박수',
                  'avg hr',
                  'avg heart rate',
                  '심박',
                  'heart rate',
                  'hr',
                  'bpm',
                ])
              );
              const lapMaxHr = parseHeartRate(
                getRowValue(row, [
                  '최대심박 bpm',
                  '최대심박',
                  '최대 심박',
                  '최대 심박수',
                  'max hr',
                  'max heart rate',
                  '최고 심박',
                  '최고심박',
                  'peak hr',
                ])
              );

              if (lapDist > 0 || lapTime !== '00:00:00') {
                const lapNum = parseInt(splitVal.replace(/[^\d]/g, ''), 10) || laps.length + 1;
                cumSec += timeToSeconds(lapTime);
                const cumH = Math.floor(cumSec / 3600);
                const cumM = Math.floor((cumSec % 3600) / 60);
                const cumS = cumSec % 60;
                const cumTimeStr = `${cumH.toString().padStart(2, '0')}:${cumM.toString().padStart(2, '0')}:${cumS.toString().padStart(2, '0')}`;

                laps.push({
                  lap: lapNum,
                  distanceKm: lapDist,
                  time: lapTime,
                  cumulativeTime: cumTimeStr,
                  avgPace: lapPace || "5'00\"",
                  avgGap: lapGap || undefined,
                  avgHr: lapHr,
                  maxHr: lapMaxHr > 0 ? lapMaxHr : lapHr,
                });
              }
            });

            // Calculate overall session aggregates
            let totalDist = 0;
            let totalTime = '00:00:00';
            let avgPace = "5'00\"";
            let avgHr = 0;
            let maxHr = 0;
            let totalCalories = 0;

            if (summaryRow) {
              totalDist = parseDistanceKm(
                getRowValue(summaryRow, ['거리 km', '거리', 'distance', '총 거리'])
              );
              totalTime = normalizeTimeString(
                getRowValue(summaryRow, ['시간', 'time', '경과 시간', '이동 시간'])
              );
              avgPace =
                formatPace(
                  getRowValue(summaryRow, ['평균 페이스 min/km', '평균 페이스', 'avg pace'])
                ) || avgPace;
              avgHr = parseHeartRate(
                getRowValue(summaryRow, [
                  '평균 심박 bpm',
                  '평균 심박',
                  '평균심박',
                  '평균 심박수',
                  'avg hr',
                  'avg heart rate',
                  '심박',
                  'heart rate',
                  'hr',
                  'bpm',
                ])
              );
              maxHr = parseHeartRate(
                getRowValue(summaryRow, [
                  '최대심박 bpm',
                  '최대심박',
                  '최대 심박',
                  '최대 심박수',
                  'max hr',
                  'max heart rate',
                  '최고 심박',
                  '최고심박',
                  'peak hr',
                ])
              );
              totalCalories = parseHeartRate(
                getRowValue(summaryRow, ['칼로리 C', '칼로리', 'calories', '소모 칼로리'])
              );
            }

            if (totalDist === 0 && laps.length > 0) {
              totalDist = Math.round(laps.reduce((acc, l) => acc + l.distanceKm, 0) * 100) / 100;
            }

            if (totalTime === '00:00:00' && laps.length > 0) {
              const totalSec = laps.reduce((acc, l) => acc + timeToSeconds(l.time), 0);
              const hrs = Math.floor(totalSec / 3600);
              const mins = Math.floor((totalSec % 3600) / 60);
              const secs = totalSec % 60;
              totalTime = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }

            if ((!avgPace || avgPace === "5'00\"") && totalDist > 0) {
              const totalSec = timeToSeconds(totalTime);
              if (totalSec > 0) {
                avgPace = secondsToPace(totalSec / totalDist);
              }
            }

            if (avgHr === 0 && laps.length > 0) {
              const validHrLaps = laps.filter((l) => (l.avgHr || 0) > 0);
              if (validHrLaps.length > 0) {
                const sumHr = validHrLaps.reduce((acc, l) => acc + (l.avgHr || 0), 0);
                avgHr = Math.round(sumHr / validHrLaps.length);
              }
            }

            if (maxHr === 0 && laps.length > 0) {
              maxHr = Math.max(...laps.map((l) => l.maxHr || 0));
            }

            const rowTitle = getRowValue(firstRow, ['제목', 'title', '활동명']);
            const finalTitle =
              fileTitle && fileTitle !== '가민 임포트 훈련' ? fileTitle : rowTitle || fileTitle;

            const session: Omit<TrainingSession, 'id' | 'createdAt'> = {
              date: fileDate,
              title: finalTitle,
              totalDistanceKm: totalDist,
              totalTime,
              avgPace,
              avgHr,
              maxHr: maxHr > 0 ? maxHr : avgHr,
              laps,
              notes: totalCalories > 0 ? `소모 칼로리: ${totalCalories} kcal` : '',
            };

            resolve([session]);
          } catch (err) {
            reject(err);
          }
        },
        error: (err) => {
          reject(err);
        },
      });
    });
  };

  // Handle Multi-file CSV Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setIsUploadingCsv(true);
      const parsedResults = await Promise.all(files.map((f) => parseSingleCsvFile(f)));
      const allSessions = parsedResults
        .flat()
        .filter((s) => s.totalDistanceKm > 0 || s.totalTime !== '00:00:00');

      if (allSessions.length === 0) {
        alert('CSV 파일에서 유효한 훈련 기록을 찾을 수 없습니다.');
        return;
      }

      // Sort descending by date
      allSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setPendingCsvItems(allSessions);
      setIsCsvModalOpen(true);
    } catch (err) {
      console.error('CSV Parsing Error:', err);
      alert('CSV 파일 파싱 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
    } finally {
      setIsUploadingCsv(false);
      e.target.value = '';
    }
  };

  // Save CSV items from modal
  const handleSaveCsvItems = async (items: Omit<TrainingSession, 'id' | 'createdAt'>[]) => {
    // Enrich with shoeName if shoeId exists and shoeName is missing
    const enriched = items.map((item) => {
      if (item.shoeId && !item.shoeName) {
        const found = shoes.find((sh) => sh.id === item.shoeId);
        if (found) {
          return { ...item, shoeName: found.name };
        }
      }
      return item;
    });

    if (onAddBatchTrainingSessions) {
      await onAddBatchTrainingSessions(enriched);
    } else {
      for (const item of enriched) {
        await onAddTrainingSession(item);
      }
    }
  };

  const toggleYear = (year: number, defaultOpen: boolean = false) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !(prev[year] ?? defaultOpen),
    }));
  };

  const toggleMonth = (mKey: string, defaultOpen: boolean = false) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [mKey]: !(prev[mKey] ?? defaultOpen),
    }));
  };

  const toggleSessionDetail = (sId: string) => {
    setExpandedSessions((prev) => ({ ...prev, [sId]: !prev[sId] }));
  };

  return (
    <div className="space-y-8 animate-fadeIn text-stone-800 dark:text-stone-100">
      {/* 1. 훈련 기록 관리 */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-emerald-600/20 dark:border-stone-800 shadow-sm bg-white/95 dark:bg-stone-900/95 text-stone-800 dark:text-stone-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-xl border border-rose-700/40 shadow-xs">
              <Activity className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <span>훈련 기록 관리</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-mono font-bold">
                  {trainingSessions.length}회 기록
                </span>
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                등록된 러닝 훈련 세션의 페이스·심박수 및 연도·월별 기록을 관리합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* CSV File Upload Input (다중 파일 지원, 날짜_훈련제목 형식) */}
            <label className="h-10 px-3.5 text-xs font-bold text-white bg-gradient-to-r from-rose-800 to-rose-900 hover:from-rose-700 hover:to-rose-800 rounded-xl transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap border border-rose-700">
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" />
              <span>{isUploadingCsv ? 'CSV 분석 중...' : '가민 CSV 업로드'}</span>
              <input
                type="file"
                accept=".csv"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploadingCsv}
              />
            </label>

            {/* Clear All Sessions Button (visible when sessions exist) */}
            {trainingSessions.length > 0 && (
              <button
                onClick={async () => {
                  const ok = await verifyRunnerSecurityKey('등록된 모든 훈련 기록 초기화 및 전체 삭제');
                  if (ok && onClearAllTrainingSessions) {
                    await onClearAllTrainingSessions();
                  }
                }}
                className="h-10 px-3 text-xs font-semibold text-rose-800 dark:text-rose-300 hover:text-rose-950 dark:hover:text-rose-100 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 border border-rose-300 dark:border-rose-800 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                title="모든 훈련 기록 전체 삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>전체 삭제</span>
              </button>
            )}

            {/* Today's Workout Direct Log Button */}
            {onOpenTodayWorkoutModal && (
              <button
                type="button"
                onClick={onOpenTodayWorkoutModal}
                className="h-10 px-4 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 border border-emerald-500"
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>+ 직접 기록</span>
              </button>
            )}
          </div>
        </div>


        {/* View Mode Switcher: 리스트 보기 vs 달력 보기 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-700 dark:text-stone-300">보기 모드:</span>
            <div className="inline-flex p-1 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-2xs">
              <button
                type="button"
                onClick={() => setSessionViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  sessionViewMode === 'list'
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-750'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>리스트 보기</span>
                <span className="text-[10px] font-mono opacity-80">({trainingSessions.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSessionViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  sessionViewMode === 'calendar'
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-750'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>달력 보기 (캘린더)</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-stone-500 dark:text-stone-400">
            {sessionViewMode === 'calendar' ? (
              <span>날짜별 칸을 클릭하면 해당 날짜의 훈련 상세 정보와 러닝화 지정이 가능합니다.</span>
            ) : (
              <span>월별·주차별 마일리지와 랩 스플릿 차트를 확인하세요.</span>
            )}
          </div>
        </div>

        {/* Calendar View */}
        {sessionViewMode === 'calendar' && (
          <TrainingCalendarView
            sessions={trainingSessions}
            shoes={shoes}
            onOpenShoeModal={(s) => setShoeModalSession(s)}
            onShareSession={(s) => setSharingSession(s)}
            onDeleteSession={onDeleteTrainingSession}
            onOpenTodayWorkoutModal={onOpenTodayWorkoutModal}
          />
        )}

        {/* List View: Yearly & Monthly Accordion of Training Sessions */}
        {sessionViewMode === 'list' && (
          groupedYearlyTraining.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800">
            <Activity className="w-10 h-10 text-stone-400 mx-auto mb-2" />
            <p className="text-sm text-stone-600 dark:text-stone-300">등록된 훈련 기록이 없습니다.</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              가민 등에서 추출한 CSV 파일을 업로드하여 훈련 일지를 등록해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedYearlyTraining.map((yearGroup, yearIndex) => {
              const isYearExpanded = expandedYears[yearGroup.year] ?? (yearIndex === 0);

              return (
                <div
                  key={yearGroup.yearKey}
                  className="rounded-2xl bg-stone-50/80 dark:bg-stone-900 border border-emerald-600/20 dark:border-emerald-500/30 overflow-hidden shadow-2xs"
                >
                  {/* Year Accordion Header */}
                  <button
                    onClick={() => toggleYear(yearGroup.year, yearIndex === 0)}
                    className="w-full p-4 sm:p-4.5 flex items-center justify-between text-left hover:bg-emerald-50 dark:hover:bg-stone-850 transition-colors cursor-pointer bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                        {isYearExpanded ? (
                          <ChevronDown className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-stone-500 dark:text-stone-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base sm:text-lg font-bold font-athletic text-stone-900 dark:text-white tracking-wide">
                            {yearGroup.yearTitle}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold border border-stone-200 dark:border-stone-700">
                            {yearGroup.months.length}개 월
                          </span>
                        </div>
                        <span className="text-xs text-stone-500 dark:text-stone-400">
                          {yearGroup.totalSessionsCount}회 훈련 세션 완료
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm px-2.5 sm:px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-athletic font-bold shadow-2xs">
                        연간 {yearGroup.totalDistance} km
                      </span>
                    </div>
                  </button>

                  {/* Months in this Year */}
                  {isYearExpanded && (
                    <div className="p-3.5 sm:p-4 space-y-3.5 bg-stone-50/50 dark:bg-stone-950/40">
                      {yearGroup.months.map((monthGroup, mIdx) => {
                        const isMonthExpanded = expandedMonths[monthGroup.monthKey] ?? (yearIndex === 0 && mIdx === 0);

                        return (
                          <div
                            key={monthGroup.monthKey}
                            className="rounded-xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 overflow-hidden shadow-2xs"
                          >
                            {/* Month Accordion Header */}
                            <button
                              onClick={() => toggleMonth(monthGroup.monthKey, yearIndex === 0 && mIdx === 0)}
                              className="w-full p-3.5 sm:p-4 flex items-center justify-between text-left hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                {isMonthExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-stone-400 dark:text-stone-500" />
                                )}
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                  <span className="text-sm sm:text-base font-bold text-stone-900 dark:text-white whitespace-nowrap">{monthGroup.monthTitle}</span>
                                  <span className="text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap">
                                    ({monthGroup.totalSessionsCount}회 훈련 · 총 {monthGroup.totalDistance}km)
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-athletic font-bold whitespace-nowrap">
                                  월간 {monthGroup.totalDistance} km
                                </span>
                              </div>
                            </button>

                            {/* Weeks in this Month */}
                            {isMonthExpanded && (
                              <div className="p-3 sm:p-4 pt-1 space-y-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/60">
                      {monthGroup.weeks.map((weekGroup) => (
                        <div
                          key={weekGroup.weekKey}
                          className="rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 p-3.5 space-y-3 shadow-2xs"
                        >
                          {/* Monday ~ Sunday Week Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-stone-200 dark:border-stone-700">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Calendar className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                              <span className="text-xs font-bold text-stone-900 dark:text-white">
                                {weekGroup.weekLabel}
                              </span>
                              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                                ({weekGroup.sessions.length}회 훈련)
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                              <span className="text-[11px] text-stone-500 dark:text-stone-400">주간 마일리지:</span>
                              <span className="text-xs font-bold font-athletic text-emerald-900 dark:text-emerald-300 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800">
                                {weekGroup.weeklyDistance} km
                              </span>
                            </div>
                          </div>

                          {/* Sessions in this week (Sorted descending by date) */}
                          <div className="space-y-3">
                            {weekGroup.sessions.map((session, sIdx) => {
                              const isDetailOpen = expandedSessions[session.id] ?? false;

                              return (
                                <div
                                  key={`sess_${session.id || 'item'}_${sIdx}`}
                                  className="rounded-xl p-3.5 border border-stone-200 dark:border-stone-700 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all bg-white dark:bg-stone-850 shadow-2xs"
                                >
                                  {/* Summary Card Header */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="text-xs font-mono text-emerald-900 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                          {session.date}
                                        </span>

                                        {/* Running Shoe Indicator & Quick Selector Modal Trigger */}
                                        {(() => {
                                          const displayShoe =
                                            session.shoeName ||
                                            (session.shoeId
                                              ? shoes.find((sh) => sh.id === session.shoeId)?.name
                                              : undefined);
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => setShoeModalSession(session)}
                                              className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                                                displayShoe
                                                  ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-semibold'
                                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:text-stone-900 dark:hover:text-white hover:border-emerald-300 hover:bg-stone-200 dark:hover:bg-stone-750'
                                              }`}
                                              title="착용 러닝화 입력 / 선택"
                                            >
                                              <span>👟</span>
                                              <span className="font-medium">
                                                {displayShoe ? displayShoe : '+ 러닝화 입력'}
                                              </span>
                                            </button>
                                          );
                                        })()}
                                      </div>
                                      <h4 className="text-sm font-bold text-stone-900 dark:text-white keep-all">
                                        {session.title}
                                      </h4>
                                      {session.notes && (
                                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 keep-all">{session.notes}</p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                                      <button
                                        onClick={() => setSharingSession(session)}
                                        className="px-2.5 py-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                                        title="기록 요약 이미지 저장 및 SNS 공유"
                                      >
                                        <Share2 className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span>공유/이미지 저장</span>
                                      </button>

                                      <button
                                        onClick={() => toggleSessionDetail(session.id)}
                                        className="px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-750 border border-stone-200 dark:border-stone-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                                      >
                                        <span>{isDetailOpen ? '상세 접기' : '상세 (랩 분석)'}</span>
                                        {isDetailOpen ? (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronRight className="w-3.5 h-3.5" />
                                        )}
                                      </button>

                                      <button
                                        onClick={async () => {
                                          const ok = await verifyRunnerSecurityKey(
                                            `'${session.title}' 훈련 기록 삭제`
                                          );
                                          if (ok) onDeleteTrainingSession(session.id);
                                        }}
                                        className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                        title="삭제 (비밀번호 확인)"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Summary Metrics */}
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-750 text-xs">
                                    <div>
                                      <div className="text-[10px] text-stone-500">총 훈련 거리</div>
                                      <div className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white font-athletic">
                                        {session.totalDistanceKm} <span className="text-[10px] font-normal text-stone-500">km</span>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-stone-500">총 소요 시간</div>
                                      <div className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white font-athletic">
                                        {session.totalTime}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-stone-500">평균 페이스</div>
                                      <div className="text-sm sm:text-base font-extrabold text-emerald-800 dark:text-emerald-300 font-athletic">
                                        {session.avgPace} <span className="text-[10px] font-normal text-stone-500">/km</span>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-stone-500">평균 / 최대 심박</div>
                                      <div className="text-sm sm:text-base font-extrabold text-rose-900 dark:text-rose-300 font-athletic">
                                        {session.avgHr} <span className="text-[10px] font-normal text-stone-500">/ {session.maxHr} bpm</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Detail Lap-by-Lap Table (Expands on "상세" click) */}
                                  {isDetailOpen && session.laps && session.laps.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800 animate-fadeIn">
                                      <div className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2 flex items-center justify-between">
                                        <span>구간 랩(Lap) 상세 분석표</span>
                                        <span className="text-[11px] text-stone-500">
                                          총 {session.laps.length}개 랩
                                        </span>
                                      </div>

                                      <div className="overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-750">
                                        <table className="w-full text-left text-xs">
                                          <thead className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-b border-stone-200 dark:border-stone-700 font-semibold">
                                            <tr>
                                              <th className="p-2 sm:p-2.5">랩 #</th>
                                              <th className="p-2 sm:p-2.5">시간</th>
                                              <th className="p-2 sm:p-2.5">누적 시간</th>
                                              <th className="p-2 sm:p-2.5">거리</th>
                                              <th className="p-2 sm:p-2.5">평균 페이스</th>
                                              <th className="p-2 sm:p-2.5 hidden sm:table-cell">GAP</th>
                                              <th className="p-2 sm:p-2.5">평균 심박</th>
                                              <th className="p-2 sm:p-2.5">최대 심박</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-stone-200 dark:divide-stone-750 font-mono">
                                            {session.laps.map((lap, lIdx) => (
                                              <tr
                                                key={lIdx}
                                                className="hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                                              >
                                                <td className="p-2 sm:p-2.5 font-bold text-stone-900 dark:text-white">
                                                  Lap {lap.lap}
                                                </td>
                                                <td className="p-2 sm:p-2.5 text-stone-700 dark:text-stone-300">{lap.time}</td>
                                                <td className="p-2 sm:p-2.5 text-stone-500">
                                                  {lap.cumulativeTime}
                                                </td>
                                                <td className="p-2 sm:p-2.5 text-emerald-800 dark:text-emerald-400 font-bold">
                                                  {lap.distanceKm} km
                                                </td>
                                                <td className="p-2 sm:p-2.5 text-emerald-700 dark:text-emerald-300">
                                                  {lap.avgPace}
                                                </td>
                                                <td className="p-2 sm:p-2.5 text-stone-500 hidden sm:table-cell">
                                                  {lap.avgGap || '-'}
                                                </td>
                                                <td className="p-2 sm:p-2.5 text-rose-800 dark:text-rose-300">
                                                  {lap.avgHr} bpm
                                                </td>
                                                <td className="p-2 sm:p-2.5 text-rose-900 dark:text-rose-200 font-bold">
                                                  {lap.maxHr} bpm
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
      </section>

      {/* AI 다음 주 맞춤 훈련 강도 추천 (회복 / 유지 / 강화) */}
      <TrainingIntensityRecommender
        sessions={trainingSessions}
        vdot={currentVDOT}
        targetRaceCourse={evalSelectedDistance}
        shoes={shoes}
      />

      {/* 4. 일자별 주간훈련 상세계획표 */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-emerald-600/20 dark:border-stone-800 shadow-sm bg-white/95 dark:bg-stone-900/95 text-stone-800 dark:text-stone-100 overflow-hidden w-full max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 min-w-0 w-full">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-xl border border-rose-700/40 shadow-xs flex-shrink-0">
              <Calendar className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>일자별 주간 맞춤 훈련 상세계획표</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold whitespace-nowrap">
                  AI Periodization
                </span>
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400 keep-all">
                참가 대회 일정과 목표 페이스를 종합 분석하여 매주 최적의 주기화 훈련 계획을 수립합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <button
              onClick={() => setIsCustomizingPlan((prev) => !prev)}
              className="px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-750 border border-stone-300 dark:border-stone-700 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>{isCustomizingPlan ? '설정 패널 접기' : '훈련 요일/포인트 설정'}</span>
            </button>
            <button
              onClick={handleGenerateWeeklyPlan}
              className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap border border-emerald-500"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI 맞춤 계획표 생성</span>
            </button>
          </div>
        </div>

        {/* Target Race Schedule & Goal Pace Intensity Analysis Banner */}
        {targetRaceAnalysis ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-50/80 via-amber-50/50 to-emerald-50/80 dark:from-stone-850 dark:via-stone-850 dark:to-stone-850 border border-emerald-300 dark:border-stone-700 shadow-sm mb-5 space-y-3 text-stone-800 dark:text-stone-100 animate-fadeIn">
            {/* Multi-race selector tabs: sorted closest to farthest */}
            {allUpcomingRacesAnalysis.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-stone-200/70 dark:border-stone-700/70 mb-2">
                <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 whitespace-nowrap">대회별 강도분석 (가까운 순):</span>
                {allUpcomingRacesAnalysis.map((r, idx) => (
                  <button
                    key={r.raceId || idx}
                    type="button"
                    onClick={() => setSelectedAnalyzedRaceIndex(idx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
                      activeRaceIndex === idx
                        ? 'bg-rose-900 text-white border-rose-950 shadow-2xs'
                        : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-emerald-400'
                    }`}
                  >
                    <span>{idx === 0 ? (r.dDayDays === 0 ? '🏆 1순위 (오늘 결승 레이스!)' : '🥇 1순위 (가장 가까운 대회)') : `${idx + 1}순위 대회`}</span>
                    <span className="font-mono text-[11px] opacity-90">{r.dDayDays === 0 ? 'D-Day (오늘)' : `D-${r.dDayDays}일`}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10">{r.importanceGrade.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 dark:border-stone-700/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-xl shadow-xs">
                  <Target className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                      <span>참가 대회 일정 & 목표 페이스 강도 연동 분석</span>
                    </h3>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold font-athletic">
                      {targetRaceAnalysis.dDayDays === 0
                        ? '🏆 D-Day (오늘 결승 레이스!)'
                        : `D-${targetRaceAnalysis.dDayDays}일 (${targetRaceAnalysis.dDayWeeks}주 전)`}
                    </span>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold">
                      {targetRaceAnalysis.periodizationPhase}
                    </span>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold">
                      {targetRaceAnalysis.paceIntensityLevel}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5">
                    <strong>{targetRaceAnalysis.raceName}</strong> ({targetRaceAnalysis.course} · {targetRaceAnalysis.raceDate}) 대회 목표에 맞춰 주간 훈련 볼륨과 테이퍼링 강도를 세밀하게 연동합니다.
                  </p>
                </div>
              </div>

              {/* Target Pace Hero Stat */}
              <div className="flex items-center gap-3 bg-white dark:bg-stone-800 p-2.5 px-4 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xs self-start sm:self-auto flex-shrink-0">
                <div className="text-right">
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold">대회 목표 페이스</div>
                  <div className="text-base sm:text-lg font-black text-rose-900 dark:text-rose-300 font-athletic">
                    {targetRaceAnalysis.targetRacePace} <span className="text-xs font-normal text-stone-500 dark:text-stone-400">/km</span>
                  </div>
                </div>
                <div className="h-7 w-px bg-stone-200 dark:bg-stone-700" />
                <div className="text-left">
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold">목표 완주 시간</div>
                  <div className="text-xs font-bold text-stone-900 dark:text-white font-mono">
                    {targetRaceAnalysis.targetFinishTime}
                  </div>
                </div>
              </div>
            </div>

            {/* 3-Column Periodization & Tapering Modulation Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-white/95 dark:bg-stone-800/90 border border-emerald-200 dark:border-emerald-800 space-y-1 shadow-2xs">
                <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>주기화 전략 ({targetRaceAnalysis.periodizationPhase})</span>
                </span>
                <p className="text-[11px] text-stone-700 dark:text-stone-300 leading-relaxed">
                  {targetRaceAnalysis.phaseDescription}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/95 dark:bg-stone-800/90 border border-amber-200 dark:border-amber-800 space-y-1 shadow-2xs">
                <span className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>목표 페이스 강도 & 훈련 지침</span>
                </span>
                <p className="text-[11px] text-stone-700 dark:text-stone-300 leading-relaxed">
                  {targetRaceAnalysis.strategicAdvice}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/95 dark:bg-stone-800/90 border border-rose-200 dark:border-rose-800 space-y-1 shadow-2xs">
                <span className="font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
                  <span>
                    테이퍼링 세밀 조율 ({targetRaceAnalysis.taperingVolumeCutPct > 0 ? `-${targetRaceAnalysis.taperingVolumeCutPct}% 감량` : '볼륨 유지'})
                  </span>
                </span>
                <p className="text-[11px] text-stone-700 dark:text-stone-300 leading-relaxed">
                  {targetRaceAnalysis.taperingIntensityStrategy}
                </p>
                <div className="text-[11px] text-rose-900 dark:text-rose-200 font-semibold pt-1.5 border-t border-rose-200 dark:border-rose-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 leading-snug">
                  <span className="whitespace-nowrap">🏃 LSD: <strong>{targetRaceAnalysis.taperingLsdDistKm}km</strong></span>
                  <span className="break-words">⚡ 스피드: <strong>{targetRaceAnalysis.taperingSpeedRepNote}</strong></span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
              <span className="text-[11px] text-stone-600 dark:text-stone-300 flex items-center gap-1.5 flex-wrap">
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">✓ 훈련 계획표 연동:</span>
                <span>
                  대회 일정과 목표 페이스({targetRaceAnalysis.targetRacePace}/km)에 따라 주간 볼륨과 테이퍼링 강도가 아래 계획표에 세분화되어 반영됩니다.
                </span>
              </span>
              <button
                type="button"
                onClick={handleGenerateWeeklyPlan}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-2xs flex items-center gap-1.5 flex-shrink-0 cursor-pointer self-start sm:self-auto"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>이 대회 맞춤 테이퍼링 계획표 즉시 갱신</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-stone-50 via-emerald-50/30 to-stone-50 border border-stone-200/80 shadow-2xs mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 text-xs text-stone-700 animate-fadeIn">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-gradient-to-br from-stone-200 to-stone-300 text-stone-700 rounded-xl shadow-2xs flex-shrink-0">
                <Target className="w-5 h-5 text-stone-700" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                    현재 참가 예정인 목표 대회가 없습니다.
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold">
                    기본 유산소 체력 유지 모드
                  </span>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-300 keep-all">
                  {races && races.length > 0
                    ? '등록된 이전 마라톤 대회가 모두 완료되었습니다! 출전할 다음 목표 대회를 등록하시면 실시간 D-Day 카운트다운과 목표 페이스 주기화 훈련이 자동으로 연동됩니다.'
                    : '출전할 마라톤 대회를 등록하시면 실시간 D-Day 카운트다운과 목표 페이스 주기화(테이퍼링) 훈련이 스마트하게 연동됩니다.'}
                </p>
              </div>
            </div>

            {onNavigateToRaces && (
              <button
                type="button"
                onClick={onNavigateToRaces}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-2xs flex items-center gap-1.5 flex-shrink-0 cursor-pointer self-start sm:self-auto transition-all whitespace-nowrap"
              >
                <Calendar className="w-4 h-4" />
                <span>참가 예정 대회 등록하기</span>
              </button>
            )}
          </div>
        )}


        {/* Shoe Mileage Analytics Card (Expandable in Running Records tab) */}
        {showShoeAnalytics && (
          <div className="mb-6 animate-fadeIn">
            <ShoeMileageAnalyticsCard
              shoes={shoes}
              sessions={trainingSessions}
            />
          </div>
        )}

        {/* Training Days & Point Workouts Customization Form */}
        {isCustomizingPlan && (
          <div className="p-4 sm:p-5 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 mb-6 space-y-4 text-stone-800 dark:text-stone-100">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
              <span className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-emerald-700" />
                <span>훈련 요일 및 포인트 훈련 지정</span>
              </span>
              <span className="text-[11px] text-stone-500">
                선택한 요일 외의 날은 자동 '휴식일'로 배치됩니다.
              </span>
            </div>

            {/* 1. 훈련 요일 다중 선택 */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-2">
                1️⃣ 주간 훈련 요일 선택 (복수 선택):
              </label>
              <div className="grid grid-cols-7 gap-1 sm:gap-2 w-full min-w-0">
                {(['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'] as DayOfWeek[]).map((day) => {
                  const isSelected = customTrainingDays.includes(day);
                  const isSpeed = customSpeedDay === day;
                  const isLongRun = customLongRunDay === day;

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          // Prevent unselecting if it's the last one
                          if (customTrainingDays.length <= 1) return;
                          setCustomTrainingDays((prev) => prev.filter((d) => d !== day));
                          if (customSpeedDay === day) setCustomSpeedDay('없음');
                          if (customLongRunDay === day) setCustomLongRunDay('없음');
                        } else {
                          setCustomTrainingDays((prev) => [...prev, day]);
                        }
                      }}
                      className={`py-2 px-0.5 sm:px-1 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 min-w-0 overflow-hidden ${
                        isSelected
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-200 font-bold shadow-2xs'
                          : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-750'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-bold truncate">{day.replace('요일', '')}</span>
                      <span className="text-[10px] hidden sm:inline font-normal truncate">
                        {isSelected ? '훈련' : '휴식'}
                      </span>
                      {(isSpeed || isLongRun) && (
                        <span
                          className={`text-[8px] sm:text-[9px] px-1 py-0.2 rounded font-mono truncate max-w-full font-bold ${
                            isSpeed
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {isSpeed ? '스피드' : '장거리'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. 포인트 훈련 요일 지정 & 상황 맞춤 AI 자동 결정 */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700 space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    2️⃣ 포인트 훈련 요일 지정 (핵심)
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  세부종목·목표거리 AI 자동 결정
                </span>
              </div>

              {/* Point Training Days Selection (Only Days!) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Speed Workout Day */}
                <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-rose-200 dark:border-rose-900/60 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>⚡ 스피드 포인트 요일</span>
                    </label>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400">VO2max / 역치 훈련</span>
                  </div>
                  <select
                    value={customSpeedDay}
                    onChange={(e) => {
                      const val = e.target.value as DayOfWeek | '없음';
                      setCustomSpeedDay(val);
                      if (val !== '없음' && !customTrainingDays.includes(val)) {
                        setCustomTrainingDays((prev) => [...prev, val]);
                      }
                    }}
                    className="w-full bg-stone-50 dark:bg-stone-750 border border-stone-300 dark:border-stone-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-800 dark:text-stone-100 focus:outline-none focus:border-rose-400"
                  >
                    <option value="없음">스피드 훈련 없음 (일반 조깅)</option>
                    {customTrainingDays.map((d) => (
                      <option key={d} value={d}>
                        {d} {customLongRunDay === d ? '(장거리와 겹침)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Long Run Day */}
                <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-emerald-200 dark:border-emerald-900/60 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>🏃 장거리 포인트 (LSD) 요일</span>
                    </label>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400">지구력 / 완주력 극대화</span>
                  </div>
                  <select
                    value={customLongRunDay}
                    onChange={(e) => {
                      const val = e.target.value as DayOfWeek | '없음';
                      setCustomLongRunDay(val);
                      if (val !== '없음' && !customTrainingDays.includes(val)) {
                        setCustomTrainingDays((prev) => [...prev, val]);
                      }
                    }}
                    className="w-full bg-stone-50 dark:bg-stone-750 border border-stone-300 dark:border-stone-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-800 dark:text-stone-100 focus:outline-none focus:border-emerald-400"
                  >
                    <option value="없음">장거리 훈련 없음 (일반 조깅)</option>
                    {customTrainingDays.map((d) => (
                      <option key={d} value={d}>
                        {d} {customSpeedDay === d ? '(스피드와 겹침)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* AI Situation-Adaptive Auto Optimization Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50 via-teal-50 to-indigo-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-indigo-950/40 border border-emerald-300 dark:border-emerald-700/50 text-xs text-stone-800 dark:text-stone-200 space-y-2">
                <div className="flex items-center gap-2 font-black text-emerald-950 dark:text-emerald-300">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>세부종목 및 목표거리 AI 상황 맞춤 자동 결정</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold ml-auto shadow-2xs">
                    기본 적용됨
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
                  복잡한 종목 계산이나 마일리지 설정을 직접 하실 필요가 없습니다. <strong>포인트 요일만 지정</strong>하시면, 등록된 2~3개 대회 일정(남은 D-Day)과 주기화 단계, VDOT 및 최근 러닝 기록에 맞추어 주차별 최적 종목과 거리를 시스템이 알아서 배정합니다.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  <span className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-emerald-200 dark:border-emerald-700 font-mono whitespace-nowrap">
                    🏃 LSD(장거리): <strong className="text-emerald-800 dark:text-emerald-300">{targetRaceAnalysis ? `${targetRaceAnalysis.taperingLsdDistKm}km` : (effectiveCourse === '풀코스' ? '26km' : effectiveCourse === '하프' ? '18km' : '14km')}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-rose-200 dark:border-rose-700 font-mono whitespace-nowrap">
                    ⚡ 스피드 종목: <strong className="text-rose-800 dark:text-rose-300">{effectiveSpeedType}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-indigo-200 dark:border-indigo-700 font-mono whitespace-nowrap">
                    📏 기준 대회 코스: <strong className="text-indigo-800 dark:text-indigo-300">{effectiveCourse}</strong>
                  </span>
                  {targetRaceAnalysis && (
                    <span className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 truncate max-w-full">
                      연계 대회: {targetRaceAnalysis.raceName} (D-{targetRaceAnalysis.dDayDays}일)
                    </span>
                  )}
                </div>
              </div>

              {/* Optional Collapsible: Advanced Manual Settings */}
              <div className="pt-1 border-t border-stone-200 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setShowAdvancedPlanSettings(!showAdvancedPlanSettings)}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-white hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-750 border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                    <span>고급 세부 설정 (세부종목·목표거리 직접 수동 지정 필요 시)</span>
                  </div>
                  <span className="text-[11px] text-stone-500 font-mono">
                    {showAdvancedPlanSettings ? '▲ 접기' : '▼ 직접 지정 펼치기'}
                  </span>
                </button>

                {showAdvancedPlanSettings && (
                  <div className="mt-2.5 space-y-3 p-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 animate-fadeIn">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-700">
                      <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoPointMode}
                          onChange={(e) => setAutoPointMode(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>스마트 자동 최적화 유지 (권장)</span>
                      </label>
                      <span className="text-[10px] text-stone-500">
                        체크 해제 시 아래 수동 설정값이 적용됩니다.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                          스피드 세부 종목 직접 지정
                        </label>
                        <select
                          value={customSpeedType}
                          onChange={(e) => {
                            setCustomSpeedType(e.target.value as SpeedWorkoutType);
                            setAutoPointMode(false);
                          }}
                          className="w-full bg-stone-50 dark:bg-stone-750 border border-stone-300 dark:border-stone-600 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 dark:text-stone-100"
                        >
                          <optgroup label="🟢 저강도 포인트 (존3 구간)">
                            <option value="존3 마라톤 페이스주">🎯 존3 마라톤 페이스주</option>
                            <option value="존3 모더레이트런">🏃 존3 모더레이트런</option>
                            <option value="존3 유산소 역치주">🌿 존3 유산소 역치주</option>
                          </optgroup>
                          <optgroup label="🟡 중강도 포인트 (역치 구간)">
                            <option value="템포런">🔥 템포런</option>
                            <option value="크루즈 인터벌">⏱️ 크루즈 인터벌</option>
                            <option value="1~3k 인터벌">🎯 1~3k 인터벌</option>
                            <option value="변속주(파틀렉)">⚡ 변속주 / 파틀렉</option>
                            <option value="빌드업주">📈 빌드업주</option>
                          </optgroup>
                          <optgroup label="🔴 고강도 포인트 (VO2max 인터벌)">
                            <option value="인터벌">⚡ 1000m 인터벌</option>
                            <option value="800m 인터벌">💥 800m 인터벌</option>
                            <option value="400m 숏 인터벌">🌪️ 400m 숏 인터벌</option>
                            <option value="언덕훈련">⛰️ 언덕 질주 훈련</option>
                          </optgroup>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                          목표 레이스 거리 직접 지정
                        </label>
                        <select
                          value={evalSelectedDistance}
                          onChange={(e) => {
                            setEvalSelectedDistance(e.target.value as '10K' | '하프' | '풀코스');
                            setAutoPointMode(false);
                          }}
                          className="w-full bg-stone-50 dark:bg-stone-750 border border-stone-300 dark:border-stone-600 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 dark:text-stone-100"
                        >
                          <option value="풀코스">풀코스 (LSD 26km 권장)</option>
                          <option value="하프">하프 마라톤 (LSD 18km 권장)</option>
                          <option value="10K">10K (LSD 14km 권장)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="text-[11px] text-stone-600 dark:text-stone-400 bg-white dark:bg-stone-800 p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 flex items-center justify-between">
              <span>
                💡 포인트 요일을 지정한 후 우측 상단의 <strong>[AI 맞춤 계획표 생성]</strong>을 누르면 요일별 세부 종목, 심박존, 강도, 목표 페이스가 최적으로 자동 계산되어 반영됩니다.
              </span>
            </div>
          </div>
        )}

        {/* Runner State & Mileage Trend Analysis Summary Card */}
        {runnerStateAnalysis && (
          <div className="p-4 sm:p-5 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 mb-6 space-y-4 text-stone-800 dark:text-stone-100 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200">
                  <BarChart3 className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <span>러너 실훈련 상태 & 주간 마일리지 추세 정밀 진단</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        runnerStateAnalysis.fatigueRisk === '안전(스위트스팟)'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : runnerStateAnalysis.fatigueRisk === '주의(과부하 위험)'
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      {runnerStateAnalysis.fatigueRisk}
                    </span>
                  </h3>
                  <div className="text-[11px] text-stone-500">
                    최근 4주간 실제 누적 마일리지와 ACWR(급성:만성 운동부하비)를 실시간 반영하여 주간 거리와 강도를 맞춤 세팅합니다.
                  </div>
                </div>
              </div>

              {/* Status Trend Pill */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[11px] text-stone-500">마일리지 추세:</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 border ${
                    runnerStateAnalysis.mileageTrend === '증가세'
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                      : runnerStateAnalysis.mileageTrend === '감소세'
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-stone-300 dark:border-stone-700'
                  }`}
                >
                  {runnerStateAnalysis.mileageTrend === '증가세' ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-700" />
                  ) : runnerStateAnalysis.mileageTrend === '감소세' ? (
                    <ArrowDownRight className="w-3.5 h-3.5 text-amber-700" />
                  ) : (
                    <Compass className="w-3.5 h-3.5 text-stone-600" />
                  )}
                  <span>
                    {runnerStateAnalysis.mileageTrend} ({runnerStateAnalysis.trendRatio >= 0 ? '+' : ''}
                    {runnerStateAnalysis.trendRatio}%)
                  </span>
                </span>
              </div>
            </div>

            {/* 4 Stat Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 min-w-0">
              <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 min-w-0 shadow-2xs">
                <div className="text-[10px] text-stone-500 dark:text-stone-400 keep-all">최근 4주 평균 마일리지</div>
                <div className="text-base sm:text-lg font-black text-stone-900 dark:text-white font-athletic mt-0.5 truncate">
                  {runnerStateAnalysis.avgWeeklyMileage4Weeks}{' '}
                  <span className="text-xs font-normal text-stone-500 dark:text-stone-400">km/주</span>
                </div>
                <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 truncate">
                  피크 주간: <span className="text-stone-700 dark:text-stone-300 font-semibold">{runnerStateAnalysis.peakWeeklyDistance}km</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 min-w-0 shadow-2xs">
                <div className="text-[10px] text-stone-500 dark:text-stone-400 keep-all">직전 주간 마일리지 (Acute)</div>
                <div className="text-base sm:text-lg font-black text-emerald-800 dark:text-emerald-300 font-athletic mt-0.5 truncate">
                  {runnerStateAnalysis.lastWeekDistance}{' '}
                  <span className="text-xs font-normal text-stone-500 dark:text-stone-400">km</span>
                </div>
                <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 truncate">
                  월~일: <span className="text-emerald-900 dark:text-emerald-300 font-mono font-semibold">{runnerStateAnalysis.lastWeekLabel || '지난주'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 min-w-0 shadow-2xs">
                <div className="text-[10px] text-stone-500 dark:text-stone-400 keep-all">ACWR (운동 부하 비율)</div>
                <div
                  className={`text-base sm:text-lg font-black font-athletic mt-0.5 truncate ${
                    runnerStateAnalysis.acwr > 1.35
                      ? 'text-rose-800 dark:text-rose-400'
                      : runnerStateAnalysis.acwr < 0.75
                      ? 'text-amber-800 dark:text-amber-400'
                      : 'text-emerald-800 dark:text-emerald-300'
                  }`}
                >
                  {runnerStateAnalysis.acwr}{' '}
                  <span className="text-[10px] font-normal text-stone-500 dark:text-stone-400 font-sans">
                    (0.8~1.3)
                  </span>
                </div>
                <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 truncate">
                  부상 안전도: <span className="text-emerald-800 dark:text-emerald-300 font-semibold">{runnerStateAnalysis.fatigueRisk}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 min-w-0 shadow-2xs">
                <div className="text-[10px] text-emerald-900 dark:text-emerald-300 font-semibold keep-all">AI 권장 주간 총 볼륨</div>
                <div className="text-base sm:text-lg font-black text-emerald-800 dark:text-emerald-300 font-athletic mt-0.5 truncate">
                  {runnerStateAnalysis.recommendedWeeklyKm}{' '}
                  <span className="text-xs font-normal text-stone-500 dark:text-stone-400">km</span>
                </div>
                <div className="text-[10px] text-stone-600 dark:text-stone-400 mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5 leading-tight">
                  <span>LSD: <strong className="text-rose-900 dark:text-rose-300 font-semibold">{runnerStateAnalysis.longRunRecommendedKm}km</strong></span>
                  <span>/</span>
                  <span>스피드: <strong className="text-amber-900 dark:text-amber-300 font-semibold">{runnerStateAnalysis.speedVolumeRecommendedKm}km</strong></span>
                </div>
              </div>
            </div>

            {/* Target Race Data Weighting Diagnosis Section (참가 대회 데이터 강도 & 테이퍼링 정밀 진단) */}
            {runnerStateAnalysis.raceWeightDetail && (() => {
              const rDetail = runnerStateAnalysis.raceWeightDetail;

              return (
                <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-emerald-50/90 via-amber-50/60 to-rose-50/80 dark:from-emerald-950/40 dark:via-stone-850 dark:to-stone-900 border border-emerald-300 dark:border-emerald-700/60 shadow-2xs space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/70 dark:border-emerald-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                        <Target className="w-3 h-3 text-white" />
                        <span>참가 대회 가중치 & 테이퍼링 정밀 반영</span>
                      </span>
                      <strong className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white">
                        {rDetail.raceName} ({rDetail.dDayDays === 0 ? '🏆 D-Day 오늘 결승 레이스' : `D-${rDetail.dDayDays}일`} · {rDetail.course})
                      </strong>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                        목표 강도: {rDetail.paceIntensityLevel} ({rDetail.targetRacePace}/km)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                        {rDetail.periodizationPhase}
                      </span>
                    </div>
                  </div>

                  {/* Tapering Scale Note Highlight */}
                  {rDetail.taperScaleNote && (
                    <div className="p-2 rounded-lg bg-emerald-100/70 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-[11px] text-emerald-950 dark:text-emerald-200 font-medium flex items-center gap-1.5">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300">🎯 테이퍼링 맞춤 조율:</span>
                      <span>{rDetail.taperScaleNote}</span>
                    </div>
                  )}

                  {/* Easy Run Cruise Load Physiological Insight Card */}
                  {rDetail.isEasyRunCruiseLoad && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-100/90 via-teal-100/80 to-amber-100/70 dark:from-emerald-950/60 dark:via-teal-950/40 dark:to-stone-900 border-2 border-emerald-400/80 dark:border-emerald-600 text-xs text-emerald-950 dark:text-emerald-100 space-y-1.5 shadow-2xs">
                      <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-300 text-xs sm:text-sm">
                        <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400 flex-shrink-0" />
                        <span>🌿 평소 이지런 연장 부하 (Zone 2 Easy Cruise) 맞춤 테이퍼링 진단</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-700 text-white font-mono">
                          감량 배제 (0~5%)
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-800 dark:text-stone-200 leading-relaxed keep-all">
                        {rDetail.easyRunCruiseNote ||
                          `${rDetail.course || '10K'} ${rDetail.targetRacePace} 페이스는 심박수 Zone 2(유산소 조깅) 영역으로, 평소 일상 이지런 대비 거리만 살짝 늘어난 가벼운 유산소 부하입니다. 젖산 축적과 근육 피로가 거의 없으므로 무리한 조기 감량은 불필요하며, 주간 마일리지를 온전히 유지하고 전날 가벼운 3~4km 리듬 조깅 또는 휴식만으로 최상의 컨디션을 맞춥니다.`}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold border-t border-emerald-300/60 dark:border-emerald-800/60">
                        <span>💡 권장 주말/주초 전략:</span>
                        <span className="text-stone-700 dark:text-stone-300 font-normal">
                          대회 전날 3~4km 가벼운 조깅 또는 휴식 ➡️ {rDetail.raceName} ({rDetail.course}) 편안한 유산소 완주 ➡️ 익일 가벼운 리커버리 후 정상 훈련 복귀
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-stone-700 dark:text-stone-300 leading-relaxed keep-all">
                    💡 <strong>가중치 분석 로직:</strong> 최근 4주 누적 기록(평균 {runnerStateAnalysis.avgWeeklyMileage4Weeks}km, ACWR {runnerStateAnalysis.acwr})과 
                    목표 페이스 강도(<strong>{rDetail.paceIntensityLevel}</strong>)를 복합 연산하여 
                    주간 총 권장 볼륨({runnerStateAnalysis.recommendedWeeklyKm}km)과 감량폭({rDetail.taperingVolumeCutPct > 0 ? `-${rDetail.taperingVolumeCutPct}%` : '감량 없이 100% 가동'}), 
                    포인트 세션(LSD {runnerStateAnalysis.longRunRecommendedKm}km / 스피드 {runnerStateAnalysis.speedVolumeRecommendedKm}km)의 거리와 강도가 맞춤 산출되었습니다.
                    <span className="text-stone-500 dark:text-stone-400 block pt-0.5">
                      * 목표 강도와 일정이 감안되어, 조기 감량으로 인한 심폐 엔진 저하를 막고 안전한 테이퍼링 및 훈련 흐름을 유지합니다.
                    </span>
                  </div>

                  {/* Multi-race roadmap list (closest first) */}
                  {allUpcomingRacesAnalysis.length > 1 && (
                    <div className="pt-2 border-t border-emerald-200/70 space-y-1.5">
                      <div className="text-[11px] font-bold text-stone-800 dark:text-stone-200 flex items-center justify-between">
                        <span>📋 참가 예정 대회 순서별 중요도 & 강도 로드맵 (가까운 순):</span>
                        <span className="text-[10px] text-stone-500 font-normal">총 {allUpcomingRacesAnalysis.length}개 대회</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                        {allUpcomingRacesAnalysis.map((r, i) => (
                          <div
                            key={r.raceId || i}
                            onClick={() => setSelectedAnalyzedRaceIndex(i)}
                            className={`p-2 rounded-lg border text-[11px] transition-all cursor-pointer ${
                              i === 0
                                ? 'bg-emerald-100/70 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700 font-medium'
                                : 'bg-white/80 dark:bg-stone-850/80 border-stone-200 dark:border-stone-700 hover:border-emerald-400'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold text-stone-900 dark:text-white">
                              <span className="flex items-center gap-1">
                                <span>{i === 0 ? (r.dDayDays === 0 ? '🏆 1순위 (오늘 대회)' : '🥇 1순위 (현재 연동)') : `${i + 1}순위`}</span>
                              </span>
                              <span className="text-rose-800 dark:text-rose-400 font-mono">{r.dDayDays === 0 ? 'D-Day (오늘)' : `D-${r.dDayDays}일`}</span>
                            </div>
                            <div className="truncate text-stone-800 dark:text-stone-200 font-semibold">{r.raceName} ({r.course})</div>
                            <div className="text-[10px] text-stone-600 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 font-medium text-stone-700 dark:text-stone-300">{r.importanceGrade.split(' ')[0]}</span>
                              <span>· {r.paceIntensityLevel.split(' ')[0]}</span>
                              <span>· {r.periodizationPhase.split(' ')[0]}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* This-Week Real Training Progress Tracker */}
            {runnerStateAnalysis.thisWeekLoggedKm !== undefined && runnerStateAnalysis.thisWeekLoggedKm > 0 && (
              <div className="p-3 rounded-xl bg-white dark:bg-stone-850 border border-emerald-300 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 font-bold text-[10px] border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                    <span>이번 주 실훈련 진행 현황</span>
                  </span>
                  <span className="text-stone-800 dark:text-stone-200 font-medium text-[11px]">
                    {runnerStateAnalysis.thisWeekDaysDone?.join(', ')} 훈련 완료 ({runnerStateAnalysis.thisWeekLoggedKm}km 소화)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-stone-500 dark:text-stone-400 text-[11px]">
                    남은 요일 권장 볼륨:{' '}
                    <strong className="text-emerald-800 dark:text-emerald-300 font-athletic text-sm">
                      {runnerStateAnalysis.remainingWeeklyPlanKm ?? Math.max(0, runnerStateAnalysis.recommendedWeeklyKm - runnerStateAnalysis.thisWeekLoggedKm)}km
                    </strong>
                  </span>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
                    / 주간 총 {runnerStateAnalysis.recommendedWeeklyKm}km
                  </span>
                </div>
              </div>
            )}

            {/* Recent 4-week miniature progress bar / breakdown */}
            {runnerStateAnalysis.recent4WeeksDistances.length > 0 && (
              <div className="p-3 rounded-xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 flex-shrink-0">
                  <span>📊 최근 4주 마일리지 추이:</span>
                </span>
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                  {runnerStateAnalysis.recent4WeeksDistances.map((rw, rIdx) => (
                    <div key={rIdx} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-stone-500 dark:text-stone-400">{rw.weekLabel}</span>
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-mono text-[11px] font-bold">
                        {rw.distanceKm}km
                      </span>
                      {rIdx < runnerStateAnalysis.recent4WeeksDistances.length - 1 && (
                        <span className="text-stone-400 dark:text-stone-600 text-[10px]">➡️</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed AI Tuning Feedback */}
            <div className="space-y-1.5 p-3 rounded-xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 text-xs shadow-2xs">
              <div className="flex items-start gap-2">
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex-shrink-0 font-bold">
                  거리 볼륨 제어
                </span>
                <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-[11px]">
                  {runnerStateAnalysis.mileageAdjustmentNote}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex-shrink-0 font-bold">
                  훈련 강도 조율
                </span>
                <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-[11px]">
                  {runnerStateAnalysis.intensityAdjustmentNote}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Schedule Table / Cards */}
        <div className="space-y-3">
          {activePlan.map((dayPlan, idx) => {
            const intensityBadgeColors = {
              낮음: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
              보통: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700',
              높음: 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-800',
              휴식: 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700',
            };

            const typeBadgeColors: Record<string, string> = {
              템포런: 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800',
              인터벌: 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-800',
              '800m 인터벌': 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-800',
              '400m 숏 인터벌': 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-800',
              '1~3k 인터벌': 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-800',
              '크루즈 인터벌': 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800',
              언덕훈련: 'bg-orange-100 dark:bg-orange-950/80 text-orange-900 dark:text-orange-300 border-orange-300 dark:border-orange-800',
              빌드업주: 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800',
              '변속주(파틀렉)': 'bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-800',
              LSD: 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
              조깅: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
              회복주: 'bg-teal-100 dark:bg-teal-950/80 text-teal-900 dark:text-teal-300 border-teal-300 dark:border-teal-800',
              휴식: 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700',
              대회: 'bg-rose-900 text-amber-300 border-rose-700 font-bold',
            };

            return (
              <div
                key={idx}
                className={`rounded-2xl p-3.5 sm:p-5 border transition-all flex flex-col xl:flex-row xl:items-start justify-between gap-4 min-w-0 w-full overflow-hidden ${
                  dayPlan.isCompleted
                    ? 'bg-gradient-to-r from-emerald-50/70 via-white to-white dark:from-emerald-950/30 dark:via-stone-900 dark:to-stone-900 border-emerald-400 dark:border-emerald-700 shadow-sm'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-2xs'
                }`}
              >
                {/* Day & Type & Details */}
                <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
                  <div className="w-14 sm:w-16 text-center py-2 px-1 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700 flex-shrink-0">
                    <div className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">{dayPlan.dayShort}</div>
                    <div className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white">{dayPlan.day}</div>
                    {dayPlan.dateStr && (
                      <div className="text-[9px] text-stone-400 dark:text-stone-500 font-mono mt-0.5">
                        {dayPlan.dateStr.slice(5)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border whitespace-nowrap flex-shrink-0 ${
                          typeBadgeColors[dayPlan.type] || 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                        }`}
                      >
                        {dayPlan.type}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium border whitespace-nowrap flex-shrink-0 ${
                          intensityBadgeColors[dayPlan.intensity]
                        }`}
                      >
                        강도: {dayPlan.intensity}
                      </span>
                      {dayPlan.isCompleted && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 shadow-2xs whitespace-nowrap flex-shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                          <span>실제 훈련 완료</span>
                        </span>
                      )}
                      {dayPlan.title.includes('D-DAY 목표 대회') ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-gradient-to-r from-amber-400 to-amber-500 text-stone-900 border border-amber-600 flex items-center gap-1 shadow-xs animate-pulse whitespace-nowrap flex-shrink-0">
                          <span>🏆 대회 결승 레이스 D-DAY</span>
                        </span>
                      ) : dayPlan.title.includes('테이퍼링') ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-rose-50 dark:bg-rose-950/70 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                          <Target className="w-3 h-3 text-rose-700 dark:text-rose-400" />
                          <span>대회 테이퍼링 감량 반영</span>
                        </span>
                      ) : targetRaceAnalysis && dayPlan.type !== '휴식' && !dayPlan.isCompleted && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                          <Target className="w-2.5 h-2.5 text-emerald-700 dark:text-emerald-400" />
                          <span>대회 주기화 연동</span>
                        </span>
                      )}
                      {!dayPlan.isCompleted && runnerStateAnalysis?.thisWeekLoggedKm && runnerStateAnalysis.thisWeekLoggedKm > 0 && dayPlan.type !== '휴식' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold whitespace-nowrap flex-shrink-0">
                          실훈련 반영 맞춤
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2 flex-wrap keep-all">
                      <span>{dayPlan.title}</span>
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5 leading-relaxed keep-all">
                      {dayPlan.description}
                    </p>

                    {/* Granular Split Pacing Stages (빌드업주 / 포인트 훈련 세부 구간표) */}
                    {dayPlan.stages && dayPlan.stages.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 min-w-0 w-full">
                        {dayPlan.stages.map((stg, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-2.5 rounded-lg bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-750 text-xs flex flex-col justify-between gap-1 shadow-2xs min-w-0"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-stone-900 dark:text-white text-[11px] truncate whitespace-nowrap">{stg.step}</span>
                              <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 whitespace-nowrap flex-shrink-0">
                                {stg.pace}/km
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-stone-600 dark:text-stone-400">
                              <span className="truncate">{stg.zone}</span>
                              <span className="text-stone-500 dark:text-stone-400 whitespace-nowrap font-medium">{stg.distanceKm}km</span>
                            </div>
                            <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-tight border-t border-stone-200 dark:border-stone-700 pt-1 mt-0.5 keep-all">
                              {stg.focus}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recommended Running Shoe & Rotation Rationale (기록된 훈련은 추천 신발 박스 제외) */}
                    {dayPlan.type !== '휴식' && !dayPlan.isCompleted && (
                      <div className="mt-3 p-2.5 rounded-xl bg-emerald-50/70 dark:bg-stone-850 border border-emerald-200 dark:border-stone-750 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-2xs min-w-0 w-full">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-stone-800 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-stone-700 flex-shrink-0">
                            <span className="text-base">👟</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-stone-600 dark:text-stone-400 font-semibold whitespace-nowrap">추천 러닝화:</span>
                              <strong className="text-stone-900 dark:text-white font-bold truncate max-w-[200px]">
                                {dayPlan.recommendedShoe?.shoeName || (shoes.length > 0 ? shoes[0].name : '보유 러닝화 미등록')}
                              </strong>
                              {dayPlan.recommendedShoe?.category && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-semibold whitespace-nowrap ${
                                    dayPlan.recommendedShoe.category === '스피드' ||
                                    dayPlan.recommendedShoe.category === '레이싱'
                                      ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                      : dayPlan.recommendedShoe.category === '장거리'
                                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                      : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  }`}
                                >
                                  {dayPlan.recommendedShoe.category}
                                </span>
                              )}
                            </div>
                            {dayPlan.recommendedShoe?.reason && (
                              <div className="text-[11px] text-stone-700 dark:text-stone-300 mt-0.5 flex items-start gap-1.5 keep-all">
                                <span className="text-emerald-700 dark:text-emerald-400 font-mono flex-shrink-0 mt-0.5">💡</span>
                                <span>{dayPlan.recommendedShoe.reason}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-3 sm:gap-5 self-stretch xl:self-center border-t xl:border-t-0 pt-2.5 xl:pt-0 border-stone-200 dark:border-stone-800 w-full xl:w-auto justify-between xl:justify-end flex-shrink-0 min-w-0 bg-stone-50 dark:bg-stone-850 xl:bg-transparent xl:dark:bg-transparent p-2.5 xl:p-0 rounded-xl">
                  <div className="text-left sm:text-center xl:text-right min-w-[65px]">
                    <div className="text-[10px] text-stone-500 whitespace-nowrap">
                      {dayPlan.isCompleted ? '실제 주행거리' : '목표 거리'}
                    </div>
                    <div className={`text-sm font-extrabold font-athletic whitespace-nowrap ${
                      dayPlan.isCompleted ? 'text-emerald-900 dark:text-emerald-400 text-base' : 'text-stone-900 dark:text-white'
                    }`}>
                      {dayPlan.distanceKm > 0 ? `${dayPlan.distanceKm} km` : '0 km'}
                    </div>
                  </div>

                  <div className="text-left sm:text-center xl:text-right min-w-[65px]">
                    <div className="text-[10px] text-stone-500 whitespace-nowrap">
                      {dayPlan.isCompleted ? '실제 평균페이스' : '목표 페이스'}
                    </div>
                    <div className="text-sm font-extrabold font-athletic whitespace-nowrap text-emerald-800">
                      {dayPlan.targetPace}
                    </div>
                  </div>

                  <div className="text-left sm:text-center xl:text-right min-w-[65px]">
                    <div className="text-[10px] text-stone-500 whitespace-nowrap">
                      {dayPlan.isCompleted ? '실제 심박/상태' : '목표 심박존'}
                    </div>
                    <div className="text-xs font-semibold text-rose-900 whitespace-nowrap">
                      {dayPlan.targetZone}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly Total Plan Summary Footer Bar */}
        <div className="mt-4 p-4 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs min-w-0 w-full text-stone-800 dark:text-stone-100">
          <div className="flex items-center gap-2 text-stone-700 dark:text-stone-200 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span className="keep-all">
              이번 주간 총 계획 거리:{' '}
              <strong className="text-stone-900 dark:text-white text-sm font-bold font-athletic whitespace-nowrap">
                {Math.round(activePlan.reduce((acc, d) => acc + (d.distanceKm || 0), 0) * 10) / 10} km
              </strong>{' '}
              <span className="text-stone-500 whitespace-nowrap">
                (주 {activePlan.filter((d) => d.type !== '휴식').length}일 훈련 / {activePlan.filter((d) => d.type === '휴식').length}일 휴식)
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500 dark:text-stone-400">
            <span className="whitespace-nowrap">
              스피드: <strong className="text-rose-900 dark:text-rose-300">{activePlan.find(d => ['인터벌', '템포런', '언덕훈련', '빌드업주', '변속주(파틀렉)'].includes(d.type) || (d.title && (d.title.includes('스피드') || d.title.includes('인터벌') || d.title.includes('템포런') || d.title.includes('빌드업') || d.title.includes('크루즈') || d.title.includes('언덕') || d.title.includes('모더레이트') || d.title.includes('포인트'))))?.distanceKm || 0}km</strong>
            </span>
            <span>•</span>
            <span className="whitespace-nowrap">
              장거리(LSD): <strong className="text-purple-900 dark:text-purple-300">{activePlan.find(d => d.type === 'LSD' || d.title.includes('LSD') || d.title.includes('장거리'))?.distanceKm || 0}km</strong>
            </span>
            <span>•</span>
            <span className="whitespace-nowrap">
              유산소/회복: <strong className="text-emerald-800 dark:text-emerald-300">
                {Math.round(activePlan.filter(d => (d.type === '조깅' || d.type === '회복주') && !d.title.includes('포인트') && !d.title.includes('모더레이트') && !d.title.includes('스피드') && !d.title.includes('LSD') && !d.title.includes('장거리')).reduce((acc, d) => acc + d.distanceKm, 0) * 10) / 10}km
              </strong>
            </span>
          </div>
        </div>
      </section>

      {/* Garmin Multi-file CSV Upload Modal */}
      {isCsvModalOpen && (
        <Suspense fallback={null}>
          <CsvWorkoutUploadModal
            isOpen={isCsvModalOpen}
            parsedItems={pendingCsvItems}
            shoes={shoes}
            existingSessions={trainingSessions}
            onSave={handleSaveCsvItems}
            onClose={() => {
              setIsCsvModalOpen(false);
              setPendingCsvItems([]);
            }}
          />
        </Suspense>
      )}

      {/* Training Share & Image Export Modal */}
      {sharingSession && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
              <div className="bg-stone-900 border border-emerald-500/40 rounded-2xl p-6 text-center text-white space-y-2">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
                <p className="text-xs text-stone-300">캔버스 이미지 생성기를 불러오는 중입니다...</p>
              </div>
            </div>
          }
        >
          <TrainingShareModal
            session={sharingSession}
            vdot={currentVDOT}
            runnerTierName={runnerTier.label}
            onClose={() => setSharingSession(null)}
          />
        </Suspense>
      )}

      {/* Training Shoe Input & Selector Modal */}
      {shoeModalSession && (
        <TrainingShoeModal
          session={shoeModalSession}
          shoes={shoes}
          recentSessions={trainingSessions}
          onSave={async (shoeName, shoeId) => {
            if (onUpdateTrainingSession) {
              await onUpdateTrainingSession(shoeModalSession.id, { shoeName, shoeId });
            }
          }}
          onClose={() => setShoeModalSession(null)}
        />
      )}
    </div>
  );
};
