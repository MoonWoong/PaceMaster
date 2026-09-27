import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TabsNav, TabKey } from './components/TabsNav';
import { TabMyInfo } from './components/TabMyInfo';
import { TabRunningRecords } from './components/TabRunningRecords';
import { TabMarathonRaces } from './components/TabMarathonRaces';
import { SecurityPromptModal } from './components/SecurityPromptModal';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { PaceCalculatorModal } from './components/PaceCalculatorModal';
import { WeeklyDistanceBarChart } from './components/WeeklyDistanceBarChart';
import { MarathonDDayHeroWidget } from './components/MarathonDDayHeroWidget';
import { DailyInsightCard } from './components/DailyInsightCard';
import { GoalProgressBarSection } from './components/GoalProgressBarSection';
import { AnnualRunningHeatmap } from './components/AnnualRunningHeatmap';
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
  updateTrainingSession,
  deleteTrainingSession,
  clearAllTrainingSessions,
  getWeeklyPlan,
  saveWeeklyPlan,
  getWeeklyPlanSettings,
  saveWeeklyPlanSettings,
  DEFAULT_WEEKLY_PLAN_SETTINGS,
} from './lib/firebase';
import { estimateBestVDOT } from './lib/vdot';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('my_info');
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isPaceCalcOpen, setIsPaceCalcOpen] = useState(false);
  const [isTodayWorkoutModalOpen, setIsTodayWorkoutModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // App State synced with DB
  const [physicalInfo, setPhysicalInfo] = useState<PhysicalInfo>({
    height: 176,
    weight: 68.5,
    age: 33,
  });

  const [shoes, setShoes] = useState<RunningShoe[]>([]);
  const [races, setRaces] = useState<RegisteredRace[]>([]);
  const [runningRecords, setRunningRecords] = useState<RunningRecords>({
    pb5k: '00:20:45',
    pb10k: '00:43:10',
    pbHalf: '01:36:25',
    pbFull: '03:24:50',
    maxHr: 191,
    thresholdHr: 172,
  });
  const [runningGoals, setRunningGoals] = useState<RunningGoals>({
    target10k: '00:39:59',
    targetHalf: '01:29:59',
    targetFull: '03:09:59',
  });
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanDay[]>([]);
  const [weeklyPlanSettings, setWeeklyPlanSettings] = useState<WeeklyPlanSettings>(
    DEFAULT_WEEKLY_PLAN_SETTINGS
  );

  // Load all data on mount asynchronously
  useEffect(() => {
    async function loadData() {
      try {
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
          getPhysicalInfo(),
          getShoes(),
          getRaces(),
          getRunningRecords(),
          getRunningGoals(),
          getTrainingSessions(),
          getWeeklyPlan(),
          getWeeklyPlanSettings(),
        ]);

        if (phys) setPhysicalInfo(phys);
        if (shoeList) setShoes(shoeList);
        if (raceList) setRaces(raceList);
        if (recordsData) setRunningRecords(recordsData);
        if (goalsData) setRunningGoals(goalsData);
        if (sessionsData) setTrainingSessions(sessionsData);
        if (planData) setWeeklyPlan(planData);
        if (planSettingsData) setWeeklyPlanSettings(planSettingsData);
      } catch (err) {
        console.error('Failed to load runner data from DB:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
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
    const created = await addTrainingSession(sessionData);
    setTrainingSessions((prev) => [created, ...prev]);

    // Automatically accumulate shoe mileage if shoe is linked
    if (sessionData.shoeId) {
      const targetShoe = shoes.find((s) => s.id === sessionData.shoeId);
      if (targetShoe) {
        const updatedShoe: RunningShoe = {
          ...targetShoe,
          mileage: Math.round(((targetShoe.mileage || 0) + (sessionData.totalDistanceKm || 0)) * 100) / 100,
        };
        await handleUpdateShoe(updatedShoe);
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

  const bestVdotCalc = estimateBestVDOT(runningRecords);
  const currentVDOT = bestVdotCalc.vdot;

  return (
    <div className="relative min-h-screen text-slate-100 flex flex-col items-center justify-start p-3 sm:p-6 lg:p-8">
      {/* 
        1. 배경화면: 트랙이 있는 잔디 운동장 이미지 + 어두운 오버레이
        고해상도 스포츠 경기장 트랙 & 잔디 필드 이미지 (인물 없음)
      */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=2400&q=80')`,
        }}
      />
      {/* 어두운 그라데이션 오버레이 (텍스트 가독성 최우선 확보 - 스크롤 깜빡임 방지) */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-slate-950/90 via-slate-950/85 to-slate-950/95 pointer-events-none" />

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

        {/* 2. Today's AI Running Insight & Condition Diagnosis */}
        <DailyInsightCard
          sessions={trainingSessions}
          races={races}
          records={runningRecords}
          goals={runningGoals}
          onOpenTodayWorkoutModal={() => setIsTodayWorkoutModalOpen(true)}
        />

        {/* 3. Running Goals Achievement Progress Bars */}
        <GoalProgressBarSection
          goals={runningGoals}
          records={runningRecords}
          onNavigateToGoals={handleNavigateToGoals}
        />

        {/* 4. Dashboard 7-Day Distance Bar Chart */}
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
        <main className="w-full pb-16 pt-6 px-1 sm:px-3 rounded-b-2xl sm:rounded-b-3xl bg-slate-900/95 border-b-2 border-x-2 border-emerald-500/30 shadow-2xl mb-8">
          {isLoading ? (
            <div className="glass-panel rounded-2xl p-12 text-center border border-white/10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-400 mb-3" />
              <p className="text-sm text-slate-300">러닝 대시보드 데이터를 불러오는 중입니다...</p>
            </div>
          ) : (
            <>
              {activeTab === 'my_info' && (
                <TabMyInfo
                  physicalInfo={physicalInfo}
                  shoes={shoes}
                  races={races}
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
                <TabRunningRecords
                  records={runningRecords}
                  goals={runningGoals}
                  trainingSessions={trainingSessions}
                  weeklyPlan={weeklyPlan}
                  weeklyPlanSettings={weeklyPlanSettings}
                  shoes={shoes}
                  onSaveRecords={handleSaveRecords}
                  onSaveGoals={handleSaveGoals}
                  onAddTrainingSession={handleAddTrainingSession}
                  onUpdateTrainingSession={handleUpdateTrainingSession}
                  onDeleteTrainingSession={handleDeleteTrainingSession}
                  onClearAllTrainingSessions={handleClearAllTrainingSessions}
                  onSaveWeeklyPlan={handleSaveWeeklyPlan}
                  onOpenPaceCalculator={() => setIsPaceCalcOpen(true)}
                  onOpenTodayWorkoutModal={() => setIsTodayWorkoutModalOpen(true)}
                />
              )}

              {activeTab === 'marathon_races' && (
                <TabMarathonRaces
                  onRegisterRaceToMyList={async (race) => {
                    await handleAddRace(race);
                  }}
                />
              )}
            </>
          )}
        </main>

        {/* Annual Running Activity Heatmap (GitHub Grass Contribution Graph) */}
        <AnnualRunningHeatmap sessions={trainingSessions} />

        {/* Footer */}
        <footer className="w-full text-center py-6 text-xs text-slate-400 border-t border-white/5">
          <p className="mb-1">
            PaceMaster · 맞춤형 러닝 대시보드 & 마스터즈 트레이닝 시스템
          </p>
          <p className="text-[11px] text-slate-500">
            Firebase Firestore Multi-device Cloud Sync Ready
          </p>
        </footer>
      </div>

      {/* Security Verification Modal */}
      <SecurityPromptModal />

      {/* Target Pace Calculator Modal */}
      {isPaceCalcOpen && (
        <PaceCalculatorModal
          isOpen={isPaceCalcOpen}
          onClose={() => setIsPaceCalcOpen(false)}
          currentVDOT={currentVDOT}
        />
      )}

      {/* Firebase Database Config Modal */}
      <FirebaseConfigModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
      />

      {/* Today's Workout Session Logger & Integrated Analytics Modal */}
      {isTodayWorkoutModalOpen && (
        <TodayWorkoutLoggerModal
          isOpen={isTodayWorkoutModalOpen}
          onClose={() => setIsTodayWorkoutModalOpen(false)}
          onSaveSession={handleAddTrainingSession}
          existingSessions={trainingSessions}
          records={runningRecords}
          goals={runningGoals}
          shoes={shoes}
        />
      )}
    </div>
  );
}
