import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Zap,
  Activity,
  Check,
  TrendingUp,
  Shield,
  Flame,
  Award,
} from 'lucide-react';
import { TrainingSession, RunningShoe } from '../types';
import {
  analyzeAndRecommendTrainingIntensity,
  IntensityLevel,
  IntensityRoutinePackage,
} from '../lib/trainingRecommendation';

interface TrainingIntensityRecommenderProps {
  sessions: TrainingSession[];
  vdot: number;
  targetRaceCourse?: string;
  shoes?: RunningShoe[];
  onApplyRoutine?: (routineDays: any[], settings?: any) => Promise<void>;
}

export const TrainingIntensityRecommender: React.FC<TrainingIntensityRecommenderProps> = ({
  sessions,
  vdot,
  targetRaceCourse = '풀코스',
  shoes = [],
}) => {
  // Analysis from sports science engine with shoe rotation
  const analysis = useMemo(() => {
    return analyzeAndRecommendTrainingIntensity(sessions, vdot, targetRaceCourse, shoes);
  }, [sessions, vdot, targetRaceCourse, shoes]);

  // Selected level state (defaults to AI recommended level)
  const [selectedLevel, setSelectedLevel] = useState<IntensityLevel>(analysis.recommendedLevel);

  const activePackage: IntensityRoutinePackage = analysis.routines[selectedLevel];

  return (
    <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-white/10 shadow-xl space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 rounded-xl border border-amber-500/30 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-xl font-bold text-white">
                다음 주 맞춤 훈련 강도 추천
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold font-mono">
                VDOT {vdot.toFixed(1)} Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 keep-all">
              직전 주간 마일리지와 최근 4주 누적 추세, 급성·만성 부하(ACWR)를 심층 분석하여 다음 주 최적의 훈련 강도 및 권장 마일리지를 진단합니다.
            </p>
          </div>
        </div>

        {/* AI Recommended Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-900/90 px-3.5 py-2 rounded-xl border border-amber-500/30 shadow-md flex-shrink-0">
          <span className="text-xs text-slate-300 whitespace-nowrap">AI 추천 강도:</span>
          <span
            className={`px-2.5 py-0.5 rounded-lg text-xs font-black border whitespace-nowrap ${
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
            <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="keep-all">스포츠 사이언스 직전 주간 훈련 부하 진단:</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono">
            <span className="text-slate-400 whitespace-nowrap">
              직전 주간({analysis.lastWeekLabel || '지난주 월~일'}):{' '}
              <strong className="text-cyan-300 font-athletic font-bold">
                {analysis.lastWeekDistance ?? analysis.acuteLoadKm}km
              </strong>
            </span>
            <span className="text-slate-400 whitespace-nowrap">
              4주 평균: <strong className="text-white font-athletic">{analysis.chronicLoadKm}km</strong>
            </span>
            <span className="text-slate-400 whitespace-nowrap">
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

        <p className="text-xs text-slate-200 leading-relaxed keep-all">
          {analysis.recommendationReason}
        </p>

        <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1 border-t border-white/5">
          <Activity className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          <span className="keep-all">{analysis.vdotInsight}</span>
        </div>
      </div>

      {/* 3-Way Level Switcher Cards */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-2.5">
          훈련 강도 단계별 진단 및 목표 볼륨 (선택하여 비교):
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
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
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
              <p className="text-[11px] text-slate-300 line-clamp-3 mb-2 keep-all leading-relaxed">
                {analysis.routines.회복.summary}
              </p>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs whitespace-nowrap">
              <span className="text-slate-400">권장 주간 볼륨:</span>
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
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
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
              <p className="text-[11px] text-slate-300 line-clamp-3 mb-2 keep-all leading-relaxed">
                {analysis.routines.유지.summary}
              </p>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs whitespace-nowrap">
              <span className="text-slate-400">권장 주간 볼륨:</span>
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
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap">
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
              <p className="text-[11px] text-slate-300 line-clamp-3 mb-2 keep-all leading-relaxed">
                {analysis.routines.강화.summary}
              </p>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs whitespace-nowrap">
              <span className="text-slate-400">권장 주간 볼륨:</span>
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">
              [{activePackage.level}] {activePackage.tagline}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              ({activePackage.volumeRatioText})
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300 pt-1">
            {activePackage.keyBenefits.map((benefit, bIdx) => (
              <span
                key={bIdx}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[11px] keep-all"
              >
                <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span>{benefit}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-white/5 flex items-center gap-2 flex-shrink-0 max-w-sm keep-all">
          <span className="text-emerald-400 text-sm flex-shrink-0">💡</span>
          <span>
            상세 요일별 플랜 편성은 아래 <strong>[일자별 주간 맞춤 훈련 상세계획표]</strong>에서 맞춤 생성 및 확인하실 수 있습니다.
          </span>
        </div>
      </div>
    </section>
  );
};
