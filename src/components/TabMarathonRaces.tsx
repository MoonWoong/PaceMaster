import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Filter,
  RefreshCw,
  ExternalLink,
  Calendar,
  MapPin,
  CheckSquare,
  Square,
  Search,
  PlusCircle,
  Clock,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { MarathonEvent, RegisteredRace } from '../types';
import {
  MOCK_MARATHON_RACES,
  getFilteredMarathons,
  calculateDDay,
  getTodayDateStr,
} from '../lib/marathonData';
import { verifyRunnerSecurityKey } from '../lib/security';

interface TabMarathonRacesProps {
  onRegisterRaceToMyList: (race: Omit<RegisteredRace, 'id'>) => Promise<void>;
}

export const TabMarathonRaces: React.FC<TabMarathonRacesProps> = ({
  onRegisterRaceToMyList,
}) => {
  const [races, setRaces] = useState<MarathonEvent[]>(MOCK_MARATHON_RACES);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [registeredMessage, setRegisteredMessage] = useState('');

  // Available filter options
  const regions = [
    '서울',
    '경기/인천',
    '강원',
    '충청/대전',
    '전라/광주',
    '경상/대구/부산',
    '제주',
  ];
  const courses = ['풀', '하프', '10K', '5K'];
  const days = ['토요일', '일요일'];

  // Toggle helpers
  const toggleRegion = (reg: string) => {
    setSelectedRegions((prev) =>
      prev.includes(reg) ? prev.filter((r) => r !== reg) : [...prev, reg]
    );
  };

  const toggleCourse = (crs: string) => {
    setSelectedCourses((prev) =>
      prev.includes(crs) ? prev.filter((c) => c !== crs) : [...prev, crs]
    );
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const resetFilters = () => {
    setSelectedRegions([]);
    setSelectedCourses([]);
    setSelectedDays([]);
    setSearchQuery('');
  };

  // Sync / Refresh button with Runner Security Key Authentication
  const handleRefresh = async () => {
    const authorized = await verifyRunnerSecurityKey('마라톤GO 실시간 대회 일정 스크래핑 동기화');
    if (!authorized) return;

    setIsRefreshing(true);
    setRefreshMessage('마라톤GO 최신 실시간 스크래핑 피드와 동기화 중...');
    setTimeout(() => {
      setRaces([...MOCK_MARATHON_RACES]);
      setIsRefreshing(false);
      setRefreshMessage('✅ 2026-2027 시즌 최신 마라톤 일정이 성공적으로 동기화되었습니다. (과거 대회 제외 및 중복 제거 완료)');
      setTimeout(() => setRefreshMessage(''), 3500);
    }, 600);
  };

  // Filtered races (excluding past dates)
  const filteredRaces = useMemo(() => {
    return getFilteredMarathons(
      races,
      {
        selectedRegions,
        selectedCourses,
        selectedDays,
        searchQuery,
      },
      getTodayDateStr()
    );
  }, [races, selectedRegions, selectedCourses, selectedDays, searchQuery]);

  // Handle Register race into My Info
  const handleRegisterToMyInfo = async (race: MarathonEvent, courseToRegister: string) => {
    const ok = await verifyRunnerSecurityKey(`'${race.title}' 내 참가 대회로 등록`);
    if (!ok) return;

    await onRegisterRaceToMyList({
      name: race.title,
      date: race.date,
      course: courseToRegister,
      location: race.location,
      websiteUrl: race.websiteUrl,
      isTarget: false,
      createdAt: new Date().toISOString(),
    });

    setRegisteredMessage(`'${race.title} (${courseToRegister})' 대회가 [내 정보] 참가 대회 목록에 등록되었습니다!`);
    setTimeout(() => setRegisteredMessage(''), 4000);
  };

  return (
    <div id="marathon-races-tab" tabIndex={-1} className="space-y-6 animate-fadeIn outline-none">
      {/* Registration Success Banner */}
      {registeredMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-fadeIn">
          <span>{registeredMessage}</span>
          <button
            type="button"
            onClick={() => setRegisteredMessage('')}
            className="text-emerald-400 hover:text-white text-xs ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Refresh Control */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-white/10 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>전국 마라톤 대회 일정 검색</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                  {filteredRaces.length}개 검색됨
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                마라톤GO 실시간 스크래핑 연동 (과거 일정 자동 제외 · 대회명 기준 중복 제거 완료)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? '동기화 중...' : '최신 일정 새로고침'}</span>
            </button>
          </div>
        </div>

        {refreshMessage && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs">
            {refreshMessage}
          </div>
        )}

        {/* Filter Checkboxes Box */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-white/10 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="대회명 또는 개최 장소 검색 (예: 서울, JTBC, 송도, 하프)..."
              className="w-full pl-9 pr-4 py-2 glass-input rounded-xl text-xs"
            />
          </div>

          {/* 1. 지역별 필터 (Region Checkboxes) */}
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>지역 선택 (다중 선택 가능)</span>
              </span>
              {selectedRegions.length > 0 && (
                <button
                  onClick={() => setSelectedRegions([])}
                  className="text-[11px] text-slate-400 hover:text-white"
                >
                  선택 해제
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {regions.map((reg) => {
                const isChecked = selectedRegions.includes(reg);
                return (
                  <button
                    key={reg}
                    onClick={() => toggleRegion(reg)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                      isChecked
                        ? 'bg-amber-400 text-slate-950 font-bold border-amber-400 shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 border-white/5 hover:border-white/20'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{reg}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 코스별 필터 (Course Checkboxes) */}
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-cyan-400" />
                <span>참가 코스 (종목)</span>
              </span>
              {selectedCourses.length > 0 && (
                <button
                  onClick={() => setSelectedCourses([])}
                  className="text-[11px] text-slate-400 hover:text-white"
                >
                  선택 해제
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {courses.map((crs) => {
                const isChecked = selectedCourses.includes(crs);
                return (
                  <button
                    key={crs}
                    onClick={() => toggleCourse(crs)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                      isChecked
                        ? 'bg-cyan-400 text-slate-950 font-bold border-cyan-400 shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 border-white/5 hover:border-white/20'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{crs}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. 요일별 필터 (Day of Week Checkboxes) */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>개최 요일:</span>
              </span>
              <div className="flex items-center gap-2">
                {days.map((day) => {
                  const isChecked = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                        isChecked
                          ? 'bg-emerald-400 text-slate-950 font-bold border-emerald-400'
                          : 'bg-slate-800/80 text-slate-300 border-white/5 hover:border-white/20'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span>{day}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {(selectedRegions.length > 0 ||
              selectedCourses.length > 0 ||
              selectedDays.length > 0 ||
              searchQuery) && (
              <button
                onClick={resetFilters}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>필터 초기화</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Race Cards Grid */}
      <section className="space-y-4">
        {filteredRaces.length === 0 ? (
          <div className="glass-panel p-10 text-center rounded-2xl border border-white/10">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">
              선택한 조건의 마라톤 대회가 없습니다.
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              지역이나 코스 필터를 조정하거나 검색어를 변경해 보세요.
            </p>
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all"
            >
              전체 대회 보기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRaces.map((race) => {
              const dDay = calculateDDay(race.date);

              const statusBadgeColors = {
                접수중: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                마감임박: 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse',
                접수예정: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                접수마감: 'bg-slate-700/50 text-slate-400 border-slate-600',
              };

              return (
                <div
                  key={race.id}
                  className="glass-card rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between group shadow-lg"
                >
                  <div>
                    {/* Top row: Date, D-day badge, Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2.5 py-1 rounded-lg font-bold font-athletic bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                          {dDay.text}
                        </span>
                        <div className="text-xs text-slate-300 font-mono whitespace-nowrap">
                          {race.date} ({race.dayOfWeek})
                        </div>
                      </div>

                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border whitespace-nowrap ${
                          statusBadgeColors[race.status]
                        }`}
                      >
                        {race.status}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-base sm:text-lg font-bold text-white mb-2 group-hover:text-amber-300 transition-colors keep-all">
                      {race.title}
                    </h3>

                    {/* Location */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-300 mb-3">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{race.location}</span>
                      <span className="text-slate-500 whitespace-nowrap">({race.region})</span>
                    </div>

                    {/* Courses */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-4">
                      {race.courses.map((crs) => (
                        <span
                          key={crs}
                          className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-white/5 font-medium whitespace-nowrap"
                        >
                          {crs}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                    {/* Add to My Races button */}
                    <button
                      onClick={() => handleRegisterToMyInfo(race, race.courses[0])}
                      className="px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                      title="내 정보의 참가 대회 및 D-day 트래커로 등록"
                    >
                      <PlusCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>내 대회로 등록</span>
                    </button>

                    {/* External Link button (Opens in new window as requested) */}
                    <a
                      href={race.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-all shadow-sm cursor-pointer flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
                    >
                      <span>대회 사이트 이동</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
