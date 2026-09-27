import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Zap,
  Shield,
  Flame,
  CheckCircle2,
  Calendar,
  ChevronRight,
  TrendingUp,
  Activity,
  ArrowRight,
  Award,
  Layers,
  Heart,
  Timer,
  Check,
  RotateCcw,
} from 'lucide-react';
import { TrainingSession, WeeklyPlanDay, WeeklyPlanSettings, RunningShoe } from '../types';
import {
  analyzeAndRecommendTrainingIntensity,
  IntensityLevel,
  IntensityRoutinePackage,
} from '../lib/trainingRecommendation';
import { verifyRunnerSecurityKey } from '../lib/security';

interface TrainingIntensityRecommenderProps {
  sessions: TrainingSession[];
  vdot: number;
  targetRaceCourse?: string;
  shoes?: RunningShoe[];
  onApplyRoutine: (routineDays: WeeklyPlanDay[], settings?: WeeklyPlanSettings) => Promise<void>;
}

export const TrainingIntensityRecommender: React.FC<TrainingIntensityRecommenderProps> = ({
  sessions,
  vdot,
  targetRaceCourse = '풀코스',
  shoes = [],
  onApplyRoutine,
}) => {
  // Analysis from sports science engine with shoe rotation
  const analysis = useMemo(() => {
    return analyzeAndRecommendTrainingIntensity(sessions, vdot, targetRaceCourse, shoes);
  }, [sessions, vdot, targetRaceCourse, shoes]);

  // Selected level state (defaults to AI recommended level)
  const [selectedLevel, setSelectedLevel] = useState<IntensityLevel>(analysis.recommendedLevel);
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);

  const activePackage: IntensityRoutinePackage = analysis.routines[selectedLevel];

  // Handle Apply Routine to User's Weekly Plan
  const handleApply = async () => {
    const ok = await verifyRunnerSecurityKey(`'${selectedLevel}' 단계 7일 훈련 루틴을 내 주간 계획에 적용`);
    if (!ok) return;

    try {
      setIsApplying(true);
      // Construct settings
      const trainingDays = activePackage.days
        .filter((d) => d.type !== '휴식')
        .map((d) => d.day as any);

      const speedDayItem = activePackage.days.find(
        (d) => d.type === '인터벌' || d.type === '템포런'
      );
      const longRunItem = activePackage.days.find((d) => d.type === 'LSD');

      const settings: WeeklyPlanSettings = {
        trainingDays: trainingDays.length > 0 ? trainingDays : ['화요일', '목요일', '토요일', '일요일'],
        speedDay: (speedDayItem?.day as any) || '수요일',
        speedWorkoutType:
          speedDayItem?.type === '인터벌'
            ? '인터벌'
            : speedDayItem?.type === '템포런'
            ? '템포런'
            : '인터벌',
        longRunDay: (longRunItem?.day as any) || '일요일',
        targetRaceCourse: (targetRaceCourse as any) || '풀코스',
        updatedAt: new Date().toISOString(),
      };

      await onApplyRoutine(activePackage.days, settings);
      setApplySuccessMsg(`'${selectedLevel}' 단계 훈련 루틴이 주간 계획표에 성공적으로 적용되었습니다!`);
      setTimeout(() => setApplySuccessMsg(null), 4500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-white/10 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-xl font-bold text-white">
                다음 주 맞춤 훈련 강도 추천 & 루틴 제안
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold font-mono">
                VDOT {vdot.toFixed(1)} Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              최근 주간 마일리지 추세와 급성·만성 부하(ACWR)를 심층 분석하여 최적의 훈련 단계를 진단합니다.
            </p>
          </div>
        </div>

        {/* AI Recommended Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-900/90 px-3.5 py-2 rounded-xl border border-amber-500/30 shadow-md">
          <span className="text-xs text-slate-300">AI 추천 강도:</span>
          <span
            className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${
              analysis.recommendedLevel === '강화'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/20'
                : analysis.recommendedLevel === '유지'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}
          >
            {analysis.recommendedLevel === '회복' && '🌿 회복 (Recovery)'}
            {analysis.recommendedLevel === '유지' && '⚡ 유지 (Maintenance)'}
            {analysis.recommendedLevel === '강화' && '🔥 강화 (Build Overload)'}
          </span>
        </div>
      </div>

      {/* Scientific Analysis Diagnostic Callout */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950 border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>스포츠 사이언스 훈련 부하 진단 결과:</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-400">
              최근 1주: <strong className="text-white font-athletic">{analysis.acuteLoadKm}km</strong>
            </span>
            <span className="text-slate-400">
              4주 평균: <strong className="text-white font-athletic">{analysis.chronicLoadKm}km</strong>
            </span>
            <span className="text-slate-400">
              ACWR 지수:{' '}
              <strong
                className={
                  analysis.acwr > 1.25
                    ? 'text-rose-400 font-athletic'
                    : analysis.acwr >= 0.85
                    ? 'text-emerald-400 font-athletic'
                    : 'text-amber-400 font-athletic'
                }
              >
                {analysis.acwr}
              </strong>
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-200 leading-relaxed">
          {analysis.recommendationReason}
        </p>

        <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1 border-t border-white/5">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>{analysis.vdotInsight}</span>
        </div>
      </div>

      {/* 3-Way Level Switcher Cards */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-2.5">
          훈련 강도 단계 선택 (루틴 미리보기 및 전환):
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. 회복 Card */}
          <button
            type="button"
            onClick={() => setSelectedLevel('회복')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
              selectedLevel === '회복'
                ? 'bg-gradient-to-b from-emerald-950/60 to-slate-900 border-emerald-400 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-900/60 border-white/10 hover:border-white/20'
            }`}
          >
            {analysis.recommendedLevel === '회복' && (
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ⭐ AI 강력 추천
              </span>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">🌿</span>
                <span className="text-sm sm:text-base font-extrabold text-white">
                  회복 (Recovery)
                </span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-2 mb-2">
                {analysis.routines.회복.summary}
              </p>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400">주간 목표 거리:</span>
              <span className="font-extrabold text-emerald-400 font-athletic text-sm">
                {analysis.routines.회복.targetWeeklyKm} km
              </span>
            </div>
          </button>

          {/* 2. 유지 Card */}
          <button
            type="button"
            onClick={() => setSelectedLevel('유지')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
              selectedLevel === '유지'
                ? 'bg-gradient-to-b from-cyan-950/60 to-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/10'
                : 'bg-slate-900/60 border-white/10 hover:border-white/20'
            }`}
          >
            {analysis.recommendedLevel === '유지' && (
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                ⭐ AI 강력 추천
              </span>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">⚡</span>
                <span className="text-sm sm:text-base font-extrabold text-white">
                  유지 (Maintenance)
                </span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-2 mb-2">
                {analysis.routines.유지.summary}
              </p>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400">주간 목표 거리:</span>
              <span className="font-extrabold text-cyan-400 font-athletic text-sm">
                {analysis.routines.유지.targetWeeklyKm} km
              </span>
            </div>
          </button>

          {/* 3. 강화 Card */}
          <button
            type="button"
            onClick={() => setSelectedLevel('강화')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
              selectedLevel === '강화'
                ? 'bg-gradient-to-b from-rose-950/60 to-slate-900 border-rose-400 shadow-lg shadow-rose-500/10'
                : 'bg-slate-900/60 border-white/10 hover:border-white/20'
            }`}
          >
            {analysis.recommendedLevel === '강화' && (
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                ⭐ AI 강력 추천
              </span>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">🔥</span>
                <span className="text-sm sm:text-base font-extrabold text-white">
                  강화 (Build Overload)
                </span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-2 mb-2">
                {analysis.routines.강화.summary}
              </p>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400">주간 목표 거리:</span>
              <span className="font-extrabold text-rose-400 font-athletic text-sm">
                {analysis.routines.강화.targetWeeklyKm} km
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Selected Level Deep-Dive Banner */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">
              [{activePackage.level}] {activePackage.tagline}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              ({activePackage.volumeRatioText})
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            {activePackage.keyBenefits.map((benefit, bIdx) => (
              <span
                key={bIdx}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[11px]"
              >
                <Check className="w-3 h-3 text-emerald-400" />
                <span>{benefit}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Apply Routine Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isApplying}
            onClick={handleApply}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              selectedLevel === '강화'
                ? 'bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 shadow-rose-500/20'
                : selectedLevel === '유지'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 shadow-cyan-500/20'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>이 루틴으로 내 주간 계획 적용</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {applySuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn shadow-md">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{applySuccessMsg}</span>
        </div>
      )}

      {/* 7-Day Proposed Routine Schedule Table/Cards */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-300 font-semibold px-1">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>다음 주 7일(월~일) 맞춤 일별 훈련 일정표</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
              👟 보유 러닝화 로테이션 추천 포함
            </span>
          </span>
          <span className="text-[11px] text-slate-400">
            총 주행: <strong className="text-white font-athletic">{activePackage.targetWeeklyKm}km</strong> (장거리 {activePackage.longRunKm}km)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-2.5">
          {activePackage.days.map((dayPlan, idx) => {
            const isRest = dayPlan.type === '휴식';
            const isSpeed = dayPlan.type === '인터벌' || dayPlan.type === '템포런';
            const isLsd = dayPlan.type === 'LSD';

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                  isRest
                    ? 'bg-slate-900/40 border-white/5 opacity-80'
                    : isSpeed
                    ? 'bg-gradient-to-b from-rose-950/30 to-slate-900/80 border-rose-500/30 shadow-sm'
                    : isLsd
                    ? 'bg-gradient-to-b from-purple-950/30 to-slate-900/80 border-purple-500/30 shadow-sm'
                    : 'bg-slate-900/70 border-white/10'
                }`}
              >
                <div>
                  {/* Top Day Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">
                      {dayPlan.day.replace('요일', '')}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                        ({dayPlan.dayShort})
                      </span>
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                        isRest
                          ? 'bg-slate-800 text-slate-400'
                          : isSpeed
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : isLsd
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {dayPlan.type}
                    </span>
                  </div>

                  {/* Workout Title */}
                  <h4 className="text-xs font-bold text-white line-clamp-1 mb-1" title={dayPlan.title}>
                    {dayPlan.title}
                  </h4>

                  {/* Distance & Pace */}
                  {!isRest && (
                    <div className="my-1.5 p-1.5 rounded-lg bg-black/30 border border-white/5 space-y-0.5">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-[10px] text-slate-400">목표 거리:</span>
                        <strong className="text-white font-athletic font-bold">
                          {dayPlan.distanceKm} km
                        </strong>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-[10px] text-slate-400">목표 페이스:</span>
                        <strong className="text-cyan-300 font-athletic text-[11px]">
                          {dayPlan.targetPace}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed mt-1">
                    {dayPlan.description}
                  </p>

                  {/* Recommended Shoe Pill & Rotation Insight */}
                  {dayPlan.recommendedShoe && (
                    <div className="mt-2.5 p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-[10px] space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 text-emerald-300 font-bold truncate">
                          <span>👟</span>
                          <span className="truncate">{dayPlan.recommendedShoe.shoeName}</span>
                        </div>
                        {dayPlan.recommendedShoe.category && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex-shrink-0">
                            {dayPlan.recommendedShoe.category}
                          </span>
                        )}
                      </div>
                      {dayPlan.recommendedShoe.reason && (
                        <p className="text-[9px] text-slate-300 leading-tight line-clamp-2">
                          💡 {dayPlan.recommendedShoe.reason}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom intensity tag */}
                <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">강도:</span>
                  <span
                    className={`font-semibold ${
                      dayPlan.intensity === '높음'
                        ? 'text-rose-400'
                        : dayPlan.intensity === '보통'
                        ? 'text-amber-400'
                        : dayPlan.intensity === '낮음'
                        ? 'text-emerald-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {dayPlan.intensity}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
