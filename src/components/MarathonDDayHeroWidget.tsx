import React, { useState, useMemo } from 'react';
import {
  Calendar,
  MapPin,
  Flame,
  Award,
  ChevronRight,
  Sparkles,
  Timer,
  Clock,
  Zap,
  Target,
  ArrowRight,
  Edit3,
  Save,
} from 'lucide-react';
import { RegisteredRace, RunningGoals, RunningRecords } from '../types';
import { calculateDDay, getTodayDateStr } from '../lib/marathonData';
import { parseTimeToSeconds, formatPace } from '../lib/vdot';

interface MarathonDDayHeroWidgetProps {
  races: RegisteredRace[];
  goals: RunningGoals;
  records: RunningRecords;
  onNavigateToRaces: () => void;
  onNavigateToGoals?: () => void;
  onUpdateRace?: (race: RegisteredRace) => Promise<void>;
}

export const MarathonDDayHeroWidget: React.FC<MarathonDDayHeroWidgetProps> = ({
  races,
  goals,
  records,
  onNavigateToRaces,
  onNavigateToGoals,
  onUpdateRace,
}) => {
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  // Find nearest upcoming race (or explicitly marked target race)
  const targetRaceData = useMemo(() => {
    if (!races || races.length === 0) return null;

    const todayStr = getTodayDateStr();

    // Filter upcoming races (today or future)
    const upcoming = races
      .filter((r) => r.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (upcoming.length === 0) {
      // If all are past, show the most recent past race with a completed badge
      const past = [...races].sort((a, b) => b.date.localeCompare(a.date));
      return { race: past[0], isPast: true, dDayInfo: calculateDDay(past[0].date) };
    }

    // Priority: explicitly marked target race, else nearest upcoming
    const chosen = upcoming.find((r) => r.isTarget) || upcoming[0];
    const dDayInfo = calculateDDay(chosen.date);

    return { race: chosen, isPast: false, dDayInfo };
  }, [races]);

  // Determine race details and phase
  const raceDetails = useMemo(() => {
    if (!targetRaceData) return null;
    const { race, dDayInfo, isPast } = targetRaceData;
    const daysLeft = dDayInfo.daysDiff;

    // Periodization phase detection
    let phase = {
      name: '기초 지구력 구축기 (Base Phase)',
      desc: '유산소 기초(Zone 1~2) 마일리지 축적 및 부상 방지 관절 적응기',
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      badgeColor: 'text-emerald-400',
    };

    if (isPast) {
      phase = {
        name: '대회 종료 & 회복기 (Recovery Phase)',
        desc: '수고하셨습니다! 근육 피로를 풀고 다음 목표 대회를 준비하세요.',
        color: 'bg-slate-800 text-slate-300 border-white/10',
        badgeColor: 'text-slate-400',
      };
    } else if (daysLeft === 0) {
      phase = {
        name: '대회 당일! (RACE DAY)',
        desc: '그동안 흘린 땀방울을 믿고 나만의 페이스로 결승선까지 완주하세요!',
        color: 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse',
        badgeColor: 'text-rose-400',
      };
    } else if (daysLeft <= 14) {
      phase = {
        name: '테이퍼링 & 컨디션 조절기 (Tapering Phase)',
        desc: '주간 훈련량 40~60% 감축, 카보로딩 식단 및 글리코겐 충전에 집중',
        color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        badgeColor: 'text-amber-400',
      };
    } else if (daysLeft <= 30) {
      phase = {
        name: '피크 훈련 & 최종 LSD 완성기 (Peak Phase)',
        desc: '32~35km 최종 장거리 지속주 점검 및 실전 레이스 페이스 확립',
        color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        badgeColor: 'text-purple-400',
      };
    } else if (daysLeft <= 70) {
      phase = {
        name: '고강도 빌드업 & 역치 훈련기 (Build Phase)',
        desc: '역치(T-Pace) 템포런 및 인터벌 트레이닝으로 VO2max와 젖산역치 극대화',
        color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        badgeColor: 'text-cyan-400',
      };
    }

    // Preparation progress bar (based on typical 16-week = 112 days marathon cycle)
    const totalCycleDays = 112;
    const progressPct = isPast
      ? 100
      : Math.min(100, Math.max(5, Math.round(((totalCycleDays - daysLeft) / totalCycleDays) * 100)));

    // Target Time & Pace mapping (대회별 개별 목표 기록 우선 적용)
    let targetTime = race.targetTime || '';
    let targetDistanceKm = 42.195;

    if (race.course.includes('풀') || race.course.includes('42')) {
      targetDistanceKm = 42.195;
      if (!targetTime) targetTime = goals.targetFull || '';
    } else if (race.course.includes('하프') || race.course.includes('21')) {
      targetDistanceKm = 21.0975;
      if (!targetTime) targetTime = goals.targetHalf || '';
    } else if (race.course.includes('10')) {
      targetDistanceKm = 10.0;
      if (!targetTime) targetTime = goals.target10k || '';
    }

    let targetPaceFormatted = '';
    if (targetTime) {
      const targetSec = parseTimeToSeconds(targetTime);
      if (targetSec > 0 && targetDistanceKm > 0) {
        targetPaceFormatted = formatPace(targetSec / targetDistanceKm);
      }
    }

    // Remaining Weeks & Days
    const weeksLeft = Math.floor(Math.max(0, daysLeft) / 7);
    const remainDays = Math.max(0, daysLeft) % 7;

    return {
      race,
      isPast,
      daysLeft,
      dDayText: dDayInfo.text,
      weeksLeft,
      remainDays,
      phase,
      progressPct,
      targetTime,
      targetPaceFormatted,
    };
  }, [targetRaceData, goals]);

  // Empty State: When user hasn't registered any upcoming race
  if (!raceDetails) {
    return (
      <section className="w-full glass-panel rounded-2xl p-5 sm:p-6 mb-5 border border-emerald-500/30 bg-gradient-to-br from-slate-900/90 via-emerald-950/20 to-slate-900/90 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase">
                  Marathon Target Race D-Day
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10">
                  대회 미등록
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                출전 예정인 마라톤 대회를 등록해보세요!
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                대회 일정을 등록하면 남은 D-day 카운트다운과 주기화 훈련 단계가 대시보드 상단에 실시간으로 표시됩니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToRaces}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs sm:text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer self-start sm:self-auto flex-shrink-0"
          >
            <span>목표 대회 찾아보기</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    );
  }

  const {
    race,
    isPast,
    daysLeft,
    dDayText,
    weeksLeft,
    remainDays,
    phase,
    progressPct,
    targetTime,
    targetPaceFormatted,
  } = raceDetails;

  return (
    <section className="w-full glass-panel rounded-2xl p-5 sm:p-6 mb-5 border border-emerald-500/35 bg-gradient-to-br from-slate-900/95 via-emerald-950/25 to-slate-950/95 shadow-2xl relative overflow-hidden">
      {/* Background Aesthetic Ambient Light Glow */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Grid: Left Hero D-Day & Info / Right Metrics & CTA */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left: Giant D-Day Badge + Race Identifiers */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
          {/* Prominent High-Impact D-Day Counter Box */}
          <div
            className={`flex flex-col items-center justify-center px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border transition-all shadow-xl min-w-[120px] text-center ${
              isPast
                ? 'bg-slate-800/90 border-slate-700 text-slate-400'
                : daysLeft === 0
                ? 'bg-gradient-to-b from-rose-600 to-rose-700 border-rose-400 text-white shadow-rose-500/40 animate-pulse'
                : daysLeft <= 14
                ? 'bg-gradient-to-b from-amber-500/25 to-slate-900 border-amber-500/50 shadow-amber-500/20'
                : 'bg-gradient-to-b from-emerald-500/25 via-slate-900/90 to-slate-900 border-emerald-500/50 shadow-emerald-500/25'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
              TARGET RACE
            </span>
            <span
              className={`text-3xl sm:text-4xl font-black font-athletic tracking-tight mt-0.5 ${
                isPast
                  ? 'text-slate-400'
                  : daysLeft === 0
                  ? 'text-white'
                  : daysLeft <= 14
                  ? 'text-amber-300'
                  : 'text-emerald-400'
              }`}
            >
              {dDayText}
            </span>
            <span className="text-[11px] text-slate-400 font-medium mt-0.5">
              {isPast
                ? '완주 완료'
                : daysLeft === 0
                ? '대회 당일'
                : `${weeksLeft}주 ${remainDays}일 남음`}
            </span>
          </div>

          {/* Race Title, Course, Location, and Date */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {race.course}
              </span>
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>{race.date}</span>
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span className="truncate max-w-[140px] sm:max-w-[180px]">{race.location}</span>
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>{race.name}</span>
            </h2>

            {/* Current Training Phase Banner */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-lg border font-bold flex items-center gap-1.5 ${phase.color}`}
              >
                <Zap className="w-3 h-3" />
                <span>{phase.name}</span>
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                {phase.desc}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Target Goal Time & Pace + Progress & Nav Button */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 border-t lg:border-t-0 pt-3 lg:pt-0 border-white/10">
          {/* Target Finish Time & Required Pace */}
          <div className="flex items-center gap-3.5 bg-slate-950/60 p-2.5 sm:px-3.5 rounded-xl border border-white/10 text-xs">
            <div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <span>대회 목표 기록</span>
                {onUpdateRace && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetInput(targetTime || '03:15:00');
                      setIsEditingTarget(true);
                    }}
                    className="p-0.5 text-cyan-400 hover:text-white transition-colors cursor-pointer"
                    title="이 대회의 목표 완주 기록 직접 수정하기"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="text-sm font-extrabold text-white font-athletic mt-0.5 flex items-center gap-1.5">
                <span>{targetTime || '미설정'}</span>
              </div>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div>
              <div className="text-[10px] text-slate-400">필수 대회 페이스</div>
              <div className="text-sm font-extrabold text-cyan-300 font-athletic mt-0.5">
                {targetPaceFormatted ? `${targetPaceFormatted}/km` : '페이스 환산중'}
              </div>
            </div>
          </div>

          {/* Action button to switch races */}
          <button
            type="button"
            onClick={onNavigateToRaces}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/15 text-xs font-semibold transition-all shadow-sm cursor-pointer self-end"
          >
            <span>마라톤 일정 전체보기</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Preparation Timeline Progress Bar */}
      <div className="mt-4 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 font-medium">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>대회 대비 준비 주기 진행률 (16주 사이클 기준)</span>
          </span>
          <span className="text-emerald-300 font-athletic font-bold">
            {progressPct}% 경과 {isPast ? '(대회 종료)' : daysLeft === 0 ? '(오늘 대회!)' : `(D-${daysLeft})`}
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-slate-950/80 border border-white/5 overflow-hidden p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-700 shadow-sm shadow-emerald-500/50"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 대회 목표 완주 시간 개별 수정 모달 */}
      {isEditingTarget && targetRaceData?.race && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel rounded-2xl p-6 w-full max-w-md border border-white/20 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" />
              <span>대회별 맞춤 목표 기록 수정</span>
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              <strong className="text-white">{targetRaceData.race.name}</strong> ({targetRaceData.race.course}) 대회만을 위한 개별 목표 완주 시간을 설정합니다.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (onUpdateRace && targetRaceData.race) {
                  await onUpdateRace({
                    ...targetRaceData.race,
                    targetTime: targetInput.trim(),
                  });
                }
                setIsEditingTarget(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  목표 완주 시간 (hh:mm:ss)
                </label>
                <input
                  type="text"
                  required
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="예: 03:19:59"
                  className="w-full px-3 py-2.5 glass-input rounded-xl text-sm font-mono font-bold text-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  설정한 기록에 맞춰 필수 페이스와 D-day 달성 계획이 자동으로 재계산됩니다.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditingTarget(false)}
                  className="px-4 py-2 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>목표 기록 저장</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
