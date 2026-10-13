import React, { useMemo } from 'react';
import { Flame, Award, Calendar, Sun, Moon } from 'lucide-react';
import { RegisteredRace } from '../types';
import { calculateDDay, getTodayDateStr } from '../lib/marathonData';
import { WeatherProvider, WeatherWidget, ThreeDayWeatherForecast } from './WeatherWidget';
import { useTheme } from '../lib/themeContext';

interface HeaderProps {
  currentVDOT: number;
  races?: RegisteredRace[];
  onOpenDbConfig?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentVDOT,
  races = [],
}) => {
  const { theme, toggleTheme } = useTheme();

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
      <header className="w-full glass-panel rounded-2xl p-4 sm:p-6 mb-6 border border-emerald-700/20 dark:border-emerald-500/25 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Brand & Title */}
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-2xl shadow-md shadow-rose-950/20 flex items-center justify-center border border-rose-700/40">
              <Flame className="w-7 h-7 text-amber-300" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100 font-athletic">
                  PACEMASTER
                </h1>
              </div>
            </div>
          </div>

          {/* Quick Stat Highlights */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Real-time Weather & Temperature Widget */}
            <WeatherWidget />

            {/* Mode Switch Button (라이트 ☀️ / 다크 🌙 모드 전환 버튼 - 날씨정보 바로 옆 위치) */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
              title={theme === 'dark' ? '화사하고 밝은 라이트 모드로 전환' : '눈이 편안한 다크 모드로 전환'}
              className={`h-11 flex-shrink-0 inline-flex items-center gap-2 px-3 rounded-xl border transition-all duration-200 cursor-pointer shadow-xs select-none ${
                theme === 'dark'
                  ? 'bg-stone-850 hover:bg-stone-800 text-amber-300 border-amber-400/40 shadow-stone-950/40 ring-1 ring-amber-400/30'
                  : 'bg-stone-50/90 hover:bg-stone-100 text-stone-700 border-stone-200 shadow-stone-200/50 hover:text-stone-900'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  theme === 'dark' ? 'bg-amber-400/20 text-amber-300' : 'bg-indigo-100 text-indigo-600'
                }`}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 animate-pulse" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </div>
              <div className="flex flex-col justify-center text-left whitespace-nowrap">
                <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium leading-none">
                  화면 모드
                </span>
                <span className="text-xs sm:text-sm font-extrabold font-athletic mt-0.5 leading-none text-stone-900 dark:text-amber-300">
                  {theme === 'dark' ? '라이트 전환' : '다크 모드'}
                </span>
              </div>
            </button>

            {/* Nearest Upcoming Race D-Day Badge */}
            {nearestUpcomingRace ? (
              <div className="h-11 flex-shrink-0 inline-flex items-center gap-2 px-3 rounded-xl bg-gradient-to-r from-rose-900 to-rose-950 text-white border border-rose-700/60 shadow-sm">
                <div className="p-1.5 rounded-lg bg-rose-800/80 text-amber-300 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="text-left whitespace-nowrap flex flex-col justify-center">
                  <div className="text-[10px] text-rose-200 font-medium leading-none flex items-center gap-1">
                    <span className="truncate max-w-[85px] sm:max-w-[120px]">{nearestUpcomingRace.race.name}</span>
                    <span>·</span>
                    <span>{nearestUpcomingRace.race.course}</span>
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-amber-300 font-athletic mt-0.5 leading-none flex items-center gap-1.5">
                    <span>{nearestUpcomingRace.dDay.text}</span>
                    <span className="text-[10px] text-rose-300 font-mono font-normal">({nearestUpcomingRace.race.date})</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-11 flex-shrink-0 inline-flex items-center gap-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200 shadow-xs">
                <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="text-left whitespace-nowrap flex flex-col justify-center">
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 font-medium leading-none">목표 대회</div>
                  <div className="text-xs sm:text-sm font-bold text-rose-900 dark:text-rose-300 font-athletic mt-0.5 leading-none">D-Day 카운터</div>
                </div>
              </div>
            )}

            {/* VDOT Badge with Gyeongju Marathon burgundy & gold tone */}
            <div className="h-11 flex-shrink-0 inline-flex items-center gap-2 px-3 rounded-xl bg-rose-50/90 dark:bg-stone-800/80 border border-rose-200/80 dark:border-stone-700 shadow-sm">
              <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-stone-700 text-rose-700 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div className="text-left whitespace-nowrap flex flex-col justify-center">
                <div className="text-[10px] text-stone-500 dark:text-stone-400 font-medium leading-none">
                  현재 러닝 엔진
                </div>
                <div className="text-xs sm:text-sm font-bold text-rose-900 dark:text-rose-300 font-athletic mt-0.5 leading-none">
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
