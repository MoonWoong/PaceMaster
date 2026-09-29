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
        badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
        target: goals.target10k || '00:39:59',
        pb: records.pb10k || '00:43:30',
      },
      {
        label: '하프 마라톤 (21.0975km)',
        distKm: 21.0975,
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        target: goals.targetHalf || '01:29:59',
        pb: records.pbHalf || '01:36:00',
      },
      {
        label: '풀코스 마라톤 (42.195km)',
        distKm: 42.195,
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
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
      {/* Background Glow */}
      {!isNested && (
        <div className="absolute top-0 right-1/4 w-80 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-md">
            <Target className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                <span>러닝 목표 달성도</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                  Goal Progress
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              설정한 거리별 목표 완주 시간 대비 현재 최고 기록(PB)의 달성률을 정밀 계산합니다.
            </p>
          </div>
        </div>

        {/* Overall Average Progress Badge & Edit Link */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/70 border border-purple-500/30">
            <span className="text-[10px] text-slate-400 font-medium">평균 달성도:</span>
            <span className="text-xs sm:text-sm font-black text-purple-300 font-athletic">
              {avgProgress}%
            </span>
          </div>

          {!isNested && onNavigateToGoals && (
            <button
              type="button"
              onClick={onNavigateToGoals}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white border border-white/10 transition-all cursor-pointer"
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
            className={`p-4 rounded-xl border transition-all ${
              item.isAchieved
                ? 'bg-slate-950/70 border-emerald-500/40 shadow-md shadow-emerald-500/10'
                : 'bg-slate-950/50 border-white/10 hover:border-white/20'
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
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : item.progressPct >= 90
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-800 text-slate-300 border-white/10'
                }`}
              >
                {item.isAchieved ? '달성 완료' : `${item.progressPct}% 진행`}
              </span>
            </div>

            {/* Target vs Current PB Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-3 p-2 rounded-lg bg-slate-900/80 border border-white/5 font-mono">
              <div>
                <div className="text-[10px] text-slate-400 font-sans">현재 최고기록(PB)</div>
                <div className="text-xs font-bold text-white mt-0.5">
                  {item.pbTime || '--:--:--'}
                </div>
                <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                  페이스: <strong className="text-slate-200">{item.pbPaceFormatted || '-'}</strong>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-purple-300 font-sans">목표 완주시간</div>
                <div className="text-xs font-bold text-purple-300 mt-0.5">
                  {item.targetTime || '--:--:--'}
                </div>
                <div className="text-[10px] text-purple-400 font-sans mt-0.5">
                  페이스: <strong className="text-purple-200">{item.targetPaceFormatted || '-'}</strong>
                </div>
              </div>
            </div>

            {/* Progress Bar & Percentage */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">달성률</span>
                <span
                  className={`text-sm font-black font-athletic ${
                    item.isAchieved
                      ? 'text-emerald-400'
                      : item.progressPct >= 90
                      ? 'text-cyan-400'
                      : 'text-purple-400'
                  }`}
                >
                  {item.progressPct}%
                </span>
              </div>

              <div className="w-full h-2 rounded-full bg-slate-900 border border-white/10 overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    item.isAchieved
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50'
                      : item.progressPct >= 90
                      ? 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                      : item.progressPct >= 75
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
                      : 'bg-gradient-to-r from-purple-500 to-blue-400'
                  }`}
                  style={{ width: `${Math.min(100, item.progressPct)}%` }}
                />
              </div>

              {/* Time Gap Footer */}
              <div className="pt-1 flex items-center justify-between text-[11px] gap-2">
                <span
                  className={`font-medium keep-all ${
                    item.isAchieved ? 'text-emerald-300' : 'text-slate-300'
                  }`}
                >
                  {item.gapText}
                </span>
                {item.isAchieved && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
      <div className="w-full pt-4 mt-4 border-t border-white/10 relative">
        {content}
      </div>
    );
  }

  return (
    <section className="w-full glass-panel rounded-2xl p-5 sm:p-6 mb-5 border border-purple-500/25 bg-gradient-to-br from-slate-900/90 via-purple-950/20 to-slate-900/90 shadow-xl relative overflow-hidden">
      {content}
    </section>
  );
};
