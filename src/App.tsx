import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Header } from './components/Header';
import { TabsNav, TabKey } from './components/TabsNav';
import { TabMyInfo } from './components/TabMyInfo';
import { SecurityPromptModal } from './components/SecurityPromptModal';
import { DashboardAnalyticsDeck, DashboardAnalyticsTab } from './components/DashboardAnalyticsDeck';
import { MarathonDDayHeroWidget } from './components/MarathonDDayHeroWidget';
import { StadiumTrackBackground } from './components/StadiumTrackBackground';
import { ThemeProvider } from './lib/themeContext';

import { TabRunningRecords } from './components/TabRunningRecords';
import { TabMarathonRaces } from './components/TabMarathonRaces';
import { TabTrainingPlan } from './components/TabTrainingPlan';
import { AnnualRunningHeatmap } from './components/AnnualRunningHeatmap';
import { DataBackupSection } from './components/DataBackupSection';
import { PaceCalculatorModal } from './components/PaceCalculatorModal';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { TodayWorkoutLoggerModal } from './components/TodayWorkoutLoggerModal';

import {
  PhysicalInfo,
  RunningShoe,
  RegisteredRace,
  RunningRecords,
  RunningGoals,
  TrainingSession,
  WeeklyPlanDay,
  WeeklyPlanSettings,
  ComprehensiveTrainingPlan,
} from './types';
import {
  getPhysicalInfo,
  savePhysicalInfo,
  getShoes,
  addShoe,
  updateShoe,
  deleteShoe,
  resetShoesToDefault,
  getRaces,
  addRace,
  updateRace,
  deleteRace,
  getRunningRecords,
  saveRunningRecords,
  getRunningGoals,
  saveRunningGoals,
  getTrainingSessions,
  subscribeTrainingSessions,
  deduplicateSessions,
  addTrainingSession,
  addBatchTrainingSessions,
  updateTrainingSession,
  deleteTrainingSession,
  clearAllTrainingSessions,
  getWeeklyPlan,
  saveWeeklyPlan,
  getWeeklyPlanSettings,
  saveWeeklyPlanSettings,
  getComprehensiveTrainingPlan,
  saveComprehensiveTrainingPlan,
  DEFAULT_PHYSICAL,
  DEFAULT_SHOES,
  DEFAULT_RACES,
  DEFAULT_RECORDS,
  DEFAULT_GOALS,
  DEFAULT_TRAINING_SESSIONS,
  DEFAULT_WEEKLY_PLAN_SETTINGS,
  getLocalItem,
} from './lib/firebase';
import { estimateBestVDOT } from './lib/vdot';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('my_info');
  const [dashboardTab, setDashboardTab] = useState<DashboardAnalyticsTab>('rolling7');
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isPaceCalcOpen, setIsPaceCalcOpen] = useState(false);
  const [isTodayWorkoutModalOpen, setIsTodayWorkoutModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // App State: Instant Synchronous Hydration from Local Storage (0ms initial load time)
  const [physicalInfo, setPhysicalInfo] = useState<PhysicalInfo>(() =>
    getLocalItem<PhysicalInfo>('physical', DEFAULT_PHYSICAL)
  );

  const [shoes, setShoes] = useState<RunningShoe[]>(() =>
    getLocalItem<RunningShoe[]>('shoes', DEFAULT_SHOES)
  );
  const [races, setRaces] = useState<RegisteredRace[]>(() =>
    getLocalItem<RegisteredRace[]>('races', DEFAULT_RACES)
  );
  const [runningRecords, setRunningRecords] = useState<RunningRecords>(() =>
    getLocalItem<RunningRecords>('records', DEFAULT_RECORDS)
  );
  const [runningGoals, setRunningGoals] = useState<RunningGoals>(() =>
    getLocalItem<RunningGoals>('goals', DEFAULT_GOALS)
  );
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(() => {
    const raw = getLocalItem<TrainingSession[]>('training_sessions', DEFAULT_TRAINING_SESSIONS);
    return deduplicateSessions(raw);
  });
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanDay[]>(() =>
    getLocalItem<WeeklyPlanDay[]>('weekly_plan', [])
  );
  const [weeklyPlanSettings, setWeeklyPlanSettings] = useState<WeeklyPlanSettings>(() =>
    getLocalItem<WeeklyPlanSettings>('weekly_plan_settings', DEFAULT_WEEKLY_PLAN_SETTINGS)
  );
  const [comprehensivePlan, setComprehensivePlan] = useState<ComprehensiveTrainingPlan | null>(() =>
    getLocalItem<ComprehensiveTrainingPlan | null>('training_plan', null)
  );

  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  // Reliable cloud sync with Firestore: hydrates local storage and updates state without dropping slow responses
  const syncCloudData = useCallback(async (isManual = false) => {
    setIsSyncing(true);
    try {
      console.log('[Sync] Starting cloud Firestore synchronization...');

      const [
        physResult,
        shoesResult,
        racesResult,
        recordsResult,
        goalsResult,
        sessionsResult,
        planResult,
        planSettingsResult,
        compPlanResult,
      ] = await Promise.allSettled([
        getPhysicalInfo(),
        getShoes(),
        getRaces(),
        getRunningRecords(),
        getRunningGoals(),
        getTrainingSessions(),
        getWeeklyPlan(),
        getWeeklyPlanSettings(),
        getComprehensiveTrainingPlan(),
      ]);

      if (physResult.status === 'fulfilled' && physResult.value) {
        setPhysicalInfo(physResult.value);
      }
      if (shoesResult.status === 'fulfilled' && shoesResult.value && shoesResult.value.length > 0) {
        setShoes(shoesResult.value);
      }
      if (racesResult.status === 'fulfilled' && racesResult.value && racesResult.value.length > 0) {
        setRaces(racesResult.value);
      }
      if (recordsResult.status === 'fulfilled' && recordsResult.value) {
        setRunningRecords(recordsResult.value);
      }
      if (goalsResult.status === 'fulfilled' && goalsResult.value) {
        setRunningGoals(goalsResult.value);
      }
      if (sessionsResult.status === 'fulfilled' && sessionsResult.value) {
        setTrainingSessions(deduplicateSessions(sessionsResult.value));
      }
      if (planResult.status === 'fulfilled' && planResult.value) {
        setWeeklyPlan(planResult.value);
      }
      if (planSettingsResult.status === 'fulfilled' && planSettingsResult.value) {
        setWeeklyPlanSettings(planSettingsResult.value);
      }
      if (compPlanResult.status === 'fulfilled' && compPlanResult.value) {
        setComprehensivePlan(compPlanResult.value);
      }

      setLastSyncedAt(new Date());

      if (isManual) {
        const count =
          sessionsResult.status === 'fulfilled' && sessionsResult.value
            ? sessionsResult.value.length
            : 0;
        const latest =
          sessionsResult.status === 'fulfilled' && sessionsResult.value && sessionsResult.value[0]
            ? ` (최근: ${sessionsResult.value[0].date} ${sessionsResult.value[0].title})`
            : '';
        setSyncToastMessage(`클라우드 Firestore에서 ${count}개 훈련 세션 및 기록을 최신 동기화했습니다.${latest}`);
        setTimeout(() => setSyncToastMessage(null), 3500);
      }
    } catch (err) {
      console.warn('[Sync] Cloud sync notice:', err);
      if (isManual) {
        setSyncToastMessage('클라우드 동기화 중 오류가 발생했습니다. 네트워크를 확인해주세요.');
        setTimeout(() => setSyncToastMessage(null), 3000);
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Initial and reactive background sync with live real-time subscription
  useEffect(() => {
    syncCloudData();

    // Live real-time listener for Firestore training_sessions (syncs instantly across tabs and URLs)
    const unsub = subscribeTrainingSessions((freshSessions) => {
      setTrainingSessions(deduplicateSessions(freshSessions));
    });

    // Re-sync whenever the user switches back to this browser tab or window
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncCloudData();
      }
    };
    const handleFocus = () => {
      syncCloudData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (unsub) unsub();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [syncCloudData]);

  const handleSaveComprehensivePlan = async (plan: ComprehensiveTrainingPlan) => {
    await saveComprehensiveTrainingPlan(plan);
    setComprehensivePlan(plan);
  };

  // Handlers for Physical Info
  const handleSavePhysical = async (info: PhysicalInfo) => {
    await savePhysicalInfo(info);
    setPhysicalInfo(info);
  };

  // Handlers for Shoes
  const handleAddShoe = async (newShoeData: Omit<RunningShoe, 'id'>) => {
    const created = await addShoe(newShoeData);
    setShoes((prev) => [created, ...prev]);
  };

  const handleUpdateShoe = async (updatedShoe: RunningShoe) => {
    await updateShoe(updatedShoe);
    setShoes((prev) => prev.map((s) => (s.id === updatedShoe.id ? updatedShoe : s)));
  };

  const handleDeleteShoe = async (id: string) => {
    await deleteShoe(id);
    setShoes((prev) => prev.filter((s) => s.id !== id));
  };

  const handleResetShoes = async () => {
    const list = await resetShoesToDefault();
    setShoes(list);
  };

  // Handlers for Races
  const handleAddRace = async (newRaceData: Omit<RegisteredRace, 'id'>) => {
    const created = await addRace(newRaceData);
    setRaces((prev) =>
      [...prev, created].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    );
  };

  const handleDeleteRace = async (id: string) => {
    await deleteRace(id);
    setRaces((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRace = async (updatedRace: RegisteredRace) => {
    await updateRace(updatedRace);
    setRaces((prev) =>
      prev.map((r) => (r.id === updatedRace.id ? updatedRace : r))
    );
  };

  // Focus Navigation Handlers
  const handleNavigateToRaces = () => {
    setActiveTab('marathon_races');
    setTimeout(() => {
      const el = document.getElementById('marathon-races-tab');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.focus();
      }
    }, 100);
  };

  const handleNavigateToGoals = () => {
    setDashboardTab('goals');
    setTimeout(() => {
      const el = document.getElementById('dashboard-analytics-deck');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleNavigateToPlan = () => {
    setActiveTab('training_plan');
    setTimeout(() => {
      const el = document.getElementById('training-plan-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.focus();
        el.classList.add('ring-2', 'ring-emerald-500');
        setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500'), 2500);
      }
    }, 120);
  };

  const handleNavigateToShoes = () => {
    setActiveTab('my_info');
    setTimeout(() => {
      const el = document.getElementById('shoe-closet-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-2', 'ring-cyan-400');
        setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-400'), 2500);
      }
    }, 100);
  };

  // Handlers for Running Records
  const handleSaveRecords = async (rec: RunningRecords) => {
    await saveRunningRecords(rec);
    setRunningRecords(rec);
  };

  // Handlers for Running Goals
  const handleSaveGoals = async (gls: RunningGoals) => {
    await saveRunningGoals(gls);
    setRunningGoals(gls);
  };

  // Handlers for Training Sessions (CSV & Quick Log)
  const handleAddTrainingSession = async (
    sessionData: Omit<TrainingSession, 'id' | 'createdAt'>
  ) => {
    let finalSession = { ...sessionData };
    if (finalSession.shoeId && !finalSession.shoeName) {
      const targetShoe = shoes.find((s) => s.id === finalSession.shoeId);
      if (targetShoe) {
        finalSession.shoeName = targetShoe.name;
      }
    }

    const created = await addTrainingSession(finalSession);
    setTrainingSessions((prev) => deduplicateSessions([created, ...prev]));

    // Automatically accumulate shoe mileage if shoe is linked
    if (finalSession.shoeId) {
      const targetShoe = shoes.find((s) => s.id === finalSession.shoeId);
      if (targetShoe) {
        const updatedShoe: RunningShoe = {
          ...targetShoe,
          mileage: Math.round(((targetShoe.mileage || 0) + (finalSession.totalDistanceKm || 0)) * 100) / 100,
        };
        await handleUpdateShoe(updatedShoe);
      }
    }
  };

  const handleAddBatchTrainingSessions = async (
    sessionsData: Omit<TrainingSession, 'id' | 'createdAt'>[]
  ) => {
    if (!sessionsData || sessionsData.length === 0) return;

    // Ensure all sessions with shoeId have shoeName populated
    const enrichedSessions = sessionsData.map((s) => {
      if (s.shoeId && !s.shoeName) {
        const targetShoe = shoes.find((sh) => sh.id === s.shoeId);
        if (targetShoe) {
          return { ...s, shoeName: targetShoe.name };
        }
      }
      return s;
    });

    const createdList = await addBatchTrainingSessions(enrichedSessions);
    setTrainingSessions((prev) => {
      const combined = [...createdList, ...prev];
      return deduplicateSessions(combined);
    });

    // Accumulate shoe mileage across all sessions in the batch
    const mileageMap: Record<string, number> = {};
    for (const s of enrichedSessions) {
      if (s.shoeId && s.totalDistanceKm > 0) {
        mileageMap[s.shoeId] = (mileageMap[s.shoeId] || 0) + s.totalDistanceKm;
      }
    }

    if (Object.keys(mileageMap).length > 0) {
      for (const [sId, dist] of Object.entries(mileageMap)) {
        const targetShoe = shoes.find((s) => s.id === sId);
        if (targetShoe) {
          const updatedShoe: RunningShoe = {
            ...targetShoe,
            mileage: Math.round(((targetShoe.mileage || 0) + dist) * 100) / 100,
          };
          await handleUpdateShoe(updatedShoe);
        }
      }
    }
  };

  const handleUpdateTrainingSession = async (
    sessionId: string,
    updates: Partial<TrainingSession>
  ) => {
    const updated = await updateTrainingSession(sessionId, updates);
    if (updated) {
      setTrainingSessions((prev) =>
        deduplicateSessions(prev.map((s) => (s.id === sessionId ? updated : s)))
      );
    }
  };

  const handleDeleteTrainingSession = async (id: string) => {
    await deleteTrainingSession(id);
    setTrainingSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClearAllTrainingSessions = async () => {
    await clearAllTrainingSessions();
    setTrainingSessions([]);
  };

  // Handlers for Weekly Plan
  const handleSaveWeeklyPlan = async (
    plan: WeeklyPlanDay[],
    settings?: WeeklyPlanSettings
  ) => {
    await saveWeeklyPlan(plan, settings);
    setWeeklyPlan(plan);
    if (settings) {
      setWeeklyPlanSettings(settings);
    }
  };

  const handleRestoreSuccess = (data: {
    physicalInfo: PhysicalInfo;
    shoes: RunningShoe[];
    races: RegisteredRace[];
    runningRecords: RunningRecords;
    runningGoals: RunningGoals;
    trainingSessions: TrainingSession[];
    weeklyPlan?: WeeklyPlanDay[];
    weeklyPlanSettings?: WeeklyPlanSettings;
  }) => {
    if (data.physicalInfo) setPhysicalInfo(data.physicalInfo);
    if (data.shoes) setShoes(data.shoes);
    if (data.races) setRaces(data.races);
    if (data.runningRecords) setRunningRecords(data.runningRecords);
    if (data.runningGoals) setRunningGoals(data.runningGoals);
    if (data.trainingSessions) setTrainingSessions(deduplicateSessions(data.trainingSessions));
    if (data.weeklyPlan) setWeeklyPlan(data.weeklyPlan);
    if (data.weeklyPlanSettings) setWeeklyPlanSettings(data.weeklyPlanSettings);
  };

  const bestVdotCalc = estimateBestVDOT(runningRecords);
  const currentVDOT = bestVdotCalc.vdot;

  return (
    <ThemeProvider>
      <div className="relative min-h-screen text-stone-800 dark:text-stone-100 flex flex-col items-center justify-start p-3 sm:p-6 lg:p-8 transition-colors duration-200">
        {/* 
          1. 배경화면: 따사로운 봄 햇살 아래 푸른 잔디밭과 붉은 우레탄/클레이 육상 트랙이 펼쳐진 야외 운동장 배경
          2027 경주마라톤 버건디 컬러 & 싱그러운 봄의 초록 잔디 테마 (다크 모드 시 몰입감 넘치는 야간 스타디움 조명 연출)
        */}
        <StadiumTrackBackground />

        {/* Main Glassmorphism Container */}
        <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col smooth-scroll-surface">
          {/* Header */}
          <Header
            currentVDOT={currentVDOT}
            races={races}
            isSyncing={isSyncing}
            sessionsCount={trainingSessions.length}
            lastSyncedAt={lastSyncedAt}
            onManualSync={() => syncCloudData(true)}
            onOpenDbConfig={() => setIsDbModalOpen(true)}
          />

          {/* Sync Success / Notification Toast */}
          {syncToastMessage && (
            <div className="fixed bottom-6 right-6 z-50 animate-bounce">
              <div className="px-4 py-3 rounded-2xl bg-emerald-900/95 text-white font-bold text-xs sm:text-sm shadow-xl border border-emerald-500 flex items-center gap-2.5 backdrop-blur-md">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>{syncToastMessage}</span>
              </div>
            </div>
          )}

          {/* Cloud Hydration Banner on Fresh Load */}
          {isSyncing && trainingSessions.length === 0 && (
            <div className="w-full mb-4 p-3 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700/80 shadow-sm flex items-center justify-between gap-3 text-xs text-emerald-950 dark:text-emerald-200">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="font-bold">Firestore 클라우드에서 러닝 기록 및 훈련 데이터를 동기화하고 있습니다...</span>
              </div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">실시간 연결 중</span>
            </div>
          )}

          {/* 1. Nearest Marathon Target Race D-Day Hero Widget */}
          <MarathonDDayHeroWidget
            races={races}
            goals={runningGoals}
            records={runningRecords}
            onNavigateToRaces={handleNavigateToRaces}
            onNavigateToGoals={handleNavigateToGoals}
            onNavigateToPlan={handleNavigateToPlan}
            onUpdateRace={handleUpdateRace}
          />

          {/* 2. Unified Dashboard Analytics Deck (최근 7일, 주간, PB, 러닝목표) */}
          <DashboardAnalyticsDeck
            sessions={trainingSessions}
            records={runningRecords}
            goals={runningGoals}
            activeTab={dashboardTab}
            onChangeTab={setDashboardTab}
            onSaveRecords={handleSaveRecords}
            onSaveGoals={handleSaveGoals}
            onOpenPaceCalculator={() => setIsPaceCalcOpen(true)}
            onNavigateToRecords={() => setActiveTab('running_records')}
          />

          {/* 3 Main Tabs Nav (내 정보, 러닝기록, 마라톤 대회) */}
          <TabsNav
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            shoesCount={shoes.length}
            sessionsCount={trainingSessions.length}
            racesCount={races.length}
          />

          {/* Connected Tab Content Deck Container - Seamlessly united with active tab */}
          <main className="w-full pb-16 pt-6 px-1 sm:px-3 rounded-b-2xl sm:rounded-b-3xl bg-white/95 dark:bg-stone-900/95 border-b-2 border-x-2 border-emerald-600/30 dark:border-emerald-500/30 shadow-xl mb-8 text-stone-800 dark:text-stone-100 transition-colors">
          {activeTab === 'my_info' && (
            <TabMyInfo
              physicalInfo={physicalInfo}
              shoes={shoes}
              races={races}
              sessions={trainingSessions}
              onSavePhysical={handleSavePhysical}
              onAddShoe={handleAddShoe}
              onUpdateShoe={handleUpdateShoe}
              onDeleteShoe={handleDeleteShoe}
              onResetShoes={handleResetShoes}
              onAddRace={handleAddRace}
              onDeleteRace={handleDeleteRace}
              onUpdateRace={handleUpdateRace}
            />
          )}

          {activeTab === 'running_records' && (
            <Suspense
              fallback={
                <div className="py-20 text-center space-y-3">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600 mb-2" />
                  <p className="text-sm font-bold text-stone-700">훈련 기록 대시보드를 불러오는 중입니다...</p>
                  <p className="text-xs text-stone-500">러닝 세션 데이터 및 맞춤 훈련 계획을 준비합니다.</p>
                </div>
              }
            >
              <TabRunningRecords
                records={runningRecords}
                goals={runningGoals}
                trainingSessions={trainingSessions}
                weeklyPlan={weeklyPlan}
                weeklyPlanSettings={weeklyPlanSettings}
                shoes={shoes}
                races={races}
                onSaveRecords={handleSaveRecords}
                onSaveGoals={handleSaveGoals}
                onAddTrainingSession={handleAddTrainingSession}
                onAddBatchTrainingSessions={handleAddBatchTrainingSessions}
                onUpdateTrainingSession={handleUpdateTrainingSession}
                onDeleteTrainingSession={handleDeleteTrainingSession}
                onClearAllTrainingSessions={handleClearAllTrainingSessions}
                onSaveWeeklyPlan={handleSaveWeeklyPlan}
                onUpdateRace={handleUpdateRace}
                onOpenPaceCalculator={() => setIsPaceCalcOpen(true)}
                onOpenTodayWorkoutModal={() => setIsTodayWorkoutModalOpen(true)}
                onNavigateToShoes={handleNavigateToShoes}
                onNavigateToRaces={handleNavigateToRaces}
              />
            </Suspense>
          )}

          {activeTab === 'training_plan' && (
            <Suspense
              fallback={
                <div className="py-20 text-center space-y-3">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600 mb-2" />
                  <p className="text-sm font-bold text-stone-700">맞춤 훈련 계획표를 불러오는 중입니다...</p>
                  <p className="text-xs text-stone-500">주기화 스케줄 및 상세 훈련 목적을 준비합니다.</p>
                </div>
              }
            >
              <TabTrainingPlan
                currentVDOT={currentVDOT}
                races={races}
                goals={runningGoals}
                shoes={shoes}
                sessions={trainingSessions}
                records={runningRecords}
                savedPlan={comprehensivePlan}
                onSavePlan={handleSaveComprehensivePlan}
                onOpenLogWorkout={(dateStr, defaultTitle, defaultDist) => {
                  setIsTodayWorkoutModalOpen(true);
                }}
              />
            </Suspense>
          )}

          {activeTab === 'marathon_races' && (
            <Suspense
              fallback={
                <div className="py-20 text-center space-y-3">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600 mb-2" />
                  <p className="text-sm font-bold text-stone-700">전국 마라톤 대회 DB를 불러오는 중입니다...</p>
                  <p className="text-xs text-stone-500">최신 다가오는 대회 일정 및 코스 정보를 동기화합니다.</p>
                </div>
              }
            >
              <TabMarathonRaces
                onRegisterRaceToMyList={async (race) => {
                  await handleAddRace(race);
                }}
              />
            </Suspense>
          )}
        </main>

        {/* Annual Running Activity Heatmap (GitHub Grass Contribution Graph) */}
        <Suspense fallback={null}>
          <AnnualRunningHeatmap sessions={trainingSessions} />
        </Suspense>

        {/* Data Loss Prevention: Local JSON Export & Import Section */}
        <Suspense fallback={null}>
          <DataBackupSection
            physicalInfo={physicalInfo}
            shoes={shoes}
            races={races}
            runningRecords={runningRecords}
            runningGoals={runningGoals}
            trainingSessions={trainingSessions}
            weeklyPlan={weeklyPlan}
            weeklyPlanSettings={weeklyPlanSettings}
            onRestoreSuccess={handleRestoreSuccess}
          />
        </Suspense>

        {/* Footer */}
        <footer className="w-full text-center py-6 text-xs text-stone-600 dark:text-stone-400 border-t border-emerald-900/15 dark:border-stone-800">
          <p className="mb-1 font-semibold text-emerald-950 dark:text-emerald-400">
            PaceMaster · 2027 경주마라톤 정조준 러닝 대시보드
          </p>
          <p className="text-[11px] text-stone-500 dark:text-stone-400">
            Firebase Firestore Multi-device Cloud Sync Ready · Gyeongju Marathon Heritage Edition
          </p>
        </footer>
      </div>

      {/* Security Verification Modal */}
      <SecurityPromptModal />

      {/* Target Pace Calculator Modal */}
      {isPaceCalcOpen && (
        <Suspense fallback={null}>
          <PaceCalculatorModal
            isOpen={isPaceCalcOpen}
            onClose={() => setIsPaceCalcOpen(false)}
            currentVDOT={currentVDOT}
          />
        </Suspense>
      )}

      {/* Firebase Database Config Modal */}
      {isDbModalOpen && (
        <Suspense fallback={null}>
          <FirebaseConfigModal
            isOpen={isDbModalOpen}
            onClose={() => setIsDbModalOpen(false)}
          />
        </Suspense>
      )}

      {/* Today's Workout Session Logger & Integrated Analytics Modal */}
      {isTodayWorkoutModalOpen && (
        <Suspense fallback={null}>
          <TodayWorkoutLoggerModal
            isOpen={isTodayWorkoutModalOpen}
            onClose={() => setIsTodayWorkoutModalOpen(false)}
            onSaveSession={handleAddTrainingSession}
            existingSessions={trainingSessions}
            records={runningRecords}
            goals={runningGoals}
            shoes={shoes}
          />
        </Suspense>
      )}
      </div>
    </ThemeProvider>
  );
}
