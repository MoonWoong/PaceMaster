import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Activity,
  Flame,
  TrendingUp,
  Clock,
  Footprints,
  Share2,
  Trash2,
  Plus,
  Check,
  X,
  Sparkles,
  Zap,
  Heart,
  Tag,
} from 'lucide-react';
import { TrainingSession, RunningShoe } from '../types';

interface TrainingCalendarViewProps {
  sessions: TrainingSession[];
  shoes: RunningShoe[];
  onOpenShoeModal: (session: TrainingSession) => void;
  onShareSession: (session: TrainingSession) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onOpenTodayWorkoutModal?: () => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const TrainingCalendarView: React.FC<TrainingCalendarViewProps> = ({
  sessions,
  shoes,
  onOpenShoeModal,
  onShareSession,
  onDeleteSession,
  onOpenTodayWorkoutModal,
}) => {
  // Current viewed Year and Month
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => today.toISOString().split('T')[0], [today]);

  // Find latest session date or fallback to today
  const initialYearMonth = useMemo(() => {
    if (sessions.length > 0) {
      const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
      const latestDate = new Date(sorted[0].date);
      if (!isNaN(latestDate.getTime())) {
        return { year: latestDate.getFullYear(), month: latestDate.getMonth() };
      }
    }
    return { year: today.getFullYear(), month: today.getMonth() };
  }, [sessions, today]);

  const [currentYear, setCurrentYear] = useState<number>(initialYearMonth.year);
  const [currentMonth, setCurrentMonth] = useState<number>(initialYearMonth.month); // 0-indexed (0: Jan, 11: Dec)
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(todayStr);

