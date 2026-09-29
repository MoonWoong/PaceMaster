import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Activity,
  Heart,
  TrendingUp,
  Award,
  Upload,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
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
} from 'lucide-react';
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
} from '../types';
import {
  estimateBestVDOT,
  calculateHeartRateZones,
  getTrainingPaces,
  getRunnerTier,
  evaluateRunningGoal,
  formatPace,
} from '../lib/vdot';
import {
  generateWeeklyTrainingPlan,
  analyzeRunnerState,
  enrichWeeklyPlanWithActualSessions,
  DayOfWeek,
  PlanCustomOptions,
} from '../lib/trainingPlanGenerator';
import { attachShoeRecommendationsToPlan } from '../lib/shoeRecommender';
import { verifyRunnerSecurityKey } from '../lib/security';
import { TrainingShareModal } from './TrainingShareModal';
import { TrainingAnalyticsDashboard } from './TrainingAnalyticsDashboard';
import { TrainingIntensityRecommender } from './TrainingIntensityRecommender';
import { TrainingShoeModal } from './TrainingShoeModal';
import { TrainingCalendarView } from './TrainingCalendarView';
import { CsvWorkoutUploadModal, ParsedCsvUploadItem } from './CsvWorkoutUploadModal';
import { ShoeMileageAnalyticsCard } from './ShoeMileageAnalyticsCard';
import { GoalProgressBarSection } from './GoalProgressBarSection';

interface TabRunningRecordsProps {
  records: RunningRecords;
  goals: RunningGoals;
  trainingSessions: TrainingSession[];
  weeklyPlan: WeeklyPlanDay[];
  weeklyPlanSettings?: WeeklyPlanSettings;
  shoes?: RunningShoe[];
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
  onOpenPaceCalculator?: () => void;
  onOpenTodayWorkoutModal?: () => void;
  onNavigateToShoes?: () => void;
}

