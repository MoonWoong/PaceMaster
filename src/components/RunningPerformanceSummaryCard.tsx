import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Award,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Target,
  TrendingUp,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronUp,
  Footprints,
  Activity,
  Flame,
  Calendar,
  Compass,
} from 'lucide-react';
import { TrainingSession, RunningRecords, RunningGoals, RegisteredRace } from '../types';
import { estimateBestVDOT } from '../lib/vdot';
import { calculateDDay, getTodayDateStr } from '../lib/marathonData';
import {
  RunnerPerformanceSummaryData,
  generateHeuristicPerformanceSummary,
} from '../lib/performanceSummaryFallback';

interface RunningPerformanceSummaryCardProps {
  sessions: TrainingSession[];
  records: RunningRecords;
  goals: RunningGoals;
  races: RegisteredRace[];
  isAppLoading?: boolean;
  onOpenTodayWorkoutModal?: () => void;
  onNavigateToRecords?: () => void;
}

const CACHE_KEY = 'pacemaster_running_performance_summary_v2';

// Helper to calculate scientifically accurate weekly mileage from training sessions
export const calculateWeeklyMileageStats = (sessionsList: TrainingSession[]) => {
  if (!sessionsList || sessionsList.length === 0) {
    return { avgWeeklyKm: 0, lastWeekKm: 0, activeWeeksCount: 0 };
  }

  // Filter valid sessions with distance > 0 and valid date
  const valid = sessionsList
    .filter((s) => s.date && !isNaN(new Date(s.date).getTime()) && (s.totalDistanceKm || 0) > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (valid.length === 0) {
    return { avgWeeklyKm: 0, lastWeekKm: 0, activeWeeksCount: 0 };
  }

  // Group sessions by Monday-Sunday calendar weeks
  const weekMap: Record<string, { monday: Date; distance: number; sessionsCount: number }> = {};
  for (const s of valid) {
    const d = new Date(s.date);
    const day = d.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);

    if (!weekMap[key]) {
      weekMap[key] = { monday, distance: 0, sessionsCount: 0 };
    }
    weekMap[key].distance += s.totalDistanceKm || 0;
    weekMap[key].sessionsCount += 1;
  }

  const sortedWeeks = Object.values(weekMap).sort(
    (a, b) => a.monday.getTime() - b.monday.getTime()
  );

  const lastWeekKm =
    sortedWeeks.length > 0 ? Math.round(sortedWeeks[sortedWeeks.length - 1].distance * 10) / 10 : 0;

  // Recent up to 4 calendar weeks recorded
  const recentWeeks = sortedWeeks.slice(-4);
  const recentSum = recentWeeks.reduce((acc, w) => acc + w.distance, 0);
  const avgWeeklyKm = Math.round((recentSum / Math.max(recentWeeks.length, 1)) * 10) / 10;

  return {
    avgWeeklyKm,
    lastWeekKm,
    activeWeeksCount: sortedWeeks.length,
  };
};

