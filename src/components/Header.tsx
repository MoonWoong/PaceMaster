import React from 'react';
import { Flame, Activity, ShieldCheck, Database, Award } from 'lucide-react';
import { getDbConnectionStatus } from '../lib/firebase';
import { RegisteredRace } from '../types';
import { WeatherProvider, WeatherWidget, ThreeDayWeatherForecast } from './WeatherWidget';

interface HeaderProps {
  currentVDOT: number;
  races?: RegisteredRace[];
  onOpenDbConfig: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentVDOT,
  onOpenDbConfig,
}) => {
  const dbStatus = getDbConnectionStatus();

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
              <p className="text-xs sm:text-sm text-stone-600 font-medium keep-all">
                싱그러운 봄 트랙 러닝 · 2027 경주 벚꽃 & 국제 마라톤 맞춤 훈련 대시보드
              </p>
            </div>
          </div>

          {/* Quick Stat Highlights */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Real-time Weather & Temperature Widget */}
            <WeatherWidget />

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

            {/* DB Status Button */}
            <button
              onClick={onOpenDbConfig}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all flex-shrink-0 whitespace-nowrap cursor-pointer ${
                dbStatus.isCloud
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100 hover:text-stone-900'
              }`}
              title="클라우드 Firestore DB 설정 열기"
            >
              <Database className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="hidden sm:inline">
                {dbStatus.isCloud ? 'Firestore 연동됨' : 'DB 연동 설정'}
              </span>
            </button>

            {/* Security Badge */}
            <div
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-xs flex-shrink-0 whitespace-nowrap font-medium"
              title="데이터 변경 시 보안 키 확인"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="text-[11px] hidden sm:inline">보안 모드 ON</span>
            </div>
          </div>
        </div>

        {/* 3-Day Weather Forecast Summary below Current Weather for Training Planning */}
        <ThreeDayWeatherForecast />
      </header>
    </WeatherProvider>
  );
};
