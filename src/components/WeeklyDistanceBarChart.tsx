import React, { useState, useMemo } from 'react';
import {
  BarChart2,
  Calendar,
  Flame,
  TrendingUp,
  Activity,
  ChevronRight,
  Info,
  Clock,
  Award,
  Sparkles,
  Footprints,
} from 'lucide-react';
import { TrainingSession } from '../types';
import { formatPace, formatSecondsToTime, parseTimeToSeconds } from '../lib/vdot';

interface WeeklyDistanceBarChartProps {
  sessions: TrainingSession[];
  onOpenPaceCalculator?: () => void;
  onNavigateToRecords?: () => void;
}

interface DayData {
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // 월, 화, 수...
  shortDate: string; // 09.24
  fullDateLabel: string; // 2026.09.24 (수)
  isToday: boolean;
  totalDistanceKm: number;
  totalSeconds: number;
  sessions: TrainingSession[];
  avgPaceStr: string;
}

const KOREAN_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const WeeklyDistanceBarChart: React.FC<WeeklyDistanceBarChartProps> = ({
  sessions,
  onNavigateToRecords,
}) => {
  // Mode: 'rolling7' (최근 7일) or 'calendarWeek' (이번 주 월~일)
  const [viewMode, setViewMode] = useState<'rolling7' | 'calendarWeek'>('rolling7');
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);

  // Compute reference date: today or latest session date if today has no data and latest session is recent
  const referenceDate = useMemo(() => {
    const now = new Date();
    // Check if sessions has dates
    if (sessions && sessions.length > 0) {
      const dates = sessions
        .map((s) => new Date(s.date).getTime())
        .filter((t) => !isNaN(t));
      if (dates.length > 0) {
        const maxSessionTime = Math.max(...dates);
        // If max session date is after or equal to now (or close), use the max
        if (maxSessionTime > now.getTime()) {
          return new Date(maxSessionTime);
        }
      }
    }
    return now;
  }, [sessions]);

  // Generate 7 days data
  const daysData = useMemo<DayData[]>(() => {
    const list: DayData[] = [];
    const base = new Date(referenceDate);

    // Group all sessions by dateStr
    const sessionMap: Record<string, TrainingSession[]> = {};
    for (const s of sessions) {
      if (!s.date) continue;
      const dKey = s.date.trim().substring(0, 10);
      if (!sessionMap[dKey]) sessionMap[dKey] = [];
      sessionMap[dKey].push(s);
    }

    if (viewMode === 'rolling7') {
      // D-6 to D-0 (7 days ending at referenceDate)
      for (let i = 6; i >= 0; i--) {
        const d = new Date(base);
        d.setDate(base.getDate() - i);

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const dayOfWeek = KOREAN_DAYS[d.getDay()];

        const daySessions = sessionMap[dateStr] || [];
        const distSum = daySessions.reduce((acc, cur) => acc + (cur.totalDistanceKm || 0), 0);
        const secSum = daySessions.reduce((acc, cur) => acc + parseTimeToSeconds(cur.totalTime || ''), 0);

        let paceStr = "-'--\"";
        if (distSum > 0 && secSum > 0) {
          paceStr = formatPace(secSum / distSum);
        }

        const isToday = i === 0;

        list.push({
          dateStr,
          dayLabel: dayOfWeek,
          shortDate: `${month}.${day}`,
          fullDateLabel: `${year}.${month}.${day} (${dayOfWeek})`,
          isToday,
          totalDistanceKm: Math.round(distSum * 100) / 100,
          totalSeconds: secSum,
          sessions: daySessions,
          avgPaceStr: paceStr,
        });
      }
    } else {
      // Calendar Week: Monday ~ Sunday of referenceDate's week
      const currentDayOfWeek = base.getDay(); // 0 is Sun, 1 is Mon...
      const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
      const monday = new Date(base);
      monday.setDate(base.getDate() + diffToMonday);

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const dayOfWeek = KOREAN_DAYS[d.getDay()];

        const daySessions = sessionMap[dateStr] || [];
        const distSum = daySessions.reduce((acc, cur) => acc + (cur.totalDistanceKm || 0), 0);
        const secSum = daySessions.reduce((acc, cur) => acc + parseTimeToSeconds(cur.totalTime || ''), 0);

        let paceStr = "-'--\"";
        if (distSum > 0 && secSum > 0) {
          paceStr = formatPace(secSum / distSum);
        }

        const todayYear = base.getFullYear();
        const todayMonth = String(base.getMonth() + 1).padStart(2, '0');
        const todayDay = String(base.getDate()).padStart(2, '0');
        const isToday = dateStr === `${todayYear}-${todayMonth}-${todayDay}`;

        list.push({
          dateStr,
          dayLabel: dayOfWeek,
          shortDate: `${month}.${day}`,
          fullDateLabel: `${year}.${month}.${day} (${dayOfWeek})`,
          isToday,
          totalDistanceKm: Math.round(distSum * 100) / 100,
          totalSeconds: secSum,
          sessions: daySessions,
          avgPaceStr: paceStr,
        });
      }
    }

    return list;
  }, [sessions, referenceDate, viewMode]);

  // Aggregate Metrics for the 7 Days
  const summary = useMemo(() => {
    let totalDist = 0;
    let totalSec = 0;
    let activeDaysCount = 0;
    let maxDayDist = 0;
    let maxDayLabel = '';

    for (const d of daysData) {
      totalDist += d.totalDistanceKm;
      totalSec += d.totalSeconds;
      if (d.totalDistanceKm > 0) {
        activeDaysCount++;
        if (d.totalDistanceKm > maxDayDist) {
          maxDayDist = d.totalDistanceKm;
          maxDayLabel = `${d.shortDate} (${d.dayLabel}) ${d.totalDistanceKm}km`;
        }
      }
    }

    const avgDailyDist = totalDist > 0 ? (totalDist / 7).toFixed(1) : '0.0';
    const overallPace =
      totalDist > 0 && totalSec > 0 ? formatPace(totalSec / totalDist) : "-'--\"";

    return {
      totalDist: Math.round(totalDist * 100) / 100,
      totalSec,
      totalTimeFormatted: formatSecondsToTime(totalSec, true),
      activeDaysCount,
      restDaysCount: 7 - activeDaysCount,
      avgDailyDist,
      overallPace,
      maxDayDist,
      maxDayLabel,
    };
  }, [daysData]);

  // Max value for chart Y-axis scale (minimum 15km to look balanced)
  const chartMaxY = Math.max(15, Math.ceil((summary.maxDayDist + 2) / 5) * 5);

  return (
    <section className="w-full glass-panel rounded-2xl p-4 sm:p-6 mb-6 border border-emerald-600/20 shadow-md relative overflow-hidden bg-white/95 text-stone-800">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-800 to-rose-950 text-white font-bold shadow-sm border border-rose-700/40">
            <BarChart2 className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-stone-900 font-athletic">
                최근 7일간 훈련 마일리지 대시보드
              </h2>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold border border-emerald-300 uppercase tracking-wider">
                {viewMode === 'rolling7' ? '최근 7일' : '이번 주 월~일'}
              </span>
            </div>
            <p className="text-xs text-stone-600">
              잔디밭과 트랙 위에서 달린 7일간의 총 러닝 거리를 일별 막대 그래프와 함께 집계합니다.
            </p>
          </div>
        </div>

        {/* Action Controls & Mode Switch */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switch Buttons */}
          <div className="flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('rolling7')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'rolling7'
                  ? 'bg-white text-emerald-900 shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              최근 7일
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendarWeek')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'calendarWeek'
                  ? 'bg-white text-emerald-900 shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              이번 주 (월~일)
            </button>
          </div>
        </div>
      </div>

      {/* 4 Key Stat Badges Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-6 relative z-10">
        {/* Total Distance Card */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-stone-50/90 border border-stone-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
            <span>7일간 총 러닝 거리</span>
            <Footprints className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-stone-900 font-athletic tracking-tight">
              {summary.totalDist.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-emerald-800">km</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">
            일평균 <span className="text-emerald-800 font-bold">{summary.avgDailyDist}km</span> 달림
          </div>
        </div>

        {/* Total Time & Pace Card */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-stone-50/90 border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
            <span>평균 페이스 & 시간</span>
            <Clock className="w-3.5 h-3.5 text-rose-700" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-rose-900 font-athletic tracking-tight">
              {summary.overallPace}
            </span>
            <span className="text-xs font-semibold text-stone-500">/km</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 truncate">
            총 러닝 시간: <span className="text-stone-800 font-mono font-semibold">{summary.totalTimeFormatted}</span>
          </div>
        </div>

        {/* Workout Days Card */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-stone-50/90 border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
            <span>훈련 주기 & 일수</span>
            <Calendar className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-stone-900 font-athletic tracking-tight">
              {summary.activeDaysCount}
            </span>
            <span className="text-xs font-bold text-amber-800">일 러닝</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">
            휴식 {summary.restDaysCount}일 / 총 7일
          </div>
        </div>

        {/* Longest Run Card */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-stone-50/90 border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
            <span>최장 러닝 (LSD)</span>
            <Award className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-emerald-800 font-athletic tracking-tight">
              {summary.maxDayDist.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-emerald-800">km</span>
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 truncate">
            {summary.maxDayLabel ? summary.maxDayLabel : '기록 없음'}
          </div>
        </div>
      </div>

      {/* Main Bar Chart Section */}
      <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/40 border border-emerald-600/15 relative z-10">
        {/* Scale reference info */}
        <div className="flex items-center justify-between text-[11px] text-stone-500 mb-4 pb-2 border-b border-emerald-600/15">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-700" />
            <span>막대를 마우스로 올리거나 터치하면 일자별 세부 훈련 세션이 표시됩니다.</span>
          </span>
          <span className="font-mono text-stone-500 hidden sm:inline">
            최대 기준 눈금: {chartMaxY}km
          </span>
        </div>

        {/* Vertical Bars Flex Layout */}
        <div className="relative pt-6 pb-2">
          {/* Subtle horizontal grid lines */}
          <div className="absolute inset-x-0 top-6 bottom-10 flex flex-col justify-between pointer-events-none opacity-25">
            <div className="w-full border-b border-dashed border-emerald-700 text-[10px] text-emerald-800 pr-1 text-right">
              {chartMaxY}km
            </div>
            <div className="w-full border-b border-dashed border-stone-400 text-[10px] text-stone-500 pr-1 text-right">
              {(chartMaxY / 2).toFixed(0)}km
            </div>
            <div className="w-full border-b border-stone-400 text-[10px] text-stone-500 pr-1 text-right">
              0km
            </div>
          </div>

          {/* 7 Bars Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-4 items-end h-48 sm:h-56 relative z-10 px-1 sm:px-3">
            {daysData.map((d) => {
              const heightPct =
                chartMaxY > 0 ? Math.min(100, Math.max(6, (d.totalDistanceKm / chartMaxY) * 100)) : 6;
              const hasRun = d.totalDistanceKm > 0;
              const isHovered = hoveredDay?.dateStr === d.dateStr;

              return (
                <div
                  key={d.dateStr}
                  className="flex flex-col items-center h-full justify-end group cursor-pointer"
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => setHoveredDay(isHovered ? null : d)}
                >
                  {/* Distance text on top of bar */}
                  <div
                    className={`mb-1.5 text-center transition-all ${
                      isHovered ? 'scale-110 -translate-y-1' : ''
                    }`}
                  >
                    {hasRun ? (
                      <span className="inline-block px-1 sm:px-2 py-0.5 rounded-md bg-white border border-emerald-600/30 text-[10px] sm:text-xs font-black text-emerald-900 font-athletic shadow-2xs">
                        {d.totalDistanceKm.toFixed(1)}
                        <span className="text-[9px] font-normal hidden sm:inline ml-0.5">k</span>
                      </span>
                    ) : (
                      <span className="text-[10px] sm:text-[11px] text-stone-400 font-medium">
                        휴식
                      </span>
                    )}
                  </div>

                  {/* Vertical Bar Graphic */}
                  <div className="w-full max-w-[48px] flex items-end justify-center h-full max-h-[140px] sm:max-h-[160px]">
                    <div
                      style={{ height: `${hasRun ? heightPct : 6}%` }}
                      className={`w-full rounded-t-xl transition-all duration-500 ease-out relative ${
                        hasRun
                          ? d.isToday
                            ? 'bg-gradient-to-t from-[#881337] via-[#16a34a] to-[#22c55e] shadow-md border-t-2 border-emerald-400'
                            : 'bg-gradient-to-t from-[#881337] via-[#15803d] to-[#4ade80] hover:from-[#991b1b] hover:via-[#16a34a] hover:to-[#86efac] shadow-sm'
                          : 'bg-stone-200/60 border border-dashed border-stone-300'
                      } ${isHovered ? 'ring-2 ring-emerald-500 scale-[1.04]' : ''}`}
                    >
                      {/* Top highlight cap */}
                      {hasRun && (
                        <div className="absolute top-0 inset-x-0 h-1.5 rounded-t-xl bg-white/40" />
                      )}
                    </div>
                  </div>

                  {/* Day of week & Date label below bar */}
                  <div className="mt-2 text-center">
                    <div
                      className={`text-xs sm:text-sm font-bold leading-tight ${
                        d.isToday ? 'text-emerald-800 font-black' : 'text-stone-700'
                      }`}
                    >
                      {d.dayLabel}
                    </div>
                    <div className="text-[10px] text-stone-500 leading-tight">{d.shortDate}</div>
                    {d.isToday && (
                      <span className="inline-block mt-0.5 px-1 py-0.2 rounded bg-emerald-600 text-white text-[9px] font-black leading-none uppercase">
                        오늘
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hovered Day Tooltip Card */}
        {hoveredDay && (
          <div className="mt-4 p-3.5 rounded-xl bg-white border border-emerald-600/30 shadow-lg animate-fadeIn text-stone-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-stone-900">{hoveredDay.fullDateLabel}</span>
                {hoveredDay.isToday && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                    오늘
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-stone-600">
                  총 거리:{' '}
                  <span className="text-emerald-800 font-bold font-athletic text-sm">
                    {hoveredDay.totalDistanceKm}km
                  </span>
                </span>
                {hoveredDay.totalDistanceKm > 0 && (
                  <>
                    <span className="text-stone-600">
                      평균 페이스:{' '}
                      <span className="text-rose-900 font-bold font-athletic">
                        {hoveredDay.avgPaceStr}
                      </span>
                    </span>
                    <span className="text-stone-600">
                      시간:{' '}
                      <span className="text-stone-900 font-mono font-semibold">
                        {formatSecondsToTime(hoveredDay.totalSeconds, true)}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* List of training sessions on this day */}
            {hoveredDay.sessions.length > 0 ? (
              <div className="space-y-1.5">
                {hoveredDay.sessions.map((sess, idx) => (
                  <div
                    key={sess.id || idx}
                    className="flex flex-wrap items-center justify-between p-2 rounded-lg bg-stone-50 text-xs border border-stone-200"
                  >
                    <div className="flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5 text-rose-700" />
                      <span className="font-semibold text-stone-900">{sess.title}</span>
                      {sess.shoeName && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200">
                          👟 {sess.shoeName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-stone-600 font-mono text-[11px]">
                      <span>{sess.totalDistanceKm}km</span>
                      <span>{sess.totalTime}</span>
                      <span className="text-emerald-800 font-semibold">{sess.avgPace}/km</span>
                      {sess.avgHr && <span>심박 {sess.avgHr}bpm</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-stone-500 py-1 flex items-center gap-2">
                <span>🛌 훈련 기록이 없는 휴식일(Rest Day)입니다. 몸의 회복과 재생도 훈련의 일부입니다.</span>
              </div>
            )}
          </div>
        )}

        {/* Empty State Banner if no distance in last 7 days */}
        {summary.totalDist === 0 && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                최근 7일간 등록된 러닝 기록이 없습니다. 가민 CSV 파일을 등록하여 그래프를 확인해보세요!
              </span>
            </div>
            {onNavigateToRecords && (
              <button
                type="button"
                onClick={onNavigateToRecords}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shrink-0 ml-2"
              >
                훈련 기록 등록하기
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
