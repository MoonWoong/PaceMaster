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
      return 'bg-rose-100 text-rose-900 border-rose-300 font-semibold';
    }
    if (t.includes('lsd') || t.includes('장거리') || dist >= 20) {
      return 'bg-stone-100 text-stone-800 border-stone-300 font-semibold';
    }
    if (t.includes('템포') || t.includes('지속') || t.includes('대회')) {
      return 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
    }
    if (t.includes('회복') || t.includes('리커버리')) {
      return 'bg-emerald-50 text-emerald-900 border-emerald-200 font-semibold';
    }
    return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold';
  };

  return (
    <div className="space-y-4">
      {/* 1. Calendar Header & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-stone-200 shadow-sm text-stone-800">
        {/* Month Navigator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-white transition-colors cursor-pointer"
              title="이전 달"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-3 min-w-[130px] text-center">
              <span className="text-base sm:text-lg font-black text-stone-900 font-athletic tracking-wide">
                {currentYear}년 {currentMonth + 1}월
              </span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-white transition-colors cursor-pointer"
              title="다음 달"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoToday}
            className="px-3 py-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            이번 달 (오늘)
          </button>
        </div>

        {/* Monthly Summary Badges */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-semibold shadow-2xs">
            <Activity className="w-3.5 h-3.5 text-emerald-700" />
            <span>총 거리:</span>
            <strong className="font-athletic text-sm text-emerald-800">
              {monthStats.totalDistance} km
            </strong>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 font-semibold shadow-2xs">
            <Footprints className="w-3.5 h-3.5 text-rose-800" />
            <span>훈련:</span>
            <strong className="font-athletic text-sm text-rose-900">
              {monthStats.sessionCount}회
            </strong>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 font-semibold shadow-2xs">
            <Zap className="w-3.5 h-3.5 text-amber-700" />
            <span>평균 페이스:</span>
            <strong className="font-athletic text-sm text-amber-800">
              {monthStats.avgPace}
            </strong>
          </div>
        </div>
      </div>

      {/* 2. Interactive Calendar Matrix Table */}
      <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden shadow-sm">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center text-xs font-bold py-2.5">
          {WEEKDAYS.map((day, idx) => (
            <div
              key={day}
              className={`${
                idx === 0 ? 'text-rose-700' : idx === 6 ? 'text-emerald-700' : 'text-stone-700'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid Rows */}
        <div className="divide-y divide-stone-200">
          {calendarWeeks.map((week, wIdx) => (
            <div key={wIdx} className="relative group/row">
              <div className="grid grid-cols-7 divide-x divide-stone-200">
                {week.days.map((day) => {
                  const isSelected = selectedDateStr === day.dateStr;
                  const hasSessions = day.sessions.length > 0;

                  return (
                    <div
                      key={day.dateStr}
                      onClick={() => setSelectedDateStr(day.dateStr)}
                      className={`min-h-[96px] sm:min-h-[110px] p-1.5 sm:p-2 flex flex-col justify-between transition-all cursor-pointer select-none relative ${
                        !day.isCurrentMonth
                          ? 'bg-stone-50/50 opacity-40 hover:opacity-70'
                          : isSelected
                          ? 'bg-emerald-50/80 ring-2 ring-inset ring-emerald-600'
                          : 'bg-white hover:bg-stone-50'
                      }`}
                    >
                      {/* Top Date Header Row */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                            day.isToday
                              ? 'bg-emerald-600 text-white font-black shadow-xs'
                              : day.dayOfWeek === 0
                              ? 'text-rose-700'
                              : day.dayOfWeek === 6
                              ? 'text-emerald-700'
                              : 'text-stone-700'
                          }`}
                        >
                          {day.dayNumber}
                        </span>

                        {/* Daily Total Distance Pill */}
                        {hasSessions && (
                          <span className="text-[10px] sm:text-xs font-athletic font-black text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
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
                              className={`p-1 rounded-md text-[10px] border leading-tight truncate shadow-2xs ${badgeColor}`}
                              title={`${s.title} (${s.totalDistanceKm}km, ${s.avgPace})`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold truncate max-w-[70px] sm:max-w-[90px]">
                                  {s.title}
                                </span>
                                <span className="font-mono shrink-0">{s.avgPace}</span>
                              </div>
                              {s.shoeName && (
                                <div className="text-[9px] text-stone-600 truncate opacity-90 mt-0.5 flex items-center gap-0.5 font-medium">
                                  <span>👟</span>
                                  <span className="truncate">{s.shoeName}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {day.sessions.length > 2 && (
                          <div className="text-[9px] text-stone-500 text-center font-bold">
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
                <div className="absolute right-2 top-2 hidden group-hover/row:flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-800 text-white border border-emerald-700 shadow-md pointer-events-none z-10 font-bold font-athletic">
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
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-3 text-stone-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-stone-900 font-mono">
                    {selectedDateStr} 훈련 상세 내역
                  </h4>
                  {selectedDateStr === todayStr && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">
                      오늘
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600">
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
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>오늘 훈련 기록 추가</span>
              </button>
            )}
          </div>

          {/* Session Cards for Selected Date */}
          {selectedDateSessions.length === 0 ? (
            <div className="py-8 text-center rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-3xl mb-2 inline-block">🏃‍♂️💤</span>
              <p className="text-xs text-stone-600 font-semibold">
                {selectedDateStr} 에는 달린 기록이 없습니다.
              </p>
              <p className="text-[11px] text-stone-500 mt-1">
                완전 휴식 또는 크로스 트레이닝으로 다음 러닝을 준비한 날입니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3.5 sm:p-4 rounded-xl bg-stone-50 border border-stone-200 hover:border-emerald-300 transition-all space-y-3 shadow-2xs"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-emerald-900 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                          {session.date}
                        </span>

                        {/* Shoe Tag or Selector Trigger */}
                        <button
                          type="button"
                          onClick={() => onOpenShoeModal(session)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                            session.shoeName
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200 font-semibold'
                              : 'bg-white text-stone-600 border-stone-300 hover:text-stone-900 hover:border-emerald-500'
                          }`}
                          title="훈련 착용 러닝화 선택 / 변경"
                        >
                          <span>👟</span>
                          <span>{session.shoeName || '+ 러닝화 지정'}</span>
                        </button>
                      </div>
                      <h5 className="text-sm sm:text-base font-bold text-stone-900">
                        {session.title}
                      </h5>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => onShareSession(session)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        title="이미지 카드로 저장 및 공유"
                      >
                        <Share2 className="w-3.5 h-3.5 text-rose-700" />
                        <span>이미지 저장</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`'${session.title}' 훈련 기록을 정말 삭제하시겠습니까?`)) {
                            onDeleteSession(session.id);
                          }
                        }}
                        className="p-1.5 text-stone-400 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                        title="기록 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stat Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-stone-200 text-xs">
                    <div className="p-2 rounded-lg bg-white border border-stone-200 shadow-2xs">
                      <div className="text-[10px] text-stone-500 mb-0.5">거리</div>
                      <div className="text-sm sm:text-base font-black text-stone-900 font-athletic">
                        {session.totalDistanceKm} <span className="text-xs text-emerald-700 font-bold">km</span>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white border border-stone-200 shadow-2xs">
                      <div className="text-[10px] text-stone-500 mb-0.5">평균 페이스</div>
                      <div className="text-sm sm:text-base font-black text-emerald-800 font-athletic">
                        {session.avgPace} <span className="text-xs text-stone-500 font-normal">/km</span>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white border border-stone-200 shadow-2xs">
                      <div className="text-[10px] text-stone-500 mb-0.5">소요 시간</div>
                      <div className="text-sm sm:text-base font-black text-stone-900 font-athletic">
                        {session.totalTime}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white border border-stone-200 shadow-2xs">
                      <div className="text-[10px] text-stone-500 mb-0.5">평균 심박수</div>
                      <div className="text-sm sm:text-base font-black text-rose-900 font-athletic">
                        {session.avgHr ? `${session.avgHr} bpm` : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Session Notes if exists */}
                  {session.notes && (
                    <div className="p-2.5 rounded-lg bg-white border border-stone-200 text-xs text-stone-700 shadow-2xs">
                      <span className="text-[10px] text-stone-500 block mb-0.5 font-semibold">훈련 메모:</span>
                      {session.notes}
                    </div>
                  )}

                  {/* Laps Preview if exists */}
                  {session.laps && session.laps.length > 0 && (
                    <div className="pt-2 border-t border-stone-200">
                      <div className="text-[10px] text-stone-600 font-semibold mb-1.5 flex items-center justify-between">
                        <span>랩 스플릿 (총 {session.laps.length}개)</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {session.laps.map((l) => (
                          <div
                            key={l.lap}
                            className="px-2 py-1 rounded bg-white border border-stone-200 text-[10px] flex items-center gap-1.5 font-mono shadow-2xs"
                          >
                            <span className="text-stone-500 font-bold">L{l.lap}</span>
                            <span className="text-emerald-800 font-bold">{l.avgPace}</span>
                            {l.avgHr && <span className="text-rose-800">({l.avgHr})</span>}
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
