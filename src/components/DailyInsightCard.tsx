import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  RefreshCw,
  Activity,
  Heart,
  Zap,
  TrendingUp,
  ShieldCheck,
  Award,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Footprints,
} from 'lucide-react';
import { TrainingSession, RegisteredRace, RunningRecords, RunningGoals } from '../types';
import { analyzeRunnerState } from '../lib/trainingPlanGenerator';
import { DailyInsightData, generateHeuristicDailyInsight } from '../lib/dailyInsightFallback';

interface DailyInsightCardProps {
  sessions: TrainingSession[];
  races: RegisteredRace[];
  records: RunningRecords;
  goals: RunningGoals;
  onOpenTodayWorkoutModal?: () => void;
}

const CACHE_KEY = 'pacemaster_daily_insight_cache';

export const DailyInsightCard: React.FC<DailyInsightCardProps> = ({
  sessions,
  races,
  records,
  goals,
  onOpenTodayWorkoutModal,
}) => {
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todaySession = sessions.find((s) => s.date === todayDateStr);

  const [insight, setInsight] = useState<DailyInsightData>(() => {
    // Try restoring from localStorage first
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const today = new Date().toISOString().split('T')[0];
        if (parsed && parsed.dateKey === today && parsed.data) {
          return parsed.data;
        }
      }
    } catch {
      // ignore
    }
    // Initial heuristic calculation
    return generateHeuristicDailyInsight({ sessions, races, records, goals });
  });

  const [isLoading, setIsLoading] = useState(false);

  // Fetch or re-generate insight using server-side Gemini AI
  const fetchGeminiInsight = useCallback(
    async (isManualRefresh = false) => {
      setIsLoading(true);

      const runnerAnalysis = analyzeRunnerState(sessions, records.pbFull ? '풀코스' : '하프');
      const today = new Date().toISOString().split('T')[0];

      // Prepare payload
      const sortedSessions = [...sessions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const latestRun = sortedSessions[0];
      const latestRunSummary = latestRun
        ? `${latestRun.date} - ${latestRun.title} (${latestRun.totalDistanceKm}km, 페이스 ${latestRun.avgPace}, 심박 ${latestRun.avgHr}bpm)`
        : '최근 기록 없음';

      const upcomingRaces = races
        .filter((r) => r.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));
      const targetRace = upcomingRaces.find((r) => r.isTarget) || upcomingRaces[0];

      const payload = {
        runnerProfile: {
          vdot: records.pbFull || records.pbHalf ? '정밀 산출됨' : '초기 설정',
          pb5k: records.pb5k,
          pb10k: records.pb10k,
          pbHalf: records.pbHalf,
          pbFull: records.pbFull,
        },
        recentSessionsSummary: {
          totalSessionsCount: sessions.length,
          avgWeeklyKm: runnerAnalysis.avgWeeklyMileage4Weeks,
          last7DaysKm: runnerAnalysis.lastWeekDistance,
          latestRunSummary,
        },
        acwr: runnerAnalysis.acwr,
        mileageTrend: runnerAnalysis.mileageTrend,
        fatigueRisk: runnerAnalysis.fatigueRisk,
        upcomingRace: targetRace
          ? {
              name: targetRace.name,
              date: targetRace.date,
              dDay: Math.ceil(
                (new Date(targetRace.date).getTime() - new Date().getTime()) /
                  (1000 * 60 * 60 * 24)
              ),
            }
          : null,
      };

      try {
        const response = await fetch('/api/daily-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          if (result && result.title && result.analysis) {
            const fullData: DailyInsightData = {
              readinessScore: Number(result.readinessScore) || 85,
              conditionLevel: result.conditionLevel || '양호 (안정적 페이스 유지)',
              title: result.title,
              analysis: result.analysis,
              recommendedToday: result.recommendedToday,
              cheerMessage: result.cheerMessage,
              generatedAt: new Date().toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              }),
              source: result.source || 'gemini',
            };

            setInsight(fullData);
            try {
              localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({ dateKey: today, data: fullData })
              );
            } catch {
              // ignore
            }
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Gemini API fetch error, using sports-science engine fallback:', err);
      }

      // Fallback
      const fallbackData = generateHeuristicDailyInsight({ sessions, races, records, goals });
      setInsight(fallbackData);
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ dateKey: today, data: fallbackData })
        );
      } catch {
        // ignore
      }
      setIsLoading(false);
    },
    [sessions, races, records, goals]
  );

  // Trigger Gemini insight automatically on mount or session update if cached is not gemini
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.dateKey === today && parsed.data?.source === 'gemini') {
          return; // Already fetched today with Gemini
        }
      }
    } catch {
      // ignore
    }

    fetchGeminiInsight(false);
  }, [fetchGeminiInsight]);

  // Color mappings for readiness score
  const readinessColor =
    insight.readinessScore >= 85
      ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15'
      : insight.readinessScore >= 70
      ? 'text-cyan-300 border-cyan-500/40 bg-cyan-500/15'
      : insight.readinessScore >= 55
      ? 'text-amber-300 border-amber-500/40 bg-amber-500/15'
      : 'text-rose-400 border-rose-500/40 bg-rose-500/15';

  return (
    <section className="w-full glass-panel rounded-2xl p-5 sm:p-6 mb-5 border border-cyan-500/25 bg-gradient-to-br from-slate-900/95 via-cyan-950/20 to-slate-950/95 shadow-xl relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-teal-500/20 text-cyan-400 rounded-xl border border-cyan-500/30 shadow-md">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>오늘의 러닝 인사이트 & 컨디션 진단</span>
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                AI Coach
              </span>
            </div>
            <p className="text-xs text-slate-300">
              최근 훈련 기록, 누적 마일리지, ACWR 부하를 종합 분석하여 오늘의 컨디션과 맞춤 훈련을 제안합니다.
            </p>
          </div>
        </div>

        {/* Action Buttons: Log Today's Run + Re-analyze */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {onOpenTodayWorkoutModal && (
            <button
              type="button"
              onClick={onOpenTodayWorkoutModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>오늘의 훈련 기록</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => fetchGeminiInsight(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            title="최근 기록을 반영하여 AI 인사이트 새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'AI 분석 중...' : '인사이트 재분석'}</span>
          </button>
        </div>
      </div>

      {/* Today's Completed Session Banner (if recorded) */}
      {todaySession && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs relative z-10 animate-fadeIn">
          <div className="flex items-center gap-2.5 text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-white">오늘의 훈련 기록 완료!</span>{' '}
              <span className="text-emerald-200">
                {todaySession.title} ({todaySession.totalDistanceKm}km · {todaySession.avgPace}/km)
              </span>
            </div>
          </div>
          <span className="text-[11px] text-emerald-300 font-semibold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-700/50 self-start sm:self-auto">
            대시보드 & 잔디밭 실시간 통합 반영됨
          </span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start relative z-10">
        {/* Left: Readiness Score Gauge Box (3 cols) */}
        <div className="lg:col-span-3 flex sm:flex-row lg:flex-col items-center justify-between sm:justify-start lg:justify-center gap-3 p-4 rounded-xl bg-slate-950/70 border border-white/5 text-center">
          <div className="relative flex items-center justify-center">
            {/* Circular Readiness Indicator */}
            <div
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 flex flex-col items-center justify-center shadow-lg ${readinessColor}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                훈련 준비도
              </span>
              <span className="text-2xl sm:text-3xl font-black font-athletic tracking-tight text-white">
                {insight.readinessScore}
              </span>
              <span className="text-[9px] text-slate-400">/ 100점</span>
            </div>
          </div>

          <div className="text-left sm:text-left lg:text-center">
            <div className="text-[10px] text-slate-400">오늘의 컨디션 평가</div>
            <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
              {insight.conditionLevel}
            </div>
          </div>
        </div>

        {/* Right: AI Title, Analysis, Recommended Workout & Cheer Message (9 cols) */}
        <div className="lg:col-span-9 space-y-3">
          {/* AI Headline Title */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/60 border border-cyan-500/20">
            <div className="text-xs text-cyan-400 font-semibold flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5" />
              <span>핵심 진단</span>
            </div>
            <h4 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
              {insight.title}
            </h4>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              {insight.analysis}
            </p>
          </div>

          {/* Today's Recommended Action & Cheering Message Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Recommended Workout */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1">
              <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>오늘 추천 훈련 & 리커버리</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {insight.recommendedToday}
              </p>
            </div>

            {/* Motivational Cheer Message */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-slate-900/90 to-purple-950/30 border border-purple-500/20 space-y-1">
              <div className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>러너를 위한 오늘의 한마디</span>
              </div>
              <p className="text-xs text-slate-200 italic leading-relaxed">
                {insight.cheerMessage}
              </p>
            </div>
          </div>

          {/* Footer Badge & Timestamp */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-cyan-400" />
              <span>
                {insight.source === 'gemini'
                  ? 'Gemini 3.8 Flash AI 기반 실시간 분석 완료'
                  : '스포츠 사이언스 분석 엔진 기반'}
              </span>
            </span>
            <span className="text-slate-500">{insight.generatedAt} 기준</span>
          </div>
        </div>
      </div>
    </section>
  );
};
