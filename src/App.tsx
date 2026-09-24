import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TabsNav, TabKey } from './components/TabsNav';
import { TabMyInfo } from './components/TabMyInfo';
import { TabRunningRecords } from './components/TabRunningRecords';
import { TabMarathonRaces } from './components/TabMarathonRaces';
import { SecurityPromptModal } from './components/SecurityPromptModal';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';

import {
  PhysicalInfo,
  RunningShoe,
  RegisteredRace,
  RunningRecords,
  RunningGoals,
  TrainingSession,
  WeeklyPlanDay,
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
  deleteRace,
  getRunningRecords,
  saveRunningRecords,
  getRunningGoals,
  saveRunningGoals,
  getTrainingSessions,
  addTrainingSession,
  deleteTrainingSession,
  getWeeklyPlan,
  saveWeeklyPlan,
} from './lib/firebase';
import { estimateBestVDOT } from './lib/vdot';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('my_info');
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
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
        ] = await Promise.all([
          getPhysicalInfo(),
          getShoes(),
          getRaces(),
          getRunningRecords(),
          getRunningGoals(),
          getTrainingSessions(),
          getWeeklyPlan(),
        ]);

        if (phys) setPhysicalInfo(phys);
        if (shoeList) setShoes(shoeList);
        if (raceList) setRaces(raceList);
        if (recordsData) setRunningRecords(recordsData);
        if (goalsData) setRunningGoals(goalsData);
        if (sessionsData) setTrainingSessions(sessionsData);
        if (planData) setWeeklyPlan(planData);
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

  // Handlers for Training Sessions (CSV)
  const handleAddTrainingSession = async (
    sessionData: Omit<TrainingSession, 'id' | 'createdAt'>
  ) => {
    const created = await addTrainingSession(sessionData);
    setTrainingSessions((prev) => [created, ...prev]);
  };

  const handleDeleteTrainingSession = async (id: string) => {
    await deleteTrainingSession(id);
    setTrainingSessions((prev) => prev.filter((s) => s.id !== id));
  };

  // Handlers for Weekly Plan
  const handleSaveWeeklyPlan = async (plan: WeeklyPlanDay[]) => {
    await saveWeeklyPlan(plan);
    setWeeklyPlan(plan);
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
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-700 pointer-events-none"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=2400&q=80')`,
        }}
      />
      {/* 어두운 그라데이션 오버레이 (텍스트 가독성 최우선 확보) */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-slate-950/85 via-slate-950/80 to-slate-950/92 backdrop-blur-[2px] pointer-events-none" />

      {/* Main Glassmorphism Container */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col">
        {/* Header */}
        <Header
          currentVDOT={currentVDOT}
          races={races}
          onOpenDbConfig={() => setIsDbModalOpen(true)}
        />

        {/* 3 Main Tabs Nav (내 정보, 러닝기록, 마라톤 대회) */}
        <TabsNav activeTab={activeTab} onChangeTab={setActiveTab} />

        {/* Tab Content Area */}
        <main className="w-full pb-16">
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
                />
              )}

              {activeTab === 'running_records' && (
                <TabRunningRecords
                  records={runningRecords}
                  goals={runningGoals}
                  trainingSessions={trainingSessions}
                  weeklyPlan={weeklyPlan}
                  onSaveRecords={handleSaveRecords}
                  onSaveGoals={handleSaveGoals}
                  onAddTrainingSession={handleAddTrainingSession}
                  onDeleteTrainingSession={handleDeleteTrainingSession}
                  onSaveWeeklyPlan={handleSaveWeeklyPlan}
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

        {/* Footer */}
        <footer className="w-full text-center py-6 text-xs text-slate-400 border-t border-white/5">
          <p className="mb-1">
            PaceMaster · 맞춤형 러닝 대시보드 & 마스터즈 트레이닝 시스템
          </p>
          <p className="text-[11px] text-slate-500">
            데이터 변경 보안 인증 키: <span className="font-mono text-emerald-400 font-semibold">ansdnd1!</span> · Firebase Firestore Multi-device Sync Ready
          </p>
        </footer>
      </div>

      {/* Security Verification Modal */}
      <SecurityPromptModal />

      {/* Firebase Database Config Modal */}
      <FirebaseConfigModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
      />
    </div>
  );
}
