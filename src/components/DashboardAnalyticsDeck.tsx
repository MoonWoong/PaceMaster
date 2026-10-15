import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  TrendingUp,
  Award,
  Target,
  Activity,
  Heart,
  Zap,
  Save,
  Calculator,
  Flame,
} from 'lucide-react';
import { RunningGoals, RunningRecords, TrainingSession } from '../types';
import {
  parseTimeToSeconds,
  calculateVDOT,
  estimateBestVDOT,
  getRunnerTier,
  calculateHeartRateZones,
  getTrainingPaces,
  evaluateRunningGoal,
} from '../lib/vdot';
import { verifyRunnerSecurityKey } from '../lib/security';
import { WeeklyDistanceBarChart } from './WeeklyDistanceBarChart';
import { TrainingAnalyticsDashboard } from './TrainingAnalyticsDashboard';
import { HeartRateTrendAnalytics } from './HeartRateTrendAnalytics';
import { GoalProgressBarSection } from './GoalProgressBarSection';

export type DashboardAnalyticsTab = 'rolling7' | 'weekly' | 'heartrate' | 'pb' | 'goals';

interface DashboardAnalyticsDeckProps {
  sessions: TrainingSession[];
  records: RunningRecords;
  goals: RunningGoals;
  activeTab?: DashboardAnalyticsTab;
  onChangeTab?: (tab: DashboardAnalyticsTab) => void;
  onSaveRecords: (records: RunningRecords) => Promise<void>;
  onSaveGoals: (goals: RunningGoals) => Promise<void>;
  onOpenPaceCalculator?: () => void;
  onNavigateToRecords?: () => void;
}

