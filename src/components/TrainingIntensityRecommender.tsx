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
    <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-emerald-600/20 shadow-sm bg-white/95 text-stone-800 space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white rounded-xl shadow-xs flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-xl font-bold text-stone-900">
                다음 주 맞춤 훈련 강도 추천
              </h2>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold font-mono">
                VDOT {vdot.toFixed(1)} Engine
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-0.5 keep-all">
              직전 주간 마일리지와 최근 4주 누적 추세, 급성·만성 부하(ACWR)를 심층 분석하여 다음 주 최적의 훈련 강도 및 권장 마일리지를 진단합니다.
            </p>
          </div>
        </div>

        {/* AI Recommended Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-stone-50 px-3.5 py-2 rounded-xl border border-stone-300 shadow-2xs flex-shrink-0">
          <span className="text-xs text-stone-600 whitespace-nowrap font-medium">AI 추천 강도:</span>
          <span
            className={`px-2.5 py-0.5 rounded-lg text-xs font-black border whitespace-nowrap ${
              analysis.recommendedLevel === '강화'
                ? 'bg-rose-100 text-rose-900 border-rose-300 shadow-xs'
                : analysis.recommendedLevel === '유지'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {analysis.recommendedLevel === '회복' && '🌿 회복 (Recovery)'}
            {analysis.recommendedLevel === '유지' && '⚡ 유지 (Maintenance)'}
            {analysis.recommendedLevel === '강화' && '🔥 강화 (Build Overload)'}
          </span>
        </div>
      </div>

      {/* Scientific Analysis Diagnostic Callout */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50/90 via-stone-50/70 to-rose-50/90 border border-emerald-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
            <Zap className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span className="keep-all">스포츠 사이언스 직전 주간 훈련 부하 진단:</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono">
            <span className="text-stone-600 whitespace-nowrap">
              직전 주간({analysis.lastWeekLabel || '지난주 월~일'}):{' '}
              <strong className="text-emerald-800 font-athletic font-bold">
                {analysis.lastWeekDistance ?? analysis.acuteLoadKm}km
              </strong>
            </span>
            <span className="text-stone-600 whitespace-nowrap">
              4주 평균: <strong className="text-stone-900 font-athletic">{analysis.chronicLoadKm}km</strong>
            </span>
            <span className="text-stone-600 whitespace-nowrap">
              ACWR 지수:{' '}
              <strong
                className={
                  analysis.acwr > 1.25
                    ? 'text-rose-900 font-athletic'
                    : analysis.acwr >= 0.85
                    ? 'text-emerald-800 font-athletic'
                    : 'text-amber-800 font-athletic'
                }
              >
                {analysis.acwr}
              </strong>
            </span>
          </div>
        </div>

        <p className="text-xs text-stone-700 leading-relaxed keep-all">
          {analysis.recommendationReason}
        </p>

        <div className="text-[11px] text-stone-600 flex items-center gap-2 pt-1 border-t border-stone-200/80">
          <Activity className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
          <span className="keep-all font-medium">{analysis.vdotInsight}</span>
        </div>
      </div>

      {/* 3-Way Level Switcher Cards */}
      <div>
        <label className="block text-xs font-bold text-stone-700 mb-2.5">
          훈련 강도 단계별 진단 및 목표 볼륨 (선택하여 비교):
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. 회복 Card */}
          <button
            type="button"
            onClick={() => setSelectedLevel('회복')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
              selectedLevel === '회복'
                ? 'bg-emerald-50/80 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                : 'bg-white border-stone-200 hover:border-emerald-300 shadow-2xs'
            }`}
          >
            {analysis.recommendedLevel === '회복' && (
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 whitespace-nowrap">
                ⭐ AI 강력 추천
              </span>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">🌿</span>
                <span className="text-sm sm:text-base font-extrabold text-stone-900">
                  회복 (Recovery)
                </span>
              </div>
              <p className="text-[11px] text-stone-600 line-clamp-3 mb-2 keep-all leading-relaxed">
                {analysis.routines.회복.summary}
              </p>
            </div>

            <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs whitespace-nowrap">
              <span className="text-stone-500 font-medium">권장 주간 볼륨:</span>
              <span className="font-extrabold text-emerald-800 font-athletic text-sm">
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
                ? 'bg-emerald-50/80 border-emerald-600 shadow-md ring-2 ring-emerald-600/20'
                : 'bg-white border-stone-200 hover:border-emerald-300 shadow-2xs'
            }`}
          >
            {analysis.recommendedLevel === '유지' && (
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 whitespace-nowrap">
                ⭐ AI 강력 추천
              </span>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">⚡</span>
                <span className="text-sm sm:text-base font-extrabold text-stone-900">
                  유지 (Maintenance)
                </span>
              </div>
              <p className="text-[11px] text-stone-600 line-clamp-3 mb-2 keep-all leading-relaxed">
                {analysis.routines.유지.summary}
              </p>
            </div>

            <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs whitespace-nowrap">
              <span className="text-stone-500 font-medium">권장 주간 볼륨:</span>
              <span className="font-extrabold text-emerald-800 font-athletic text-sm">
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
                ? 'bg-rose-50/80 border-rose-500 shadow-md ring-2 ring-rose-500/20'
                : 'bg-white border-stone-200 hover:border-rose-300 shadow-2xs'
            }`}
          >
            {analysis.recommendedLevel === '강화' && (
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 whitespace-nowrap">
                ⭐ AI 강력 추천
              </span>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">🔥</span>
                <span className="text-sm sm:text-base font-extrabold text-stone-900">
                  강화 (Build Overload)
                </span>
              </div>
              <p className="text-[11px] text-stone-600 line-clamp-3 mb-2 keep-all leading-relaxed">
                {analysis.routines.강화.summary}
              </p>
            </div>

            <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs whitespace-nowrap">
              <span className="text-stone-500 font-medium">권장 주간 볼륨:</span>
              <span className="font-extrabold text-rose-900 font-athletic text-sm">
                {analysis.routines.강화.targetWeeklyKm} km
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Selected Level Deep-Dive Banner */}
      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-stone-900">
              [{activePackage.level}] {activePackage.tagline}
            </span>
            <span className="text-[11px] font-mono text-stone-500">
              ({activePackage.volumeRatioText})
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-stone-600 pt-1">
            {activePackage.keyBenefits.map((benefit, bIdx) => (
              <span
                key={bIdx}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-stone-200 text-[11px] keep-all text-stone-700 shadow-2xs"
              >
                <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                <span>{benefit}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="text-xs text-stone-600 bg-white p-3 rounded-xl border border-stone-200 flex items-center gap-2 flex-shrink-0 max-w-sm keep-all shadow-2xs">
          <span className="text-emerald-700 text-sm flex-shrink-0">💡</span>
          <span>
            상세 요일별 플랜 편성은 아래 <strong>[일자별 주간 맞춤 훈련 상세계획표]</strong>에서 맞춤 생성 및 확인하실 수 있습니다.
          </span>
        </div>
      </div>
    </section>
  );
};
