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
  Save,
  Target,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Info,
  SlidersHorizontal,
  ShieldAlert,
} from 'lucide-react';
import { PhysicalInfo, RunningShoe, RegisteredRace, ShoeCategory, TrainingSession } from '../types';
import { calculateDDay, getTodayDateStr } from '../lib/marathonData';
import { verifyRunnerSecurityKey } from '../lib/security';

interface TabMyInfoProps {
  physicalInfo: PhysicalInfo;
  shoes: RunningShoe[];
  races: RegisteredRace[];
  sessions?: TrainingSession[];
  onSavePhysical: (info: PhysicalInfo) => Promise<void>;
  onAddShoe: (shoe: Omit<RunningShoe, 'id'>) => Promise<void>;
  onUpdateShoe: (shoe: RunningShoe) => Promise<void>;
  onDeleteShoe: (id: string) => Promise<void>;
  onResetShoes: () => Promise<void>;
  onAddRace: (race: Omit<RegisteredRace, 'id'>) => Promise<void>;
  onDeleteRace: (id: string) => Promise<void>;
  onUpdateRace?: (race: RegisteredRace) => Promise<void>;
}

export const TabMyInfo: React.FC<TabMyInfoProps> = ({
  physicalInfo,
  shoes,
  races,
  sessions = [],
  onSavePhysical,
  onAddShoe,
  onUpdateShoe,
  onDeleteShoe,
  onResetShoes,
  onAddRace,
  onDeleteRace,
  onUpdateRace,
}) => {
  // Physical Info State
  const [height, setHeight] = useState(physicalInfo.height.toString());
  const [weight, setWeight] = useState(physicalInfo.weight.toString());
  const [age, setAge] = useState(physicalInfo.age.toString());
  const [isSavingPhysical, setIsSavingPhysical] = useState(false);
  const [physicalSavedAlert, setPhysicalSavedAlert] = useState(false);

  // Shoes State
  const [selectedShoeCategory, setSelectedShoeCategory] = useState<string>('데일리');
  const [shoeStatusFilter, setShoeStatusFilter] = useState<'all' | 'needs_replacement' | 'safe'>('all');
  const [shoeSortBy, setShoeSortBy] = useState<'urgent_first' | 'mileage_desc' | 'wear_pct_desc' | 'recent_worn' | 'name_asc'>('urgent_first');
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(false);
  const [shoeSearchQuery, setShoeSearchQuery] = useState<string>('');
  const [isShoeModalOpen, setIsShoeModalOpen] = useState(false);
  const [newShoeName, setNewShoeName] = useState('');
  const [newShoeBrand, setNewShoeBrand] = useState('Nike');
  const [newShoeCategory, setNewShoeCategory] = useState<ShoeCategory>('데일리');
  const [newShoeMileage, setNewShoeMileage] = useState('0');
  const [newShoeMaxMileage, setNewShoeMaxMileage] = useState('600');
  const [newShoeSize, setNewShoeSize] = useState('');

  // Editing Shoe Full Details State
  const [editingShoe, setEditingShoe] = useState<RunningShoe | null>(null);
  const [editShoeName, setEditShoeName] = useState<string>('');
  const [editShoeBrand, setEditShoeBrand] = useState<string>('Nike');
  const [editShoeCategory, setEditShoeCategory] = useState<ShoeCategory>('데일리');
  const [editShoeSize, setEditShoeSize] = useState<string>('');
  const [editMileage, setEditMileage] = useState<string>('0');
  const [editMaxMileage, setEditMaxMileage] = useState<string>('600');

  // Races State
  const [isRaceModalOpen, setIsRaceModalOpen] = useState(false);
  const [newRaceName, setNewRaceName] = useState('');
  const [newRaceDate, setNewRaceDate] = useState(() => getTodayDateStr());
  const [newRaceCourse, setNewRaceCourse] = useState('풀 (42.195km)');
  const [newRaceLocation, setNewRaceLocation] = useState('서울');
  const [newRaceTargetTime, setNewRaceTargetTime] = useState('');
  const [newRacePriority, setNewRacePriority] = useState<'A' | 'B' | 'C'>('A');
  const [editingRaceForTarget, setEditingRaceForTarget] = useState<RegisteredRace | null>(null);
  const [editRaceTargetTime, setEditRaceTargetTime] = useState('');
  const [editRacePriority, setEditRacePriority] = useState<'A' | 'B' | 'C'>('A');
  const [editRaceIsTarget, setEditRaceIsTarget] = useState(false);

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
      size: newShoeSize.trim() || undefined,
      mileage: Math.round((parseFloat(newShoeMileage) || 0) * 100) / 100,
      maxMileage: newShoeCategory === '레이싱' ? 300 : (Math.round((parseFloat(newShoeMaxMileage) || 600) * 100) / 100),
      review: '',
      createdAt: new Date().toISOString().split('T')[0],
    });

    setNewShoeName('');
    setNewShoeMileage('0');
    setNewShoeMaxMileage('600');
    setNewShoeSize('');
    setIsShoeModalOpen(false);
  };

  // Open Edit Modal for a Shoe (Full information editing)
  const handleOpenEditShoe = (shoe: RunningShoe) => {
    setEditingShoe(shoe);
    setEditShoeName(shoe.name);
    setEditShoeBrand(shoe.brand);
    setEditShoeCategory(shoe.category);
    setEditShoeSize(shoe.size || '');
    setEditMileage(shoe.mileage.toString());
    setEditMaxMileage((shoe.maxMileage || (shoe.category === '레이싱' ? 300 : 600)).toString());
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
      size: editShoeSize.trim() || undefined,
      mileage: Math.round((parseFloat(editMileage) || 0) * 100) / 100,
      maxMileage: Math.round((parseFloat(editMaxMileage) || (editShoeCategory === '레이싱' ? 300 : 600)) * 100) / 100,
      review: '',
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
      targetTime: newRaceTargetTime.trim() || undefined,
      isTarget: races.length === 0 || newRacePriority === 'A',
      priority: newRacePriority,
      importance:
        newRacePriority === 'A'
          ? 'A-Race (메인 목표)'
          : newRacePriority === 'B'
          ? 'B-Race (중간 점검)'
          : 'C-Race (연습 대회)',
      createdAt: new Date().toISOString(),
    });

    setNewRaceName('');
    setNewRaceTargetTime('');
    setNewRacePriority('A');
    setIsRaceModalOpen(false);
  };

  const handleSaveRaceTargetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRaceForTarget || !onUpdateRace) return;

    await onUpdateRace({
      ...editingRaceForTarget,
      targetTime: editRaceTargetTime.trim() || undefined,
      priority: editRacePriority,
      isTarget: editRaceIsTarget,
      importance:
        editRacePriority === 'A'
          ? 'A-Race (메인 목표)'
          : editRacePriority === 'B'
          ? 'B-Race (중간 점검)'
          : 'C-Race (연습 대회)',
    });

    setEditingRaceForTarget(null);
  };

  // Quick 1-click Priority Switcher on Race Cards
  const handleQuickChangePriority = async (race: RegisteredRace, newPriority: 'A' | 'B' | 'C') => {
    if (!onUpdateRace) return;
    await onUpdateRace({
      ...race,
      priority: newPriority,
      importance:
        newPriority === 'A'
          ? 'A-Race (메인 목표)'
          : newPriority === 'B'
          ? 'B-Race (중간 점검)'
          : 'C-Race (연습 대회)',
    });
  };

  // Map session history to shoes (last worn date, sessions count, total session km)
  const shoeSessionStats = useMemo(() => {
    const stats: Record<
      string,
      { count: number; lastWornDate?: string; lastSessionTitle?: string; totalSessionKm: number }
    > = {};

    sessions.forEach((sess) => {
      const matchShoe = shoes.find(
        (s) =>
          (sess.shoeId && s.id === sess.shoeId) ||
          (sess.shoeName && sess.shoeName.toLowerCase().includes(s.name.toLowerCase()))
      );

      if (matchShoe) {
        if (!stats[matchShoe.id]) {
          stats[matchShoe.id] = {
            count: 0,
            lastWornDate: sess.date,
            lastSessionTitle: sess.title,
            totalSessionKm: 0,
          };
        }
        stats[matchShoe.id].count += 1;
        stats[matchShoe.id].totalSessionKm =
          Math.round((stats[matchShoe.id].totalSessionKm + (sess.totalDistanceKm || 0)) * 10) / 10;

        if (
          !stats[matchShoe.id].lastWornDate ||
          new Date(sess.date).getTime() > new Date(stats[matchShoe.id].lastWornDate!).getTime()
        ) {
          stats[matchShoe.id].lastWornDate = sess.date;
          stats[matchShoe.id].lastSessionTitle = sess.title;
        }
      }
    });

    return stats;
  }, [shoes, sessions]);

  // Analyzed Shoes with wear rate and status
  const analyzedShoes = useMemo(() => {
    return shoes.map((shoe) => {
      const maxMil = shoe.maxMileage && shoe.maxMileage > 0 ? shoe.maxMileage : (shoe.category === '레이싱' ? 300 : 600);
      const mileage = Math.round((shoe.mileage || 0) * 10) / 10;
      const wearPct = Math.round((mileage / maxMil) * 100);
      const remainingKm = Math.round((maxMil - mileage) * 10) / 10;
      const sessionStat = shoeSessionStats[shoe.id];

      let status: 'optimal' | 'warning' | 'near_limit' | 'overdue';
      let statusLabel: string;
      let statusColor: string;
      let badgeBg: string;

      if (wearPct >= 100) {
        status = 'overdue';
        statusLabel = '수명 완료';
        statusColor = 'text-rose-900';
        badgeBg = 'bg-rose-100 text-rose-900 border-rose-300';
      } else if (wearPct >= 80) {
        status = 'near_limit';
        statusLabel = '사용 중';
        statusColor = 'text-stone-700';
        badgeBg = 'bg-stone-100 text-stone-700 border-stone-200';
      } else if (wearPct >= 50) {
        status = 'warning';
        statusLabel = '사용 중';
        statusColor = 'text-stone-700';
        badgeBg = 'bg-stone-100 text-stone-700 border-stone-200';
      } else {
        status = 'optimal';
        statusLabel = '최상 컨디션';
        statusColor = 'text-emerald-800';
        badgeBg = 'bg-emerald-100 text-emerald-900 border-emerald-300';
      }

      return {
        ...shoe,
        effectiveMaxMileage: maxMil,
        effectiveMileage: mileage,
        wearPct,
        remainingKm,
        status,
        statusLabel,
        statusColor,
        badgeBg,
        sessionCount: sessionStat?.count || 0,
        lastWornDate: sessionStat?.lastWornDate,
        lastSessionTitle: sessionStat?.lastSessionTitle,
      };
    });
  }, [shoes, shoeSessionStats]);

  // Executive Metrics
  const shoeMetrics = useMemo(() => {
    const totalShoes = analyzedShoes.length;
    const totalMileage = Math.round(analyzedShoes.reduce((sum, s) => sum + s.effectiveMileage, 0) * 10) / 10;
    const overdueCount = analyzedShoes.filter((s) => s.status === 'overdue').length;
    const nearLimitCount = analyzedShoes.filter((s) => s.status === 'near_limit').length;
    const warningCount = analyzedShoes.filter((s) => s.status === 'warning').length;
    const optimalCount = analyzedShoes.filter((s) => s.status === 'optimal').length;
    const urgentCount = overdueCount + nearLimitCount;
    const safeCount = optimalCount + warningCount;

    const avgWearPct =
      totalShoes > 0
        ? Math.round(analyzedShoes.reduce((sum, s) => sum + s.wearPct, 0) / totalShoes)
        : 0;

    return {
      totalShoes,
      totalMileage,
      overdueCount,
      nearLimitCount,
      warningCount,
      optimalCount,
      urgentCount,
      safeCount,
      avgWearPct,
    };
  }, [analyzedShoes]);

  // Categories list
  const shoeCategories: ('전체' | ShoeCategory)[] = [
    '전체',
    '데일리',
    '스피드',
    '장거리',
    '레이싱',
    '트레일',
  ];

  // Filtered & Sorted Shoes
  const filteredAndSortedShoes = useMemo(() => {
    let result = [...analyzedShoes];

    // Status filter
    if (shoeStatusFilter === 'needs_replacement') {
      result = result.filter((s) => s.status === 'overdue' || s.status === 'near_limit');
    } else if (shoeStatusFilter === 'safe') {
      result = result.filter((s) => s.status === 'optimal' || s.status === 'warning');
    }

    // Category filter
    if (selectedShoeCategory !== '전체') {
      result = result.filter((s) => s.category === selectedShoeCategory);
    }

    // Search query
    if (shoeSearchQuery.trim()) {
      const q = shoeSearchQuery.toLowerCase().trim();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.brand.toLowerCase().includes(q)
      );
    }

    // Sort
    if (shoeSortBy === 'urgent_first') {
      const order = { overdue: 0, near_limit: 1, warning: 2, optimal: 3 };
      result.sort((a, b) => order[a.status] - order[b.status] || b.wearPct - a.wearPct);
    } else if (shoeSortBy === 'mileage_desc') {
      result.sort((a, b) => b.effectiveMileage - a.effectiveMileage);
    } else if (shoeSortBy === 'wear_pct_desc') {
      result.sort((a, b) => b.wearPct - a.wearPct);
    } else if (shoeSortBy === 'recent_worn') {
      result.sort((a, b) => {
        const timeA = a.lastWornDate ? new Date(a.lastWornDate).getTime() : 0;
        const timeB = b.lastWornDate ? new Date(b.lastWornDate).getTime() : 0;
        return timeB - timeA;
      });
    } else if (shoeSortBy === 'name_asc') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }

    return result;
  }, [analyzedShoes, shoeStatusFilter, selectedShoeCategory, shoeSearchQuery, shoeSortBy]);

  // Sort races by nearest date first (가까운 날짜 순 정렬)
  const sortedRaces = useMemo(() => {
    return [...races].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [races]);

  return (
    <div className="space-y-8 animate-fadeIn text-stone-800">
      {/* 1. 신체 정보 섹션 */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-emerald-600/20 shadow-sm bg-white/95">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-xl border border-rose-700/40 shadow-xs">
              <Scale className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-stone-900">러너 신체 정보</h2>
              <p className="text-xs text-stone-600">
                체중과 키는 페이스 효율성 및 VO2max 계산의 중요한 기준입니다.
              </p>
            </div>
          </div>

          {physicalSavedAlert && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs border border-emerald-300 font-bold animate-pulse">
              <Check className="w-3.5 h-3.5" />
              <span>저장 완료</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSavePhysical}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
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
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
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
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
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
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 mb-5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-stone-600 font-medium">BMI 체질량지수:</span>
              <span className="text-emerald-800 font-black font-athletic text-sm">{bmi}</span>
              <span className="text-stone-700 font-semibold">({getBmiDesc(bmi)})</span>
            </div>
            <div className="text-stone-500 text-[11px]">
              * 1kg 체중 감량 시 풀코스 완주 시간 약 2~3분 단축 효과
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingPhysical}
              className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-emerald-500"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingPhysical ? '저장 중...' : '신체 정보 저장'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. 보유 러닝화 로테이션 & 마일리지 수명 관리 섹션 */}
      <section id="shoe-closet-section" className="glass-panel rounded-2xl p-5 sm:p-7 border border-emerald-600/20 shadow-sm bg-white/95 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-2xl border border-rose-700/40 shadow-sm">
              <Footprints className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
                  <span>보유 러닝화 로테이션 & 마일리지 수명 관리</span>
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-bold">
                  {shoes.length}켤레
                </span>
                {shoeMetrics.urgentCount > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                    교체 알림 {shoeMetrics.urgentCount}켤레
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 mt-1">
                신발별 실시간 누적 주행거리와 목표 마일리지 수명 소진율을 모니터링하고 교체 주기를 관리합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsGuidanceOpen((prev) => !prev)}
              className="px-3 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isGuidanceOpen ? '가이드 접기' : '교체 기준 가이드'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsShoeModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border border-emerald-500"
            >
              <Plus className="w-4 h-4" />
              <span>러닝화 등록</span>
            </button>
          </div>
        </div>

        {/* Executive Key Stat Gauges */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>총 누적 주행</span>
              <TrendingUp className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono">
              {shoeMetrics.totalMileage.toLocaleString()} <span className="text-xs font-normal text-stone-500">km</span>
            </div>
            <div className="text-[11px] text-stone-500 mt-1 flex items-center justify-between">
              <span>보유 신발</span>
              <strong className="text-stone-800">{shoeMetrics.totalShoes}켤레</strong>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>평균 수명 소진율</span>
              <BarChart3 className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono">
              {shoeMetrics.avgWearPct} <span className="text-xs font-normal text-stone-500">%</span>
            </div>
            <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  shoeMetrics.avgWearPct >= 80 ? 'bg-amber-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.min(shoeMetrics.avgWearPct, 100)}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>교체 임박 & 수명 초과</span>
              <AlertTriangle className={`w-4 h-4 ${shoeMetrics.urgentCount > 0 ? 'text-rose-600' : 'text-stone-400'}`} />
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${shoeMetrics.urgentCount > 0 ? 'text-rose-900' : 'text-stone-700'}`}>
              {shoeMetrics.urgentCount} <span className="text-xs font-normal text-stone-500">켤레</span>
            </div>
            <div className="text-[11px] text-stone-500 mt-1 flex items-center justify-between">
              <span>수명 초과: <strong className="text-rose-900">{shoeMetrics.overdueCount}</strong></span>
              <span>임박: <strong className="text-amber-700">{shoeMetrics.nearLimitCount}</strong></span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>안전 & 최상 컨디션</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-800 font-mono">
              {shoeMetrics.optimalCount} <span className="text-xs font-normal text-stone-500">켤레</span>
            </div>
            <div className="text-[11px] text-stone-500 mt-1 flex items-center justify-between">
              <span>마모 진행: <strong className="text-amber-700">{shoeMetrics.warningCount}</strong></span>
              <span>최적: <strong className="text-emerald-800">{shoeMetrics.optimalCount}</strong></span>
            </div>
          </div>
        </div>

        {/* Replacement Alert Banner (특정 마일리지 도달 시 교체 알림) */}
        {shoeMetrics.urgentCount > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 border border-rose-300 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-800 border border-rose-200 flex-shrink-0 mt-0.5">
                  <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-rose-700" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-1.5">
                      <span>러닝화 교체 및 은퇴 권장 알림</span>
                    </h3>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-bold">
                      🚨 총 {shoeMetrics.urgentCount}켤레 대상
                    </span>
                  </div>
                  <p className="text-xs text-stone-700 leading-relaxed keep-all">
                    미드솔 완충 폼의 수명이 한계에 도달했습니다. 쿠션 반발력 저하는 
                    <strong className="text-rose-900"> 족저근막염, 정강이 통증(신스프린트), 무릎 관절 부상</strong>의 주된 원인이 됩니다.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {analyzedShoes
                      .filter((s) => s.status === 'overdue' || s.status === 'near_limit')
                      .map((s) => (
                        <span
                          key={s.id}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 whitespace-nowrap ${
                            s.status === 'overdue'
                              ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                          }`}
                        >
                          <span>{s.name}</span>
                          <span className="font-mono text-[11px]">
                            ({s.effectiveMileage}km / {s.effectiveMaxMileage}km, {s.wearPct}%)
                          </span>
                        </span>
                      ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShoeStatusFilter(shoeStatusFilter === 'needs_replacement' ? 'all' : 'needs_replacement')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer self-start sm:self-center ${
                  shoeStatusFilter === 'needs_replacement'
                    ? 'bg-rose-900 text-white shadow-sm'
                    : 'bg-rose-100 text-rose-900 hover:bg-rose-200 border border-rose-300'
                }`}
              >
                <span>{shoeStatusFilter === 'needs_replacement' ? '전체 보기로 복귀' : '교체 대상만 모아보기'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Sports Science Guidance Expandable Panel */}
        {isGuidanceOpen && (
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-stone-700 space-y-3 animate-fadeIn">
            <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>스포츠 사이언스 기반 러닝화 카테고리별 교체 기준</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-white border border-stone-200 space-y-1 shadow-2xs">
                <span className="text-xs font-bold text-rose-900">카본 레이싱화 (250~350km)</span>
                <p className="text-[11px] text-stone-600">
                  초임계 폼(ZoomX, Lightstrike Pro 등)과 카본 플레이트의 최고 반발탄성은 300km 내외에서 감쇄됩니다. 대회용 이후에는 템포/인터벌 연습화로 전환 추천.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-stone-200 space-y-1 shadow-2xs">
                <span className="text-xs font-bold text-amber-800">스피드/템포 트레이너 (400~500km)</span>
                <p className="text-[11px] text-stone-600">
                  인터벌 및 빠른 페이스 주행을 지탱하는 나일론 플레이트/반발 쿠션화. 지면 충격 흡수 한계 도달 시 교체 준비.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-stone-200 space-y-1 shadow-2xs">
                <span className="text-xs font-bold text-emerald-800">데일리 쿠션화 (600~800km)</span>
                <p className="text-[11px] text-stone-600">
                  매일 신는 조깅/회복주 신발. 겉창(아웃솔) 마모가 보이지 않더라도 미드솔 내부 기포가 영구 압축되므로 600km 초과 시 관절 보호를 위해 교체 요망.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-stone-200 space-y-1 shadow-2xs">
                <span className="text-xs font-bold text-emerald-300">장거리 LSD / 맥스쿠션 (600~750km)</span>
                <p className="text-[11px] text-slate-400">
                  장거리 20~35km 주행 시 체중의 3~4배 하중을 분산. 힐카운터 비틀림 및 미드솔 주름 발생 시 즉각 은퇴 권장.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search bar & Category Filter Buttons */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  지우기
                </button>
              )}
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
                <span>정렬:</span>
              </div>
              <select
                value={shoeSortBy}
                onChange={(e) => setShoeSortBy(e.target.value as any)}
                className="bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs text-stone-800 font-medium focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs"
              >
                <option value="urgent_first">교체 시급순 (경고 우선)</option>
                <option value="mileage_desc">누적 마일리지 높은 순</option>
                <option value="wear_pct_desc">수명 소진율(%) 높은 순</option>
                <option value="recent_worn">최근 착용일 순</option>
                <option value="name_asc">모델명 가나다순</option>
              </select>
            </div>
          </div>

          {/* Category & Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 bg-stone-100 rounded-xl border border-stone-200 overflow-x-auto scrollbar-none">
            {/* Status quick filters */}
            <button
              type="button"
              onClick={() => setShoeStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                shoeStatusFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              전체 ({shoes.length})
            </button>

            <button
              type="button"
              onClick={() => setShoeStatusFilter('needs_replacement')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                shoeStatusFilter === 'needs_replacement'
                  ? 'bg-rose-900 text-white shadow-2xs font-bold'
                  : 'text-rose-900 hover:text-rose-950 hover:bg-rose-100/70 font-semibold'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-rose-300" />
              <span>교체 대상 ({shoeMetrics.urgentCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setShoeStatusFilter('safe')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                shoeStatusFilter === 'safe'
                  ? 'bg-emerald-700 text-white shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              정상·양호 ({shoeMetrics.safeCount})
            </button>

            <div className="h-4 w-px bg-stone-300 mx-1 flex-shrink-0" />

            {/* Category tabs */}
            <button
              type="button"
              onClick={() => setSelectedShoeCategory('전체')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedShoeCategory === '전체'
                  ? 'bg-white text-emerald-900 font-bold border border-emerald-400 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <span>전체 분류</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedShoeCategory === '전체' ? 'bg-emerald-100 text-emerald-900 font-bold' : 'bg-stone-200 text-stone-600'
              }`}>
                {shoes.length}
              </span>
            </button>

            {shoeCategories.filter((c) => c !== '전체').map((cat) => {
              const count = shoes.filter((s) => s.category === cat).length;
              if (count === 0) return null;
              const isSelected = selectedShoeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedShoeCategory(isSelected ? '전체' : cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-white text-emerald-900 font-bold border border-emerald-400 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-emerald-100 text-emerald-900 font-bold' : 'bg-stone-200 text-stone-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shoes Grid */}
        {filteredAndSortedShoes.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-stone-50 border border-stone-200">
            <Footprints className="w-10 h-10 text-stone-400 mx-auto mb-2" />
            <p className="text-sm text-stone-600">선택한 조건에 해당하는 러닝화가 없습니다.</p>
            <button
              onClick={() => {
                setSelectedShoeCategory('전체');
                setShoeStatusFilter('all');
                setShoeSearchQuery('');
              }}
              className="mt-3 text-xs text-emerald-700 hover:underline cursor-pointer font-semibold"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAndSortedShoes.map((shoe) => {
              const categoryBadgeColors: Record<ShoeCategory, string> = {
                데일리: 'bg-emerald-50 text-emerald-900 border-emerald-300',
                스피드: 'bg-amber-50 text-amber-900 border-amber-300',
                장거리: 'bg-emerald-100 text-emerald-900 border-emerald-400',
                레이싱: 'bg-rose-50 text-rose-900 border-rose-300',
                트레일: 'bg-stone-100 text-stone-800 border-stone-300',
              };

              // Progress Bar Color: 50% yellow, 80% orange, 100%+ burgundy/red
              let barColor = 'from-emerald-600 to-emerald-500';
              if (shoe.status === 'overdue') {
                barColor = 'from-rose-800 to-rose-950 animate-pulse';
              } else if (shoe.status === 'near_limit') {
                barColor = 'from-amber-500 to-orange-500'; // 80% 주황색
              } else if (shoe.status === 'warning') {
                barColor = 'from-amber-400 to-yellow-500'; // 50% 노란색
              }

              return (
                <div
                  key={shoe.id}
                  className={`rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between ${
                    shoe.status === 'overdue'
                      ? 'bg-rose-50/70 border-rose-300 hover:border-rose-400 shadow-sm'
                      : shoe.status === 'near_limit'
                      ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400 shadow-2xs'
                      : 'bg-white border-stone-200 hover:border-emerald-300 shadow-2xs'
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Header: Category & Brand & Status Badge & Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${
                            categoryBadgeColors[shoe.category]
                          }`}
                        >
                          {shoe.category}
                        </span>
                        <span className="text-xs text-stone-500 font-medium">{shoe.brand}</span>
                        {shoe.size && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md font-mono font-semibold bg-stone-100 text-stone-700 border border-stone-300">
                            {shoe.size.endsWith('mm') ? shoe.size : `${shoe.size}mm`}
                          </span>
                        )}
                        <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold border ${shoe.badgeBg} flex items-center gap-1`}>
                          {shoe.status === 'overdue' && <AlertTriangle className="w-3 h-3 text-rose-700" />}
                          {shoe.status === 'near_limit' && <AlertCircle className="w-3 h-3 text-orange-700" />}
                          {shoe.status === 'optimal' && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
                          <span>{shoe.statusLabel}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleOpenEditShoe(shoe)}
                          className="p-1.5 text-stone-400 hover:text-emerald-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          title="러닝화 정보 및 마일리지 수정"
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
                          className="p-1.5 text-stone-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="삭제 (비밀번호 확인)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Shoe Model Name */}
                    <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">{shoe.name}</h3>

                    {/* Unified Mileage & Lifespan Management Contents */}
                    <div className="space-y-2 pt-1">
                      {/* Unified Mileage Header */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-500 font-medium">누적 주행거리</span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className={`text-base font-black ${
                            shoe.status === 'overdue' ? 'text-rose-900' : 'text-emerald-800'
                          }`}>
                            {shoe.effectiveMileage}km
                          </span>
                          <span className="text-stone-500">/ {shoe.effectiveMaxMileage}km</span>
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ml-1 ${
                            shoe.wearPct >= 100
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : shoe.wearPct >= 80
                              ? 'bg-orange-100 text-orange-900 border border-orange-300'
                              : shoe.wearPct >= 50
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                          }`}>
                            {shoe.wearPct}%
                          </span>
                        </div>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full h-2.5 rounded-full bg-stone-200 p-0.5 border border-stone-300 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${barColor}`}
                          style={{ width: `${Math.min(shoe.wearPct, 100)}%` }}
                        />
                      </div>

                      {/* Milestone Tick Labels */}
                      <div className="flex justify-between text-[10px] text-stone-500 font-mono px-0.5">
                        <span className="whitespace-nowrap">0km</span>
                        <span className="text-amber-700 font-semibold whitespace-nowrap">50%</span>
                        <span className="text-orange-700 font-semibold whitespace-nowrap">80%</span>
                        <span className="text-rose-900 font-semibold whitespace-nowrap text-right">
                          {shoe.effectiveMaxMileage}km
                        </span>
                      </div>

                      {/* Wear Status Callout: 수명 초과 시에만 직관적으로 알림 */}
                      {shoe.status === 'overdue' && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2 font-bold keep-all leading-relaxed">
                          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                          <span>⚠️ {Math.abs(shoe.remainingKm)}km 초과 주행 — 완충 한계 도달 (관절 부상 방지를 위해 즉시 교체 요망)</span>
                        </div>
                      )}

                      {/* Recent Workout Note if linked in sessions */}
                      {shoe.lastWornDate && (
                        <div className="text-[11px] text-stone-600 font-mono flex items-center gap-1.5 pt-0.5">
                          <span className="px-2 py-0.5 bg-stone-100 rounded border border-stone-200 text-stone-700">
                            최근 훈련: {shoe.lastWornDate}
                          </span>
                          {shoe.lastSessionTitle && (
                            <span className="text-stone-500 truncate max-w-[200px]">({shoe.lastSessionTitle})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. 참가 대회 & D-day 섹션 */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-emerald-600/20 shadow-sm bg-white/95 text-stone-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-xl border border-rose-700/40 shadow-xs">
              <Calendar className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
                <span>참가 예정 대회 및 D-Day 카운터</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-mono font-bold">
                  {races.length}개
                </span>
              </h2>
              <p className="text-xs text-stone-600">
                목표 대회 날짜에 맞추어 자동으로 D-day를 계산하고 피킹 훈련을 조율합니다.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsRaceModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 border border-emerald-500 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>참가 대회 등록</span>
          </button>
        </div>

        {races.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-stone-50 border border-stone-200">
            <Calendar className="w-10 h-10 text-stone-400 mx-auto mb-2" />
            <p className="text-sm text-stone-600">등록된 마라톤 대회가 없습니다.</p>
            <button
              onClick={() => setIsRaceModalOpen(true)}
              className="mt-3 text-xs text-emerald-700 hover:underline font-semibold cursor-pointer"
            >
              올해 출전할 대회를 추가해 보세요.
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedRaces.map((race) => {
              const dDay = calculateDDay(race.date);

              const badgeColor = dDay.isPassed
                ? 'bg-stone-200 text-stone-600 border-stone-300'
                : dDay.daysDiff <= 14
                ? 'bg-rose-100 text-rose-900 border-rose-400 animate-pulse'
                : dDay.daysDiff <= 45
                ? 'bg-amber-100 text-amber-900 border-amber-400'
                : 'bg-emerald-100 text-emerald-900 border-emerald-400';

              return (
                <div
                  key={race.id}
                  className="rounded-xl p-5 border border-stone-200 hover:border-emerald-300 bg-white transition-all flex flex-col justify-between shadow-2xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm px-3 py-1 rounded-xl font-extrabold font-athletic border ${badgeColor} shadow-2xs`}
                        >
                          {dDay.text}
                        </span>
                        <span className="text-xs text-stone-500 font-mono">{race.date}</span>
                      </div>

                      <button
                        onClick={async () => {
                          const ok = await verifyRunnerSecurityKey(
                            `'${race.name}' 대회 삭제`
                          );
                          if (ok) onDeleteRace(race.id);
                        }}
                        className="p-1 text-stone-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="text-base font-bold text-stone-900 mt-1 mb-1">{race.name}</h3>
                    <div className="text-xs text-stone-600 flex items-center gap-2 mb-2">
                      <span className="text-rose-900 font-semibold">{race.course}</span>
                      <span>·</span>
                      <span className="text-stone-500">{race.location}</span>
                    </div>

                    {/* Individual Race Target Time Display & Edit */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200 text-xs mb-2">
                      <div className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-rose-800" />
                        <span className="text-stone-600 font-medium">목표 기록:</span>
                        <span className="font-bold font-mono text-rose-900">
                          {race.targetTime || '미설정'}
                        </span>
                      </div>
                      {onUpdateRace && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRaceForTarget(race);
                            setEditRaceTargetTime(race.targetTime || '');
                            setEditRacePriority(
                              race.priority === 'C' || race.importance?.includes('C')
                                ? 'C'
                                : race.priority === 'B' || race.importance?.includes('B')
                                ? 'B'
                                : 'A'
                            );
                            setEditRaceIsTarget(!!race.isTarget);
                          }}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors cursor-pointer"
                        >
                          목표·중요도 수정
                        </button>
                      )}
                    </div>

                    {/* Race Priority (중요도) Selector & Quick 1-Click Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2 rounded-lg bg-stone-50 border border-stone-200 text-xs mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold text-stone-700">대회 중요도:</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            race.priority === 'C' || race.importance?.includes('C')
                              ? 'bg-stone-200 text-stone-800 border-stone-300'
                              : race.priority === 'B' || race.importance?.includes('B')
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}
                        >
                          {race.priority === 'C' || race.importance?.includes('C')
                            ? 'C-Race (연습대회)'
                            : race.priority === 'B' || race.importance?.includes('B')
                            ? 'B-Race (중간점검)'
                            : 'A-Race (메인목표)'}
                        </span>
                        {race.isTarget && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-900 font-bold border border-rose-300">
                            ★ 대표 목표
                          </span>
                        )}
                      </div>

                      {/* Quick 1-Click Priority Switcher */}
                      {onUpdateRace && (
                        <div className="flex items-center gap-1 self-end sm:self-auto">
                          {(['A', 'B', 'C'] as const).map((p) => {
                            const isCurrent =
                              p === 'A'
                                ? (!race.priority || race.priority === 'A' || race.importance?.includes('A')) &&
                                  !race.importance?.includes('B') &&
                                  !race.importance?.includes('C')
                                : p === 'B'
                                ? race.priority === 'B' || race.importance?.includes('B')
                                : race.priority === 'C' || race.importance?.includes('C');
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleQuickChangePriority(race, p)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                                  isCurrent
                                    ? p === 'A'
                                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                                      : p === 'B'
                                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                      : 'bg-stone-700 text-white border-stone-800 shadow-xs'
                                    : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-100'
                                }`}
                                title={
                                  p === 'A'
                                    ? 'A-Race: 최우선 메인 목표 (풀 테이퍼링/피킹)'
                                    : p === 'B'
                                    ? 'B-Race: 중간 점검 레이스 (미니 테이퍼링)'
                                    : 'C-Race: 연습/훈련 대회 (테이퍼링 최소화, 마일리지 유지)'
                                }
                              >
                                {p}-Race
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
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
                        className="text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 font-medium"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-stone-200 shadow-2xl text-stone-800">
            <h3 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
              <Footprints className="w-5 h-5 text-emerald-700" />
              <span>새 러닝화 등록</span>
            </h3>

            <form onSubmit={handleAddShoeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">신발 이름 / 모델명</label>
                <input
                  type="text"
                  required
                  value={newShoeName}
                  onChange={(e) => setNewShoeName(e.target.value)}
                  placeholder="예: 알파플라이 3, 줌 플라이 5"
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs font-semibold text-stone-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">브랜드</label>
                  <input
                    type="text"
                    required
                    value={newShoeBrand}
                    onChange={(e) => setNewShoeBrand(e.target.value)}
                    placeholder="Nike, Adidas..."
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs text-stone-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">사이즈 (mm)</label>
                  <input
                    type="text"
                    value={newShoeSize}
                    onChange={(e) => setNewShoeSize(e.target.value)}
                    placeholder="직접 입력 (선택)"
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold text-stone-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">카테고리</label>
                  <select
                    value={newShoeCategory}
                    onChange={(e) => {
                      const cat = e.target.value as ShoeCategory;
                      setNewShoeCategory(cat);
                      setNewShoeMaxMileage(cat === '레이싱' ? '300' : '600');
                    }}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs bg-white text-stone-800 font-medium"
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
                  <label className="block text-xs font-semibold text-stone-700 mb-1">현재 주행거리 (km)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newShoeMileage}
                    onChange={(e) => setNewShoeMileage(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold text-stone-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">목표 교체 수명 (km)</label>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    value={newShoeMaxMileage}
                    onChange={(e) => setNewShoeMaxMileage(e.target.value)}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold text-stone-800"
                  />
                </div>
              </div>

              {/* Quick Lifespan Mileage Presets */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <span className="text-[11px] font-semibold text-stone-700 block">
                  카테고리별 권장 수명 프리셋 선택:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewShoeMaxMileage('300')}
                    className={`px-2 py-1.5 text-[11px] rounded-lg border text-left transition-all cursor-pointer ${
                      newShoeMaxMileage === '300'
                        ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:text-stone-900'
                    }`}
                  >
                    300km (카본 레이싱)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewShoeMaxMileage('450')}
                    className={`px-2 py-1.5 text-[11px] rounded-lg border text-left transition-all cursor-pointer ${
                      newShoeMaxMileage === '450'
                        ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:text-stone-900'
                    }`}
                  >
                    450km (스피드/템포)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewShoeMaxMileage('600')}
                    className={`px-2 py-1.5 text-[11px] rounded-lg border text-left transition-all cursor-pointer ${
                      newShoeMaxMileage === '600'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:text-stone-900'
                    }`}
                  >
                    600km (데일리 쿠션)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewShoeMaxMileage('700')}
                    className={`px-2 py-1.5 text-[11px] rounded-lg border text-left transition-all cursor-pointer ${
                      newShoeMaxMileage === '700'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:text-stone-900'
                    }`}
                  >
                    700km (장거리 맥스쿠션)
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsShoeModalOpen(false)}
                  className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-stone-200 shadow-2xl text-stone-800">
            <h3 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-rose-800" />
              <span>새 마라톤 대회 등록</span>
            </h3>

            <form onSubmit={handleAddRaceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">대회명</label>
                <input
                  type="text"
                  required
                  value={newRaceName}
                  onChange={(e) => setNewRaceName(e.target.value)}
                  placeholder="예: 2026 손기정 평화마라톤"
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs font-semibold text-stone-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-stone-700">대회 일자 (날짜)</label>
                    {newRaceDate && (
                      <span className="text-[11px] font-bold text-rose-900 font-athletic">
                        {calculateDDay(newRaceDate).text}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    required
                    value={newRaceDate}
                    onChange={(e) => setNewRaceDate(e.target.value)}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs text-stone-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">참가 코스</label>
                  <select
                    value={newRaceCourse}
                    onChange={(e) => setNewRaceCourse(e.target.value)}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs bg-white text-stone-800 font-medium"
                  >
                    <option value="풀 (42.195km)">풀 (42.195km)</option>
                    <option value="하프 (21.0975km)">하프 (21.0975km)</option>
                    <option value="10K">10K 단축 마라톤</option>
                    <option value="5K 건강달리기">5K 건강달리기</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">개최 장소</label>
                <input
                  type="text"
                  value={newRaceLocation}
                  onChange={(e) => setNewRaceLocation(e.target.value)}
                  placeholder="예: 서울 잠실종합운동장"
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs text-stone-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  대회 중요도 (우선순위 & 테이퍼링 강도 설정)
                </label>
                <select
                  value={newRacePriority}
                  onChange={(e) => setNewRacePriority(e.target.value as 'A' | 'B' | 'C')}
                  className="w-full px-3 py-2.5 glass-input rounded-xl text-xs bg-white text-stone-800 font-semibold"
                >
                  <option value="A">A-Race (최우선 메인 목표) — 전력 완주 & 2~3주 정밀 테이퍼링</option>
                  <option value="B">B-Race (중간 점검 / 준비) — 실전 페이스 점검 & 3~5일 미니 감량</option>
                  <option value="C">C-Race (연습 / 훈련 대회) — 훈련용 대회 & 테이퍼링 최소화(마일리지 유지)</option>
                </select>
                <span className="text-[10px] text-stone-500 mt-1 block keep-all">
                  💡 <strong>테이퍼링 자동 조율:</strong> 중요도와 목표 강도가 낮은 대회는 조기 감량으로 인한 지구력 손실을 막기 위해 테이퍼링을 최소화하고 평소 훈련 마일리지를 유지합니다.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  대회 목표 완주 기록 (선택)
                </label>
                <input
                  type="text"
                  value={newRaceTargetTime}
                  onChange={(e) => setNewRaceTargetTime(e.target.value)}
                  placeholder="예: 03:29:59 (hh:mm:ss)"
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold text-stone-800"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  * 이 대회의 목표 완주 시간을 설정하면 D-day 위젯에 맞춤 페이스와 함께 연동됩니다.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsRaceModalOpen(false)}
                  className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>대회 등록</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 러닝화 전체 정보 및 마일리지 수정 모달 */}
      {editingShoe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-stone-200 shadow-2xl text-stone-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-700" />
                <span>러닝화 정보 및 사이즈 수정</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingShoe(null)}
                className="text-stone-400 hover:text-stone-700 text-xs px-2 py-1 cursor-pointer"
              >
                닫기
              </button>
            </div>

            <form onSubmit={handleSaveEditShoeSubmit} className="space-y-4">
              {/* 1. 신발 모델명 */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  신발 이름 / 모델명 <span className="text-rose-700">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editShoeName}
                  onChange={(e) => setEditShoeName(e.target.value)}
                  placeholder="예: 알파플라이 3, 줌 플라이 5"
                  className="w-full px-3 py-2.5 glass-input rounded-xl text-xs font-bold text-stone-900 focus:border-emerald-600"
                />
              </div>

              {/* 2. 브랜드, 사이즈 & 카테고리 */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">브랜드</label>
                  <input
                    type="text"
                    required
                    value={editShoeBrand}
                    onChange={(e) => setEditShoeBrand(e.target.value)}
                    placeholder="Nike, Adidas..."
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs text-stone-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">사이즈 (mm)</label>
                  <input
                    type="text"
                    value={editShoeSize}
                    onChange={(e) => setEditShoeSize(e.target.value)}
                    placeholder="직접 입력 (선택)"
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold text-stone-900 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">카테고리</label>
                  <select
                    value={editShoeCategory}
                    onChange={(e) => {
                      const cat = e.target.value as ShoeCategory;
                      setEditShoeCategory(cat);
                    }}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs bg-white text-stone-800"
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
                  <label className="block text-xs font-semibold text-emerald-800 mb-1">
                    현재 누적 주행거리 (km)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editMileage}
                    onChange={(e) => setEditMileage(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 glass-input rounded-xl text-sm font-mono font-bold text-stone-900 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    목표 수명 마일리지 (km)
                  </label>
                  <input
                    type="number"
                    min="50"
                    step="50"
                    required
                    value={editMaxMileage}
                    onChange={(e) => setEditMaxMileage(e.target.value)}
                    className="w-full px-3 py-2.5 glass-input rounded-xl text-sm font-mono text-stone-800 font-bold"
                  />
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setEditMaxMileage('300')}
                      className="px-2 py-0.5 text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded cursor-pointer transition-colors border border-stone-200"
                    >
                      300km (레이싱)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMaxMileage('450')}
                      className="px-2 py-0.5 text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded cursor-pointer transition-colors border border-stone-200"
                    >
                      450km (스피드)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMaxMileage('600')}
                      className="px-2 py-0.5 text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded cursor-pointer transition-colors border border-stone-200"
                    >
                      600km (데일리)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMaxMileage('700')}
                      className="px-2 py-0.5 text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded cursor-pointer transition-colors border border-stone-200"
                    >
                      700km (LSD)
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. 실시간 수명 소진율 & 마모 상태 프리뷰 (50% yellow, 80% orange) */}
              {(() => {
                const currentKm = parseFloat(editMileage) || 0;
                const maxKm = parseFloat(editMaxMileage) || 600;
                const wearPct = maxKm > 0 ? Math.round((currentKm / maxKm) * 100) : 0;
                const remaining = Math.round((maxKm - currentKm) * 10) / 10;
                const isOverdue = wearPct >= 100;
                const isNearLimit = wearPct >= 80 && wearPct < 100;
                const isWarning = wearPct >= 50 && wearPct < 80;

                return (
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-600 font-medium">수명 소진율 및 상태 프리뷰</span>
                      <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                        isOverdue
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : isNearLimit
                          ? 'bg-orange-100 text-orange-900 border border-orange-300'
                          : isWarning
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}>
                        {wearPct}% {isOverdue ? '(수명 종료)' : isNearLimit ? '(80% 도달)' : isWarning ? '(50% 도달)' : '(양호)'}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOverdue
                            ? 'bg-rose-600'
                            : isNearLimit
                            ? 'bg-orange-500'
                            : isWarning
                            ? 'bg-amber-400'
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(wearPct, 100)}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-stone-600">
                      {remaining <= 0 ? (
                        <span className="text-rose-900 font-semibold">
                          ⚠️ 권장 수명을 {Math.abs(remaining)}km 초과했습니다. 쿠션 꺼짐으로 인한 무릎·발목 충격 주의!
                        </span>
                      ) : (
                        <span>
                          수명 한계까지 약 <strong className="text-emerald-800 font-mono font-bold">{remaining}km</strong> 남았습니다.
                        </span>
                      )}
                    </p>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditingShoe(null)}
                  className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>수정사항 저장</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 대회별 중요도 및 목표 완주 기록 수정 모달 */}
      {editingRaceForTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-stone-200 shadow-2xl text-stone-800">
            <h3 className="text-lg font-bold text-stone-900 mb-2 flex items-center gap-2">
              <Target className="w-5 h-5 text-rose-800" />
              <span>대회 중요도 & 목표 기록 수정</span>
            </h3>
            <p className="text-xs text-stone-600 mb-4">
              <strong className="text-stone-900">{editingRaceForTarget.name}</strong> ({editingRaceForTarget.course})의 중요도와 맞춤 목표 완주 시간을 설정합니다.
            </p>

            <form onSubmit={handleSaveRaceTargetSubmit} className="space-y-4">
              {/* 1. 대회 중요도 (우선순위) */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  대회 중요도 (우선순위 & 테이퍼링 강도)
                </label>
                <select
                  value={editRacePriority}
                  onChange={(e) => setEditRacePriority(e.target.value as 'A' | 'B' | 'C')}
                  className="w-full px-3 py-2.5 glass-input rounded-xl text-xs bg-white text-stone-800 font-semibold"
                >
                  <option value="A">A-Race (최우선 메인 목표) — 전력 완주 & 2~3주 정밀 테이퍼링</option>
                  <option value="B">B-Race (중간 점검 / 준비) — 실전 페이스 점검 & 3~5일 미니 감량</option>
                  <option value="C">C-Race (연습 / 훈련 대회) — 훈련용 대회 & 테이퍼링 최소화(마일리지 유지)</option>
                </select>
                <span className="text-[10px] text-stone-500 mt-1 block keep-all">
                  💡 <strong>테이퍼링 자동 연동:</strong> C-Race나 목표 강도가 낮은 대회는 조기 감량으로 인한 심폐 능력 저하를 막기 위해 테이퍼링을 최소화하고 주간 훈련 마일리지를 온전히 유지합니다.
                </span>
              </div>

              {/* 2. 목표 완주 시간 */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  목표 완주 시간 (hh:mm:ss)
                </label>
                <input
                  type="text"
                  value={editRaceTargetTime}
                  onChange={(e) => setEditRaceTargetTime(e.target.value)}
                  placeholder="예: 03:19:59"
                  className="w-full px-3 py-2.5 glass-input rounded-xl text-sm font-mono font-bold text-stone-900"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  대회마다 목표 완주 기록을 개별적으로 설정하여 관리할 수 있습니다.
                </span>
              </div>

              {/* 3. 대표 목표 대회 설정 여부 */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    checked={editRaceIsTarget}
                    onChange={(e) => setEditRaceIsTarget(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-stone-300"
                  />
                  <span>이 대회를 대표 메인 목표 대회로 지정</span>
                </label>
                <span className="text-[10px] text-stone-500 mt-1 block pl-6">
                  * 홈 화면 상단 D-Day 위젯과 훈련 계획 생성 시 최우선 기준으로 분석됩니다.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditingRaceForTarget(null)}
                  className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>설정 저장</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
