import React, { useState, useMemo } from 'react';
import {
  X,
  Footprints,
  Clock,
  Heart,
  Flame,
  Award,
  Calendar,
  Sparkles,
  Zap,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Save,
  ArrowRight,
  RotateCcw,
  Activity,
  Sliders,
  AlertCircle,
} from 'lucide-react';
import {
  TrainingSession,
  RunningRecords,
  RunningGoals,
  RunningShoe,
} from '../types';
import {
  calculateIntegratedWorkoutAnalysis,
  IntegratedWorkoutAnalysis,
} from '../lib/integratedSessionAnalytics';

interface TodayWorkoutLoggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSession: (
    session: Omit<TrainingSession, 'id' | 'createdAt'>
  ) => Promise<void>;
  existingSessions: TrainingSession[];
  records: RunningRecords;
  goals: RunningGoals;
  shoes: RunningShoe[];
}

const WORKOUT_TYPES = [
  { id: '조깅', label: '가벼운 조깅 (Easy)', defaultPace: "5'40\"", defaultDist: 8, zone: 'Zone 2' },
  { id: '템포런', label: '템포런 / 지속주 (Tempo)', defaultPace: "4'45\"", defaultDist: 10, zone: 'Zone 3-4' },
  { id: '인터벌', label: '인터벌 / 스피드 (Interval)', defaultPace: "4'10\"", defaultDist: 8, zone: 'Zone 5' },
  { id: 'LSD', label: 'LSD 장거리 지속주 (LSD)', defaultPace: "5'55\"", defaultDist: 22, zone: 'Zone 2' },
  { id: '회복런', label: '회복 러닝 (Recovery)', defaultPace: "6'20\"", defaultDist: 5, zone: 'Zone 1' },
  { id: '대회', label: '대회 참가 레이스 (Race)', defaultPace: "4'30\"", defaultDist: 10, zone: 'Zone 4-5' },
];

