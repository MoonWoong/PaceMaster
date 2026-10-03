import React, { useState, useEffect, Suspense } from 'react';
import { Header } from './components/Header';
import { TabsNav, TabKey } from './components/TabsNav';
import { TabMyInfo } from './components/TabMyInfo';
import { SecurityPromptModal } from './components/SecurityPromptModal';
import { WeeklyDistanceBarChart } from './components/WeeklyDistanceBarChart';
import { MarathonDDayHeroWidget } from './components/MarathonDDayHeroWidget';
import { StadiumTrackBackground } from './components/StadiumTrackBackground';

// Code Splitting: Lazy-load heavy sub-tabs, widgets & modals for instant initial page render
const TabRunningRecords = React.lazy(() =>
  import('./components/TabRunningRecords').then((m) => ({ default: m.TabRunningRecords }))
);
const TabMarathonRaces = React.lazy(() =>
  import('./components/TabMarathonRaces').then((m) => ({ default: m.TabMarathonRaces }))
);
const AnnualRunningHeatmap = React.lazy(() =>
  import('./components/AnnualRunningHeatmap').then((m) => ({ default: m.AnnualRunningHeatmap }))
);
const DataBackupSection = React.lazy(() =>
  import('./components/DataBackupSection').then((m) => ({ default: m.DataBackupSection }))
);
const PaceCalculatorModal = React.lazy(() =>
  import('./components/PaceCalculatorModal').then((m) => ({ default: m.PaceCalculatorModal }))
);
const FirebaseConfigModal = React.lazy(() =>
  import('./components/FirebaseConfigModal').then((m) => ({ default: m.FirebaseConfigModal }))
);
const TodayWorkoutLoggerModal = React.lazy(() =>
  import('./components/TodayWorkoutLoggerModal').then((m) => ({ default: m.TodayWorkoutLoggerModal }))
);

import {
  PhysicalInfo,
  RunningShoe,
  RegisteredRace,
  RunningRecords,
  RunningGoals,
  TrainingSession,
  WeeklyPlanDay,
  WeeklyPlanSettings,
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
  addTrainingSession,
  addBatchTrainingSessions,
  updateTrainingSession,
  deleteTrainingSession,
  clearAllTrainingSessions,
  getWeeklyPlan,
  saveWeeklyPlan,
  getWeeklyPlanSettings,
  saveWeeklyPlanSettings,
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
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(() =>
    getLocalItem<TrainingSession[]>('training_sessions', DEFAULT_TRAINING_SESSIONS)
  );
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanDay[]>(() =>
    getLocalItem<WeeklyPlanDay[]>('weekly_plan', [])
  );
  const [weeklyPlanSettings, setWeeklyPlanSettings] = useState<WeeklyPlanSettings>(() =>
    getLocalItem<WeeklyPlanSettings>('weekly_plan_settings', DEFAULT_WEEKLY_PLAN_SETTINGS)
  );

  // Non-blocking background sync with Firestore (runs asynchronously without blocking UI)
  useEffect(() => {
    let isMounted = true;
    async function syncCloudData() {
      setIsSyncing(true);
      try {
        function fetchWithTimeout<T>(p: Promise<T>, fallback: T, ms = 5000): Promise<T> {
          return Promise.race([
            p,
            new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
          ]);
        }

        const [
          phys,
          shoeList,
          raceList,
          recordsData,
          goalsData,
          sessionsData,
          planData,
          planSettingsData,
        ] = await Promise.all([
          fetchWithTimeout(getPhysicalInfo(), physicalInfo),
          fetchWithTimeout(getShoes(), shoes),
          fetchWithTimeout(getRaces(), races),
          fetchWithTimeout(getRunningRecords(), runningRecords),
          fetchWithTimeout(getRunningGoals(), runningGoals),
          fetchWithTimeout(getTrainingSessions(), trainingSessions),
          fetchWithTimeout(getWeeklyPlan(), weeklyPlan),
          fetchWithTimeout(getWeeklyPlanSettings(), weeklyPlanSettings),
        ]);

        if (isMounted) {
          if (phys) setPhysicalInfo(phys);
          if (shoeList && shoeList.length > 0) setShoes(shoeList);
          if (raceList && raceList.length > 0) setRaces(raceList);
          if (recordsData) setRunningRecords(recordsData);
          if (goalsData) setRunningGoals(goalsData);
          if (sessionsData) setTrainingSessions(sessionsData);
          if (planData) setWeeklyPlan(planData);
          if (planSettingsData) setWeeklyPlanSettings(planSettingsData);
        }
      } catch (err) {
        console.warn('[Sync] Non-blocking cloud sync completed with notice:', err);
      } finally {
        if (isMounted) {
          setIsSyncing(false);
        }
      }
    }

    syncCloudData();
    return () => {
      isMounted = false;
    };
  }, []);

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
    setActiveTab('running_records');
    setTimeout(() => {
      const el = document.getElementById('running-goals-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.classList.add('ring-2', 'ring-purple-400');
        setTimeout(() => el.classList.remove('ring-2', 'ring-purple-400'), 2500);
      }
    }, 100);
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
    setTrainingSessions((prev) => [created, ...prev]);

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
      return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
        prev.map((s) => (s.id === sessionId ? updated : s))
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
    if (data.trainingSessions) setTrainingSessions(data.trainingSessions);
    if (data.weeklyPlan) setWeeklyPlan(data.weeklyPlan);
    if (data.weeklyPlanSettings) setWeeklyPlanSettings(data.weeklyPlanSettings);
  };

  const bestVdotCalc = estimateBestVDOT(runningRecords);
  const currentVDOT = bestVdotCalc.vdot;

  return (
    <div className="relative min-h-screen text-stone-800 flex flex-col items-center justify-start p-3 sm:p-6 lg:p-8">
      {/* 
        1. 배경화면: 따사로운 봄 햇살 아래 푸른 잔디밭과 붉은 우레탄/클레이 육상 트랙이 펼쳐진 야외 운동장 배경
        2027 경주마라톤 버건디 컬러 & 싱그러운 봄의 초록 잔디 테마
      */}
      <StadiumTrackBackground />

      {/* Main Glassmorphism Container */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col smooth-scroll-surface">
        {/* Header */}
        <Header
          currentVDOT={currentVDOT}
          races={races}
          onOpenDbConfig={() => setIsDbModalOpen(true)}
        />

        {/* 1. Nearest Marathon Target Race D-Day Hero Widget */}
        <MarathonDDayHeroWidget
          races={races}
          goals={runningGoals}
          records={runningRecords}
          onNavigateToRaces={handleNavigateToRaces}
          onNavigateToGoals={handleNavigateToGoals}
          onUpdateRace={handleUpdateRace}
        />

        {/* 2. Dashboard 7-Day Distance Bar Chart */}
        <WeeklyDistanceBarChart
          sessions={trainingSessions}
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
        <main className="w-full pb-16 pt-6 px-1 sm:px-3 rounded-b-2xl sm:rounded-b-3xl bg-white/95 border-b-2 border-x-2 border-emerald-600/30 shadow-xl mb-8 text-stone-800">
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
        <footer className="w-full text-center py-6 text-xs text-stone-600 border-t border-emerald-900/15">
          <p className="mb-1 font-semibold text-emerald-950">
            PaceMaster · 2027 경주마라톤 정조준 러닝 대시보드
          </p>
          <p className="text-[11px] text-stone-500">
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
  );
}
