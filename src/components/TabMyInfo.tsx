import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Scale,
  Calendar,
  Footprints,
  Plus,
  Trash2,
  Edit2,
  Check,
  Sparkles,
  Award,
  ExternalLink,
  Search,
  RotateCcw,
} from 'lucide-react';
import { PhysicalInfo, RunningShoe, RegisteredRace, ShoeCategory } from '../types';
import { calculateDDay } from '../lib/marathonData';
import { verifyRunnerSecurityKey } from '../lib/security';

interface TabMyInfoProps {
  physicalInfo: PhysicalInfo;
  shoes: RunningShoe[];
  races: RegisteredRace[];
  onSavePhysical: (info: PhysicalInfo) => Promise<void>;
  onAddShoe: (shoe: Omit<RunningShoe, 'id'>) => Promise<void>;
  onUpdateShoe: (shoe: RunningShoe) => Promise<void>;
  onDeleteShoe: (id: string) => Promise<void>;
  onResetShoes: () => Promise<void>;
  onAddRace: (race: Omit<RegisteredRace, 'id'>) => Promise<void>;
  onDeleteRace: (id: string) => Promise<void>;
}

export const TabMyInfo: React.FC<TabMyInfoProps> = ({
  physicalInfo,
  shoes,
  races,
  onSavePhysical,
  onAddShoe,
  onUpdateShoe,
  onDeleteShoe,
  onResetShoes,
  onAddRace,
  onDeleteRace,
}) => {
  // Physical Info State
  const [height, setHeight] = useState(physicalInfo.height.toString());
  const [weight, setWeight] = useState(physicalInfo.weight.toString());
  const [age, setAge] = useState(physicalInfo.age.toString());
  const [isSavingPhysical, setIsSavingPhysical] = useState(false);
  const [physicalSavedAlert, setPhysicalSavedAlert] = useState(false);

  // Shoes State
  const [selectedShoeCategory, setSelectedShoeCategory] = useState<string>('데일리');
  const [shoeSearchQuery, setShoeSearchQuery] = useState<string>('');
  const [isShoeModalOpen, setIsShoeModalOpen] = useState(false);
  const [newShoeName, setNewShoeName] = useState('');
  const [newShoeBrand, setNewShoeBrand] = useState('Nike');
  const [newShoeCategory, setNewShoeCategory] = useState<ShoeCategory>('데일리');
  const [newShoeMileage, setNewShoeMileage] = useState('0');
  const [newShoeMaxMileage, setNewShoeMaxMileage] = useState('600');
  const [newShoeReview, setNewShoeReview] = useState('');

  // Editing Shoe Full Details State
  const [editingShoe, setEditingShoe] = useState<RunningShoe | null>(null);
  const [editShoeName, setEditShoeName] = useState<string>('');
  const [editShoeBrand, setEditShoeBrand] = useState<string>('Nike');
  const [editShoeCategory, setEditShoeCategory] = useState<ShoeCategory>('데일리');
  const [editMileage, setEditMileage] = useState<string>('0');
  const [editMaxMileage, setEditMaxMileage] = useState<string>('600');
  const [editReview, setEditReview] = useState<string>('');

  // Races State
  const [isRaceModalOpen, setIsRaceModalOpen] = useState(false);
  const [newRaceName, setNewRaceName] = useState('');
  const [newRaceDate, setNewRaceDate] = useState('2026-11-01');
  const [newRaceCourse, setNewRaceCourse] = useState('풀 (42.195km)');
  const [newRaceLocation, setNewRaceLocation] = useState('서울');

  // Calculate BMI
  const heightM = parseFloat(height) / 100;
  const weightKg = parseFloat(weight);
  const bmi = heightM > 0 && weightKg > 0 ? (weightKg / (heightM * heightM)).toFixed(1) : '-';
  const getBmiDesc = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    if (num < 18.5) return '저체중 (가벼운 주법에 유리)';
    if (num < 23) return '정상 체중 (마라톤 최적 구간)';
    if (num < 25) return '과체중 (관절 보호 및 서서히 감량 추천)';
    return '비만 (부상 방지 조깅 위주 추천)';
  };

  // Handle Physical Save
  const handleSavePhysical = async (e: React.FormEvent) => {
    e.preventDefault();
    const authorized = await verifyRunnerSecurityKey('신체 정보 저장/수정');
    if (!authorized) return;

    setIsSavingPhysical(true);
    await onSavePhysical({
      height: parseFloat(height) || 175,
      weight: parseFloat(weight) || 68,
      age: parseInt(age, 10) || 30,
    });
    setIsSavingPhysical(false);
    setPhysicalSavedAlert(true);
    setTimeout(() => setPhysicalSavedAlert(false), 2500);
  };

  // Handle Add Shoe
  const handleAddShoeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShoeName.trim()) return;

    const authorized = await verifyRunnerSecurityKey('러닝화 등록');
    if (!authorized) return;

    await onAddShoe({
      name: newShoeName.trim(),
      brand: newShoeBrand.trim(),
      category: newShoeCategory,
      mileage: parseFloat(newShoeMileage) || 0,
      maxMileage: newShoeCategory === '레이싱' ? 300 : (parseFloat(newShoeMaxMileage) || 600),
      review: newShoeReview.trim() || '탄탄한 착화감과 접지력.',
      createdAt: new Date().toISOString().split('T')[0],
    });

    setNewShoeName('');
    setNewShoeReview('');
    setNewShoeMileage('0');
    setNewShoeMaxMileage('600');
    setIsShoeModalOpen(false);
  };

  // Open Edit Modal for a Shoe (Full information editing)
  const handleOpenEditShoe = (shoe: RunningShoe) => {
    setEditingShoe(shoe);
    setEditShoeName(shoe.name);
    setEditShoeBrand(shoe.brand);
    setEditShoeCategory(shoe.category);
    setEditMileage(shoe.mileage.toString());
    setEditMaxMileage((shoe.maxMileage || (shoe.category === '레이싱' ? 300 : 600)).toString());
    setEditReview(shoe.review || '');
  };

  // Handle Save Edited Shoe
  const handleSaveEditShoeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShoe) return;
    if (!editShoeName.trim()) {
      alert('러닝화 모델명을 입력해주세요.');
      return;
    }

    const authorized = await verifyRunnerSecurityKey(`'${editShoeName.trim()}' 러닝화 정보 수정`);
    if (!authorized) return;

    await onUpdateShoe({
      ...editingShoe,
      name: editShoeName.trim(),
      brand: editShoeBrand.trim(),
      category: editShoeCategory,
      mileage: parseFloat(editMileage) || 0,
      maxMileage: parseFloat(editMaxMileage) || (editShoeCategory === '레이싱' ? 300 : 600),
      review: editReview.trim() || '탄탄한 착화감과 접지력.',
    });

    setEditingShoe(null);
  };

  // Handle Add Race
  const handleAddRaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRaceName.trim()) return;

    const authorized = await verifyRunnerSecurityKey('참가 대회 등록');
    if (!authorized) return;

    await onAddRace({
      name: newRaceName.trim(),
      date: newRaceDate,
      course: newRaceCourse,
      location: newRaceLocation,
      isTarget: races.length === 0,
      createdAt: new Date().toISOString(),
    });

    setNewRaceName('');
    setIsRaceModalOpen(false);
  };

  // Filter Shoes ('전체' 탭을 가장 마지막 위치로 배치)
  const shoeCategories: (ShoeCategory | '전체')[] = [
    '데일리',
    '스피드',
    '장거리',
    '레이싱',
    '트레일',
    '전체',
  ];
  const filteredShoes = shoes.filter((s) => {
    if (selectedShoeCategory !== '전체' && s.category !== selectedShoeCategory) {
      return false;
    }
    if (shoeSearchQuery.trim()) {
      const q = shoeSearchQuery.toLowerCase().trim();
      const matchName = s.name.toLowerCase().includes(q);
      const matchBrand = s.brand.toLowerCase().includes(q);
      const matchReview = s.review.toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchReview) return false;
    }
    return true;
  });

  // Sort races by nearest date first (가까운 날짜 순 정렬)
  const sortedRaces = useMemo(() => {
    return [...races].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [races]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. 신체 정보 섹션 */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-white/10 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">러너 신체 정보</h2>
              <p className="text-xs text-slate-400">
                체중과 키는 페이스 효율성 및 VO2max 계산의 중요한 기준입니다.
              </p>
            </div>
          </div>

          {physicalSavedAlert && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs border border-emerald-500/30 animate-pulse">
              <Check className="w-3.5 h-3.5" />
              <span>저장 완료</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSavePhysical}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                신장 (키 cm)
              </label>
              <input
                type="number"
                step="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                required
                className="w-full px-4 py-2.5 glass-input rounded-xl text-sm font-semibold"
                placeholder="175"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                체중 (몸무게 kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
                className="w-full px-4 py-2.5 glass-input rounded-xl text-sm font-semibold"
                placeholder="68"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                나이 (만 연령)
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
                className="w-full px-4 py-2.5 glass-input rounded-xl text-sm font-semibold"
                placeholder="32"
              />
            </div>
          </div>

          {/* Realtime BMI & Runner Weight Analysis */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 mb-5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">BMI 체질량지수:</span>
              <span className="text-emerald-400 font-bold font-athletic text-sm">{bmi}</span>
              <span className="text-slate-300">({getBmiDesc(bmi)})</span>
            </div>
            <div className="text-slate-400 text-[11px]">
              * 1kg 체중 감량 시 풀코스 완주 시간 약 2~3분 단축 효과
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingPhysical}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>{isSavingPhysical ? '저장 중...' : '신체 정보 저장 (보안 확인)'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. 보유 러닝화 목록 섹션 */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-white/10 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
              <Footprints className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>보유 러닝화 로테이션</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                  {shoes.length}켤레
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                훈련 목적별 신발 로테이션(데일리/스피드/LSD/레이싱/트레일) 및 마일리지 수명 관리
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsShoeModalOpen(true)}
              className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:border-cyan-400"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>러닝화 등록</span>
            </button>
          </div>
        </div>

        {/* Search bar & Category Filter Buttons */}
        <div className="space-y-3 mb-5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={shoeSearchQuery}
              onChange={(e) => setShoeSearchQuery(e.target.value)}
              placeholder="러닝화 모델명 또는 브랜드 검색 (예: 베이퍼플라이, 알파플라이, 아디오스, 메타스피드, 호카, 나이트로)..."
              className="w-full pl-9 pr-4 py-2 glass-input rounded-xl text-xs"
            />
            {shoeSearchQuery && (
              <button
                onClick={() => setShoeSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                지우기
              </button>
            )}
          </div>

          {/* Category Filter Buttons (Mobile-first large touch targets) */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/60 rounded-xl border border-white/5 overflow-x-auto scrollbar-none">
            {shoeCategories.map((cat) => {
              const count = cat === '전체' ? shoes.length : shoes.filter((s) => s.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedShoeCategory(cat)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[38px] flex items-center gap-1.5 ${
                    selectedShoeCategory === cat
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedShoeCategory === cat ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shoes Grid */}
        {filteredShoes.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-white/5">
            <Footprints className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">등록된 러닝화가 없습니다.</p>
            <button
              onClick={() => setIsShoeModalOpen(true)}
              className="mt-3 text-xs text-cyan-400 hover:underline"
            >
              새로운 러닝화를 등록해 보세요.
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredShoes.map((shoe) => {
              const maxMil = shoe.maxMileage || 600;
              const pct = Math.min(Math.round((shoe.mileage / maxMil) * 100), 100);
              const isOverdue = shoe.mileage >= maxMil;

              const categoryBadgeColors: Record<ShoeCategory, string> = {
                데일리: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                스피드: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                장거리: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                레이싱: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                트레일: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
              };

              return (
                <div
                  key={shoe.id}
                  className="glass-card rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${
                            categoryBadgeColors[shoe.category]
                          }`}
                        >
                          {shoe.category}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{shoe.brand}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditShoe(shoe)}
                          className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg transition-colors cursor-pointer"
                          title="러닝화 전체 정보 및 마일리지 수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await verifyRunnerSecurityKey(
                              `'${shoe.name}' 러닝화 삭제`
                            );
                            if (ok) onDeleteShoe(shoe.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          title="삭제 (비밀번호 확인)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-white mb-2">{shoe.name}</h3>

                    {/* 한줄평 */}
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 text-xs text-slate-300 mb-3 italic">
                      &ldquo;{shoe.review}&rdquo;
                    </div>
                  </div>

                  {/* Mileage progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">누적 주행거리:</span>
                      <div className="flex items-center gap-1.5 font-mono font-bold text-white">
                        <span className="text-cyan-400 text-sm">
                          {shoe.mileage}km
                        </span>
                        <span className="text-slate-500 font-normal">/ {maxMil}km ({pct}%)</span>
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isOverdue
                            ? 'bg-rose-500'
                            : pct > 80
                            ? 'bg-amber-400'
                            : 'bg-cyan-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {isOverdue && (
                      <p className="text-[10px] text-rose-400 mt-1">
                        ⚠️ 수명 마일리지 초과: 미드솔 쿠션 수명이 다해 무릎 부상 위험이 있습니다.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. 참가 대회 & D-day 섹션 */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-white/10 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>참가 예정 대회 및 D-Day 카운터</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                  {races.length}개
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                목표 대회 날짜에 맞추어 자동으로 D-day를 계산하고 피킹 훈련을 조율합니다.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsRaceModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-amber-500/40 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:border-amber-400"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>참가 대회 등록</span>
          </button>
        </div>

        {races.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-white/5">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">등록된 마라톤 대회가 없습니다.</p>
            <button
              onClick={() => setIsRaceModalOpen(true)}
              className="mt-3 text-xs text-amber-400 hover:underline"
            >
              올해 출전할 대회를 추가해 보세요.
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedRaces.map((race) => {
              const dDay = calculateDDay(race.date);

              const badgeColor = dDay.isPassed
                ? 'bg-slate-700 text-slate-400 border-slate-600'
                : dDay.daysDiff <= 14
                ? 'bg-rose-500/30 text-rose-300 border-rose-500 animate-pulse'
                : dDay.daysDiff <= 45
                ? 'bg-amber-500/30 text-amber-300 border-amber-500'
                : 'bg-emerald-500/30 text-emerald-300 border-emerald-500';

              return (
                <div
                  key={race.id}
                  className="glass-card rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm px-3 py-1 rounded-xl font-extrabold font-athletic border ${badgeColor} shadow-md`}
                        >
                          {dDay.text}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">{race.date}</span>
                      </div>

                      <button
                        onClick={async () => {
                          const ok = await verifyRunnerSecurityKey(
                            `'${race.name}' 대회 삭제`
                          );
                          if (ok) onDeleteRace(race.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="text-base font-bold text-white mt-1 mb-1">{race.name}</h3>
                    <div className="text-xs text-slate-300 flex items-center gap-2 mb-2">
                      <span className="text-amber-400 font-semibold">{race.course}</span>
                      <span>·</span>
                      <span className="text-slate-400">{race.location}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {dDay.isPassed
                        ? '대회 종료'
                        : dDay.isToday
                        ? '🔥 오늘이 대회 당일입니다!'
                        : `${dDay.daysDiff}일 남음`}
                    </span>
                    {race.websiteUrl && (
                      <a
                        href={race.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <span>대회 홈페이지</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 러닝화 등록 모달 */}
      {isShoeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel rounded-2xl p-6 w-full max-w-md border border-white/20 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Footprints className="w-5 h-5 text-cyan-400" />
              <span>새 러닝화 등록</span>
            </h3>

            <form onSubmit={handleAddShoeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">신발 이름 / 모델명</label>
                <input
                  type="text"
                  required
                  value={newShoeName}
                  onChange={(e) => setNewShoeName(e.target.value)}
                  placeholder="예: 알파플라이 3, 줌 플라이 5"
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">브랜드</label>
                  <input
                    type="text"
                    required
                    value={newShoeBrand}
                    onChange={(e) => setNewShoeBrand(e.target.value)}
                    placeholder="Nike, Adidas, Asics..."
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">카테고리</label>
                  <select
                    value={newShoeCategory}
                    onChange={(e) => {
                      const cat = e.target.value as ShoeCategory;
                      setNewShoeCategory(cat);
                      setNewShoeMaxMileage(cat === '레이싱' ? '300' : '600');
                    }}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs bg-slate-900"
                  >
                    <option value="데일리">데일리 (조깅용)</option>
                    <option value="스피드">스피드 (인터벌/템포)</option>
                    <option value="장거리">장거리 (LSD)</option>
                    <option value="레이싱">레이싱 (대회용 카본)</option>
                    <option value="트레일">트레일 (산악/비포장)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">현재 주행거리 (km)</label>
                  <input
                    type="number"
                    value={newShoeMileage}
                    onChange={(e) => setNewShoeMileage(e.target.value)}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">목표 권장 수명 (km)</label>
                  <input
                    type="number"
                    value={newShoeMaxMileage}
                    onChange={(e) => setNewShoeMaxMileage(e.target.value)}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">한줄평 (착용감, 쿠셔닝 등)</label>
                <input
                  type="text"
                  value={newShoeReview}
                  onChange={(e) => setNewShoeReview(e.target.value)}
                  placeholder="예: 4분대 페이스에서 밀어주는 카본 탄성이 일품임"
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsShoeModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-300 hover:text-white bg-slate-800 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-all shadow-md shadow-cyan-500/20"
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 참가 대회 등록 모달 */}
      {isRaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel rounded-2xl p-6 w-full max-w-md border border-white/20 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span>새 마라톤 대회 등록</span>
            </h3>

            <form onSubmit={handleAddRaceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">대회명</label>
                <input
                  type="text"
                  required
                  value={newRaceName}
                  onChange={(e) => setNewRaceName(e.target.value)}
                  placeholder="예: 2026 손기정 평화마라톤"
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">대회 일자 (날짜)</label>
                  <input
                    type="date"
                    required
                    value={newRaceDate}
                    onChange={(e) => setNewRaceDate(e.target.value)}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">참가 코스</label>
                  <select
                    value={newRaceCourse}
                    onChange={(e) => setNewRaceCourse(e.target.value)}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs bg-slate-900"
                  >
                    <option value="풀 (42.195km)">풀 (42.195km)</option>
                    <option value="하프 (21.0975km)">하프 (21.0975km)</option>
                    <option value="10K">10K 단축 마라톤</option>
                    <option value="5K 건강달리기">5K 건강달리기</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">개최 장소</label>
                <input
                  type="text"
                  value={newRaceLocation}
                  onChange={(e) => setNewRaceLocation(e.target.value)}
                  placeholder="예: 서울 잠실종합운동장"
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRaceModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-300 hover:text-white bg-slate-800 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-md shadow-amber-500/20"
                >
                  대회 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 러닝화 전체 정보 및 마일리지 수정 모달 */}
      {editingShoe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel rounded-2xl p-6 w-full max-w-md border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-400" />
                <span>러닝화 전체 정보 수정</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingShoe(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 cursor-pointer"
              >
                닫기
              </button>
            </div>

            <form onSubmit={handleSaveEditShoeSubmit} className="space-y-4">
              {/* 1. 신발 모델명 */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  신발 이름 / 모델명 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editShoeName}
                  onChange={(e) => setEditShoeName(e.target.value)}
                  placeholder="예: 알파플라이 3, 줌 플라이 5"
                  className="w-full px-3 py-2.5 glass-input rounded-xl text-xs font-bold text-white focus:border-cyan-400"
                />
              </div>

              {/* 2. 브랜드 & 카테고리 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">브랜드</label>
                  <input
                    type="text"
                    required
                    value={editShoeBrand}
                    onChange={(e) => setEditShoeBrand(e.target.value)}
                    placeholder="Nike, Adidas, Asics..."
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">카테고리</label>
                  <select
                    value={editShoeCategory}
                    onChange={(e) => {
                      const cat = e.target.value as ShoeCategory;
                      setEditShoeCategory(cat);
                    }}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs bg-slate-900 text-white"
                  >
                    <option value="데일리">데일리 (조깅용)</option>
                    <option value="스피드">스피드 (인터벌/템포)</option>
                    <option value="장거리">장거리 (LSD)</option>
                    <option value="레이싱">레이싱 (대회용 카본)</option>
                    <option value="트레일">트레일 (산악/비포장)</option>
                  </select>
                </div>
              </div>

              {/* 3. 누적 마일리지 & 목표 권장 수명 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-cyan-300 mb-1">
                    현재 누적 주행거리 (km)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={editMileage}
                    onChange={(e) => setEditMileage(e.target.value)}
                    className="w-full px-3 py-2.5 glass-input rounded-xl text-sm font-mono font-bold text-white focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    목표 수명 마일리지 (km)
                  </label>
                  <input
                    type="number"
                    min="50"
                    step="50"
                    required
                    value={editMaxMileage}
                    onChange={(e) => setEditMaxMileage(e.target.value)}
                    className="w-full px-3 py-2.5 glass-input rounded-xl text-sm font-mono text-slate-200"
                  />
                  <div className="flex gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setEditMaxMileage('300')}
                      className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer transition-colors"
                    >
                      300km (레이싱)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMaxMileage('600')}
                      className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer transition-colors"
                    >
                      600km (일반)
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. 한줄평 / 착용 후기 */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">한줄평 / 러닝 피드백</label>
                <input
                  type="text"
                  value={editReview}
                  onChange={(e) => setEditReview(e.target.value)}
                  placeholder="착용감, 쿠셔닝 탄성, 접지력 등..."
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingShoe(null)}
                  className="px-4 py-2 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  수정 저장 (보안 확인)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
