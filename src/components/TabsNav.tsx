import React from 'react';
import { User, Activity, Trophy, CalendarRange } from 'lucide-react';

export type TabKey = 'my_info' | 'running_records' | 'training_plan' | 'marathon_races';

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
      sublabel: 'PB · 심박존 · 가민 CSV',
      icon: Activity,
    },
    {
      id: 'training_plan' as TabKey,
      label: '플랜',
      badge: '주/월간 뷰',
      sublabel: '맞춤 주기화 계획표 · 포인트',
      icon: CalendarRange,
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
      <div className="relative pt-1 px-1 sm:px-2 bg-stone-100/90 border-x-2 border-t-2 border-emerald-600/30 backdrop-blur-md rounded-t-2xl sm:rounded-t-3xl">
        {/* Category guide strip */}
        <div className="flex items-center justify-between px-2 py-1 mb-1 text-[11px] text-stone-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span className="font-mono font-bold uppercase tracking-wider text-stone-800">
              상세 관리 탭
            </span>
            <span className="text-stone-400">/</span>
            <span className="text-emerald-900 font-bold truncate max-w-[180px] xs:max-w-none whitespace-nowrap">
              {activeTab === 'my_info' && '내 신체 스펙 & 러닝화 보관함'}
              {activeTab === 'running_records' && '러닝 기록 분석 & 가민 CSV 세션'}
              {activeTab === 'training_plan' && '기간 맞춤 훈련 계획표 (주/월간 주기화)'}
              {activeTab === 'marathon_races' && '전국 마라톤 대회 일정'}
            </span>
          </div>
        </div>

        {/* Tab Buttons Row - Active tab bottom blends seamlessly into body background */}
        <nav
          aria-label="대시보드 주요 관리 탭"
          className="grid grid-cols-4 gap-1 sm:gap-2 items-end -mb-[1px] relative z-10"
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
                    ? 'bg-white border-t-2 border-x border-emerald-600 border-b-transparent shadow-md text-stone-900 font-bold z-20'
                    : 'bg-stone-200/60 hover:bg-white/70 border-t border-x border-stone-200 border-b border-emerald-600/30 text-stone-600 hover:text-stone-900'
                }`}
              >
                {/* Active Top Accent Line Glow */}
                {isActive && (
                  <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-emerald-600 via-rose-700 to-emerald-600" />
                )}

                <div
                  className={`p-1.5 sm:p-2 rounded-xl transition-colors shrink-0 ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-500/40'
                      : 'bg-white/80 text-stone-500 group-hover:bg-rose-50 group-hover:text-rose-800'
                  }`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>

                <div className="text-center sm:text-left leading-tight min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-1.5">
                    <span
                      className={`text-xs sm:text-sm font-black tracking-tight truncate ${
                        isActive ? 'text-stone-900' : 'text-stone-700 group-hover:text-stone-900'
                      }`}
                    >
                      {tab.label}
                    </span>
                    <span
                      className={`hidden md:inline-block text-[9px] px-1.5 py-0.5 rounded-md font-semibold font-mono ${
                        isActive
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : 'bg-stone-200 text-stone-700 border border-stone-300'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  </div>
                  <div
                    className={`hidden sm:block text-[10px] mt-0.5 truncate ${
                      isActive ? 'text-emerald-800 font-bold' : 'text-stone-500'
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