export const DashboardAnalyticsDeck: React.FC<DashboardAnalyticsDeckProps> = ({
  sessions,
  records,
  goals,
  activeTab: controlledTab,
  onChangeTab: controlledOnChangeTab,
  onSaveRecords,
  onSaveGoals,
  onOpenPaceCalculator,
  onNavigateToRecords,
}) => {
  const [internalTab, setInternalTab] = useState<DashboardAnalyticsTab>('rolling7');
  const currentTab = controlledTab !== undefined ? controlledTab : internalTab;
  const setTab = (tab: DashboardAnalyticsTab) => {
    if (controlledOnChangeTab) controlledOnChangeTab(tab);
    else setInternalTab(tab);
  };

  // ==========================================
  // PB & HR Zones State & Logic (Tab: 'pb')
  // ==========================================
  const [pb5k, setPb5k] = useState(records?.pb5k || '00:21:00');
  const [pb10k, setPb10k] = useState(records?.pb10k || '00:43:30');
  const [pbHalf, setPbHalf] = useState(records?.pbHalf || '01:36:00');
  const [pbFull, setPbFull] = useState(records?.pbFull || '03:25:00');
  const [maxHr, setMaxHr] = useState(records?.maxHr ? records.maxHr.toString() : '190');
  const [thresholdHr, setThresholdHr] = useState(
    records?.thresholdHr ? records.thresholdHr.toString() : '172'
  );
  const [isSavingRecords, setIsSavingRecords] = useState(false);
  const [recordsSavedAlert, setRecordsSavedAlert] = useState(false);

  useEffect(() => {
    if (records) {
      if (records.pb5k != null) setPb5k(records.pb5k);
      if (records.pb10k != null) setPb10k(records.pb10k);
      if (records.pbHalf != null) setPbHalf(records.pbHalf);
      if (records.pbFull != null) setPbFull(records.pbFull);
      if (records.maxHr != null) setMaxHr(records.maxHr.toString());
      if (records.thresholdHr != null) setThresholdHr(records.thresholdHr.toString());
    }
  }, [records]);

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
    setRecordsSavedAlert(true);
    setTimeout(() => setRecordsSavedAlert(false), 2500);
  };

  // ==========================================
  // Goals State & Logic (Tab: 'goals')
  // ==========================================
  const [target10k, setTarget10k] = useState(goals?.target10k || '00:39:59');
  const [targetHalf, setTargetHalf] = useState(goals?.targetHalf || '01:29:59');
  const [targetFull, setTargetFull] = useState(goals?.targetFull || '03:09:59');
  const [evalSelectedDistance, setEvalSelectedDistance] = useState<'10K' | '하프' | '풀코스'>('풀코스');
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [goalsSavedAlert, setGoalsSavedAlert] = useState(false);

  useEffect(() => {
    if (goals) {
      if (goals.target10k != null) setTarget10k(goals.target10k);
      if (goals.targetHalf != null) setTargetHalf(goals.targetHalf);
      if (goals.targetFull != null) setTargetFull(goals.targetFull);
    }
  }, [goals]);

  const liveGoals = useMemo(
    () => ({
      target10k: target10k || goals?.target10k || '',
      targetHalf: targetHalf || goals?.targetHalf || '',
      targetFull: targetFull || goals?.targetFull || '',
    }),
    [target10k, targetHalf, targetFull, goals]
  );

  const targetTimeForEval =
    evalSelectedDistance === '10K'
      ? target10k
      : evalSelectedDistance === '하프'
      ? targetHalf
      : targetFull;

  const goalEvaluation = useMemo(() => {
    return evaluateRunningGoal(currentVDOT, evalSelectedDistance, targetTimeForEval);
  }, [currentVDOT, evalSelectedDistance, targetTimeForEval]);

  const handleSaveGoalsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await verifyRunnerSecurityKey('러닝 목표 기록 저장');
    if (!ok) return;

    setIsSavingGoals(true);
    await onSaveGoals({
      target10k: target10k.trim(),
      targetHalf: targetHalf.trim(),
      targetFull: targetFull.trim(),
    });
    setIsSavingGoals(false);
    setGoalsSavedAlert(true);
    setTimeout(() => setGoalsSavedAlert(false), 2500);
  };

  const TABS: { id: DashboardAnalyticsTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'rolling7', label: '최근 7일', icon: Calendar },
    { id: 'weekly', label: '주간', icon: TrendingUp },
    { id: 'heartrate', label: '심박', icon: Heart },
    { id: 'pb', label: 'PB', icon: Award },
    { id: 'goals', label: '러닝목표', icon: Target },
  ];

  return (
    <section id="dashboard-analytics-deck" className="w-full mb-6">
      {/* Connected Tab Header Bar (상위 탭 제목 영역 - 하위 컨텐츠와 빈틈없이 일체형 연결) */}
      <div className="relative pt-1 px-1 sm:px-2 bg-stone-100/90 dark:bg-stone-900/90 border-x-2 border-t-2 border-emerald-600/30 dark:border-emerald-500/30 backdrop-blur-md rounded-t-2xl sm:rounded-t-3xl transition-colors">
        {/* Category Context Strip */}
        <div className="flex items-center justify-between px-2.5 py-1 mb-1 text-[11px] text-stone-600 dark:text-stone-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-700 dark:bg-rose-400" />
            <span className="font-mono font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
              마일리지 & 생체 분석 덱
            </span>
            <span className="text-stone-400">/</span>
            <span className="text-rose-900 dark:text-rose-300 font-bold truncate">
              {currentTab === 'rolling7' && '최근 7일간 일자별 훈련 마일리지 대시보드'}
              {currentTab === 'weekly' && '주간 마일리지 추세 & 훈련 부하 강도 분석'}
              {currentTab === 'heartrate' && '페이스별 심박 흐름 & 심폐 유산소 효율 분석'}
              {currentTab === 'pb' && '러닝 PB & 생리학적 5대 심박존 분석'}
              {currentTab === 'goals' && '러닝 목표 & AI 실현 타당성 분석'}
            </span>
          </div>
        </div>

        {/* 5-Tab Navigation Buttons Row - Active tab bottom blends seamlessly into body container below */}
        <nav
          aria-label="상위 마일리지 및 생체 분석 탭"
          className="grid grid-cols-5 gap-1 sm:gap-2 items-end -mb-[1px] relative z-10"
        >
          {TABS.map((tab) => {
            const isActive = currentTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={`group relative flex items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 sm:py-2.5 px-0.5 sm:px-2.5 transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-white/95 dark:bg-stone-900/95 text-stone-900 dark:text-white font-black shadow-none border-t-2 border-x-2 border-b-0 border-emerald-600/30 dark:border-emerald-500/30 rounded-t-xl sm:rounded-t-2xl z-20'
                    : 'bg-stone-200/50 dark:bg-stone-800/50 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/80 dark:hover:bg-stone-800/80 font-bold border border-transparent rounded-t-lg sm:rounded-t-xl mb-0.5'
                }`}
              >
                <Icon
                  className={`w-3 sm:w-4 h-3 sm:h-4 shrink-0 transition-colors ${
                    isActive
                      ? 'text-rose-700 dark:text-rose-400'
                      : 'text-stone-400 dark:text-stone-500 group-hover:text-stone-700 dark:group-hover:text-stone-300'
                  }`}
                />
                <span className="text-[11px] sm:text-sm truncate font-semibold sm:font-bold">{tab.label}</span>
                {isActive && (
                  <span className="absolute top-0 left-2 right-2 h-0.5 bg-gradient-to-r from-rose-800 via-rose-600 to-rose-900 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Connected Tab Content Deck Container - Seamlessly united with active tab */}
      <div className="w-full p-4 sm:p-6 rounded-b-2xl sm:rounded-b-3xl bg-white/95 dark:bg-stone-900/95 border-b-2 border-x-2 border-emerald-600/30 dark:border-emerald-500/30 shadow-xl text-stone-800 dark:text-stone-100 transition-colors">
        {/* Tab 1: 최근 7일간 훈련 마일리지 대시보드 */}
        {currentTab === 'rolling7' && (
          <div className="animate-fadeIn">
            <WeeklyDistanceBarChart
              sessions={sessions}
              onNavigateToRecords={onNavigateToRecords}
              isNested={true}
            />
          </div>
        )}

        {/* Tab 2: 주간 마일리지 추세 & 훈련 강도 분석 */}
        {currentTab === 'weekly' && (
          <div className="animate-fadeIn">
            <TrainingAnalyticsDashboard
              sessions={sessions}
              maxHr={parseInt(maxHr, 10) || 190}
              thresholdHr={parseInt(thresholdHr, 10) || 172}
              isNested={true}
            />
          </div>
        )}

        {/* Tab 3: 페이스별 심박 흐름 & 심폐 효율 분석 */}
        {currentTab === 'heartrate' && (
          <div className="animate-fadeIn">
            <HeartRateTrendAnalytics
              sessions={sessions}
              maxHr={parseInt(maxHr, 10) || 190}
              thresholdHr={parseInt(thresholdHr, 10) || 172}
              isNested={true}
            />
          </div>
        )}

        {/* Tab 4: 러닝 PB & 생리학적 심박존 분석 */}
        {currentTab === 'pb' && (
          <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-xl border border-rose-700/40 shadow-xs">
                <Activity className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-white">
                  러닝 PB & 생리학적 심박존 분석
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  거리별 최고 기록(PB)과 심박수를 기반으로 VDOT 및 5대 심박존을 정밀 계산합니다.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {onOpenPaceCalculator && (
                <button
                  type="button"
                  onClick={onOpenPaceCalculator}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-750 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="목표 거리와 예상 완주 시간으로 필요한 평균 페이스 계산하기"
                >
                  <Calculator className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>목표 페이스 계산기</span>
                </button>
              )}

              {/* VDOT & Tier Hero Badge */}
              <div className="flex items-center gap-3 p-2 px-3.5 rounded-xl bg-rose-50/90 dark:bg-stone-800 border border-rose-200 dark:border-rose-900/60 shadow-xs">
                <div className="text-right">
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider">
                    VDOT
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-rose-900 dark:text-rose-400 font-athletic">
                    {currentVDOT > 0 ? currentVDOT.toFixed(1) : '--'}
                  </div>
                </div>
                <div className="h-7 w-px bg-rose-200 dark:bg-stone-700" />
                <div className="text-left">
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100">{runnerTier.label}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Inputs for PB and Heart Rates */}
          <form onSubmit={handleSaveRecordsSubmit}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  5K PB (hh:mm:ss)
                </label>
                <input
                  type="text"
                  value={pb5k}
                  onChange={(e) => setPb5k(e.target.value)}
                  placeholder="00:21:00"
                  className="h-10 w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  10K PB (hh:mm:ss)
                </label>
                <input
                  type="text"
                  value={pb10k}
                  onChange={(e) => setPb10k(e.target.value)}
                  placeholder="00:43:30"
                  className="h-10 w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  하프 PB (hh:mm:ss)
                </label>
                <input
                  type="text"
                  value={pbHalf}
                  onChange={(e) => setPbHalf(e.target.value)}
                  placeholder="01:36:00"
                  className="h-10 w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  풀코스 PB (hh:mm:ss)
                </label>
                <input
                  type="text"
                  value={pbFull}
                  onChange={(e) => setPbFull(e.target.value)}
                  placeholder="03:25:00"
                  className="h-10 w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  <span>최대 심박수 (Max HR bpm)</span>
                </label>
                <input
                  type="number"
                  value={maxHr}
                  onChange={(e) => setMaxHr(e.target.value)}
                  placeholder="190"
                  className="h-10 w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>역치 심박수 (Threshold HR / LTHR bpm)</span>
                </label>
                <input
                  type="number"
                  value={thresholdHr}
                  onChange={(e) => setThresholdHr(e.target.value)}
                  placeholder="172"
                  className="h-10 w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              {recordsSavedAlert ? (
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 animate-pulse">
                  ✓ 러닝 PB & 심박수가 성공적으로 저장되었습니다.
                </span>
              ) : <div />}

              <button
                type="submit"
                disabled={isSavingRecords}
                className="h-10 sm:h-11 w-full sm:w-auto px-5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-md shadow-emerald-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-emerald-400/30"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingRecords ? '저장 중...' : '러닝 정보 저장'}</span>
              </button>
            </div>
          </form>

          {/* 5대 심박존 (Zone 1 ~ Zone 5) 시각화 */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>러너 맞춤 심박 트레이닝 존 (Heart Rate Zones)</span>
              </h3>
              <span className="text-[10px] text-stone-500 dark:text-stone-400">최대 {maxHr || 190} bpm / 역치 {thresholdHr || 172} bpm</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {hrZones.map((z) => (
                <div
                  key={z.zone}
                  className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/90 border border-stone-200 dark:border-stone-750 flex flex-col justify-between shadow-2xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-stone-900 dark:text-white">Zone {z.zone}</span>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: z.color }}
                    />
                  </div>
                  <div className="text-[11px] font-medium text-stone-600 dark:text-stone-300 truncate">
                    {z.nameKo.split(' ')[0]}
                  </div>
                  <div className="text-sm sm:text-base font-extrabold font-athletic text-emerald-800 dark:text-emerald-300 my-0.5">
                    {z.minHr}~{z.maxHr} <span className="text-[10px] font-normal text-stone-500 dark:text-stone-400">bpm</span>
                  </div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">{z.pctRange}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Jack Daniels VDOT 훈련 페이스 표 */}
          {trainingPaces && (
            <div className="mt-4 pt-3.5 border-t border-stone-200 dark:border-stone-800">
              <h3 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white mb-2.5 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>VDOT 기준 권장 훈련 페이스 (Training Paces)</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/90 border border-stone-200 dark:border-stone-750 shadow-2xs">
                  <div className="text-stone-500 dark:text-stone-400 text-[11px]">이지 (E-Pace)</div>
                  <div className="text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-300 font-athletic mt-0.5">
                    {trainingPaces.easyPaceRange.min} ~ {trainingPaces.easyPaceRange.max}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/90 border border-stone-200 dark:border-stone-750 shadow-2xs">
                  <div className="text-stone-500 dark:text-stone-400 text-[11px]">마라톤 (M-Pace)</div>
                  <div className="text-xs sm:text-sm font-bold text-rose-900 dark:text-rose-300 font-athletic mt-0.5">
                    {trainingPaces.marathonPace.pace}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/90 border border-stone-200 dark:border-stone-750 shadow-2xs">
                  <div className="text-stone-500 dark:text-stone-400 text-[11px]">역치 (T-Pace)</div>
                  <div className="text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-300 font-athletic mt-0.5">
                    {trainingPaces.thresholdPace.pace}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/90 border border-stone-200 dark:border-stone-750 shadow-2xs">
                  <div className="text-stone-500 dark:text-stone-400 text-[11px]">인터벌 (I-Pace)</div>
                  <div className="text-xs sm:text-sm font-bold text-rose-800 dark:text-rose-300 font-athletic mt-0.5">
                    {trainingPaces.intervalPace.pace}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/90 border border-stone-200 dark:border-stone-750 shadow-2xs col-span-2 sm:col-span-1">
                  <div className="text-stone-500 dark:text-stone-400 text-[11px]">반복 (R-Pace)</div>
                  <div className="text-xs sm:text-sm font-bold text-purple-800 dark:text-purple-300 font-athletic mt-0.5">
                    {trainingPaces.repetitionPace.pace}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: 러닝 목표 & AI 실현 타당성 분석 */}
      {currentTab === 'goals' && (
        <div
          id="running-goals-card"
          tabIndex={-1}
          className="space-y-6 outline-none transition-all duration-300 animate-fadeIn"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-xl border border-rose-700/40 shadow-xs">
                <Target className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <span>러닝 목표 & AI 실현 타당성 분석</span>
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  거리별 목표 완주 시간을 설정하면 VDOT 기반 달성 가능성과 전략을 진단합니다.
                </p>
              </div>
            </div>
          </div>

          {/* Goals Input Form */}
          <form onSubmit={handleSaveGoalsSubmit} className="mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  10K 목표 (hh:mm:ss)
                </label>
                <input
                  type="text"
                  value={target10k}
                  onChange={(e) => setTarget10k(e.target.value)}
                  placeholder="00:39:59"
                  className="h-10 w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  하프 마라톤 목표
                </label>
                <input
                  type="text"
                  value={targetHalf}
                  onChange={(e) => setTargetHalf(e.target.value)}
                  placeholder="01:29:59"
                  className="h-10 w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  풀코스 마라톤 목표
                </label>
                <input
                  type="text"
                  value={targetFull}
                  onChange={(e) => setTargetFull(e.target.value)}
                  placeholder="03:09:59"
                  className="h-10 w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={isSavingGoals}
                  className="h-10 w-full px-4 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer border border-emerald-500 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingGoals ? '저장 중...' : '목표 기록 저장'}</span>
                </button>
              </div>
            </div>
          </form>

          {goalsSavedAlert && (
            <div className="mb-4 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 animate-pulse">
              ✓ 목표 기록이 성공적으로 저장되었습니다.
            </div>
          )}

          {/* 러닝 목표 달성도 프로그레스 바 영역 */}
          <GoalProgressBarSection
            goals={liveGoals}
            records={records}
            isNested={true}
          />

          {/* Distance Selector for AI Analysis */}
          <div className="flex items-center gap-2 mb-3 pt-4 border-t border-stone-200 dark:border-stone-800">
            <span className="text-xs text-stone-600 dark:text-stone-300 font-medium">검증 코스:</span>
            {(['10K', '하프', '풀코스'] as const).map((dist) => (
              <button
                key={dist}
                type="button"
                onClick={() => setEvalSelectedDistance(dist)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  evalSelectedDistance === dist
                    ? 'bg-rose-900 text-white shadow-sm'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-700'
                }`}
              >
                {dist}
              </button>
            ))}
          </div>

          {/* AI Feasibility Evaluation Card */}
          {goalEvaluation && (
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-stone-850 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-emerald-200/60 dark:border-emerald-800/40">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-stone-900 dark:text-white">
                    [{evalSelectedDistance}] 목표 VDOT: <span className="text-emerald-800 dark:text-emerald-300 font-athletic text-sm">{goalEvaluation.targetVDOT.toFixed(1)}</span>
                  </span>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400">
                    (현재 {currentVDOT.toFixed(1)} 대비 {goalEvaluation.diffVDOT > 0 ? `+${goalEvaluation.diffVDOT}` : goalEvaluation.diffVDOT})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-600 dark:text-stone-300">타당성 점수:</span>
                  <strong className="text-sm font-athletic text-stone-900 dark:text-white">{goalEvaluation.feasibilityScore}%</strong>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                      goalEvaluation.feasibilityScore >= 70
                        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : goalEvaluation.feasibilityScore >= 45
                        ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                        : 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                    }`}
                  >
                    {goalEvaluation.feasibilityLevel}
                  </span>
                </div>
              </div>

              <div className="text-xs text-stone-700 dark:text-stone-200 leading-relaxed">
                <span className="text-emerald-900 dark:text-emerald-300 font-semibold mr-1">분석 의견:</span>
                {goalEvaluation.aiFeedback}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-lg bg-white dark:bg-stone-850 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                  <span className="text-emerald-900 dark:text-emerald-300 font-semibold mr-1">추천 집중:</span>
                  <span className="text-stone-700 dark:text-stone-300">{goalEvaluation.recommendedTrainingFocus}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-stone-850 border border-rose-200 dark:border-rose-850 flex flex-col sm:flex-row sm:items-center justify-between gap-1 shadow-2xs">
                  <div>
                    <span className="text-rose-900 dark:text-rose-300 font-semibold mr-1">필수 대회 페이스:</span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">({evalSelectedDistance} 목표 {targetTimeForEval} 기준)</span>
                  </div>
                  <span className="text-rose-900 dark:text-rose-300 font-athletic font-bold text-xs sm:text-sm">
                    {goalEvaluation.requiredRacePace} /km 유지 필요
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </section>
  );
};