export const TabRunningRecords: React.FC<TabRunningRecordsProps> = ({
  records,
  goals,
  trainingSessions,
  weeklyPlan,
  weeklyPlanSettings,
  shoes = [],
  onSaveRecords,
  onSaveGoals,
  onAddTrainingSession,
  onAddBatchTrainingSessions,
  onUpdateTrainingSession,
  onDeleteTrainingSession,
  onClearAllTrainingSessions,
  onSaveWeeklyPlan,
  onOpenPaceCalculator,
  onOpenTodayWorkoutModal,
  onNavigateToShoes,
}) => {
  // Session Shoe Modal State
  const [shoeModalSession, setShoeModalSession] = useState<TrainingSession | null>(null);
  // CSV Upload & Memo Modal State
  const [pendingCsvItems, setPendingCsvItems] = useState<ParsedCsvUploadItem[]>([]);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false);
  // Shoe Analytics Toggle State
  const [showShoeAnalytics, setShowShoeAnalytics] = useState<boolean>(false);
  // Running Records State
  const [pb5k, setPb5k] = useState(records.pb5k || '00:21:00');
  const [pb10k, setPb10k] = useState(records.pb10k || '00:43:30');
  const [pbHalf, setPbHalf] = useState(records.pbHalf || '01:36:00');
  const [pbFull, setPbFull] = useState(records.pbFull || '03:25:00');
  const [maxHr, setMaxHr] = useState(records.maxHr ? records.maxHr.toString() : '190');
  const [thresholdHr, setThresholdHr] = useState(
    records.thresholdHr ? records.thresholdHr.toString() : '172'
  );
  const [isSavingRecords, setIsSavingRecords] = useState(false);

  // Goals State
  const [target10k, setTarget10k] = useState(goals.target10k || '00:39:59');
  const [targetHalf, setTargetHalf] = useState(goals.targetHalf || '01:29:59');
  const [targetFull, setTargetFull] = useState(goals.targetFull || '03:09:59');
  const [evalSelectedDistance, setEvalSelectedDistance] = useState<'10K' | '하프' | '풀코스'>(
    '풀코스'
  );

  // Accordion expanded state for training sessions (최신 연도 기본 열림)
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({});
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  // Training Sessions View Mode: 'list' (리스트 보기) vs 'calendar' (달력 보기)
  const [sessionViewMode, setSessionViewMode] = useState<'list' | 'calendar'>('list');

  // Share Modal State
  const [sharingSession, setSharingSession] = useState<TrainingSession | null>(null);

  // CSV Upload parsing error / status
  const [csvStatus, setCsvStatus] = useState<string>('');

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
    return estimateBestVDOT({
      pb5k,
      pb10k,
      pbHalf,
      pbFull,
    });
  }, [pb5k, pb10k, pbHalf, pbFull]);

  const currentVDOT = currentBest.vdot;
  const runnerTier = useMemo(() => getRunnerTier(currentVDOT), [currentVDOT]);
  const hrZones = useMemo(
    () => calculateHeartRateZones(parseInt(maxHr, 10) || 185, parseInt(thresholdHr, 10) || 170),
    [maxHr, thresholdHr]
  );
  const trainingPaces = useMemo(() => getTrainingPaces(currentVDOT), [currentVDOT]);

  // 2. AI Goal Evaluation
  const targetTimeForEval =
    evalSelectedDistance === '10K'
      ? target10k
      : evalSelectedDistance === '하프'
      ? targetHalf
      : targetFull;

  const goalEvaluation = useMemo(() => {
    return evaluateRunningGoal(currentVDOT, evalSelectedDistance, targetTimeForEval);
  }, [currentVDOT, evalSelectedDistance, targetTimeForEval]);

  // Live goals synced with inputs or saved goals for real-time progress bar calculation
  const liveGoals = useMemo(
    () => ({
      target10k: target10k || goals.target10k,
      targetHalf: targetHalf || goals.targetHalf,
      targetFull: targetFull || goals.targetFull,
    }),
    [target10k, targetHalf, targetFull, goals]
  );

  // 3. In-depth Runner Workload & Training State Analysis
  const runnerStateAnalysis = useMemo(() => {
    return analyzeRunnerState(trainingSessions, evalSelectedDistance);
  }, [trainingSessions, evalSelectedDistance]);

  // Helper to get Monday-Sunday Week Range string for a given date
  // e.g. "2026.09.21 (월) ~ 09.27 (일)"
  const getMondayToSundayWeekInfo = (dateStr: string): { weekKey: string; weekLabel: string; mondayDate: Date } => {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
    // Diff to previous Monday: if Sun(0), diff is -6; if Mon(1), diff is 0; if Tue(2), diff is -1
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const mYear = monday.getFullYear();
    const mMonth = String(monday.getMonth() + 1).padStart(2, '0');
    const mDate = String(monday.getDate()).padStart(2, '0');

    const sMonth = String(sunday.getMonth() + 1).padStart(2, '0');
    const sDate = String(sunday.getDate()).padStart(2, '0');

    const weekKey = `${mYear}-${mMonth}-${mDate}`;
    const weekLabel = `${mYear}.${mMonth}.${mDate}(월) ~ ${sMonth}.${sDate}(일)`;

    return { weekKey, weekLabel, mondayDate: monday };
  };

  // 3. Group training sessions by Month and Monday~Sunday Weeks (All sorted descending by date)
  interface WeeklyGroup {
    weekKey: string;
    weekLabel: string;
    mondayDate: Date;
    weeklyDistance: number;
    sessions: TrainingSession[];
  }

  interface MonthlyGroup {
    monthKey: string;
    monthTitle: string;
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
    // Sort all sessions descending by date first
    const sorted = [...trainingSessions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Map: year -> monthKey -> month data
    const yearMonthMap: Record<
      number,
      Record<string, { monthDate: Date; monthTitle: string; weeksMap: Record<string, WeeklyGroup> }>
    > = {};

    for (const session of sorted) {
      const d = new Date(session.date);
      const year = !isNaN(d.getTime()) ? d.getFullYear() : 2026;
      const month = !isNaN(d.getTime()) ? d.getMonth() + 1 : 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const monthTitle = `${year}년 ${month}월`;
      const monthDate = new Date(year, month - 1, 1);

      if (!yearMonthMap[year]) {
        yearMonthMap[year] = {};
      }

      if (!yearMonthMap[year][monthKey]) {
        yearMonthMap[year][monthKey] = {
          monthDate,
          monthTitle,
          weeksMap: {},
        };
      }

      const { weekKey, weekLabel, mondayDate } = getMondayToSundayWeekInfo(session.date);

      if (!yearMonthMap[year][monthKey].weeksMap[weekKey]) {
        yearMonthMap[year][monthKey].weeksMap[weekKey] = {
          weekKey,
          weekLabel,
          mondayDate,
          weeklyDistance: 0,
          sessions: [],
        };
      }

      yearMonthMap[year][monthKey].weeksMap[weekKey].sessions.push(session);
      yearMonthMap[year][monthKey].weeksMap[weekKey].weeklyDistance += session.totalDistanceKm || 0;
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
          w.weeklyDistance = Math.round(w.weeklyDistance * 100) / 100;
        });

        const totalDist = weeks.reduce((sum, w) => sum + w.weeklyDistance, 0);
        const totalSessions = weeks.reduce((sum, w) => sum + w.sessions.length, 0);

        return {
          monthKey: mKey,
          monthTitle: mData.monthTitle,
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
  }, [trainingSessions]);

  // Handle Save Records
  const handleSaveRecordsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await verifyRunnerSecurityKey('러닝 기록(PB/심박수) 저장');
    if (!ok) return;

    setIsSavingRecords(true);
    await onSaveRecords({
      pb5k: pb5k.trim(),
      pb10k: pb10k.trim(),
      pbHalf: pbHalf.trim(),
      pbFull: pbFull.trim(),
      maxHr: parseInt(maxHr, 10) || 190,
      thresholdHr: parseInt(thresholdHr, 10) || 172,
    });
    setIsSavingRecords(false);
  };

  // Handle Save Goals
  const handleSaveGoalsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await verifyRunnerSecurityKey('러닝 목표 기록 저장');
    if (!ok) return;

    await onSaveGoals({
      target10k: target10k.trim(),
      targetHalf: targetHalf.trim(),
      targetFull: targetFull.trim(),
    });
  };

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
      speedWorkoutType: customSpeedType,
      longRunDay: customLongRunDay,
      targetRaceCourse: evalSelectedDistance,
      updatedAt: new Date().toISOString(),
    };

    const newPlan = generateWeeklyTrainingPlan(currentVDOT, evalSelectedDistance, {
      trainingDays: customTrainingDays,
      speedDay: customSpeedDay,
      speedWorkoutType: customSpeedType,
      longRunDay: customLongRunDay,
      trainingSessions,
      shoes,
    });
    await onSaveWeeklyPlan(newPlan, settings);
  };

  // Active weekly plan (if empty, generate default with custom options; enrich with shoe recommendations)
  const activePlan = useMemo(() => {
    if (weeklyPlan && weeklyPlan.length > 0) {
      const planWithShoes = attachShoeRecommendationsToPlan(weeklyPlan, shoes, trainingSessions);
      return enrichWeeklyPlanWithActualSessions(planWithShoes, trainingSessions, runnerStateAnalysis);
    }
    return generateWeeklyTrainingPlan(currentVDOT, evalSelectedDistance, {
      trainingDays: customTrainingDays,
      speedDay: customSpeedDay,
      speedWorkoutType: customSpeedType,
      longRunDay: customLongRunDay,
      trainingSessions,
      shoes,
    });
  }, [
    weeklyPlan,
    currentVDOT,
    evalSelectedDistance,
    customTrainingDays,
    customSpeedDay,
    customSpeedType,
    customLongRunDay,
    trainingSessions,
    shoes,
    runnerStateAnalysis,
  ]);

  // Helper to parse filename into date and training title
  // Example filename: "20260924_10km 빌드업 런.csv" or "2026-09-24_템포런.csv"
  const parseFilename = (fileName: string): { dateStr: string; sessionTitle: string } => {
    // Remove .csv extension
    const baseName = fileName.replace(/\.[^/.]+$/, '').trim();
    const underscoreIndex = baseName.indexOf('_');

    if (underscoreIndex !== -1) {
      const prefix = baseName.substring(0, underscoreIndex).trim();
      const titlePart = baseName.substring(underscoreIndex + 1).trim();

      // Check if prefix is 8-digit YYYYMMDD
      if (/^\d{8}$/.test(prefix)) {
        const year = prefix.substring(0, 4);
        const month = prefix.substring(4, 6);
        const day = prefix.substring(6, 8);
        return {
          dateStr: `${year}-${month}-${day}`,
          sessionTitle: titlePart || '가민 임포트 훈련',
        };
      }

      // Check if prefix is already YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(prefix)) {
        return {
          dateStr: prefix,
          sessionTitle: titlePart || '가민 임포트 훈련',
        };
      }

      return {
        dateStr: new Date().toISOString().split('T')[0],
        sessionTitle: titlePart || baseName,
      };
    }

    // Fallback if no underscore
    return {
      dateStr: new Date().toISOString().split('T')[0],
      sessionTitle: baseName || '가민 임포트 훈련',
    };
  };

  // Helper to extract value by multiple possible keys (case-insensitive, whitespace trimmed)
  const getRowValue = (row: Record<string, any>, candidateKeys: string[]): string => {
    for (const k of candidateKeys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
    }
    const normalizedRowKeys = Object.keys(row).map((k) => ({
      raw: k,
      norm: k.toLowerCase().replace(/[\s()_\[\]]/g, ''),
    }));
    for (const k of candidateKeys) {
      const targetNorm = k.toLowerCase().replace(/[\s()_\[\]]/g, '');
      const found = normalizedRowKeys.find(
        (rk) => rk.norm === targetNorm || rk.norm.includes(targetNorm)
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
  const parseSingleCsvFile = (file: File): Promise<Omit<TrainingSession, 'id' | 'createdAt'>> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const rawRows = results.data as Record<string, string>[];
            if (!rawRows || rawRows.length === 0) {
              return reject(new Error(`${file.name}: CSV 파일에 유효한 랩 데이터가 없습니다.`));
            }

            // Filter out completely blank rows
            const rows = rawRows.filter((r) =>
              Object.values(r).some((v) => v !== null && v !== undefined && String(v).trim() !== '')
            );

            if (rows.length === 0) {
              return reject(new Error(`${file.name}: 유효한 데이터 행이 없습니다.`));
            }

            // 1. Identify Summary Row (총계 / 요약 / Summary / Total)
            // Look from bottom to top as summary is typically the last row in Garmin exports
            let summaryRow: Record<string, string> | null = null;
            let summaryRowIndex = -1;

            for (let i = rows.length - 1; i >= 0; i--) {
              const row = rows[i];
              const lapVal = getRowValue(row, ['랩', 'Lap', '구간', '스텝', 'Step', 'Laps']).trim();
              const isLast = i === rows.length - 1;

              // Explicit summary keywords in lap column
              if (/(총계|요약|합계|전체|summary|total|totals|overall)/i.test(lapVal)) {
                summaryRow = row;
                summaryRowIndex = i;
                break;
              }

              // In Garmin, the last row sometimes has an empty lap string or non-numeric while having total distance/time
              if (isLast) {
                const dist = parseDistanceKm(
                  getRowValue(row, ['거리 km', '거리km', '거리 (km)', '거리(km)', '거리', 'Distance', 'Distance (km)'])
                );
                const time = getRowValue(row, ['시간', 'Time', '누적 시간', 'Cumulative Time']);
                if ((!lapVal || isNaN(Number(lapVal))) && (dist > 0 || time)) {
                  summaryRow = row;
                  summaryRowIndex = i;
                  break;
                }
              }
            }

            // Candidate lap rows: all rows except the summary row
            const candidateRows = rows.filter((_, idx) => idx !== summaryRowIndex);

            // 2. Handle composite interval / range rows (e.g. Lap 1-3 vs Lap 1, 2, 3)
            // In Garmin, interval repeat blocks have both a group header (e.g. "1-3", "4-6")
            // and the individual split laps ("1", "2", "3").
            // If individual split numbers exist, we filter out the duplicate group header!

            // Collect all single lap numbers present in candidate rows
            const singleLapNums = new Set<number>();
            candidateRows.forEach((row) => {
              const lapStr = getRowValue(row, ['랩', 'Lap', '구간', '스텝', 'Step', 'Laps']).trim();
              const singleMatch = lapStr.match(/^(?:Lap|랩|구간|스텝)?\s*(\d+)$/i);
              if (singleMatch) {
                singleLapNums.add(parseInt(singleMatch[1], 10));
              }
            });

            // Filter candidate rows to remove duplicate range group rows
            const lapRows = candidateRows.filter((row) => {
              const lapStr = getRowValue(row, ['랩', 'Lap', '구간', '스텝', 'Step', 'Laps']).trim();
              const rangeMatch = lapStr.match(/(?:Lap|랩|구간|스텝|반복)?\s*(\d+)\s*[-~]\s*(\d+)/i);
              if (rangeMatch) {
                const start = parseInt(rangeMatch[1], 10);
                const end = parseInt(rangeMatch[2], 10);
                let hasChildLaps = false;
                for (let n = start; n <= end; n++) {
                  if (singleLapNums.has(n)) {
                    hasChildLaps = true;
                    break;
                  }
                }
                if (hasChildLaps) {
                  return false; // exclude redundant group summary row
                }
              }
              return true;
            });

            // 3. Parse individual laps
            const parsedLaps: TrainingLap[] = [];
            let lapsDistSum = 0;
            let lapsPeakHr = 0;
            let lapsHrSum = 0;
            let lapsHrCount = 0;
            let runningSeconds = 0;

            lapRows.forEach((row, idx) => {
              const rawLap = getRowValue(row, ['랩', 'Lap', '구간', '스텝', 'Step', 'Laps']) || `${idx + 1}`;
              const cleanLapNum = rawLap.replace(/^(?:Lap|랩|구간|스텝)\s*/i, '').trim();

              const timeVal = getRowValue(row, ['시간', 'Time', '이동 시간', '경과 시간']) || '05:00';
              const rawCumVal = getRowValue(row, ['누적 시간', '누적시간', 'Cumulative Time', 'Total Time']);

              const lapSecs = timeToSeconds(timeVal);
              runningSeconds += lapSecs;
              const cumVal = rawCumVal
                ? normalizeTimeString(rawCumVal)
                : normalizeTimeString(
                    `${Math.floor(runningSeconds / 60)}:${(runningSeconds % 60).toString().padStart(2, '0')}`
                  );

              const distVal =
                parseDistanceKm(
                  getRowValue(row, ['거리 km', '거리km', '거리 (km)', '거리(km)', '거리', 'Distance', 'Distance (km)'])
                ) || 1.0;

              let paceVal = formatPace(
                getRowValue(row, ['평균 페이스 min/km', '평균 페이스', '평균페이스', 'Avg Pace', 'Avg Pace (min/km)'])
              );
              if (!paceVal && distVal > 0 && lapSecs > 0) {
                paceVal = secondsToPace(lapSecs / distVal);
              }

              const gapVal =
                formatPace(
                  getRowValue(row, ['평균 GAP min/km', '평균 GAP', 'Avg GAP'])
                ) || paceVal;

              const hrVal = parseHeartRate(
                getRowValue(row, ['평균 심박 bpm', '평균 심박', '평균심박', 'Avg HR', 'Avg Heart Rate'])
              );

              const maxHrVal =
                parseHeartRate(
                  getRowValue(row, ['최대심박 bpm', '최대 심박 bpm', '최대심박', '최대 심박', 'Max HR', 'Max Heart Rate'])
                ) || hrVal;

              lapsDistSum += distVal;
              if (hrVal > 0) {
                lapsHrSum += hrVal;
                lapsHrCount += 1;
              }
              if (maxHrVal > lapsPeakHr) {
                lapsPeakHr = maxHrVal;
              }

              parsedLaps.push({
                lap: cleanLapNum || `${idx + 1}`,
                time: timeVal,
                cumulativeTime: cumVal,
                distanceKm: Math.round(distVal * 100) / 100,
                avgPace: paceVal || "5'00\"",
                avgGap: gapVal,
                avgHr: hrVal || 150,
                maxHr: maxHrVal || hrVal || 165,
              });
            });

            // 4. Extract or compute Summary Information (총계 정보 우선 반영)
            let finalDistanceKm = 0;
            let finalTime = '00:00:00';
            let finalAvgPace = "5'00\"";
            let finalAvgHr = 150;
            let finalMaxHr = lapsPeakHr || 165;

            if (summaryRow) {
              // Direct from Summary Row (총계 row)
              const sumDist = parseDistanceKm(
                getRowValue(summaryRow, ['거리 km', '거리km', '거리 (km)', '거리(km)', '거리', 'Distance', 'Distance (km)'])
              );
              finalDistanceKm = sumDist > 0 ? sumDist : Math.round(lapsDistSum * 100) / 100;

              const sumTime = getRowValue(summaryRow, [
                '누적 시간',
                '누적시간',
                'Cumulative Time',
                'Total Time',
                '시간',
                'Time',
                '경과 시간',
                '이동 시간',
              ]);
              finalTime = sumTime
                ? normalizeTimeString(sumTime)
                : parsedLaps[parsedLaps.length - 1]?.cumulativeTime || '00:50:00';

              let sumPace = formatPace(
                getRowValue(summaryRow, [
                  '평균 페이스 min/km',
                  '평균 페이스',
                  '평균페이스',
                  'Avg Pace',
                  'Avg Pace (min/km)',
                  'Pace',
                ])
              );
              if (!sumPace || sumPace === "0'00\"") {
                const totalSecs = timeToSeconds(finalTime);
                if (totalSecs > 0 && finalDistanceKm > 0) {
                  sumPace = secondsToPace(totalSecs / finalDistanceKm);
                } else if (parsedLaps.length > 0) {
                  sumPace = parsedLaps[0].avgPace;
                }
              }
              finalAvgPace = sumPace || "5'00\"";

              const sumAvgHr = parseHeartRate(
                getRowValue(summaryRow, ['평균 심박 bpm', '평균 심박', '평균심박', 'Avg HR', 'Avg Heart Rate'])
              );
              if (sumAvgHr > 0) {
                finalAvgHr = sumAvgHr;
              } else if (lapsHrCount > 0) {
                finalAvgHr = Math.round(lapsHrSum / lapsHrCount);
              }

              const sumMaxHr = parseHeartRate(
                getRowValue(summaryRow, ['최대심박 bpm', '최대 심박 bpm', '최대심박', '최대 심박', 'Max HR', 'Max Heart Rate'])
              );
              finalMaxHr = Math.max(sumMaxHr || 0, lapsPeakHr || 0) || 165;
            } else {
              // Fallback if no summary row exists in CSV
              finalDistanceKm = Math.round(lapsDistSum * 100) / 100;
              finalTime = parsedLaps[parsedLaps.length - 1]?.cumulativeTime || '00:50:00';
              const totalSecs = timeToSeconds(finalTime);
              finalAvgPace =
                totalSecs > 0 && finalDistanceKm > 0
                  ? secondsToPace(totalSecs / finalDistanceKm)
                  : parsedLaps[0]?.avgPace || "5'00\"";
              finalAvgHr = lapsHrCount > 0 ? Math.round(lapsHrSum / lapsHrCount) : 150;
              finalMaxHr = lapsPeakHr || 165;
            }

            // If candidateRows is empty and summaryRow provided total metrics, generate at least 1 lap
            if (parsedLaps.length === 0 && finalDistanceKm > 0) {
              parsedLaps.push({
                lap: '1',
                time: finalTime,
                cumulativeTime: finalTime,
                distanceKm: finalDistanceKm,
                avgPace: finalAvgPace,
                avgGap: finalAvgPace,
                avgHr: finalAvgHr,
                maxHr: finalMaxHr,
              });
            }

            const { dateStr, sessionTitle } = parseFilename(file.name);
            const displayTitle = sessionTitle.includes('km')
              ? sessionTitle
              : `${sessionTitle} (${finalDistanceKm.toFixed(2)}km)`;

            // Extract activity date from CSV if available (e.g. Activity Date, Start Time, 날짜)
            const candidateDateKeys = [
              '날짜',
              '일자',
              'Date',
              '활동 일시',
              '활동일시',
              '시작 시간',
              '시작시간',
              'Start Time',
              'Activity Date',
              'Date/Time',
              'Timestamp',
            ];
            const rawDateFromCsv =
              (summaryRow ? getRowValue(summaryRow, candidateDateKeys) : '') ||
              (candidateRows[0] ? getRowValue(candidateRows[0], candidateDateKeys) : '');

            let effectiveDate = dateStr;
            if (rawDateFromCsv) {
              const dateMatch = rawDateFromCsv.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
              if (dateMatch) {
                effectiveDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
              }
            }

            // Extract notes/memo column if present in CSV
            const candidateMemoKeys = [
              '메모',
              '훈련메모',
              '훈련 메모',
              '메모란',
              '비고',
              '일지',
              '노트',
              'Notes',
              'Note',
              'Memo',
              'Description',
              'Comments',
              'Comment',
            ];
            const rawNoteFromCsv =
              (summaryRow ? getRowValue(summaryRow, candidateMemoKeys) : '') ||
              (candidateRows[0] ? getRowValue(candidateRows[0], candidateMemoKeys) : '');

            resolve({
              date: effectiveDate,
              title: displayTitle,
              totalDistanceKm: finalDistanceKm,
              totalTime: finalTime,
              avgPace: finalAvgPace,
              avgHr: finalAvgHr,
              maxHr: finalMaxHr,
              notes: rawNoteFromCsv || '',
              laps: parsedLaps,
            });
          } catch (err: any) {
            reject(err);
          }
        },
        error: (err) => {
          reject(err);
        },
      });
    });
  };

  // Handle Multi CSV File Upload - Opens CsvWorkoutUploadModal with memo input
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setCsvStatus(`⏳ ${files.length}개 CSV 파일 파싱 및 분석 중...`);

    const parsedItems: ParsedCsvUploadItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const sessionData = await parseSingleCsvFile(file);
        parsedItems.push({
          id: `csv-${Date.now()}-${i}`,
          fileName: file.name,
          date: sessionData.date,
          title: sessionData.title,
          totalDistanceKm: sessionData.totalDistanceKm,
          totalTime: sessionData.totalTime,
          avgPace: sessionData.avgPace,
          avgHr: sessionData.avgHr,
          maxHr: sessionData.maxHr,
          notes: sessionData.notes || '',
          laps: sessionData.laps,
        });
      } catch (err: any) {
        console.error(`Failed to process ${file.name}`, err);
        errors.push(`${file.name}: ${err.message || '파싱 오류'}`);
      }
    }

    if (errors.length > 0) {
      setCsvStatus(`⚠️ ${errors.length}개 파일 파싱 실패: ${errors[0]}`);
      setTimeout(() => setCsvStatus(''), 5000);
    } else {
      setCsvStatus('');
    }

    if (parsedItems.length > 0) {
      setPendingCsvItems(parsedItems);
      setIsCsvModalOpen(true);
    }

    // Reset input
    e.target.value = '';
  };

  // Save Batch CSV Sessions with Custom Memos & Shoes
  const handleSaveBatchCsvSessions = async (
    items: Omit<TrainingSession, 'id' | 'createdAt'>[]
  ) => {
    if (!items || items.length === 0) return;

    setCsvStatus(`⏳ ${items.length}개 훈련 세션 및 메모 등록 저장 중...`);

    try {
      if (onAddBatchTrainingSessions) {
        await onAddBatchTrainingSessions(items);
      } else {
        for (const item of items) {
          await onAddTrainingSession(item);
        }
      }

      setCsvStatus(`✅ 총 ${items.length}개 훈련 세션과 훈련 메모가 성공적으로 등록되었습니다!`);
      setTimeout(() => setCsvStatus(''), 5000);
      setIsCsvModalOpen(false);
      setPendingCsvItems([]);
    } catch (err: any) {
      console.error('Failed to save batch CSV sessions', err);
      setCsvStatus(`❌ 저장 실패: ${err.message || '저장 중 오류가 발생했습니다.'}`);
      throw err;
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
    <div className="space-y-8 animate-fadeIn">
      {/* 1. 러닝 정보 & 심박존 & VDOT */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-white/10 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                러닝 PB & 생리학적 심박존 분석
              </h2>
              <p className="text-xs text-slate-400">
                거리별 최고 기록(PB)과 심박수를 기반으로 VDOT 및 5대 심박존을 정밀 계산합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenPaceCalculator && (
              <button
                type="button"
                onClick={onOpenPaceCalculator}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="목표 거리와 예상 완주 시간으로 필요한 평균 페이스 계산하기"
              >
                <Calculator className="w-3.5 h-3.5 text-cyan-400" />
                <span>목표 페이스 계산기</span>
              </button>
            )}

            {/* VDOT & Tier Hero Badge */}
            <div className="flex items-center gap-3 p-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-950/80 to-slate-900/90 border border-emerald-500/40">
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  VDOT
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 font-athletic">
                  {currentVDOT > 0 ? currentVDOT.toFixed(1) : '--'}
                </div>
              </div>
              <div className="h-7 w-px bg-white/15" />
              <div className="text-left">
                <div className="text-xs font-bold text-white">{runnerTier.label}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Inputs for PB and Heart Rates */}
        <form onSubmit={handleSaveRecordsSubmit}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                5K PB (hh:mm:ss)
              </label>
              <input
                type="text"
                value={pb5k}
                onChange={(e) => setPb5k(e.target.value)}
                placeholder="00:21:00"
                className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                10K PB (hh:mm:ss)
              </label>
              <input
                type="text"
                value={pb10k}
                onChange={(e) => setPb10k(e.target.value)}
                placeholder="00:43:30"
                className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                하프 PB (hh:mm:ss)
              </label>
              <input
                type="text"
                value={pbHalf}
                onChange={(e) => setPbHalf(e.target.value)}
                placeholder="01:36:00"
                className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                풀코스 PB (hh:mm:ss)
              </label>
              <input
                type="text"
                value={pbFull}
                onChange={(e) => setPbFull(e.target.value)}
                placeholder="03:25:00"
                className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>최대 심박수 (Max HR bpm)</span>
              </label>
              <input
                type="number"
                value={maxHr}
                onChange={(e) => setMaxHr(e.target.value)}
                placeholder="190"
                className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>역치 심박수 (Threshold HR / LTHR bpm)</span>
              </label>
              <input
                type="number"
                value={thresholdHr}
                onChange={(e) => setThresholdHr(e.target.value)}
                placeholder="172"
                className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
              />
            </div>
          </div>

          <div className="flex justify-end mb-6">
            <button
              type="submit"
              disabled={isSavingRecords}
              className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingRecords ? '저장 중...' : '러닝 정보 저장'}</span>
            </button>
          </div>
        </form>

        {/* 5대 심박존 (Zone 1 ~ Zone 5) 시각화 */}
        <div className="pt-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-400" />
              <span>러너 맞춤 심박 트레이닝 존 (Heart Rate Zones)</span>
            </h3>
            <span className="text-[10px] text-slate-400">최대 {maxHr || 190} bpm / 역치 {thresholdHr || 172} bpm</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {hrZones.map((z) => (
              <div
                key={z.zone}
                className="p-2.5 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">Zone {z.zone}</span>
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: z.color }}
                  />
                </div>
                <div className="text-[11px] font-medium text-slate-300 truncate">
                  {z.nameKo.split(' ')[0]}
                </div>
                <div className="text-sm sm:text-base font-extrabold font-athletic text-emerald-400 my-0.5">
                  {z.minHr}~{z.maxHr} <span className="text-[10px] font-normal text-slate-400">bpm</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">{z.pctRange}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Jack Daniels VDOT 훈련 페이스 표 */}
        {trainingPaces && (
          <div className="mt-4 pt-3.5 border-t border-white/10">
            <h3 className="text-xs sm:text-sm font-bold text-white mb-2.5 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-cyan-400" />
              <span>VDOT 기준 권장 훈련 페이스 (Training Paces)</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
                <div className="text-slate-400 text-[11px]">이지 (E-Pace)</div>
                <div className="text-xs sm:text-sm font-bold text-cyan-300 font-athletic mt-0.5">
                  {trainingPaces.easyPaceRange.min} ~ {trainingPaces.easyPaceRange.max}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
                <div className="text-slate-400 text-[11px]">마라톤 (M-Pace)</div>
                <div className="text-xs sm:text-sm font-bold text-emerald-300 font-athletic mt-0.5">
                  {trainingPaces.marathonPace.pace}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
                <div className="text-slate-400 text-[11px]">역치 (T-Pace)</div>
                <div className="text-xs sm:text-sm font-bold text-amber-300 font-athletic mt-0.5">
                  {trainingPaces.thresholdPace.pace}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
                <div className="text-slate-400 text-[11px]">인터벌 (I-Pace)</div>
                <div className="text-xs sm:text-sm font-bold text-rose-300 font-athletic mt-0.5">
                  {trainingPaces.intervalPace.pace}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5 col-span-2 sm:col-span-1">
                <div className="text-slate-400 text-[11px]">반복 (R-Pace)</div>
                <div className="text-xs sm:text-sm font-bold text-purple-300 font-athletic mt-0.5">
                  {trainingPaces.repetitionPace.pace}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. 러닝 목표 & 가상 AI 검증 로직 */}
      <section
        id="running-goals-card"
        tabIndex={-1}
        className="glass-panel rounded-2xl p-5 sm:p-7 border border-white/10 shadow-xl outline-none transition-all duration-300"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>러닝 목표 & AI 실현 타당성 분석</span>
              </h2>
              <p className="text-xs text-slate-400">
                거리별 목표 완주 시간을 설정하면 VDOT 기반 달성 가능성과 전략을 진단합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Goals Input Form */}
        <form onSubmit={handleSaveGoalsSubmit} className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                10K 목표 (hh:mm:ss)
              </label>
              <input
                type="text"
                value={target10k}
                onChange={(e) => setTarget10k(e.target.value)}
                placeholder="00:39:59"
                className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                하프 마라톤 목표
              </label>
              <input
                type="text"
                value={targetHalf}
                onChange={(e) => setTargetHalf(e.target.value)}
                placeholder="01:29:59"
                className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                풀코스 마라톤 목표
              </label>
              <input
                type="text"
                value={targetFull}
                onChange={(e) => setTargetFull(e.target.value)}
                placeholder="03:09:59"
                className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
              />
            </div>
            <div>
              <button
                type="submit"
                className="w-full py-2.5 px-4 text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>목표 기록 저장</span>
              </button>
            </div>
          </div>
        </form>

        {/* 러닝 목표 달성도 프로그레스 바 영역 */}
        <GoalProgressBarSection
          goals={liveGoals}
          records={records}
          isNested={true}
        />

        {/* Distance Selector for AI Analysis */}
        <div className="flex items-center gap-2 mb-3 pt-4 border-t border-white/10">
          <span className="text-xs text-slate-400 font-medium">검증 코스:</span>
          {(['10K', '하프', '풀코스'] as const).map((dist) => (
            <button
              key={dist}
              onClick={() => setEvalSelectedDistance(dist)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                evalSelectedDistance === dist
                  ? 'bg-purple-500 text-white shadow-md shadow-purple-500/25'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              {dist}
            </button>
          ))}
        </div>

        {/* AI Feasibility Evaluation Card */}
        {goalEvaluation && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900/90 to-purple-950/40 border border-purple-500/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-white">
                  [{evalSelectedDistance}] 목표 VDOT: <span className="text-purple-400 font-athletic text-sm">{goalEvaluation.targetVDOT.toFixed(1)}</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  (현재 {currentVDOT.toFixed(1)} 대비 {goalEvaluation.diffVDOT > 0 ? `+${goalEvaluation.diffVDOT}` : goalEvaluation.diffVDOT})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">타당성 점수:</span>
                <strong className="text-sm font-athletic text-white">{goalEvaluation.feasibilityScore}%</strong>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                    goalEvaluation.feasibilityScore >= 70
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : goalEvaluation.feasibilityScore >= 45
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {goalEvaluation.feasibilityLevel}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-200 leading-relaxed">
              <span className="text-purple-300 font-semibold mr-1">분석 의견:</span>
              {goalEvaluation.aiFeedback}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/20">
                <span className="text-purple-300 font-semibold mr-1">추천 집중:</span>
                <span className="text-slate-300">{goalEvaluation.recommendedTrainingFocus}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="text-purple-300 font-semibold mr-1">필수 대회 페이스:</span>
                  <span className="text-[11px] text-slate-400">({evalSelectedDistance} 목표 {targetTimeForEval} 기준)</span>
                </div>
                <span className="text-slate-100 font-athletic font-bold text-xs sm:text-sm">
                  {goalEvaluation.requiredRacePace} /km 유지 필요
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. 훈련 기록 (CSV 업로드) */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-white/10 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>훈련 기록 관리 (가민 CSV 연동)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                  {trainingSessions.length}회 기록
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                가민/스트라바 등에서 추출한 CSV 파일을 업로드하면 랩별 페이스·심박수를 분석합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Clear All Sessions Button (visible when sessions exist) */}
            {trainingSessions.length > 0 && (
              <button
                onClick={async () => {
                  const ok = await verifyRunnerSecurityKey('등록된 모든 훈련 기록 초기화 및 전체 삭제');
                  if (ok && onClearAllTrainingSessions) {
                    await onClearAllTrainingSessions();
                    setCsvStatus('모든 훈련 기록이 성공적으로 삭제되었습니다.');
                    setTimeout(() => setCsvStatus(''), 3000);
                  }
                }}
                className="px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                title="모든 훈련 기록 전체 삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>훈련 기록 전체 삭제</span>
              </button>
            )}

            {/* Today's Workout Direct Log Button */}
            {onOpenTodayWorkoutModal && (
              <button
                type="button"
                onClick={onOpenTodayWorkoutModal}
                className="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>오늘의 훈련 직접 기록</span>
              </button>
            )}

            {/* CSV File Upload Input */}
            <label className="px-4 py-2 text-xs font-semibold text-slate-950 bg-blue-400 hover:bg-blue-300 rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>CSV 다중 파일 업로드</span>
              <input
                type="file"
                multiple
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* CSV Format Notice */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 mb-5 text-xs text-slate-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed space-y-0.5">
            <div>
              <span className="font-semibold text-white">파일명 자동 파싱:</span> 파일명을 <code className="text-cyan-300 font-mono">YYYYMMDD_훈련이름.csv</code> 형식으로 지정하면 앞 8자리는 날짜(년-월-일), 뒤 텍스트는 훈련 제목으로 자동 등록됩니다. (예: <code className="text-amber-300 font-mono">20260924_10km 빌드업 런.csv</code>)
            </div>
            <div className="text-slate-400 text-[11px]">
              * 여러 개의 CSV 파일을 동시에 선택하여 한 번에 일괄 업로드할 수 있습니다.
            </div>
          </div>
        </div>

        {csvStatus && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs">
            {csvStatus}
          </div>
        )}

        {/* View Mode Switcher: 리스트 보기 vs 달력 보기 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300">보기 모드:</span>
            <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-white/10 shadow-inner">
              <button
                type="button"
                onClick={() => setSessionViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  sessionViewMode === 'list'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
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
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>달력 보기 (캘린더)</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-400">
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
          <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-white/5">
            <Activity className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">등록된 훈련 기록이 없습니다.</p>
            <p className="text-xs text-slate-500 mt-1">
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
                  className="rounded-2xl bg-slate-900/60 border border-emerald-500/25 overflow-hidden shadow-md"
                >
                  {/* Year Accordion Header */}
                  <button
                    onClick={() => toggleYear(yearGroup.year, yearIndex === 0)}
                    className="w-full p-4 sm:p-4.5 flex items-center justify-between text-left hover:bg-emerald-500/5 transition-colors cursor-pointer bg-slate-900/90"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                        {isYearExpanded ? (
                          <ChevronDown className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base sm:text-lg font-bold font-athletic text-white tracking-wide">
                            {yearGroup.yearTitle}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-slate-300 font-semibold border border-white/10">
                            {yearGroup.months.length}개 월
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {yearGroup.totalSessionsCount}회 훈련 세션 완료
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-athletic font-bold shadow-sm">
                        연간 {yearGroup.totalDistance} km
                      </span>
                    </div>
                  </button>

                  {/* Months in this Year */}
                  {isYearExpanded && (
                    <div className="p-3.5 sm:p-4 space-y-3.5 border-t border-white/5 bg-slate-950/50">
                      {yearGroup.months.map((monthGroup, mIdx) => {
                        const isMonthExpanded = expandedMonths[monthGroup.monthKey] ?? (yearIndex === 0 && mIdx === 0);

                        return (
                          <div
                            key={monthGroup.monthKey}
                            className="rounded-xl bg-slate-900/60 border border-white/10 overflow-hidden shadow-sm"
                          >
                            {/* Month Accordion Header */}
                            <button
                              onClick={() => toggleMonth(monthGroup.monthKey, yearIndex === 0 && mIdx === 0)}
                              className="w-full p-3.5 sm:p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                {isMonthExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-cyan-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                  <span className="text-sm sm:text-base font-bold text-white whitespace-nowrap">{monthGroup.monthTitle}</span>
                                  <span className="text-xs text-slate-400 whitespace-nowrap">
                                    ({monthGroup.totalSessionsCount}회 훈련 · 총 {monthGroup.totalDistance}km)
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-athletic font-bold whitespace-nowrap">
                                  월간 {monthGroup.totalDistance} km
                                </span>
                              </div>
                            </button>

                            {/* Weeks in this Month */}
                            {isMonthExpanded && (
                              <div className="p-3 sm:p-4 pt-1 space-y-4 border-t border-white/5 bg-slate-950/40">
                      {monthGroup.weeks.map((weekGroup) => (
                        <div
                          key={weekGroup.weekKey}
                          className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5 space-y-3"
                        >
                          {/* Monday ~ Sunday Week Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-white/5">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-emerald-400" />
                              <span className="text-xs font-bold text-white">
                                {weekGroup.weekLabel}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                ({weekGroup.sessions.length}회 훈련)
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 self-start sm:self-auto">
                              <span className="text-[11px] text-slate-400">주간 마일리지:</span>
                              <span className="text-xs font-bold font-athletic text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                                {weekGroup.weeklyDistance} km
                              </span>
                            </div>
                          </div>

                          {/* Sessions in this week (Sorted descending by date) */}
                          <div className="space-y-3">
                            {weekGroup.sessions.map((session) => {
                              const isDetailOpen = expandedSessions[session.id] ?? false;

                              return (
                                <div
                                  key={session.id}
                                  className="glass-card rounded-xl p-3.5 border border-white/10 hover:border-white/20 transition-all bg-slate-900/40"
                                >
                                  {/* Summary Card Header */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="text-xs font-mono text-cyan-300 font-semibold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">
                                          {session.date}
                                        </span>

                                        {/* Running Shoe Indicator & Quick Selector Modal Trigger */}
                                        <button
                                          type="button"
                                          onClick={() => setShoeModalSession(session)}
                                          className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
                                            session.shoeName
                                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25 font-semibold'
                                              : 'bg-slate-800/80 text-slate-400 border-white/10 hover:text-white hover:border-emerald-500/30 hover:bg-slate-800'
                                          }`}
                                          title="착용 러닝화 입력 / 선택 (마일리지 연동 없음)"
                                        >
                                          <span>👟</span>
                                          <span className="font-medium">
                                            {session.shoeName ? session.shoeName : '+ 러닝화 입력'}
                                          </span>
                                        </button>
                                      </div>
                                      <h4 className="text-sm font-bold text-white keep-all">
                                        {session.title}
                                      </h4>
                                      {session.notes && (
                                        <p className="text-xs text-slate-400 mt-0.5 keep-all">{session.notes}</p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                                      <button
                                        onClick={() => setSharingSession(session)}
                                        className="px-2.5 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm shadow-cyan-500/10 whitespace-nowrap"
                                        title="기록 요약 이미지 저장 및 SNS 공유"
                                      >
                                        <Share2 className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span>공유/이미지 저장</span>
                                      </button>

                                      <button
                                        onClick={() => toggleSessionDetail(session.id)}
                                        className="px-3 py-1.5 text-xs font-semibold text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
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
                                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                        title="삭제 (비밀번호 확인)"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Summary Metrics */}
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-white/5 text-xs">
                                    <div>
                                      <div className="text-[10px] text-slate-400">총 훈련 거리</div>
                                      <div className="text-sm sm:text-base font-extrabold text-white font-athletic">
                                        {session.totalDistanceKm} <span className="text-[10px] font-normal text-slate-400">km</span>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-slate-400">총 소요 시간</div>
                                      <div className="text-sm sm:text-base font-extrabold text-white font-athletic">
                                        {session.totalTime}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-slate-400">평균 페이스</div>
                                      <div className="text-sm sm:text-base font-extrabold text-cyan-300 font-athletic">
                                        {session.avgPace} <span className="text-[10px] font-normal text-slate-400">/km</span>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-slate-400">평균 / 최대 심박</div>
                                      <div className="text-sm sm:text-base font-extrabold text-rose-300 font-athletic">
                                        {session.avgHr} <span className="text-[10px] text-slate-400">/ {session.maxHr} bpm</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Detail Lap-by-Lap Table (Expands on "상세" click) */}
                                  {isDetailOpen && session.laps && session.laps.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-white/10 animate-fadeIn">
                                      <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                                        <span>구간 랩(Lap) 상세 분석표</span>
                                        <span className="text-[11px] text-slate-400">
                                          총 {session.laps.length}개 랩
                                        </span>
                                      </div>

                                      <div className="overflow-x-auto rounded-lg border border-white/10">
                                        <table className="w-full text-left text-xs">
                                          <thead className="bg-slate-900 text-slate-300 border-b border-white/10 font-semibold">
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
                                          <tbody className="divide-y divide-white/5 font-mono">
                                            {session.laps.map((lap, lIdx) => (
                                              <tr
                                                key={lIdx}
                                                className="hover:bg-white/5 transition-colors"
                                              >
                                                <td className="p-2 sm:p-2.5 font-bold text-white">
                                                  Lap {lap.lap}
                                                </td>
                                                <td className="p-2 sm:p-2.5 text-slate-300">{lap.time}</td>
                                                <td className="p-2 sm:p-2.5 text-slate-400">
                                                  {lap.cumulativeTime}
                                                </td>
                                                <td className="p-2 sm:p-2.5 text-emerald-400 font-bold">
                                                  {lap.distanceKm} km
                                                </td>
                                                <td className="p-2 sm:p-2.5 text-cyan-300">
                                                  {lap.avgPace}
                                                </td>
                                                <td className="p-2 sm:p-2.5 text-slate-400 hidden sm:table-cell">
                                                  {lap.avgGap || '-'}
                                                </td>
                                                <td className="p-2 sm:p-2.5 text-rose-300">
                                                  {lap.avgHr} bpm
                                                </td>
                                                <td className="p-2 sm:p-2.5 text-rose-400">
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

      {/* D3.js 주간 마일리지 추세 및 훈련 강도 분포 분석 대시보드 */}
      <TrainingAnalyticsDashboard
        sessions={trainingSessions}
        maxHr={Number(maxHr) || 190}
        thresholdHr={Number(thresholdHr) || 172}
      />

      {/* AI 다음 주 맞춤 훈련 강도 추천 & 루틴 제안 (회복 / 유지 / 강화) */}
      <TrainingIntensityRecommender
        sessions={trainingSessions}
        vdot={currentVDOT}
        targetRaceCourse={evalSelectedDistance}
        shoes={shoes}
        onApplyRoutine={async (routineDays, settings) => {
          await onSaveWeeklyPlan(routineDays, settings);
        }}
      />

      {/* 4. 일자별 주간훈련 상세계획표 */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-white/10 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>일자별 주간 맞춤 훈련 상세계획표</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  AI Periodization
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                훈련 요일과 포인트(스피드·장거리) 훈련 요일을 직접 지정하여 AI 맞춤 플랜을 생성합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCustomizingPlan((prev) => !prev)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>{isCustomizingPlan ? '설정 패널 접기' : '훈련 요일/포인트 설정'}</span>
            </button>
            <button
              onClick={handleGenerateWeeklyPlan}
              className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI 맞춤 계획표 생성</span>
            </button>
          </div>
        </div>

        {/* Shoe Rotation Guidance Banner */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mb-5">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">👟</span>
            <div>
              <span className="font-bold text-emerald-300">스마트 러닝화 로테이션 추천 시스템: </span>
              <span className="text-slate-300">
                훈련 강도(스피드/장거리/조깅)에 맞추고, 자주 안 신은 신발을 골고루 돌려 신도록 배정하여 미드솔 수명을 보존하고 부상을 예방합니다.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
            <span className="text-[11px] text-slate-400 font-mono">
              보유 신발: <strong className="text-white">{shoes.length}켤레</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                if (onNavigateToShoes) {
                  onNavigateToShoes();
                } else {
                  setShowShoeAnalytics((prev) => !prev);
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-cyan-500/10"
              title="내 정보의 보유 러닝화 로테이션 & 마일리지 수명 관리 섹션으로 이동"
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>러닝화 로테이션·수명 관리 바로가기</span>
            </button>
          </div>
        </div>

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
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-emerald-500/20 mb-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <span className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                <span>훈련 요일 및 포인트 훈련 지정</span>
              </span>
              <span className="text-[11px] text-slate-400">
                선택한 요일 외의 날은 자동 '휴식일'로 배치됩니다.
              </span>
            </div>

            {/* 1. 훈련 요일 다중 선택 */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                1️⃣ 주간 훈련 요일 선택 (복수 선택):
              </label>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
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
                      className={`py-2 px-1 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-white font-bold shadow-sm shadow-emerald-500/20'
                          : 'bg-slate-800/40 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="text-xs sm:text-sm">{day.replace('요일', '')}</span>
                      <span className="text-[10px] hidden sm:inline font-normal">
                        {isSelected ? '훈련' : '휴식'}
                      </span>
                      {(isSpeed || isLongRun) && (
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                            isSpeed
                              ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                              : 'bg-purple-500/30 text-purple-300 border border-purple-500/40'
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

            {/* 2. 포인트 훈련 요일 및 종목 선택 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
              {/* 스피드 포인트 훈련 */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-rose-500/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>2️⃣ 스피드 포인트 훈련 설정</span>
                  </span>
                  <span className="text-[10px] text-slate-400">VO2max / 역치 향상</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">스피드 훈련 요일</label>
                    <select
                      value={customSpeedDay}
                      onChange={(e) => {
                        const val = e.target.value as DayOfWeek | '없음';
                        setCustomSpeedDay(val);
                        if (val !== '없음' && !customTrainingDays.includes(val)) {
                          setCustomTrainingDays((prev) => [...prev, val]);
                        }
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
                    >
                      <option value="없음">지정 안함 (일반 조깅)</option>
                      {customTrainingDays.map((d) => (
                        <option key={d} value={d}>
                          {d} {customLongRunDay === d ? '(장거리와 겹침)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">훈련 세부 종목</label>
                    <select
                      value={customSpeedType}
                      onChange={(e) =>
                        setCustomSpeedType(
                          e.target.value as SpeedWorkoutType
                        )
                      }
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
                    >
                      <option value="인터벌">400m 인터벌 (트랙 400m 질주 x 6~10회)</option>
                      <option value="800m 인터벌">800m 인터벌 (야소 800 / 800m 질주 x 4~6회)</option>
                      <option value="1~3k 인터벌">1~3k 인터벌 (1~3km 롱 크루즈 인터벌 x 3~5회)</option>
                      <option value="템포런">템포런 (젖산역치 지속주)</option>
                      <option value="변속주(파틀렉)">변속주 (파틀렉 Fartlek)</option>
                      <option value="빌드업주">빌드업주 (네거티브 스플릿)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 장거리 포인트 훈련 */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-purple-500/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5" />
                    <span>3️⃣ 장거리 포인트 훈련 설정</span>
                  </span>
                  <span className="text-[10px] text-slate-400">지구력 / 완주력 극대화</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">장거리(LSD) 요일</label>
                    <select
                      value={customLongRunDay}
                      onChange={(e) => {
                        const val = e.target.value as DayOfWeek | '없음';
                        setCustomLongRunDay(val);
                        if (val !== '없음' && !customTrainingDays.includes(val)) {
                          setCustomTrainingDays((prev) => [...prev, val]);
                        }
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                    >
                      <option value="없음">지정 안함 (일반 조깅)</option>
                      {customTrainingDays.map((d) => (
                        <option key={d} value={d}>
                          {d} {customSpeedDay === d ? '(스피드와 겹침)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">목표 레이스 거리</label>
                    <select
                      value={evalSelectedDistance}
                      onChange={(e) =>
                        setEvalSelectedDistance(e.target.value as '10K' | '하프' | '풀코스')
                      }
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                    >
                      <option value="풀코스">풀코스 (LSD 26km 권장)</option>
                      <option value="하프">하프 마라톤 (LSD 18km 권장)</option>
                      <option value="10K">10K (LSD 14km 권장)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-white/5 flex items-center justify-between">
              <span>
                💡 위 설정을 조정한 후 우측 상단의 <strong>[AI 맞춤 계획표 생성]</strong>을 누르면 요일별 심박존, 강도, 목표 페이스가 계산되어 반영됩니다.
              </span>
            </div>
          </div>
        )}

        {/* Runner State & Mileage Trend Analysis Summary Card */}
        {runnerStateAnalysis && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900/95 via-emerald-950/20 to-slate-900/95 border border-emerald-500/30 mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>러너 실훈련 상태 & 주간 마일리지 추세 정밀 진단</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        runnerStateAnalysis.fatigueRisk === '안전(스위트스팟)'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : runnerStateAnalysis.fatigueRisk === '주의(과부하 위험)'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {runnerStateAnalysis.fatigueRisk}
                    </span>
                  </h3>
                  <div className="text-[11px] text-slate-400">
                    최근 4주간 실제 누적 마일리지와 ACWR(급성:만성 운동부하비)를 실시간 반영하여 주간 거리와 강도를 맞춤 세팅합니다.
                  </div>
                </div>
              </div>

              {/* Status Trend Pill */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[11px] text-slate-400">마일리지 추세:</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 border ${
                    runnerStateAnalysis.mileageTrend === '증가세'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : runnerStateAnalysis.mileageTrend === '감소세'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  }`}
                >
                  {runnerStateAnalysis.mileageTrend === '증가세' ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : runnerStateAnalysis.mileageTrend === '감소세' ? (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  ) : (
                    <Compass className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {runnerStateAnalysis.mileageTrend} ({runnerStateAnalysis.trendRatio >= 0 ? '+' : ''}
                    {runnerStateAnalysis.trendRatio}%)
                  </span>
                </span>
              </div>
            </div>

            {/* 4 Stat Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                <div className="text-[10px] text-slate-400 keep-all">최근 4주 평균 마일리지</div>
                <div className="text-base sm:text-lg font-black text-white font-athletic mt-0.5">
                  {runnerStateAnalysis.avgWeeklyMileage4Weeks}{' '}
                  <span className="text-xs font-normal text-slate-400">km/주</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 whitespace-nowrap">
                  피크 주간: <span className="text-slate-300 font-semibold">{runnerStateAnalysis.peakWeeklyDistance}km</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                <div className="text-[10px] text-slate-400 keep-all">직전 주간 마일리지 (Acute)</div>
                <div className="text-base sm:text-lg font-black text-cyan-300 font-athletic mt-0.5">
                  {runnerStateAnalysis.lastWeekDistance}{' '}
                  <span className="text-xs font-normal text-slate-400">km</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 whitespace-nowrap">
                  월~일: <span className="text-cyan-300 font-mono font-semibold">{runnerStateAnalysis.lastWeekLabel || '지난주'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                <div className="text-[10px] text-slate-400 keep-all">ACWR (운동 부하 비율)</div>
                <div
                  className={`text-base sm:text-lg font-black font-athletic mt-0.5 ${
                    runnerStateAnalysis.acwr > 1.35
                      ? 'text-rose-400'
                      : runnerStateAnalysis.acwr < 0.75
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {runnerStateAnalysis.acwr}{' '}
                  <span className="text-[10px] font-normal text-slate-400 font-sans">
                    (적정: 0.8~1.3)
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 whitespace-nowrap">
                  부상 안전도: <span className="text-emerald-300 font-semibold">{runnerStateAnalysis.fatigueRisk}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-emerald-500/30 bg-emerald-950/20">
                <div className="text-[10px] text-emerald-400 font-semibold keep-all">AI 권장 주간 총 볼륨</div>
                <div className="text-base sm:text-lg font-black text-emerald-300 font-athletic mt-0.5">
                  {runnerStateAnalysis.recommendedWeeklyKm}{' '}
                  <span className="text-xs font-normal text-slate-400">km</span>
                </div>
                <div className="text-[10px] text-slate-300 mt-1 whitespace-nowrap">
                  LSD: <span className="text-purple-300 font-semibold">{runnerStateAnalysis.longRunRecommendedKm}km</span> / 스피드: <span className="text-rose-300 font-semibold">{runnerStateAnalysis.speedVolumeRecommendedKm}km</span>
                </div>
              </div>
            </div>

            {/* This-Week Real Training Progress Tracker */}
            {runnerStateAnalysis.thisWeekLoggedKm !== undefined && runnerStateAnalysis.thisWeekLoggedKm > 0 && (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>이번 주 실훈련 진행 현황</span>
                  </span>
                  <span className="text-white font-medium text-[11px]">
                    {runnerStateAnalysis.thisWeekDaysDone?.join(', ')} 훈련 완료 ({runnerStateAnalysis.thisWeekLoggedKm}km 소화)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">
                    남은 요일 권장 볼륨:{' '}
                    <strong className="text-emerald-300 font-athletic text-sm">
                      {runnerStateAnalysis.remainingWeeklyPlanKm ?? Math.max(0, runnerStateAnalysis.recommendedWeeklyKm - runnerStateAnalysis.thisWeekLoggedKm)}km
                    </strong>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    / 주간 총 {runnerStateAnalysis.recommendedWeeklyKm}km
                  </span>
                </div>
              </div>
            )}

            {/* Recent 4-week miniature progress bar / breakdown */}
            {runnerStateAnalysis.recent4WeeksDistances.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-950/40 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 flex-shrink-0">
                  <span>📊 최근 4주 마일리지 추이:</span>
                </span>
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                  {runnerStateAnalysis.recent4WeeksDistances.map((rw, rIdx) => (
                    <div key={rIdx} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">{rw.weekLabel}</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/10 text-white font-mono text-[11px] font-bold">
                        {rw.distanceKm}km
                      </span>
                      {rIdx < runnerStateAnalysis.recent4WeeksDistances.length - 1 && (
                        <span className="text-slate-600 text-[10px]">➡️</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed AI Tuning Feedback */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-white/10 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex-shrink-0 font-bold">
                  거리 볼륨 제어
                </span>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {runnerStateAnalysis.mileageAdjustmentNote}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex-shrink-0 font-bold">
                  훈련 강도 조율
                </span>
                <p className="text-slate-300 leading-relaxed text-[11px]">
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
              낮음: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
              보통: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
              높음: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
              휴식: 'bg-slate-700/50 text-slate-400 border-slate-600',
            };

            const typeBadgeColors = {
              템포런: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
              인터벌: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
              LSD: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
              조깅: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
              회복주: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
              휴식: 'bg-slate-800 text-slate-400 border-slate-700',
            };

            return (
              <div
                key={idx}
                className={`glass-card rounded-xl p-4 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  dayPlan.isCompleted
                    ? 'bg-gradient-to-r from-emerald-950/25 via-slate-900/90 to-slate-900/95 border-emerald-500/40 shadow-md shadow-emerald-950/20'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Day & Type */}
                <div className="flex items-center gap-3">
                  <div className="w-14 sm:w-16 text-center py-2 px-1 rounded-xl bg-slate-900 border border-white/10 flex-shrink-0">
                    <div className="text-[10px] text-slate-400 font-mono">{dayPlan.dayShort}</div>
                    <div className="text-xs sm:text-sm font-bold text-white">{dayPlan.day}</div>
                    {dayPlan.dateStr && (
                      <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                        {dayPlan.dateStr.slice(5)}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${
                          typeBadgeColors[dayPlan.type]
                        }`}
                      >
                        {dayPlan.type}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${
                          intensityBadgeColors[dayPlan.intensity]
                        }`}
                      >
                        강도: {dayPlan.intensity}
                      </span>
                      {dayPlan.isCompleted && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>실제 훈련 완료</span>
                        </span>
                      )}
                      {!dayPlan.isCompleted && runnerStateAnalysis?.thisWeekLoggedKm && runnerStateAnalysis.thisWeekLoggedKm > 0 && dayPlan.type !== '휴식' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          실훈련 반영 맞춤
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap keep-all">
                      <span>{dayPlan.title}</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed keep-all">
                      {dayPlan.description}
                    </p>

                    {/* Granular Split Pacing Stages (빌드업주 / 포인트 훈련 세부 구간표) */}
                    {dayPlan.stages && dayPlan.stages.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {dayPlan.stages.map((stg, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-2.5 rounded-lg bg-slate-950/70 border border-emerald-500/20 text-xs flex flex-col justify-between gap-1 shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-[11px] whitespace-nowrap">{stg.step}</span>
                              <span className="text-[10px] text-emerald-400 font-mono font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/30 whitespace-nowrap">
                                {stg.pace}/km
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-cyan-300">
                              <span className="whitespace-nowrap">{stg.zone}</span>
                              <span className="text-slate-400 whitespace-nowrap">{stg.distanceKm}km</span>
                            </div>
                            <div className="text-[10px] text-slate-400 leading-tight border-t border-white/5 pt-1 mt-0.5 keep-all">
                              {stg.focus}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recommended Running Shoe & Rotation Rationale (기록된 훈련은 추천 신발 박스 제외) */}
                    {dayPlan.type !== '휴식' && !dayPlan.isCompleted && (
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-sm">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                            <span className="text-base">👟</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">추천 러닝화:</span>
                              <strong className="text-emerald-300 font-bold truncate">
                                {dayPlan.recommendedShoe?.shoeName || (shoes.length > 0 ? shoes[0].name : '보유 러닝화 미등록')}
                              </strong>
                              {dayPlan.recommendedShoe?.category && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-semibold whitespace-nowrap ${
                                    dayPlan.recommendedShoe.category === '스피드' ||
                                    dayPlan.recommendedShoe.category === '레이싱'
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      : dayPlan.recommendedShoe.category === '장거리'
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  }`}
                                >
                                  {dayPlan.recommendedShoe.category}
                                </span>
                              )}
                            </div>
                            {dayPlan.recommendedShoe?.reason && (
                              <div className="text-[11px] text-slate-300 mt-0.5 flex items-start gap-1.5 keep-all">
                                <span className="text-emerald-400 font-mono flex-shrink-0 mt-0.5">💡</span>
                                <span>{dayPlan.recommendedShoe.reason}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick switch to another owned shoe */}
                        {shoes.length > 0 && (
                          <div className="flex items-center gap-1.5 self-end sm:self-auto flex-shrink-0">
                            <select
                              value={dayPlan.recommendedShoe?.shoeName || ''}
                              onChange={async (e) => {
                                const chosenName = e.target.value;
                                const chosenShoe = shoes.find((s) => s.name === chosenName);
                                const updatedPlan = activePlan.map((d, dIdx) =>
                                  dIdx === idx
                                    ? {
                                        ...d,
                                        recommendedShoe: chosenShoe
                                          ? {
                                              shoeId: chosenShoe.id,
                                              shoeName: chosenShoe.name,
                                              brand: chosenShoe.brand,
                                              category: chosenShoe.category,
                                              reason: '사용자 직접 선택 러닝화',
                                            }
                                          : undefined,
                                      }
                                    : d
                                );
                                await onSaveWeeklyPlan(updatedPlan, weeklyPlanSettings);
                              }}
                              className="bg-slate-900 border border-white/10 hover:border-emerald-500/40 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
                            >
                              <option value="">러닝화 직접 변경...</option>
                              {shoes.map((s) => (
                                <option key={s.id} value={s.name}>
                                  [{s.brand}] {s.name} ({s.category})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-4 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0 border-white/5 w-full md:w-auto justify-between md:justify-end flex-shrink-0">
                  <div className="text-left md:text-right whitespace-nowrap">
                    <div className="text-[10px] text-slate-400">
                      {dayPlan.isCompleted ? '실제 주행거리' : '목표 거리'}
                    </div>
                    <div className={`text-sm font-extrabold font-athletic ${
                      dayPlan.isCompleted ? 'text-cyan-300 text-base' : 'text-white'
                    }`}>
                      {dayPlan.distanceKm > 0 ? `${dayPlan.distanceKm} km` : '0 km'}
                    </div>
                  </div>

                  <div className="text-left md:text-right whitespace-nowrap">
                    <div className="text-[10px] text-slate-400">
                      {dayPlan.isCompleted ? '실제 평균페이스' : '목표 페이스'}
                    </div>
                    <div className={`text-sm font-extrabold font-athletic ${
                      dayPlan.isCompleted ? 'text-emerald-300 text-base' : 'text-emerald-400'
                    }`}>
                      {dayPlan.targetPace}
                    </div>
                  </div>

                  <div className="text-left md:text-right whitespace-nowrap">
                    <div className="text-[10px] text-slate-400">
                      {dayPlan.isCompleted ? '실제 심박/상태' : '목표 심박존'}
                    </div>
                    <div className="text-xs font-semibold text-cyan-300">
                      {dayPlan.targetZone}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly Total Plan Summary Footer Bar */}
        <div className="mt-4 p-4 rounded-xl bg-slate-900/90 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="keep-all">
              이번 주간 총 계획 거리:{' '}
              <strong className="text-white text-sm font-bold font-athletic whitespace-nowrap">
                {Math.round(activePlan.reduce((acc, d) => acc + (d.distanceKm || 0), 0) * 10) / 10} km
              </strong>{' '}
              <span className="text-slate-400 whitespace-nowrap">
                (주 {activePlan.filter((d) => d.type !== '휴식').length}일 훈련 / {activePlan.filter((d) => d.type === '휴식').length}일 휴식)
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 whitespace-nowrap">
            <span>
              스피드: <strong className="text-rose-300">{activePlan.find(d => d.type === '인터벌' || d.title.includes('스피드'))?.distanceKm || 0}km</strong>
            </span>
            <span>•</span>
            <span>
              장거리(LSD): <strong className="text-purple-300">{activePlan.find(d => d.type === 'LSD')?.distanceKm || 0}km</strong>
            </span>
            <span>•</span>
            <span>
              유산소/회복: <strong className="text-cyan-300">
                {Math.round(activePlan.filter(d => d.type === '조깅' || d.type === '회복주').reduce((acc, d) => acc + d.distanceKm, 0) * 10) / 10}km
              </strong>
            </span>
          </div>
        </div>
      </section>

      {/* Training Share & Image Export Modal */}
      {sharingSession && (
        <TrainingShareModal
          session={sharingSession}
          vdot={currentVDOT}
          runnerTierName={runnerTier.label}
          onClose={() => setSharingSession(null)}
        />
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

      {/* CSV Workout Upload & Memo Input Modal */}
      {isCsvModalOpen && (
        <CsvWorkoutUploadModal
          isOpen={isCsvModalOpen}
          parsedItems={pendingCsvItems}
          shoes={shoes}
          onClose={() => {
            setIsCsvModalOpen(false);
            setPendingCsvItems([]);
          }}
          onSaveBatch={handleSaveBatchCsvSessions}
        />
      )}
    </div>
  );
};
