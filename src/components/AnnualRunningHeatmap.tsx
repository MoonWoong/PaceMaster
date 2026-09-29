import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Calendar,
  Flame,
  Award,
  Zap,
  TrendingUp,
  Info,
  Footprints,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { TrainingSession } from '../types';
import { formatPace } from '../lib/vdot';

interface AnnualRunningHeatmapProps {
  sessions: TrainingSession[];
}

interface DayCell {
  dateStr: string; // YYYY-MM-DD
  date: Date;
  dayOfWeek: number; // 0: Mon, 1: Tue, ... 6: Sun
  month: number; // 0-11
  totalDistanceKm: number;
  sessionCount: number;
  sessions: TrainingSession[];
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
}

const DAY_LABELS = ['월', '', '수', '', '금', '', '일'];
const MONTH_NAMES = [
  '1월',
  '2월',
  '3월',
  '4월',
  '5월',
  '6월',
  '7월',
  '8월',
  '9월',
  '10월',
  '11월',
  '12월',
];

export const AnnualRunningHeatmap: React.FC<AnnualRunningHeatmapProps> = ({ sessions }) => {
  const currentYear = new Date().getFullYear();

  // Extract all distinct recorded years from sessions in ascending order
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    for (const s of sessions) {
      if (!s.date) continue;
      const y = parseInt(s.date.slice(0, 4), 10);
      if (!isNaN(y) && y >= 2000 && y <= 2100) {
        yearSet.add(y);
      }
    }
    // Always include currentYear if recorded or if no sessions exist
    if (yearSet.size === 0 || yearSet.has(currentYear)) {
      yearSet.add(currentYear);
    }
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [sessions, currentYear]);

  // Default to currentYear if present in availableYears, otherwise latest recorded year
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return currentYear;
  });

  // Keep selectedYear valid when availableYears changes
  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      const fallback = availableYears.includes(currentYear)
        ? currentYear
        : availableYears[availableYears.length - 1] ?? currentYear;
      setSelectedYear(fallback);
    }
  }, [availableYears, currentYear, selectedYear]);

  const currentYearIndex = availableYears.indexOf(selectedYear);
  const hasPrevYear = currentYearIndex > 0;
  const hasNextYear = currentYearIndex < availableYears.length - 1;

  const handlePrevYear = () => {
    if (hasPrevYear) {
      setSelectedYear(availableYears[currentYearIndex - 1]);
    }
  };

  const handleNextYear = () => {
    if (hasNextYear) {
      setSelectedYear(availableYears[currentYearIndex + 1]);
    }
  };

  const [hoveredCell, setHoveredCell] = useState<DayCell | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Group all sessions by YYYY-MM-DD
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, TrainingSession[]>();
    for (const s of sessions) {
      if (!s.date) continue;
      const key = s.date.slice(0, 10);
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [sessions]);

  // Compute heatmap grid for the calendar year (Jan 1 to Dec 31)
  const { weeks, monthLabels, stats } = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const yr = selectedYear;
    const startDate = new Date(yr, 0, 1);
    // Align startDate back to previous Monday
    const startDay = startDate.getDay();
    const diffToMon = startDay === 0 ? -6 : 1 - startDay;
    startDate.setDate(startDate.getDate() + diffToMon);

    const endDate = new Date(yr, 11, 31);
    // Align endDate forward to Sunday
    const endDay = endDate.getDay();
    const diffToSun = endDay === 0 ? 0 : 7 - endDay;
    endDate.setDate(endDate.getDate() + diffToSun);

    const weeksList: DayCell[][] = [];
    let currentWeek: DayCell[] = [];

    let totalDist = 0;
    let totalRuns = 0;
    let activeDays = 0;
    let maxDistanceDay = { date: '', dist: 0 };

    // Continuous day streak tracking
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const iterDate = new Date(startDate);
    let colIndex = 0;

    while (iterDate <= endDate) {
      const y = iterDate.getFullYear();
      const m = String(iterDate.getMonth() + 1).padStart(2, '0');
      const d = String(iterDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;

      // Monday is 0, Sunday is 6
      const jsDay = iterDate.getDay();
      const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
      const currentMonth = iterDate.getMonth();

      const daySessions = sessionsByDate.get(dateStr) || [];
      const dist = Math.round(daySessions.reduce((acc, s) => acc + (s.totalDistanceKm || 0), 0) * 100) / 100;
      const count = daySessions.length;

      // Determine level (0 to 4)
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (dist > 20) level = 4;
      else if (dist > 10) level = 3;
      else if (dist > 5) level = 2;
      else if (dist > 0) level = 1;

      if (!isFuture) {
        if (dist > 0) {
          totalDist += dist;
          totalRuns += count;
          activeDays++;
          tempStreak++;
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
          }
          if (dist > maxDistanceDay.dist) {
            maxDistanceDay = { date: dateStr, dist };
          }
        } else {
          tempStreak = 0;
        }
      }

      currentWeek.push({
        dateStr,
        date: new Date(iterDate),
        dayOfWeek,
        month: currentMonth,
        totalDistanceKm: dist,
        sessionCount: count,
        sessions: daySessions,
        level,
        isToday,
        isFuture,
      });

      if (dayOfWeek === 6) {
        weeksList.push(currentWeek);
        currentWeek = [];
        colIndex++;
      }

      iterDate.setDate(iterDate.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeksList.push(currentWeek);
    }

    // Build precise month labels by checking each week column
    const monthHeaderPositions: { colIndex: number; monthName: string }[] = [];
    let lastLabeledMonth = -1;

    weeksList.forEach((week, wIdx) => {
      // Find if this week contains the start of a new month (dates 1~7)
      const startOfMonthCell = week.find(
        (cell) => cell.month !== lastLabeledMonth && cell.date.getDate() <= 7
      );
      if (startOfMonthCell) {
        const prev = monthHeaderPositions[monthHeaderPositions.length - 1];
        if (!prev || wIdx - prev.colIndex >= 2) {
          monthHeaderPositions.push({
            colIndex: wIdx,
            monthName: MONTH_NAMES[startOfMonthCell.month],
          });
          lastLabeledMonth = startOfMonthCell.month;
        }
      }
    });

    // Calculate current running streak backward from today
    let checkDate = new Date(today);
    // If today hasn't run yet, check starting from yesterday
    const todaySess = sessionsByDate.get(todayStr) || [];
    if (todaySess.length > 0) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const cy = checkDate.getFullYear();
      const cm = String(checkDate.getMonth() + 1).padStart(2, '0');
      const cd = String(checkDate.getDate()).padStart(2, '0');
      const cStr = `${cy}-${cm}-${cd}`;
      const s = sessionsByDate.get(cStr) || [];
      if (s.length > 0) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      weeks: weeksList,
      monthLabels: monthHeaderPositions,
      stats: {
        totalDist: Math.round(totalDist * 100) / 100,
        totalRuns,
        activeDays,
        currentStreak,
        longestStreak,
        maxDistanceDay,
      },
    };
  }, [sessionsByDate, selectedYear]);

  // Auto-scroll to the rightmost (recent) weeks on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [weeks]);

  // Color classes for intensity levels
  const getCellClasses = (cell: DayCell) => {
    if (cell.isFuture) {
      return 'bg-slate-900/20 border-white/5 opacity-40 cursor-default';
    }

    let base = 'transition-transform hover:scale-125 hover:z-20 cursor-pointer rounded-[3px] border ';

    if (cell.isToday) {
      base += 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-950 ';
    }

    switch (cell.level) {
      case 4:
        return base + 'bg-emerald-400 border-emerald-300 shadow-sm shadow-emerald-400/50';
      case 3:
        return base + 'bg-emerald-500 border-emerald-400/70 shadow-sm shadow-emerald-500/30';
      case 2:
        return base + 'bg-emerald-600/90 border-emerald-500/50';
      case 1:
        return base + 'bg-emerald-900/80 border-emerald-700/40';
      default:
        return base + 'bg-slate-900/70 border-white/5 hover:border-white/20';
    }
  };

  return (
    <section className="w-full glass-panel rounded-2xl p-5 sm:p-6 mb-6 border border-emerald-500/30 bg-gradient-to-br from-slate-950/95 via-emerald-950/20 to-slate-950/95 shadow-xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 shadow-md">
            <Footprints className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>연간 러닝 활동 히트맵</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Annual Contribution
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              1년간 달린 날과 훈련 거리를 깃허브 잔디밭 형태로 시각화하여 러닝 루틴의 연속성을 한눈에 보여줍니다.
            </p>
          </div>
        </div>

        {/* Calendar-style Year Navigation with Arrow Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-white/10 text-xs self-start sm:self-auto shadow-sm">
          <button
            type="button"
            onClick={handlePrevYear}
            disabled={!hasPrevYear}
            className={`p-1.5 rounded-lg transition-all ${
              hasPrevYear
                ? 'text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer active:scale-95'
                : 'text-slate-600 cursor-not-allowed opacity-30'
            }`}
            title={hasPrevYear ? `이전 연도 (${availableYears[currentYearIndex - 1]}년)로 이동` : '이전 기록 연도 없음'}
            aria-label="이전 연도"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="px-3 py-1 flex items-center gap-1.5 font-bold font-athletic text-sm sm:text-base text-white tracking-wide">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>{selectedYear}년</span>
          </div>

          <button
            type="button"
            onClick={handleNextYear}
            disabled={!hasNextYear}
            className={`p-1.5 rounded-lg transition-all ${
              hasNextYear
                ? 'text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer active:scale-95'
                : 'text-slate-600 cursor-not-allowed opacity-30'
            }`}
            title={hasNextYear ? `다음 연도 (${availableYears[currentYearIndex + 1]}년)로 이동` : '다음 기록 연도 없음'}
            aria-label="다음 연도"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Badges Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-5 relative z-10">
        <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20">
          <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1">
            <span>{selectedYear}년 누적 거리</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-white font-athletic">
              {stats.totalDist.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-emerald-400">km</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">총 {stats.totalRuns}회 세션</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20">
          <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1">
            <span className="whitespace-nowrap">달린 날 (활동 빈도)</span>
            <Calendar className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-cyan-300 font-athletic">
              {stats.activeDays}
            </span>
            <span className="text-xs font-bold text-slate-400">일</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">
            {selectedYear}년 {((selectedYear % 4 === 0 && selectedYear % 100 !== 0) || (selectedYear % 400 === 0)) ? 366 : 365}일 중{' '}
            {Math.round((stats.activeDays / (((selectedYear % 4 === 0 && selectedYear % 100 !== 0) || (selectedYear % 400 === 0)) ? 366 : 365)) * 100)}% 실천
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20">
          <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1">
            <span className="whitespace-nowrap">현재 연속 러닝</span>
            <Flame className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-amber-300 font-athletic">
              {stats.currentStreak}
            </span>
            <span className="text-xs font-bold text-amber-400">일 연속</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">
            최장 연속 기록: {stats.longestStreak}일
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20">
          <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1">
            <span className="whitespace-nowrap">단일 최장 훈련</span>
            <Award className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-purple-300 font-athletic">
              {stats.maxDistanceDay.dist > 0 ? stats.maxDistanceDay.dist.toFixed(1) : '0.0'}
            </span>
            <span className="text-xs font-bold text-purple-400">km</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate whitespace-nowrap">
            {stats.maxDistanceDay.date || '기록 없음'}
          </div>
        </div>
      </div>

      {/* Heatmap Contribution Matrix Scrollable Container */}
      <div className="relative z-10 bg-slate-950/70 p-4 sm:p-5 rounded-xl border border-white/5">
        <div
          ref={scrollContainerRef}
          className="w-full overflow-x-auto pb-2 select-none scrollbar-thin scrollbar-thumb-emerald-500/30 scrollbar-track-transparent"
        >
          <div className="min-w-[760px] inline-block">
            {/* Top Month Labels Header */}
            <div className="relative text-[10px] font-semibold text-slate-400 mb-2 ml-7 h-4">
              {monthLabels.map((m, idx) => (
                <span
                  key={idx}
                  className="absolute whitespace-nowrap text-slate-300 font-mono tracking-tight"
                  style={{ left: `${m.colIndex * 16}px` }}
                >
                  {m.monthName}
                </span>
              ))}
            </div>

            {/* Heatmap Grid Row by Day of Week (Mon -> Sun) */}
            <div className="flex">
              {/* Day of Week Labels (Left Column) */}
              <div className="flex flex-col justify-between pr-2 text-[10px] font-medium text-slate-400 w-7 select-none">
                {DAY_LABELS.map((dayLabel, idx) => (
                  <div key={idx} className="h-3 flex items-center justify-end leading-none">
                    {dayLabel}
                  </div>
                ))}
              </div>

              {/* Weeks Columns */}
              <div className="flex gap-1">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1">
                    {week.map((cell) => (
                      <div
                        key={cell.dateStr}
                        onMouseEnter={() => setHoveredCell(cell)}
                        onClick={() => setHoveredCell(cell)}
                        className={`w-3 h-3 ${getCellClasses(cell)}`}
                        title={`${cell.dateStr}: ${
                          cell.totalDistanceKm > 0
                            ? `${cell.totalDistanceKm}km (${cell.sessionCount}회)`
                            : '러닝 기록 없음'
                        }`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Heatmap Footer: Legend & Interactive Hover Details Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-white/5 text-xs text-slate-400">
          {/* Hover Cell Inspector */}
          <div className="min-h-[24px] flex items-center gap-2">
            {hoveredCell ? (
              <div className="flex items-center gap-2 font-mono text-xs text-white">
                <span className="font-sans text-slate-400">{hoveredCell.dateStr}</span>
                <span className="text-white font-bold">
                  {hoveredCell.totalDistanceKm > 0 ? (
                    <span className="text-emerald-400">
                      {hoveredCell.totalDistanceKm} km ({hoveredCell.sessionCount}회 러닝)
                    </span>
                  ) : hoveredCell.isFuture ? (
                    <span className="text-slate-500">예정된 날</span>
                  ) : (
                    <span className="text-slate-500">휴식일 (0 km)</span>
                  )}
                </span>
                {hoveredCell.sessions.length > 0 && hoveredCell.sessions[0].avgPace && (
                  <span className="text-[11px] text-cyan-300 font-sans">
                    평균 페이스: {hoveredCell.sessions[0].avgPace}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>잔디밭 타일에 마우스를 올리면 해당 일자의 훈련 상세 거리를 확인할 수 있습니다.</span>
              </span>
            )}
          </div>

          {/* Color Legend (적음 -> 많음) */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto text-[11px]">
            <span className="text-slate-500">적음</span>
            <div
              className="w-3 h-3 rounded-[3px] bg-slate-900/70 border border-white/5"
              title="0 km (휴식)"
            />
            <div
              className="w-3 h-3 rounded-[3px] bg-emerald-900/80 border border-emerald-700/40"
              title="0.1 ~ 5 km (가벼운 조깅)"
            />
            <div
              className="w-3 h-3 rounded-[3px] bg-emerald-600/90 border border-emerald-500/50"
              title="5.1 ~ 10 km (기본 조깅)"
            />
            <div
              className="w-3 h-3 rounded-[3px] bg-emerald-500 border border-emerald-400/70"
              title="10.1 ~ 20 km (지속주/포인트)"
            />
            <div
              className="w-3 h-3 rounded-[3px] bg-emerald-400 border border-emerald-300 shadow-sm shadow-emerald-400/50"
              title="20 km 초과 (LSD 장거리)"
            />
            <span className="text-slate-400 font-semibold">많음 (20km+)</span>
          </div>
        </div>
      </div>
    </section>
  );
};
