import React, { useState, useMemo } from 'react';
import {
  Footprints,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Layers,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import { RunningShoe, ShoeCategory, TrainingSession } from '../types';

interface ShoeMileageAnalyticsCardProps {
  shoes: RunningShoe[];
  sessions?: TrainingSession[];
  onOpenEditShoe?: (shoe: RunningShoe) => void;
  onOpenAddShoe?: () => void;
  onNavigateToShoeList?: () => void;
}

type SortOption = 'mileage_desc' | 'wear_pct_desc' | 'urgent_first' | 'recent_worn';
type FilterOption = 'all' | 'needs_replacement' | 'safe' | ShoeCategory;

export const ShoeMileageAnalyticsCard: React.FC<ShoeMileageAnalyticsCardProps> = ({
  shoes = [],
  sessions = [],
  onOpenEditShoe,
  onOpenAddShoe,
  onNavigateToShoeList,
}) => {
  const [filter, setFilter] = useState<FilterOption>('데일리');
  const [sortBy, setSortBy] = useState<SortOption>('urgent_first');
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(false);

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

        // Keep most recent date
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

      // Wear Status Categorization
      // 100%+ : 수명 종료 / 교체 요망 (Overdue - 버건디)
      // 80%~99% : 교체 임박 / 권장 (Near Limit - 80% 주황색)
      // 50%~79% : 주의 / 마모 진행 (Warning - 50% 노란색)
      // 0%~49% : 최적 / 안전 (Optimal - 잔디밭 그린)
      let status: 'optimal' | 'warning' | 'near_limit' | 'overdue';
      let statusLabel: string;
      let statusColor: string;
      let badgeBg: string;

      if (wearPct >= 100) {
        status = 'overdue';
        statusLabel = '수명 완료';
        statusColor = 'text-rose-800';
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
        statusColor = 'text-emerald-700';
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

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalShoes = analyzedShoes.length;
    const totalMileage = Math.round(analyzedShoes.reduce((sum, s) => sum + s.effectiveMileage, 0) * 10) / 10;
    const totalMaxMileage = Math.round(analyzedShoes.reduce((sum, s) => sum + s.effectiveMaxMileage, 0) * 10) / 10;
    const overdueCount = analyzedShoes.filter((s) => s.status === 'overdue').length;
    const nearLimitCount = analyzedShoes.filter((s) => s.status === 'near_limit').length;
    const warningCount = analyzedShoes.filter((s) => s.status === 'warning').length;
    const optimalCount = analyzedShoes.filter((s) => s.status === 'optimal').length;
    const urgentCount = overdueCount + nearLimitCount;

    const totalWearPct =
      totalMaxMileage > 0
        ? Math.round((totalMileage / totalMaxMileage) * 100)
        : 0;

    // Mileage by Category
    const categoryMileage: Record<ShoeCategory, { mileage: number; count: number }> = {
      데일리: { mileage: 0, count: 0 },
      스피드: { mileage: 0, count: 0 },
      장거리: { mileage: 0, count: 0 },
      레이싱: { mileage: 0, count: 0 },
      트레일: { mileage: 0, count: 0 },
    };

    analyzedShoes.forEach((s) => {
      if (categoryMileage[s.category]) {
        categoryMileage[s.category].mileage += s.effectiveMileage;
        categoryMileage[s.category].count += 1;
      }
    });

    return {
      totalShoes,
      totalMileage,
      totalMaxMileage,
      overdueCount,
      nearLimitCount,
      warningCount,
      optimalCount,
      urgentCount,
      totalWearPct,
      avgWearPct: totalWearPct,
      categoryMileage,
    };
  }, [analyzedShoes]);

  // Filtered & Sorted Shoes
  const displayShoes = useMemo(() => {
    let result = [...analyzedShoes];

    // Filter
    if (filter === 'needs_replacement') {
      result = result.filter((s) => s.status === 'overdue' || s.status === 'near_limit');
    } else if (filter === 'safe') {
      result = result.filter((s) => s.status === 'optimal' || s.status === 'warning');
    } else if (filter !== 'all') {
      result = result.filter((s) => s.category === filter);
    }

    // Sort
    if (sortBy === 'urgent_first') {
      const order = { overdue: 0, near_limit: 1, warning: 2, optimal: 3 };
      result.sort((a, b) => order[a.status] - order[b.status] || b.wearPct - a.wearPct);
    } else if (sortBy === 'mileage_desc') {
      result.sort((a, b) => b.effectiveMileage - a.effectiveMileage);
    } else if (sortBy === 'wear_pct_desc') {
      result.sort((a, b) => b.wearPct - a.wearPct);
    } else if (sortBy === 'recent_worn') {
      result.sort((a, b) => {
        const timeA = a.lastWornDate ? new Date(a.lastWornDate).getTime() : 0;
        const timeB = b.lastWornDate ? new Date(b.lastWornDate).getTime() : 0;
        return timeB - timeA;
      });
    }

    return result;
  }, [analyzedShoes, filter, sortBy]);

  if (shoes.length === 0) {
    return null;
  }

  return (
    <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-emerald-600/20 shadow-md bg-white/95 relative overflow-hidden space-y-6 text-stone-800">
      {/* Card Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-2xl border border-rose-700/40 shadow-sm">
            <Footprints className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <span>러닝화 마일리지 수명 & 교체 관리</span>
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-semibold">
                Shoe Health Analytics
              </span>
              {metrics.urgentCount > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                  교체 알림 {metrics.urgentCount}켤레
                </span>
              )}
            </div>
            <p className="text-xs text-stone-600 mt-1">
              신발별 누적 주행거리와 목표 마일리지 수명을 시각화하고, 은퇴 및 교체 주기를 분석합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
          <button
            type="button"
            onClick={() => setIsGuidanceOpen((prev) => !prev)}
            className="px-3 py-2 text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-emerald-700" />
            <span>{isGuidanceOpen ? '가이드 접기' : '교체 주기 기준'}</span>
          </button>
          {onOpenAddShoe && (
            <button
              type="button"
              onClick={onOpenAddShoe}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border border-emerald-500"
            >
              <span>+ 신발 추가</span>
            </button>
          )}
        </div>
      </div>

      {/* Replacement Alert Banner (특정 마일리지 도달 시 교체 알림) */}
      {metrics.urgentCount > 0 && (
        <div className="relative z-10 p-4 sm:p-5 rounded-2xl bg-rose-50 border border-rose-300 shadow-sm">
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
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-bold">
                    🚨 총 {metrics.urgentCount}켤레 대상
                  </span>
                </div>
                <p className="text-xs text-stone-700 leading-relaxed keep-all">
                  미드솔 완충 폼(PEBA, EVA, ZoomX 등)의 수명이 한계에 도달했습니다. 쿠션 꺼짐 및 반발력 저하는 
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
                            : 'bg-orange-100 text-orange-900 border-orange-300'
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
              onClick={() => setFilter(filter === 'needs_replacement' ? 'all' : 'needs_replacement')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer self-start sm:self-center ${
                filter === 'needs_replacement'
                  ? 'bg-rose-900 text-white shadow-sm'
                  : 'bg-rose-100 text-rose-900 hover:bg-rose-200 border border-rose-300'
              }`}
            >
              <span>{filter === 'needs_replacement' ? '전체 보기로 복귀' : '교체 대상만 모아보기'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Sports Science Guidance Expandable Panel */}
      {isGuidanceOpen && (
        <div className="relative z-10 p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-stone-700 space-y-3 animate-fadeIn">
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
              <span className="text-xs font-bold text-emerald-800">장거리 LSD / 맥스쿠션 (600~750km)</span>
              <p className="text-[11px] text-stone-600">
                장거리 20~35km 주행 시 체중의 3~4배 하중을 분산. 힐카운터 비틀림 및 미드솔 주름 발생 시 즉각 은퇴 권장.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Executive Key Stat Gauges */}
      <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Closet Mileage */}
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>보관함 총 누적 주행</span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono">
            {metrics.totalMileage.toLocaleString()} <span className="text-xs font-normal text-stone-500">km</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-1 flex items-center justify-between">
            <span>보유 신발</span>
            <strong className="text-stone-800">{metrics.totalShoes}켤레</strong>
          </div>
        </div>

        {/* Metric 2: Total Wear Rate */}
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>전체 수명 소진율</span>
            <BarChart3 className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono">
            {metrics.totalWearPct} <span className="text-xs font-normal text-stone-500">%</span>
          </div>
          {/* Miniature Progress Bar */}
          <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden mt-1.5">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                metrics.totalWearPct >= 80 ? 'bg-orange-500' : metrics.totalWearPct >= 50 ? 'bg-amber-400' : 'bg-emerald-600'
              }`}
              style={{ width: `${Math.min(metrics.totalWearPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 3: Urgent Replacements */}
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>교체 임박 & 수명 초과</span>
            <AlertTriangle className={`w-4 h-4 ${metrics.urgentCount > 0 ? 'text-rose-600' : 'text-stone-400'}`} />
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono ${metrics.urgentCount > 0 ? 'text-rose-900' : 'text-stone-700'}`}>
            {metrics.urgentCount} <span className="text-xs font-normal text-stone-500">켤레</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-1 flex items-center justify-between">
            <span>수명 초과: <strong className="text-rose-900">{metrics.overdueCount}</strong></span>
            <span>임박: <strong className="text-orange-700">{metrics.nearLimitCount}</strong></span>
          </div>
        </div>

        {/* Metric 4: Safe / Optimal Condition */}
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>안전 & 최상 컨디션</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-800 font-mono">
            {metrics.optimalCount} <span className="text-xs font-normal text-stone-500">켤레</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-1 flex items-center justify-between">
            <span>마모 진행: <strong className="text-amber-700">{metrics.warningCount}</strong></span>
            <span>최적: <strong className="text-emerald-800">{metrics.optimalCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Sorting Toolbar */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        {/* Category & Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300'
            }`}
          >
            전체 ({analyzedShoes.length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('needs_replacement')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
              filter === 'needs_replacement'
                ? 'bg-rose-900 text-white font-bold shadow-sm'
                : 'bg-rose-50 text-rose-900 hover:bg-rose-100 border border-rose-300'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>교체 임박/초과 ({metrics.urgentCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('safe')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filter === 'safe'
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300'
            }`}
          >
            정상·양호 ({metrics.optimalCount + metrics.warningCount})
          </button>

          <div className="h-4 w-px bg-stone-300 mx-1 flex-shrink-0" />

          {(['레이싱', '스피드', '데일리', '장거리', '트레일'] as ShoeCategory[]).map((cat) => {
            const count = analyzedShoes.filter((s) => s.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  filter === cat
                    ? 'bg-rose-900 text-white font-bold shadow-sm'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <SlidersHorizontal className="w-3.5 h-3.5 text-stone-600" />
            <span>정렬:</span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs"
          >
            <option value="urgent_first">교체 시급순 (경고 우선)</option>
            <option value="mileage_desc">누적 마일리지 높은 순</option>
            <option value="wear_pct_desc">수명 소진율(%) 높은 순</option>
            <option value="recent_worn">최근 착용일 순</option>
          </select>
        </div>
      </div>

      {/* Visualized Shoe Mileage & Wear Status Cards / Bars */}
      <div className="relative z-10 space-y-3">
        {displayShoes.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-stone-50 border border-stone-200 text-stone-500 text-xs shadow-2xs">
            선택한 조건에 해당하는 러닝화가 없습니다.
          </div>
        ) : (
          displayShoes.map((shoe) => {
            const pct = Math.min(shoe.wearPct, 100);

            // Category color mappings
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
                className={`p-4 sm:p-5 rounded-2xl transition-all border ${
                  shoe.status === 'overdue'
                    ? 'bg-rose-50/60 border-rose-300 shadow-sm'
                    : shoe.status === 'near_limit'
                    ? 'bg-amber-50/60 border-amber-300 shadow-2xs'
                    : 'bg-white border-stone-200 hover:border-emerald-300 shadow-2xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-semibold border ${categoryBadgeColors[shoe.category]}`}>
                        {shoe.category}
                      </span>
                      <span className="text-xs text-stone-500 font-medium">{shoe.brand}</span>
                      {shoe.size && (
                        <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-mono font-semibold bg-stone-100 text-stone-700 border border-stone-300">
                          {shoe.size}
                        </span>
                      )}
                      <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-bold border ${shoe.badgeBg} flex items-center gap-1`}>
                        {shoe.status === 'overdue' && <AlertTriangle className="w-3 h-3 text-rose-700" />}
                        {shoe.status === 'near_limit' && <AlertCircle className="w-3 h-3 text-orange-700" />}
                        {shoe.status === 'optimal' && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
                        <span>{shoe.statusLabel}</span>
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                      <span>{shoe.name}</span>
                    </h4>
                  </div>

                  {/* Mileage & Percentage Numbers */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 flex-shrink-0">
                    <div className="flex items-baseline gap-1.5 font-mono">
                      <span className={`text-base sm:text-lg font-black ${
                        shoe.status === 'overdue' ? 'text-rose-900' : 'text-emerald-800'
                      }`}>
                        {shoe.effectiveMileage}km
                      </span>
                      <span className="text-xs text-stone-500">
                        / {shoe.effectiveMaxMileage}km
                      </span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ml-1 ${
                        shoe.wearPct >= 100
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : 'bg-stone-100 text-stone-700 border border-stone-200'
                      }`}>
                        {shoe.wearPct}%
                      </span>
                    </div>

                    <div className="text-[11px] text-stone-500">
                      {shoe.remainingKm <= 0 ? (
                        <span className="text-rose-900 font-bold">
                          ⚠️ {Math.abs(shoe.remainingKm)}km 초과 주행 (즉시 교체)
                        </span>
                      ) : (
                        <span>
                          잔여: <strong className="text-emerald-800 font-semibold">{shoe.remainingKm}km</strong> 후 수명 도달
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Bar Visualization */}
                <div className="space-y-1 mb-2.5">
                  <div className="w-full h-2.5 sm:h-3 rounded-full bg-stone-200 p-0.5 border border-stone-300 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Progress Milestone Markers */}
                  <div className="flex justify-between text-[10px] text-stone-500 font-mono px-0.5">
                    <span>0km</span>
                    <span className="text-amber-700 font-semibold">50%</span>
                    <span className="text-orange-700 font-semibold">80%</span>
                    <span className="text-rose-900 font-semibold">{shoe.effectiveMaxMileage}km</span>
                  </div>
                </div>

                {/* Footer details: Recent Session Link & Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-stone-200 text-xs">
                  <div className="text-stone-500 text-[11px] truncate flex items-center gap-2">
                    {shoe.lastWornDate ? (
                      <span className="text-emerald-900 font-mono text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex-shrink-0">
                        최근 착용: {shoe.lastWornDate} {shoe.lastSessionTitle ? `(${shoe.lastSessionTitle})` : ''}
                      </span>
                    ) : (
                      <span className="text-stone-400 text-[10px]">
                        아직 훈련 기록 연동 없음
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                    {onOpenEditShoe && (
                      <button
                        type="button"
                        onClick={() => onOpenEditShoe(shoe)}
                        className="text-[11px] text-stone-600 hover:text-emerald-800 transition-colors cursor-pointer"
                      >
                        마일리지/정보 수정
                      </button>
                    )}
                    {onNavigateToShoeList && (
                      <button
                        type="button"
                        onClick={onNavigateToShoeList}
                        className="text-[11px] text-emerald-700 hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
                      >
                        <span>신발함 바로가기</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