export const TodayWorkoutLoggerModal: React.FC<TodayWorkoutLoggerModalProps> = ({
  isOpen,
  onClose,
  onSaveSession,
  existingSessions,
  records,
  goals,
  shoes,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Form State
  const [date, setDate] = useState(todayStr);
  const [selectedType, setSelectedType] = useState('조깅');
  const [title, setTitle] = useState('오늘의 유산소 이지 조깅');
  const [distanceKm, setDistanceKm] = useState('8.0');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('45');
  const [seconds, setSeconds] = useState('00');
  const [avgHr, setAvgHr] = useState('145');
  const [maxHr, setMaxHr] = useState('162');
  const [selectedShoeId, setSelectedShoeId] = useState<string>(
    shoes.length > 0 ? shoes[0].id : ''
  );
  const [rpe, setRpe] = useState('5'); // 1-10
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Analysis result state shown after saving
  const [analysisResult, setAnalysisResult] =
    useState<IntegratedWorkoutAnalysis | null>(null);

  if (!isOpen) return null;

  // Auto calculate average pace from distance & time
  const calculatedPace = useMemo(() => {
    const dist = parseFloat(distanceKm);
    const h = parseInt(hours || '0', 10);
    const m = parseInt(minutes || '0', 10);
    const s = parseInt(seconds || '0', 10);
    const totalSec = h * 3600 + m * 60 + s;

    if (!dist || dist <= 0 || totalSec <= 0) return "-'--\"";
    const secPerKm = Math.round(totalSec / dist);
    const paceMin = Math.floor(secPerKm / 60);
    const paceSec = secPerKm % 60;
    return `${paceMin}'${String(paceSec).padStart(2, '0')}"`;
  }, [distanceKm, hours, minutes, seconds]);

  // HR Zone Preview
  const hrZoneInfo = useMemo(() => {
    const userMax = records.maxHr || 190;
    const hrVal = parseInt(avgHr || '140', 10);
    const ratio = hrVal / userMax;

    if (ratio < 0.65) return { name: 'Zone 1 (회복)', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    if (ratio < 0.78) return { name: 'Zone 2 (유산소 지구력)', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };
    if (ratio < 0.86) return { name: 'Zone 3 (템포/마라톤)', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
    if (ratio < 0.92) return { name: 'Zone 4 (젖산역치)', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    return { name: 'Zone 5 (무산소/최대산소)', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
  }, [avgHr, records.maxHr]);

  // Handle workout type chip selection
  const handleSelectWorkoutType = (item: (typeof WORKOUT_TYPES)[0]) => {
    setSelectedType(item.id);
    setDistanceKm(item.defaultDist.toString());
    setTitle(
      item.id === '조깅'
        ? '오늘의 유산소 이지 조깅'
        : item.id === '템포런'
        ? '목표 페이스 템포 지속주'
        : item.id === '인터벌'
        ? '트랙 스피드 인터벌 세션'
        : item.id === 'LSD'
        ? '주말 장거리 LSD 빌드업'
        : item.id === '회복런'
        ? '가벼운 리커버리 조깅'
        : '마라톤 공식 레이스 완주'
    );
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dist = parseFloat(distanceKm);
    if (!dist || dist <= 0) {
      return;
    }

    setIsSubmitting(true);

    const h = parseInt(hours || '0', 10);
    const m = parseInt(minutes || '0', 10);
    const s = parseInt(seconds || '0', 10);
    const formattedTime = `${String(h).padStart(2, '0')}:${String(m).padStart(
      2,
      '0'
    )}:${String(s).padStart(2, '0')}`;

    const chosenShoe = shoes.find((sh) => sh.id === selectedShoeId);

    const newSessionData = {
      date,
      title: title.trim() || '오늘의 훈련 세션',
      totalDistanceKm: Math.round(dist * 100) / 100,
      totalTime: formattedTime,
      avgPace: calculatedPace,
      avgHr: parseInt(avgHr || '140', 10),
      maxHr: parseInt(maxHr || '165', 10),
      notes: notes.trim()
        ? `[RPE 자각도 ${rpe}/10] ${notes.trim()}`
        : `[RPE 자각도 ${rpe}/10] 정상적으로 세션을 소화함`,
      shoeId: selectedShoeId || undefined,
      shoeName: chosenShoe ? `${chosenShoe.brand} ${chosenShoe.name}` : undefined,
      laps: [
        {
          lap: 1,
          time: formattedTime,
          cumulativeTime: formattedTime,
          distanceKm: Math.round(dist * 10) / 10,
          avgPace: calculatedPace,
          avgHr: parseInt(avgHr || '140', 10),
          maxHr: parseInt(maxHr || '165', 10),
        },
      ],
    };

    // Calculate sports science integrated analysis
    const dummyFullSession: TrainingSession = {
      ...newSessionData,
      id: 'temp-' + Date.now(),
      createdAt: new Date().toISOString(),
    };

    const analysis = calculateIntegratedWorkoutAnalysis(
      dummyFullSession,
      existingSessions,
      records,
      goals,
      shoes
    );

    try {
      await onSaveSession(newSessionData);
      setAnalysisResult(analysis);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="glass-panel rounded-2xl w-full max-w-2xl border border-emerald-500/30 bg-slate-950/95 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-emerald-950/40 to-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20">
              <Footprints className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>오늘의 러닝 세션 기록</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  통합 분석 엔진
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                오늘 달린 세션을 기록하면 기존 누적 데이터와 즉시 통합되어 주간 볼륨, ACWR 부하, 권장 회복 시간이 정밀 분석됩니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: If saved, show Comprehensive Post-Workout Report */}
        {analysisResult ? (
          <div className="p-5 sm:p-6 space-y-5 animate-fadeIn">
            {/* Top Success Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-900/60 to-teal-900/40 border border-emerald-500/40 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>훈련 기록 저장 및 통합 분석 완료!</span>
                </h3>
                <p className="text-xs text-slate-200 mt-1">
                  오늘 달린 <strong>{analysisResult.workoutDistanceKm} km</strong> ({analysisResult.workoutPace}/km) 세션이 대시보드 및 잔디밭 히트맵에 실시간 반영되었습니다.
                </p>
              </div>
            </div>

            {/* 4 Core Sports Science Analytics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {/* 1. Training Load */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20">
                <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1">
                  <span>훈련 부하 (TRIMP)</span>
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-white font-athletic">
                  {analysisResult.trainingLoadScore}
                  <span className="text-xs font-normal text-slate-400 ml-1">점</span>
                </div>
                <div className="text-[10px] text-amber-400 font-semibold mt-0.5">
                  부하 수준: {analysisResult.trainingLoadLevel}
                </div>
              </div>

              {/* 2. Weekly Volume Progress */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20">
                <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1">
                  <span>이번 주 누적 볼륨</span>
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-cyan-300 font-athletic">
                  {analysisResult.thisWeekTotalKm}
                  <span className="text-xs font-normal text-slate-400 ml-1">km</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  목표의 {analysisResult.weeklyProgressPercent}% 달성
                </div>
              </div>

              {/* 3. ACWR Ratio */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20">
                <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1">
                  <span>ACWR 부하 지수</span>
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-purple-300 font-athletic">
                  {analysisResult.acwr.toFixed(2)}
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                  {analysisResult.acwrStatus}
                </div>
              </div>

              {/* 4. Recovery Hours */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20">
                <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1">
                  <span>권장 회복 시간</span>
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-300 font-athletic">
                  {analysisResult.recommendedRecoveryHours}
                  <span className="text-xs font-normal text-slate-400 ml-1">시간</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  충분한 수면 권장
                </div>
              </div>
            </div>

            {/* Coach Takeaway & Prescription */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <span>스포츠 사이언스 코치의 통합 진단 요약</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {analysisResult.coachTakeaway}
              </p>
              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>심박 강도 구간: <strong className="text-cyan-300">{analysisResult.intensityZone}</strong></span>
                <span>80/20 폴라라이즈드 상태: <strong className="text-emerald-300">{analysisResult.aerobicRatioPercent}% 저강도</strong></span>
                {analysisResult.shoeName && (
                  <span>
                    착용 러닝화: <strong className="text-white">{analysisResult.shoeName}</strong> ({analysisResult.shoeUpdatedMileage}km 누적)
                  </span>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer text-center"
              >
                대시보드에서 훈련 결과 확인하기
              </button>
            </div>
          </div>
        ) : (
          /* Form: Record Today's Workout */
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            {/* Workout Type Chips */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                훈련 유형 선택
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {WORKOUT_TYPES.map((item) => {
                  const isSelected = selectedType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectWorkoutType(item)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold shadow-md shadow-emerald-500/10'
                          : 'bg-slate-900/80 border-white/5 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs">{item.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        권장 페이스: {item.defaultPace}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date & Title Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  훈련 일자
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-300 mb-1">
                  세션 제목
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 오늘의 10km 이지 조깅"
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs font-medium"
                />
              </div>
            </div>

            {/* Distance & Time & Auto Pace Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  러닝 거리 (km)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  required
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  placeholder="8.00"
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold text-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  소요 시간 (시 / 분 / 초)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="w-12 px-2 py-2 glass-input rounded-lg text-xs font-mono text-center"
                    placeholder="0"
                  />
                  <span className="text-slate-400 text-xs">h</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    className="w-14 px-2 py-2 glass-input rounded-lg text-xs font-mono text-center font-bold"
                    placeholder="45"
                  />
                  <span className="text-slate-400 text-xs">m</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={seconds}
                    onChange={(e) => setSeconds(e.target.value)}
                    className="w-14 px-2 py-2 glass-input rounded-lg text-xs font-mono text-center"
                    placeholder="00"
                  />
                  <span className="text-slate-400 text-xs">s</span>
                </div>
              </div>

              {/* Real-time Calculated Pace */}
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  자동 환산 평균 페이스
                </label>
                <div className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-cyan-500/30 flex items-center justify-between">
                  <span className="text-xs text-slate-400">평균</span>
                  <span className="text-sm font-extrabold text-cyan-300 font-mono">
                    {calculatedPace}/km
                  </span>
                </div>
              </div>
            </div>

            {/* Heart Rate & Zones */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  평균 심박수 (bpm)
                </label>
                <input
                  type="number"
                  min="60"
                  max="240"
                  value={avgHr}
                  onChange={(e) => setAvgHr(e.target.value)}
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  최고 심박수 (bpm)
                </label>
                <input
                  type="number"
                  min="60"
                  max="240"
                  value={maxHr}
                  onChange={(e) => setMaxHr(e.target.value)}
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  해당 심박 영역
                </label>
                <div className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold ${hrZoneInfo.color}`}>
                  {hrZoneInfo.name}
                </div>
              </div>
            </div>

            {/* Shoe Selection & RPE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  착용 러닝화 (마일리지 자동 누적 연동)
                </label>
                <select
                  value={selectedShoeId}
                  onChange={(e) => setSelectedShoeId(e.target.value)}
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs font-medium"
                >
                  <option value="">러닝화 미선택</option>
                  {shoes.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.brand} {sh.name} (현재 {sh.mileage}km)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-300">
                    운동 자각도 (RPE: 1~10)
                  </label>
                  <span className="text-xs font-bold text-amber-400">
                    {rpe}점 ({parseInt(rpe, 10) <= 4 ? '가벼움' : parseInt(rpe, 10) <= 7 ? '적정 강도' : '고강도/한계'})
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={rpe}
                  onChange={(e) => setRpe(e.target.value)}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                훈련 메모 및 신체 피드백
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="예: 케이던스 182spm 유지, 후반부 호흡 안정적, 우측 종아리 약간 긴장됨"
                className="w-full px-3 py-2 glass-input rounded-xl text-xs leading-relaxed resize-none"
              />
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? '통합 분석 중...' : '오늘의 훈련 기록 및 분석 저장'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
