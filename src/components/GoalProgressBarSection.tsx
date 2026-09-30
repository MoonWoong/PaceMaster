import React, { useMemo } from 'react';
import { Target, Trophy, TrendingUp, Sparkles, CheckCircle2, ChevronRight, Award } from 'lucide-react';
import { RunningGoals, RunningRecords } from '../types';
import { parseTimeToSeconds, formatPace } from '../lib/vdot';

interface GoalProgressBarSectionProps {
  goals: RunningGoals;
  records: RunningRecords;
  onNavigateToGoals?: () => void;
  isNested?: boolean;
}

interface GoalProgressItem {
  distanceLabel: string;
  distanceKm: number;
  badgeColor: string;
  targetTime: string;
  targetSeconds: number;
  targetPaceFormatted: string;
  pbTime: string;
  pbSeconds: number;
  pbPaceFormatted: string;
  progressPct: number;
  isAchieved: boolean;
  gapText: string;
  hasTarget: boolean;
  hasPb: boolean;
}

export const GoalProgressBarSection: React.FC<GoalProgressBarSectionProps> = ({
  goals,
  records,
  onNavigateToGoals,
  isNested = false,
}) => {
  const goalItems: GoalProgressItem[] = useMemo(() => {
    const list: {
      label: string;
      distKm: number;
      badgeColor: string;
      target: string;
      pb: string;
    }[] = [
      {
        label: '10K 단축 런',
        distKm: 10.0,
        badgeColor: 'bg-emerald-50 text-emerald-900 border-emerald-300',
        target: goals.target10k || '00:39:59',
        pb: records.pb10k || '00:43:30',
      },
      {
        label: '하프 마라톤 (21.0975km)',
        distKm: 21.0975,
        badgeColor: 'bg-amber-50 text-amber-900 border-amber-300',
        target: goals.targetHalf || '01:29:59',
        pb: records.pbHalf || '01:36:00',
      },
      {
        label: '풀코스 마라톤 (42.195km)',
        distKm: 42.195,
        badgeColor: 'bg-rose-50 text-rose-900 border-rose-300',
        target: goals.targetFull || '03:09:59',
        pb: records.pbFull || '03:25:00',
      },
    ];

    return list.map((item) => {
      const targetSec = parseTimeToSeconds(item.target);
      const pbSec = parseTimeToSeconds(item.pb);
      const hasTarget = targetSec > 0;
      const hasPb = pbSec > 0;

      let targetPace = '';
      if (hasTarget) {
        targetPace = formatPace(targetSec / item.distKm);
      }

      let pbPace = '';
      if (hasPb) {
        pbPace = formatPace(pbSec / item.distKm);
      }

      let progressPct = 0;
      let isAchieved = false;
      let gapText = '';

      if (hasTarget && hasPb) {
        if (pbSec <= targetSec) {
          progressPct = 100;
          isAchieved = true;
          const diffSec = targetSec - pbSec;
          const m = Math.floor(diffSec / 60);
          const s = diffSec % 60;
          gapText = diffSec > 0 ? `🎉 목표 초과 달성! (${m}분 ${s}초 빠름)` : '🎉 목표 정확히 달성 완료!';
        } else {
          // Progress ratio based on time efficiency: targetSec / pbSec
          progressPct = Math.min(99.5, Math.max(10, Math.round((targetSec / pbSec) * 1000) / 10));
          const diffSec = pbSec - targetSec;
          const m = Math.floor(diffSec / 60);
          const s = diffSec % 60;
          gapText = `목표까지 -${m}분 ${s < 10 ? '0' : ''}${s}초 단축 필요`;
        }
      } else if (hasPb && !hasTarget) {
        gapText = '목표 기록 미설정';
      } else {
        gapText = '기록 측정 필요';
      }

      return {
        distanceLabel: item.label,
        distanceKm: item.distKm,
        badgeColor: item.badgeColor,
        targetTime: item.target,
        targetSeconds: targetSec,
        targetPaceFormatted: targetPace,
        pbTime: item.pb,
        pbSeconds: pbSec,
        pbPaceFormatted: pbPace,
        progressPct,
        isAchieved,
        gapText,
        hasTarget,
        hasPb,
      };
    });
  }, [goals, records]);

  // Overall average completion percentage
  const avgProgress = useMemo(() => {
    const valid = goalItems.filter((g) => g.progressPct > 0);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, g) => acc + g.progressPct, 0);
    return Math.round((sum / valid.length) * 10) / 10;
  }, [goalItems]);

  const content = (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-stone-200 relative z-10 text-stone-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-100 text-rose-900 border border-rose-300 shadow-sm">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-rose-800" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-1.5">
                <span>러닝 목표 달성도</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-900 font-bold border border-rose-200">
                  Goal Progress
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5">
              설정한 거리별 목표 완주 시간 대비 현재 최고 기록(PB)의 달성률을 정밀 계산합니다.
            </p>
          </div>
        </div>

        {/* Overall Average Progress Badge & Edit Link */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 shadow-2xs">
            <span className="text-[10px] text-stone-500 font-medium">평균 달성도:</span>
            <span className="text-xs sm:text-sm font-black text-rose-900 font-athletic">
              {avgProgress}%
            </span>
          </div>

          {!isNested && onNavigateToGoals && (
            <button
              type="button"
              onClick={onNavigateToGoals}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-300 transition-all cursor-pointer"
            >
              <span>목표 수정</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3 Distance Progress Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 relative z-10">
        {goalItems.map((item, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-2xl border transition-all ${
              item.isAchieved
                ? 'bg-emerald-50/70 border-emerald-300 shadow-sm'
                : 'bg-stone-50/90 border-stone-200 hover:border-emerald-300 shadow-2xs'
            }`}
          >
            {/* Card Header: Course Name & Status Badge */}
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border whitespace-nowrap ${item.badgeColor}`}>
                {item.distanceLabel}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                  item.isAchieved
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : item.progressPct >= 80
                    ? 'bg-orange-100 text-orange-900 border-orange-300'
                    : item.progressPct >= 50
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-stone-100 text-stone-700 border-stone-300'
                }`}
              >
                {item.isAchieved ? '달성 완료' : `${item.progressPct}% 진행`}
              </span>
            </div>

            {/* Target vs Current PB Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-3 p-2.5 rounded-xl bg-white border border-stone-200 font-mono shadow-2xs">
              <div>
                <div className="text-[10px] text-stone-500 font-sans">현재 최고기록(PB)</div>
                <div className="text-xs font-bold text-stone-900 mt-0.5 font-athletic">
                  {item.pbTime || '--:--:--'}
                </div>
                <div className="text-[10px] text-stone-500 font-sans mt-0.5">
                  페이스: <strong className="text-stone-700">{item.pbPaceFormatted || '-'}</strong>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-rose-900 font-sans font-semibold">목표 완주시간</div>
                <div className="text-xs font-bold text-rose-900 mt-0.5 font-athletic">
                  {item.targetTime || '--:--:--'}
                </div>
                <div className="text-[10px] text-rose-700 font-sans mt-0.5">
                  페이스: <strong className="text-rose-900">{item.targetPaceFormatted || '-'}</strong>
                </div>
              </div>
            </div>

            {/* Progress Bar & Percentage */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-stone-500">달성률</span>
                <span
                  className={`text-sm font-black font-athletic ${
                    item.isAchieved
                      ? 'text-emerald-700'
                      : item.progressPct >= 80
                      ? 'text-orange-600'
                      : item.progressPct >= 50
                      ? 'text-amber-600'
                      : 'text-stone-700'
                  }`}
                >
                  {item.progressPct}%
                </span>
              </div>

              <div className="w-full h-2 rounded-full bg-stone-200 border border-stone-300/60 overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    item.isAchieved
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-sm'
                      : item.progressPct >= 80
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                      : item.progressPct >= 50
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-500'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600'
                  }`}
                  style={{ width: `${Math.min(100, item.progressPct)}%` }}
                />
              </div>

              {/* Time Gap Footer */}
              <div className="pt-1 flex items-center justify-between text-[11px] gap-2">
                <span
                  className={`font-medium keep-all ${
                    item.isAchieved ? 'text-emerald-800' : 'text-stone-600'
                  }`}
                >
                  {item.gapText}
                </span>
                {item.isAchieved && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  if (isNested) {
    return (
      <div className="w-full pt-4 mt-4 border-t border-stone-200 relative">
        {content}
      </div>
    );
  }

  return (
    <section className="w-full glass-panel rounded-2xl p-5 sm:p-6 mb-5 border border-emerald-600/20 bg-white/95 shadow-md relative overflow-hidden">
      {content}
    </section>
  );
};
