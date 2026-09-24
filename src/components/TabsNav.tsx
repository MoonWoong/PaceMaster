import React from 'react';
import { User, Activity, Trophy } from 'lucide-react';

export type TabKey = 'my_info' | 'running_records' | 'marathon_races';

interface TabsNavProps {
  activeTab: TabKey;
  onChangeTab: (tab: TabKey) => void;
}

export const TabsNav: React.FC<TabsNavProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    {
      id: 'my_info' as TabKey,
      label: '내 정보',
      sublabel: '신체·러닝화·목표대회',
      icon: User,
    },
    {
      id: 'running_records' as TabKey,
      label: '러닝기록',
      sublabel: 'PB·심박존·CSV·주간계획',
      icon: Activity,
    },
    {
      id: 'marathon_races' as TabKey,
      label: '마라톤 대회',
      sublabel: '일정 검색·필터·동기화',
      icon: Trophy,
    },
  ];

  return (
    <div className="w-full mb-6">
      <nav
        aria-label="대시보드 주요 탭 메뉴"
        className="grid grid-cols-3 gap-2 sm:gap-3 p-1.5 glass-panel rounded-2xl border border-white/10"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`min-h-[52px] sm:min-h-[60px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 px-2 sm:px-4 py-2 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/25 scale-[1.01]'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon
                className={`w-4 h-4 sm:w-5 sm:h-5 ${
                  isActive ? 'text-slate-950' : 'text-emerald-400'
                }`}
              />
              <div className="text-center sm:text-left leading-tight">
                <div className="text-xs sm:text-sm">{tab.label}</div>
                <div
                  className={`hidden sm:block text-[10px] font-normal ${
                    isActive ? 'text-slate-900/80' : 'text-slate-400'
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
  );
};
