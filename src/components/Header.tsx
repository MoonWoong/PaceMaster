import React from 'react';
import { Flame, Activity, ShieldCheck, Database, Calendar, Award } from 'lucide-react';
import { getDbConnectionStatus } from '../lib/firebase';
import { RegisteredRace } from '../types';
import { calculateDDay } from '../lib/marathonData';

interface HeaderProps {
  currentVDOT: number;
  races: RegisteredRace[];
  onOpenDbConfig: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentVDOT, races, onOpenDbConfig }) => {
  const dbStatus = getDbConnectionStatus();

  // Find nearest upcoming race
  const targetRace = races.find((r) => r.isTarget) || races[0];
  const dDayInfo = targetRace ? calculateDDay(targetRace.date) : null;

  return (
    <header className="w-full glass-panel rounded-2xl p-4 sm:p-6 mb-6 border border-white/15 shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-3.5">
          <div className="relative p-3 bg-gradient-to-br from-emerald-500 to-teal-700 text-slate-950 rounded-2xl shadow-lg shadow-emerald-500/25 flex items-center justify-center">
            <Flame className="w-7 h-7 text-white animate-pulse" />
            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-athletic">
                PACEMASTER
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30 uppercase tracking-wider">
                PRO RUNNER
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              개인용 맞춤형 러닝 대시보드 & 스포츠 사이언스 훈련 분석
            </p>
          </div>
        </div>

        {/* Quick Stat Highlights */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Target Race D-Day Badge */}
          {targetRace && dDayInfo && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 border border-emerald-500/30 shadow-sm">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <div className="text-left">
                <div className="text-[10px] text-slate-400 font-medium leading-none truncate max-w-[130px]">
                  {targetRace.name}
                </div>
                <div className="text-xs font-bold text-emerald-400 font-athletic">
                  {dDayInfo.text}
                </div>
              </div>
            </div>
          )}

          {/* VDOT Badge */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 border border-cyan-500/30 shadow-sm">
            <Award className="w-4 h-4 text-cyan-400" />
            <div className="text-left">
              <div className="text-[10px] text-slate-400 font-medium leading-none">
                현재 러닝 엔진
              </div>
              <div className="text-xs font-bold text-cyan-300 font-athletic">
                {currentVDOT > 0 ? `VDOT ${currentVDOT}` : '기록 측정중'}
              </div>
            </div>
          </div>

          {/* DB Status Button */}
          <button
            onClick={onOpenDbConfig}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
              dbStatus.isCloud
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700/80 hover:text-white'
            }`}
            title="클라우드 Firestore DB 설정 열기"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">
              {dbStatus.isCloud ? 'Firestore 연동됨' : 'DB 연동 설정'}
            </span>
          </button>

          {/* Security Badge */}
          <div
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-slate-400 text-xs"
            title="데이터 변경 시 보안 키 확인"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] hidden sm:inline">보안 모드 ON</span>
          </div>
        </div>
      </div>
    </header>
  );
};
