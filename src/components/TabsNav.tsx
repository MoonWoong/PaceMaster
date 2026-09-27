import React from 'react';
import { User, Activity, Trophy } from 'lucide-react';

export type TabKey = 'my_info' | 'running_records' | 'marathon_races';

interface TabsNavProps {
  activeTab: TabKey;
  onChangeTab: (tab: TabKey) => void;
  shoesCount?: number;
  sessionsCount?: number;
  racesCount?: number;
}

export const TabsNav: React.FC<TabsNavProps> = ({
  activeTab,
  onChangeTab,
  shoesCount = 0,
  sessionsCount = 0,
  racesCount = 0,
}) => {
  const tabs = [
    {
      id: 'my_info' as TabKey,
      label: '내 정보',
      badge: `${shoesCount}켤레`,
      sublabel: '신체 스펙 · 러닝화 · 목표대회',
      icon: User,
    },
    {
      id: 'running_records' as TabKey,
      label: '러닝기록 & 훈련',
      badge: `${sessionsCount}회 세션`,
      sublabel: 'PB · 심박존 · AI 훈련계획표',
      icon: Activity,
    },
    {
      id: 'marathon_races' as TabKey,
      label: '마라톤 대회 일정',
      badge: `${racesCount > 0 ? `${racesCount}개 등록` : '2026 대회'}`,
      sublabel: '전국 마라톤 검색 & D-Day',
      icon: Trophy,
    },
  ];

  const handleTabClick = (tabId: TabKey) => {
    onChangeTab(tabId);
    const el = document.getElementById('dashboard-tabs-section');
    if (el) {
      const topOffset = el.getBoundingClientRect().top + window.pageYOffset - 16;
      if (window.pageYOffset > topOffset + 120) {
        window.scrollTo({ top: topOffset, behavior: 'smooth' });
      }
    }
  };

  return (
    <div
      id="dashboard-tabs-section"
      className="w-full mb-0 sticky top-2 z-30 smooth-scroll-surface"
    >
      {/* 
        Container without top border - seamlessly connects into content below
      */}
      <div className="relative pt-1 px-1 sm:px-2 bg-slate-950/80 border-x-2 border-emerald-500/30 backdrop-blur-md rounded-t-2xl sm:rounded-t-3xl">
        {/* Category guide strip */}
        <div className="flex items-center justify-between px-2 py-1 mb-1 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono font-bold uppercase tracking-wider text-slate-300">
              상세 관리 탭
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-emerald-400 font-semibold">
              {activeTab === 'my_info' && '내 신체 스펙 & 러닝화 보관함'}
              {activeTab === 'running_records' && '러닝 기록 분석 & 맞춤 훈련 계획'}
              {activeTab === 'marathon_races' && '2026 전국 마라톤 대회 일정'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 hidden sm:inline font-mono">
            클릭하여 탭 전환
          </span>
        </div>

        {/* Tab Buttons Row - Active tab bottom blends seamlessly into body background */}
        <nav
          aria-label="대시보드 주요 관리 탭"
          className="grid grid-cols-3 gap-1 sm:gap-2 items-end -mb-[1px] relative z-10"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`relative group flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 px-2 sm:px-4 py-3 sm:py-3.5 rounded-t-xl sm:rounded-t-2xl cursor-pointer select-none transition-colors duration-150 ${
                  isActive
                    ? 'bg-slate-900/95 border-t-2 border-x border-emerald-400 border-b-transparent shadow-lg text-white font-bold z-20'
                    : 'bg-slate-950/70 hover:bg-slate-900/60 border-t border-x border-white/5 border-b border-emerald-500/30 text-slate-400 hover:text-slate-200'
                }`}
              >
                {/* Active Top Accent Line Glow */}
                {isActive && (
                  <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 shadow-sm shadow-emerald-400" />
                )}

                <div
                  className={`p-1.5 sm:p-2 rounded-xl transition-colors shrink-0 ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40'
                      : 'bg-white/5 text-slate-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-400'
                  }`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>

                <div className="text-center sm:text-left leading-tight min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-1.5">
                    <span
                      className={`text-xs sm:text-sm font-black tracking-tight truncate ${
                        isActive ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {tab.label}
                    </span>
                    <span
                      className={`hidden md:inline-block text-[9px] px-1.5 py-0.5 rounded-md font-semibold font-mono ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  </div>
                  <div
                    className={`hidden sm:block text-[10px] mt-0.5 truncate ${
                      isActive ? 'text-emerald-400/90 font-medium' : 'text-slate-500'
                    }`}
                  >
                    {tab.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
