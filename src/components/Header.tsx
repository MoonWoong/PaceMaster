import React, { useMemo } from 'react';
import { Flame, Award, Calendar } from 'lucide-react';
import { RegisteredRace } from '../types';
import { calculateDDay, getTodayDateStr } from '../lib/marathonData';
import { WeatherProvider, WeatherWidget, ThreeDayWeatherForecast } from './WeatherWidget';

interface HeaderProps {
  currentVDOT: number;
  races?: RegisteredRace[];
  onOpenDbConfig?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentVDOT,
  races = [],
}) => {
  // Find nearest upcoming race by date (날짜가 가장 가까운 참가대회)
  const nearestUpcomingRace = useMemo(() => {
    if (!races || races.length === 0) return null;
    const todayStr = getTodayDateStr();
    const upcoming = races
      .filter((r) => {
        if (!r.date || r.status === 'completed' || r.actualRecord) return false;
        const dDay = calculateDDay(r.date, todayStr);
        return !dDay.isPassed && dDay.daysDiff >= 0;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    if (upcoming.length === 0) {
      const past = [...races].sort((a, b) => b.date.localeCompare(a.date));
      return { race: past[0], dDay: calculateDDay(past[0].date), isPast: true };
    }

    // 날짜가 가장 가까운 참가대회 우선 반환
    const nearest = upcoming[0];
    return { race: nearest, dDay: calculateDDay(nearest.date), isPast: false };
  }, [races]);

  return (
    <WeatherProvider>
      <header className="w-full glass-panel rounded-2xl p-4 sm:p-6 mb-6 border border-emerald-700/20 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Brand & Title */}
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-2xl shadow-md shadow-rose-950/20 flex items-center justify-center border border-rose-700/40">
              <Flame className="w-7 h-7 text-amber-300" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 font-athletic">
                  PACEMASTER
                </h1>
                <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-900 font-bold border border-rose-300/80 uppercase tracking-wider whitespace-nowrap">
                  2027 경주마라톤 GOAL
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stat Highlights */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Real-time Weather & Temperature Widget */}
            <WeatherWidget />

            {/* Nearest Upcoming Race D-Day Badge */}
            {nearestUpcomingRace ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-900 to-rose-950 text-white border border-rose-700/60 shadow-sm flex-shrink-0">
                <Calendar className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <div className="text-left whitespace-nowrap">
                  <div className="text-[10px] text-rose-200 font-medium leading-none flex items-center gap-1">
                    <span className="truncate max-w-[85px] sm:max-w-[120px]">{nearestUpcomingRace.race.name}</span>
                    <span>·</span>
                    <span>{nearestUpcomingRace.race.course}</span>
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-amber-300 font-athletic mt-0.5 flex items-center gap-1.5">
                    <span>{nearestUpcomingRace.dDay.text}</span>
                    <span className="text-[10px] text-rose-300 font-mono font-normal">({nearestUpcomingRace.race.date})</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 shadow-xs flex-shrink-0">
                <Calendar className="w-4 h-4 text-rose-700 flex-shrink-0" />
                <div className="text-left whitespace-nowrap">
                  <div className="text-[10px] text-stone-500 font-medium leading-none">목표 대회</div>
                  <div className="text-xs font-bold text-rose-900 font-athletic mt-0.5">D-Day 카운터</div>
                </div>
              </div>
            )}

            {/* VDOT Badge with Gyeongju Marathon burgundy & gold tone */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50/90 border border-rose-200/80 shadow-sm flex-shrink-0">
              <Award className="w-4 h-4 text-rose-700 flex-shrink-0" />
              <div className="text-left whitespace-nowrap">
                <div className="text-[10px] text-stone-500 font-medium leading-none">
                  현재 러닝 엔진
                </div>
                <div className="text-xs font-bold text-rose-900 font-athletic mt-0.5">
                  {currentVDOT > 0 ? `VDOT ${currentVDOT}` : '기록 측정중'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3-Day Weather Forecast Summary: Visible on PC/Tablet (md:block), Hidden on Mobile */}
        <div className="hidden md:block">
          <ThreeDayWeatherForecast />
        </div>
      </header>
    </WeatherProvider>
  );
};