const formatGeneratedAt = () => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
  const timeStr = now.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateStr} ${timeStr}`;
};

export const RunningPerformanceSummaryCard: React.FC<RunningPerformanceSummaryCardProps> = ({
  sessions,
  records,
  goals,
  races,
  isAppLoading,
  onOpenTodayWorkoutModal,
  onNavigateToRecords,
}) => {
  // Estimated VDOT
  const currentVDOT = useMemo(() => {
    return records ? estimateBestVDOT(records).vdot : 45;
  }, [records]);

  // Nearest upcoming marathon race with calculated dDay
  const upcomingRace = useMemo(() => {
    if (!races || races.length === 0) return null;
    const today = getTodayDateStr();
    const valid = races
      .filter((r) => r.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    const target = valid.find((r) => r.isTarget) || valid[0];
    if (!target) return null;

    const dDayInfo = calculateDDay(target.date);

    return {
      name: target.name,
      date: target.date,
      dDay: dDayInfo.daysDiff,
      dDayText: dDayInfo.text,
    };
  }, [races]);

  // Collapsed state (default expanded)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('pacemaster_perf_summary_expanded');
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pacemaster_perf_summary_expanded', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Initial state with cached or heuristic data
  const [summaryData, setSummaryData] = useState<RunnerPerformanceSummaryData>(() => {
    try {
      // Purge old cache that might have contained the erroneous 270km calculation
      localStorage.removeItem('pacemaster_running_performance_summary_v1');
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const cachedStr = JSON.stringify(parsed);
        // If cached analysis text contains erroneous 270km references, discard it immediately
        if (
          !cachedStr.includes('270km') &&
          !cachedStr.includes('270 km') &&
          parsed.data &&
          parsed.sessionsCount === sessions.length
        ) {
          return parsed.data;
        }
      }
    } catch {
      // ignore
    }
    return generateHeuristicPerformanceSummary({ sessions, records, goals, upcomingRace });
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Fetch performance summary from API (Gemini or Fallback)
  const fetchPerformanceSummary = useCallback(
    async (isManual: boolean = false) => {
      if (sessions.length === 0) {
        const fallback = generateHeuristicPerformanceSummary({ sessions, records, goals, upcomingRace });
        setSummaryData(fallback);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        // Compute statistics for prompt
        const totalSessions = sessions.length;
        const totalDistanceKm =
          Math.round(sessions.reduce((acc, s) => acc + (s.totalDistanceKm || 0), 0) * 100) / 100;
        const longestRunKm = Math.max(...sessions.map((s) => s.totalDistanceKm || 0), 0);

        // Accurate Weekly Mileage Calculation
        const weeklyMetrics = calculateWeeklyMileageStats(sessions);

        // Valid HR
        const validHrs = sessions.filter((s) => s.avgHr && s.avgHr > 60 && s.avgHr < 220);
        const overallAvgHr =
          validHrs.length > 0
            ? Math.round(validHrs.reduce((acc, s) => acc + s.avgHr, 0) / validHrs.length)
            : 148;

        // Pace
        const paceSecs: number[] = [];
        sessions.forEach((s) => {
          if (s.avgPace) {
            const m = s.avgPace.match(/(\d+)[':](\d{2})/);
            if (m) {
              paceSecs.push(parseInt(m[1], 10) * 60 + parseInt(m[2], 10));
            }
          }
        });
        const avgSec =
          paceSecs.length > 0 ? Math.round(paceSecs.reduce((a, b) => a + b, 0) / paceSecs.length) : 330;
        const overallAvgPace = `${Math.floor(avgSec / 60)}'${(avgSec % 60).toString().padStart(2, '0')}"`;

        // Recent sample
        const sampleRecentSessions = sessions.slice(0, 8).map((s) => ({
          date: s.date,
          totalDistanceKm: s.totalDistanceKm,
          avgPace: s.avgPace,
          avgHr: s.avgHr,
          title: s.title,
        }));

        const response = await fetch('/api/performance-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            totalSessions,
            totalDistanceKm,
            longestRunKm,
            overallAvgPace,
            overallAvgHr,
            avgWeeklyKm: weeklyMetrics.avgWeeklyKm,
            lastWeekKm: weeklyMetrics.lastWeekKm,
            vdot: currentVDOT,
            upcomingRace,
            sampleRecentSessions,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.runnerType && result.strengths) {
            const formatted: RunnerPerformanceSummaryData = {
              runnerType: result.runnerType,
              overallScore: result.overallScore || 85,
              summaryTitle: result.summaryTitle || '러닝 성과 AI 종합 분석',
              aiSummary: result.aiSummary || '',
              strengths: result.strengths || [],
              improvements: result.improvements || [],
              keyAdvice: result.keyAdvice || '',
              recommendedRoutine: result.recommendedRoutine || '',
              generatedAt: formatGeneratedAt(),
              source: result.source || 'gemini',
            };

            setSummaryData(formatted);
            try {
              localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                  sessionsCount: sessions.length,
                  data: formatted,
                })
              );
            } catch {
              // ignore
            }
            return;
          }
        }
      } catch (err: any) {
        console.warn('API performance summary failed, using fallback:', err?.message);
      } finally {
        setIsLoading(false);
      }

      // Fallback
      const fallbackData = generateHeuristicPerformanceSummary({ sessions, records, goals, upcomingRace });
      fallbackData.generatedAt = formatGeneratedAt();
      setSummaryData(fallbackData);
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            sessionsCount: sessions.length,
            data: fallbackData,
          })
        );
      } catch {
        // ignore
      }
    },
    [sessions, records, goals, upcomingRace]
  );

  // Auto-refresh on screen load & when sessions change
  const hasRefreshedOnLoadRef = useRef(false);
  const prevSessionsLengthRef = useRef<number | null>(null);

  useEffect(() => {
    if (isAppLoading) return;

    if (!hasRefreshedOnLoadRef.current) {
      hasRefreshedOnLoadRef.current = true;
      prevSessionsLengthRef.current = sessions.length;
      fetchPerformanceSummary(false);
      return;
    }

    if (prevSessionsLengthRef.current !== null && prevSessionsLengthRef.current !== sessions.length) {
      prevSessionsLengthRef.current = sessions.length;
      fetchPerformanceSummary(false);
    }
  }, [isAppLoading, sessions.length, fetchPerformanceSummary]);

  // Overall statistics summary chips
  const totalStats = useMemo(() => {
    const totalDist =
      Math.round(sessions.reduce((acc, s) => acc + (s.totalDistanceKm || 0), 0) * 100) / 100;
    const longest = Math.max(...sessions.map((s) => s.totalDistanceKm || 0), 0);
    const weeklyMetrics = calculateWeeklyMileageStats(sessions);
    return {
      count: sessions.length,
      distanceKm: totalDist,
      longestRunKm: longest,
      avgWeeklyKm: weeklyMetrics.avgWeeklyKm,
    };
  }, [sessions]);

  return (
    <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950 border border-emerald-500/20 shadow-2xl mb-6 backdrop-blur-xl">
      {/* Background Glow Accents */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10">
            <Award className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>러닝 성과 AI 종합 요약 & 역량 분석</span>
              </h2>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
                {isLoading ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    <span>실시간 성과 분석 중...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>누적 세션 심층 분석</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              현재까지 기록된 <span className="text-emerald-400 font-semibold font-mono">{totalStats.count}개</span> 세션(누적 총{' '}
              <span className="text-cyan-400 font-semibold font-mono">{totalStats.distanceKm}km</span>, 최근 주간 평균{' '}
              <span className="text-amber-400 font-semibold font-mono">{totalStats.avgWeeklyKm}km</span>)을 바탕으로 러너의 강점과 보완점을 진단합니다.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => fetchPerformanceSummary(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-all cursor-pointer disabled:opacity-50"
            title="누적 훈련 데이터 기반 AI 재분석"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">{isLoading ? '분석 중...' : 'AI 재분석'}</span>
          </button>

          <button
            type="button"
            onClick={toggleExpand}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
            title={isExpanded ? '상세 분석 접기' : '상세 분석 펼치기'}
          >
            <span>{isExpanded ? '간략히' : '상세보기'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Executive Summary Banner */}
      <div className="relative z-10 mt-5 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-950/80 to-slate-900/80 border border-white/10 shadow-inner">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <Footprints className="w-3.5 h-3.5" />
                <span>{summaryData.runnerType}</span>
              </span>

              {upcomingRace && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  🎯 {upcomingRace.name} {upcomingRace.dDayText}
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {summaryData.summaryTitle}
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {summaryData.aiSummary}
            </p>
          </div>

          {/* Overall Competency Score Badge */}
          <div className="flex sm:flex-col items-center justify-between sm:justify-center p-3.5 sm:px-5 rounded-xl bg-slate-900/90 border border-emerald-500/30 shadow-md min-w-[150px] text-center">
            <span className="text-[11px] text-slate-400 font-medium">종합 러닝 완성도</span>
            <div className="flex items-baseline gap-1 my-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                {summaryData.overallScore}
              </span>
              <span className="text-xs text-slate-500 font-mono">/ 100점</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.max(10, summaryData.overallScore))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="mt-4 pt-3.5 border-t border-white/5 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="p-2 rounded-xl bg-slate-900/50 border border-white/5">
            <span className="block text-[10px] text-slate-400">총 훈련 세션</span>
            <span className="font-mono font-bold text-white text-sm">{totalStats.count}회</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/50 border border-white/5">
            <span className="block text-[10px] text-slate-400">누적 총 마일리지</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">{totalStats.distanceKm} km</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/50 border border-white/5">
            <span className="block text-[10px] text-slate-400">최근 주간 평균</span>
            <span className="font-mono font-bold text-amber-300 text-sm">{totalStats.avgWeeklyKm} km/주</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/50 border border-white/5">
            <span className="block text-[10px] text-slate-400">최장 1회 거리</span>
            <span className="font-mono font-bold text-cyan-400 text-sm">{totalStats.longestRunKm} km</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/50 border border-white/5 col-span-2 sm:col-span-1">
            <span className="block text-[10px] text-slate-400">VDOT 러닝 지수</span>
            <span className="font-mono font-bold text-emerald-300 text-sm">{currentVDOT || '-'}</span>
          </div>
        </div>
      </div>

      {/* Expandable Detailed Analysis: Strengths & Areas for Improvement */}
      {isExpanded && (
        <div className="relative z-10 mt-5 space-y-5 animate-in fade-in duration-300">
          {/* Grid: Strengths & Improvements */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. Core Strengths (러너의 핵심 강점) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-emerald-500/20 space-y-3.5 shadow-lg">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>러너의 핵심 강점 (Strengths)</span>
                    <span className="text-[11px] text-emerald-400 font-mono">
                      ({summaryData.strengths.length})
                    </span>
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400">데이터 기반 분석</span>
              </div>

              <div className="space-y-3">
                {summaryData.strengths.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-900/70 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <h5 className="text-xs sm:text-sm font-bold text-emerald-300">
                          {item.title}
                        </h5>
                      </div>
                    </div>

                    <div className="ml-6 space-y-1">
                      <div className="inline-block text-[11px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 font-semibold mb-1">
                        📊 {item.metric}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Areas for Improvement (보완점 및 맞춤 처방) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-amber-500/20 space-y-3.5 shadow-lg">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                    <Target className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>보완점 및 맞춤 훈련 처방 (Areas for Improvement)</span>
                    <span className="text-[11px] text-amber-400 font-mono">
                      ({summaryData.improvements.length})
                    </span>
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400">기록 향상 처방</span>
              </div>

              <div className="space-y-3">
                {summaryData.improvements.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-900/70 border border-amber-500/20 hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <h5 className="text-xs sm:text-sm font-bold text-amber-300">
                          {item.title}
                        </h5>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          item.priority === '높음'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        우선순위: {item.priority}
                      </span>
                    </div>

                    <div className="ml-6 space-y-1">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        <span className="text-white font-semibold">💡 트레이닝 가이드:</span>{' '}
                        {item.actionPlan}
                      </p>
                      <div className="inline-block text-[11px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-semibold mt-1">
                        🎯 목표: {item.targetMetric}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Coach's Key Strategic Advice & Routine */}
          {(summaryData.keyAdvice || summaryData.recommendedRoutine) && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 to-slate-900/70 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1 flex-1">
                {summaryData.keyAdvice && (
                  <p className="text-slate-200">
                    <span className="font-bold text-cyan-300">🏅 AI 수석 코치의 핵심 조언:</span>{' '}
                    {summaryData.keyAdvice}
                  </p>
                )}
                {summaryData.recommendedRoutine && (
                  <p className="text-slate-400">
                    <span className="font-semibold text-slate-300">📋 추천 주간 루틴:</span>{' '}
                    {summaryData.recommendedRoutine}
                  </p>
                )}
              </div>

              {onOpenTodayWorkoutModal && (
                <button
                  type="button"
                  onClick={onOpenTodayWorkoutModal}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex-shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Footprints className="w-3.5 h-3.5" />
                  <span>오늘 훈련 기록하기</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer Meta Timestamp */}
      <div className="relative z-10 mt-4 pt-3 border-t border-white/5 flex flex-col xs:flex-row xs:items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>
              {summaryData.source === 'gemini'
                ? 'Gemini AI 스포츠 사이언스 심층 분석 완료'
                : 'PaceMaster 스포츠 사이언스 통계 분석 엔진 가동 중'}
            </span>
          </span>
        </div>

        <div className="text-slate-500">
          <span>최근 분석 시각: {summaryData.generatedAt}</span>
        </div>
      </div>
    </section>
  );
};