  // Group all sessions by YYYY-MM-DD
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, TrainingSession[]>();
    for (const session of sessions) {
      if (!session.date) continue;
      const key = session.date.slice(0, 10);
      const list = map.get(key) || [];
      list.push(session);
      map.set(key, list);
    }
    return map;
  }, [sessions]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDateStr(todayStr);
  };

  // Month stats
  const monthStats = useMemo(() => {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthlySessions = sessions.filter((s) => s.date && s.date.startsWith(prefix));

    const totalDistance = Math.round(monthlySessions.reduce((acc, s) => acc + (s.totalDistanceKm || 0), 0) * 100) / 100;
    const sessionCount = monthlySessions.length;

    // Calculate avg pace in seconds
    let totalPaceSec = 0;
    let paceCount = 0;
    for (const s of monthlySessions) {
      if (s.avgPace && s.avgPace.includes("'")) {
        const parts = s.avgPace.split("'");
        const m = parseInt(parts[0], 10) || 0;
        const sec = parseInt(parts[1]?.replace('"', '') || '0', 10) || 0;
        totalPaceSec += m * 60 + sec;
        paceCount++;
      }
    }
    let avgPaceStr = '-';
    if (paceCount > 0) {
      const avgPaceSec = totalPaceSec / paceCount;
      const flooredPaceSec = Math.floor(avgPaceSec);
      const pMin = Math.floor(flooredPaceSec / 60);
      const pSec = Math.min(59, flooredPaceSec % 60);
      avgPaceStr = `${pMin}'${String(pSec).padStart(2, '0')}"`;
    }

    return {
      sessionCount,
      totalDistance,
      avgPace: avgPaceStr,
      estimatedCalories: Math.round(totalDistance * 64),
    };
  }, [sessions, currentYear, currentMonth]);

  // Generate calendar grid matrix: Array of weeks, each containing 7 day objects + weekly summary
  const calendarWeeks = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
    const daysInMonth = lastDayOfMonth.getDate();

    // Previous month filler days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();

    interface CalendarDay {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      dayOfWeek: number;
      sessions: TrainingSession[];
      totalDistance: number;
    }

    const allDays: CalendarDay[] = [];

    // Fill previous month days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(currentYear, currentMonth - 1, d);
      const dateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySessions = sessionsByDate.get(dateStr) || [];
      const dist = Math.round(daySessions.reduce((acc, s) => acc + (s.totalDistanceKm || 0), 0) * 100) / 100;

      allDays.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek: prevDate.getDay(),
        sessions: daySessions,
        totalDistance: dist,
      });
    }

    // Fill current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySessions = sessionsByDate.get(dateStr) || [];
      const dist = Math.round(daySessions.reduce((acc, s) => acc + (s.totalDistanceKm || 0), 0) * 100) / 100;
      const curDate = new Date(currentYear, currentMonth, d);

      allDays.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        dayOfWeek: curDate.getDay(),
        sessions: daySessions,
        totalDistance: dist,
      });
    }

    // Fill next month filler days to complete rows (multiples of 7)
    const remainingDays = (7 - (allDays.length % 7)) % 7;
    for (let d = 1; d <= remainingDays; d++) {
      const nextDate = new Date(currentYear, currentMonth + 1, d);
      const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySessions = sessionsByDate.get(dateStr) || [];
      const dist = Math.round(daySessions.reduce((acc, s) => acc + (s.totalDistanceKm || 0), 0) * 100) / 100;

      allDays.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek: nextDate.getDay(),
        sessions: daySessions,
        totalDistance: dist,
      });
    }

    // Split into weeks of 7
    const weeks: { days: CalendarDay[]; weeklyDistance: number }[] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      const weekDays = allDays.slice(i, i + 7);
      const weeklyDist = Math.round(weekDays.reduce((acc, d) => acc + d.totalDistance, 0) * 100) / 100;
      weeks.push({
        days: weekDays,
        weeklyDistance: weeklyDist,
      });
    }

    return weeks;
  }, [currentYear, currentMonth, sessionsByDate, todayStr]);

  // Selected date sessions
  const selectedDateSessions = useMemo(() => {
    if (!selectedDateStr) return [];
    return sessionsByDate.get(selectedDateStr) || [];
  }, [selectedDateStr, sessionsByDate]);

  // Get workout badge color
  const getWorkoutColor = (title: string, dist: number) => {
    const t = title.toLowerCase();
    if (t.includes('인터벌') || t.includes('스피드') || t.includes('질주')) {
      return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    }
    if (t.includes('lsd') || t.includes('장거리') || dist >= 20) {
      return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    }
    if (t.includes('템포') || t.includes('지속') || t.includes('대회')) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
    if (t.includes('회복') || t.includes('리커버리')) {
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  };

  return (
    <div className="space-y-4">
      {/* 1. Calendar Header & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-white/10 shadow-lg">
        {/* Month Navigator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950/70 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="이전 달"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-3 min-w-[130px] text-center">
              <span className="text-base sm:text-lg font-black text-white font-athletic tracking-wide">
                {currentYear}년 {currentMonth + 1}월
              </span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="다음 달"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoToday}
            className="px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl transition-all cursor-pointer shadow-sm"
          >
            이번 달 (오늘)
          </button>
        </div>

        {/* Monthly Summary Badges */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            <Activity className="w-3.5 h-3.5" />
            <span>총 거리:</span>
            <strong className="font-athletic text-sm text-emerald-400">
              {monthStats.totalDistance} km
            </strong>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
            <Footprints className="w-3.5 h-3.5" />
            <span>훈련:</span>
            <strong className="font-athletic text-sm text-cyan-400">
              {monthStats.sessionCount}회
            </strong>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
            <Zap className="w-3.5 h-3.5" />
            <span>평균 페이스:</span>
            <strong className="font-athletic text-sm text-amber-400">
              {monthStats.avgPace}
            </strong>
          </div>
        </div>
      </div>

      {/* 2. Interactive Calendar Matrix Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-white/10 overflow-hidden shadow-xl">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-white/10 bg-slate-950/70 text-center text-xs font-bold py-2.5">
          {WEEKDAYS.map((day, idx) => (
            <div
              key={day}
              className={`${
                idx === 0 ? 'text-rose-400' : idx === 6 ? 'text-cyan-400' : 'text-slate-400'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid Rows */}
        <div className="divide-y divide-white/5">
          {calendarWeeks.map((week, wIdx) => (
            <div key={wIdx} className="relative group/row">
              <div className="grid grid-cols-7 divide-x divide-white/5">
                {week.days.map((day) => {
                  const isSelected = selectedDateStr === day.dateStr;
                  const hasSessions = day.sessions.length > 0;

                  return (
                    <div
                      key={day.dateStr}
                      onClick={() => setSelectedDateStr(day.dateStr)}
                      className={`min-h-[96px] sm:min-h-[110px] p-1.5 sm:p-2 flex flex-col justify-between transition-all cursor-pointer select-none relative ${
                        !day.isCurrentMonth
                          ? 'bg-slate-950/30 opacity-40 hover:opacity-70'
                          : isSelected
                          ? 'bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/50'
                          : 'bg-slate-900/40 hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Top Date Header Row */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                            day.isToday
                              ? 'bg-emerald-400 text-slate-950 font-black shadow-sm shadow-emerald-400/40'
                              : day.dayOfWeek === 0
                              ? 'text-rose-400'
                              : day.dayOfWeek === 6
                              ? 'text-cyan-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {day.dayNumber}
                        </span>

                        {/* Daily Total Distance Pill */}
                        {hasSessions && (
                          <span className="text-[10px] sm:text-xs font-athletic font-black text-emerald-300 bg-emerald-500/20 px-1.5 py-0.2 rounded border border-emerald-500/30">
                            {day.totalDistance}k
                          </span>
                        )}
                      </div>

                      {/* Training Sessions List inside Date Cell */}
                      <div className="space-y-1 overflow-hidden flex-1 flex flex-col justify-end">
                        {day.sessions.slice(0, 2).map((s) => {
                          const badgeColor = getWorkoutColor(s.title, s.totalDistanceKm);

                          return (
                            <div
                              key={s.id}
                              className={`p-1 rounded-md text-[10px] border leading-tight truncate ${badgeColor}`}
                              title={`${s.title} (${s.totalDistanceKm}km, ${s.avgPace})`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold truncate max-w-[70px] sm:max-w-[90px]">
                                  {s.title}
                                </span>
                                <span className="font-mono shrink-0">{s.avgPace}</span>
                              </div>
                              {s.shoeName && (
                                <div className="text-[9px] text-slate-400 truncate opacity-90 mt-0.5 flex items-center gap-0.5">
                                  <span>👟</span>
                                  <span className="truncate">{s.shoeName}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {day.sessions.length > 2 && (
                          <div className="text-[9px] text-slate-400 text-center font-bold">
                            +{day.sessions.length - 2}개 더보기
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Weekly Mileage Floating Indicator on Row Hover */}
              {week.weeklyDistance > 0 && (
                <div className="absolute right-2 top-2 hidden group-hover/row:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-950/90 text-emerald-400 border border-emerald-500/40 shadow-lg pointer-events-none z-10 font-bold font-athletic">
                  <span>주간 합계:</span>
                  <span>{week.weeklyDistance} km</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Selected Date Detail Drawer Panel */}
      {selectedDateStr && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-white/10 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-white font-mono">
                    {selectedDateStr} 훈련 상세 내역
                  </h4>
                  {selectedDateStr === todayStr && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black">
                      오늘
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {selectedDateSessions.length > 0
                    ? `총 ${selectedDateSessions.length}개의 훈련 세션 기록이 있습니다.`
                    : '이 날짜에는 등록된 러닝 훈련이 없습니다 (휴식일).'}
                </p>
              </div>
            </div>

            {selectedDateStr === todayStr && onOpenTodayWorkoutModal && (
              <button
                type="button"
                onClick={onOpenTodayWorkoutModal}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>오늘 훈련 기록 추가</span>
              </button>
            )}
          </div>

          {/* Session Cards for Selected Date */}
          {selectedDateSessions.length === 0 ? (
            <div className="py-8 text-center rounded-xl bg-slate-950/40 border border-white/5">
              <span className="text-3xl mb-2 inline-block">🏃‍♂️💤</span>
              <p className="text-xs text-slate-400 font-medium">
                {selectedDateStr} 에는 달린 기록이 없습니다.
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                완전 휴식 또는 크로스 트레이닝으로 다음 러닝을 준비한 날입니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3.5 sm:p-4 rounded-xl bg-slate-950/60 border border-white/10 hover:border-white/20 transition-all space-y-3"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                          {session.date}
                        </span>

                        {/* Shoe Tag or Selector Trigger */}
                        <button
                          type="button"
                          onClick={() => onOpenShoeModal(session)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                            session.shoeName
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 font-semibold'
                              : 'bg-slate-800 text-slate-400 border-white/10 hover:text-white hover:border-emerald-500/30'
                          }`}
                          title="훈련 착용 러닝화 선택 / 변경"
                        >
                          <span>👟</span>
                          <span>{session.shoeName || '+ 러닝화 지정'}</span>
                        </button>
                      </div>
                      <h5 className="text-sm sm:text-base font-bold text-white">
                        {session.title}
                      </h5>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => onShareSession(session)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                        title="이미지 카드로 저장 및 공유"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>이미지 저장</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`'${session.title}' 훈련 기록을 정말 삭제하시겠습니까?`)) {
                            onDeleteSession(session.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                        title="기록 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stat Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5 text-xs">
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5">
                      <div className="text-[10px] text-slate-400 mb-0.5">거리</div>
                      <div className="text-sm sm:text-base font-black text-white font-athletic">
                        {session.totalDistanceKm} <span className="text-xs text-emerald-400 font-bold">km</span>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5">
                      <div className="text-[10px] text-slate-400 mb-0.5">평균 페이스</div>
                      <div className="text-sm sm:text-base font-black text-cyan-300 font-athletic">
                        {session.avgPace} <span className="text-xs text-slate-400 font-normal">/km</span>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5">
                      <div className="text-[10px] text-slate-400 mb-0.5">소요 시간</div>
                      <div className="text-sm sm:text-base font-black text-white font-athletic">
                        {session.totalTime}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5">
                      <div className="text-[10px] text-slate-400 mb-0.5">평균 심박수</div>
                      <div className="text-sm sm:text-base font-black text-rose-300 font-athletic">
                        {session.avgHr ? `${session.avgHr} bpm` : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Session Notes if exists */}
                  {session.notes && (
                    <div className="p-2.5 rounded-lg bg-slate-900/50 border border-white/5 text-xs text-slate-300">
                      <span className="text-[10px] text-slate-400 block mb-0.5 font-semibold">훈련 메모:</span>
                      {session.notes}
                    </div>
                  )}

                  {/* Laps Preview if exists */}
                  {session.laps && session.laps.length > 0 && (
                    <div className="pt-2 border-t border-white/5">
                      <div className="text-[10px] text-slate-400 font-semibold mb-1.5 flex items-center justify-between">
                        <span>랩 스플릿 (총 {session.laps.length}개)</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {session.laps.map((l) => (
                          <div
                            key={l.lap}
                            className="px-2 py-1 rounded bg-slate-900/80 border border-white/5 text-[10px] flex items-center gap-1.5 font-mono"
                          >
                            <span className="text-slate-400 font-bold">L{l.lap}</span>
                            <span className="text-emerald-300 font-bold">{l.avgPace}</span>
                            {l.avgHr && <span className="text-rose-300">({l.avgHr})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
