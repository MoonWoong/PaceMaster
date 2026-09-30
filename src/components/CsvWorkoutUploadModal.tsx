import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Clock,
  Heart,
  Footprints,
  Sparkles,
  Tag,
  Trash2,
  Save,
  Check,
  RotateCcw,
  Sliders,
  Zap,
  AlertCircle,
  Table,
  LayoutGrid,
  Search,
  Filter,
} from 'lucide-react';
import { TrainingSession, RunningShoe } from '../types';

export interface ParsedCsvUploadItem {
  id: string; // temporary key
  fileName: string;
  date: string;
  title: string;
  totalDistanceKm: number;
  totalTime: string;
  avgPace: string;
  avgHr: number;
  maxHr: number;
  notes: string;
  shoeId?: string;
  shoeName?: string;
  laps: TrainingSession['laps'];
}

interface CsvWorkoutUploadModalProps {
  isOpen: boolean;
  parsedItems: ParsedCsvUploadItem[];
  shoes: RunningShoe[];
  existingSessions?: TrainingSession[];
  onClose: () => void;
  onSaveBatch: (
    items: Omit<TrainingSession, 'id' | 'createdAt'>[]
  ) => Promise<void>;
}

const QUICK_MEMO_TAGS = [
  '☀️ 맑고 선선함',
  '🌧️ 우중런',
  '💨 맞바람 러닝',
  '🏃‍♂️ 편안한 조깅',
  '⚡ 템포런 / 지속주',
  '🔥 고강도 인터벌',
  '🦵 다리 가벼움',
  '💥 후반 페이스업',
  '🧘 리커버리 완료',
  '💧 땀 흠뻑 상쾌함',
];

export const CsvWorkoutUploadModal: React.FC<CsvWorkoutUploadModalProps> = ({
  isOpen,
  parsedItems,
  shoes = [],
  existingSessions = [],
  onClose,
  onSaveBatch,
}) => {
  const [items, setItems] = useState<ParsedCsvUploadItem[]>([]);
  const [commonMemo, setCommonMemo] = useState<string>('');
  const [commonShoeId, setCommonShoeId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // View Mode: table for high volume (e.g. 2025 whole year) vs cards for small sets
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);

  // Sync state when parsedItems change
  useEffect(() => {
    if (parsedItems && parsedItems.length > 0) {
      setItems(parsedItems);
      setSubmitError(null);
      // Auto default to table if more than 4 items
      if (parsedItems.length > 4) {
        setViewMode('table');
      }
    }
  }, [parsedItems]);

  // Identify duplicate items comparing against existing sessions
  const duplicateIdSet = useMemo(() => {
    const set = new Set<string>();
    if (!existingSessions || existingSessions.length === 0) return set;

    for (const item of items) {
      const isDup = existingSessions.some(
        (es) =>
          es.date === item.date &&
          Math.abs((es.totalDistanceKm || 0) - (item.totalDistanceKm || 0)) < 0.1
      );
      if (isDup) {
        set.add(item.id);
      }
    }
    return set;
  }, [items, existingSessions]);

  // Extract distinct years and months
  const { yearCounts, monthList } = useMemo(() => {
    const yCounts: Record<string, number> = {};
    const mSet = new Set<string>();

    items.forEach((it) => {
      const year = it.date.slice(0, 4) || '기타';
      const month = it.date.slice(0, 7) || '기타';
      yCounts[year] = (yCounts[year] || 0) + 1;
      if (it.date.length >= 7) {
        mSet.add(month);
      }
    });

    const mList = Array.from(mSet).sort().reverse();
    return { yearCounts: yCounts, monthList: mList };
  }, [items]);

  // Filter items for display
  const displayedItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedMonthFilter !== 'all' && !item.date.startsWith(selectedMonthFilter)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDate = item.date.includes(q);
        const matchNotes = item.notes.toLowerCase().includes(q);
        if (!matchTitle && !matchDate && !matchNotes) return false;
      }
      return true;
    });
  }, [items, selectedMonthFilter, searchQuery]);

  if (!isOpen) return null;

  // Update a single item's property
  const handleUpdateItem = (
    id: string,
    updates: Partial<ParsedCsvUploadItem>
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // Append a quick tag to an item's notes
  const handleAppendTag = (id: string, tag: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const current = (item.notes || '').trim();
        const updated = current ? `${current} #${tag}` : `#${tag}`;
        return { ...item, notes: updated };
      })
    );
  };

  // Remove an item from the upload list
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Apply common memo to all items
  const handleApplyCommonMemo = (append: boolean = false) => {
    if (!commonMemo.trim()) return;
    setItems((prev) =>
      prev.map((item) => {
        if (append && item.notes.trim()) {
          return { ...item, notes: `${item.notes.trim()} | ${commonMemo.trim()}` };
        }
        return { ...item, notes: commonMemo.trim() };
      })
    );
  };

  // Apply common shoe to all items
  const handleApplyCommonShoe = (shoeId: string) => {
    setCommonShoeId(shoeId);
    const targetShoe = shoes.find((s) => s.id === shoeId);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        shoeId: targetShoe ? targetShoe.id : undefined,
        shoeName: targetShoe ? `${targetShoe.brand} ${targetShoe.name}` : undefined,
      }))
    );
  };

  // Select shoe for a specific item
  const handleSelectShoeForItem = (id: string, shoeId: string) => {
    const targetShoe = shoes.find((s) => s.id === shoeId);
    handleUpdateItem(id, {
      shoeId: targetShoe ? targetShoe.id : undefined,
      shoeName: targetShoe ? `${targetShoe.brand} ${targetShoe.name}` : undefined,
    });
  };

  // Handle final submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (items.length === 0 || isSubmitting) return;

    // Filter out duplicates if skipDuplicates is true
    const candidates = skipDuplicates
      ? items.filter((it) => !duplicateIdSet.has(it.id))
      : items;

    if (candidates.length === 0) {
      setSubmitError('등록할 새로운 훈련 세션이 없습니다. (모든 세션이 이미 등록됨)');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Omit<TrainingSession, 'id' | 'createdAt'>[] = candidates.map(
        (it) => ({
          date: it.date,
          title: it.title.trim() || '가민 러닝 세션',
          totalDistanceKm: it.totalDistanceKm,
          totalTime: it.totalTime,
          avgPace: it.avgPace,
          avgHr: it.avgHr,
          maxHr: it.maxHr,
          notes: it.notes.trim() || undefined,
          shoeId: it.shoeId,
          shoeName: it.shoeName,
          laps: it.laps,
        })
      );

      await onSaveBatch(payload);
      onClose();
    } catch (err: any) {
      console.error('Error saving batch sessions:', err);
      setSubmitError(
        err?.message || '훈련 세션 저장 중 오류가 발생했습니다. 다시 시도해 주세요.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDistanceSum =
    Math.round(items.reduce((acc, it) => acc + (it.totalDistanceKm || 0), 0) * 10) / 10;

  const toSaveCount = skipDuplicates
    ? items.filter((it) => !duplicateIdSet.has(it.id)).length
    : items.length;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl my-auto rounded-3xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 pb-4 bg-gradient-to-r from-blue-950/50 via-slate-900 to-slate-900 border-b border-white/10 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-md shadow-blue-500/10">
              <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>가민 CSV 훈련 기록 일괄 업로드</span>
                </h3>

                {Object.entries(yearCounts).map(([yr, count]) => (
                  <span
                    key={yr}
                    className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-athletic font-bold"
                  >
                    {yr}년 훈련 {count}회
                  </span>
                ))}

                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono font-bold">
                  총 {items.length}개 세션 ({totalDistanceSum.toLocaleString()} km)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 keep-all">
                가민에서 추출한 파일의 <strong className="text-emerald-300">‘제목’</strong> 컬럼이 훈련 제목으로 자동 인식되었습니다. 날짜별 거리·시간·페이스·심박수를 확인하고 등록하세요.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Controls Strip (Bulk Tools + View Switcher + Search) */}
        <div className="p-3 sm:p-4 bg-slate-950/70 border-b border-white/5 space-y-3">
          {/* Top Row: Search & Month Filter & View Mode */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="훈련 제목('제목') 또는 날짜 검색 (예: 인터벌, 지속주, 2025-05)..."
                className="w-full pl-9 pr-4 py-1.5 glass-input rounded-xl text-xs font-medium text-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  지우기
                </button>
              )}
            </div>

            {/* View Mode Toggle & Duplicate Option */}
            <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
              {duplicateIdSet.size > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/30 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="rounded text-amber-400 focus:ring-0"
                  />
                  <span>중복 {duplicateIdSet.size}건 제외</span>
                </label>
              )}

              <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-white/10">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-blue-500 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="다량의 훈련을 한눈에 표로 검토"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>표 보기</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-blue-500 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="세션별 카드 상세 편집"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>카드 보기</span>
                </button>
              </div>
            </div>
          </div>

          {/* Month Filter Pills if multiple months */}
          {monthList.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <span className="text-[11px] text-slate-400 whitespace-nowrap flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3 text-cyan-400" />
                <span>월별 필터:</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedMonthFilter('all')}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer border ${
                  selectedMonthFilter === 'all'
                    ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                    : 'bg-slate-900 text-slate-300 border-white/5 hover:border-white/20'
                }`}
              >
                전체 ({items.length})
              </button>
              {monthList.map((m) => {
                const count = items.filter((it) => it.date.startsWith(m)).length;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMonthFilter(m)}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer border ${
                      selectedMonthFilter === m
                        ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                        : 'bg-slate-900 text-slate-300 border-white/5 hover:border-white/20'
                    }`}
                  >
                    {m} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Bulk Assign Tools Accordion / Quick Row */}
          {items.length > 1 && (
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              {/* Common Shoe Select */}
              {shoes.length > 0 && (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-slate-400 flex items-center gap-1 whitespace-nowrap">
                    <Footprints className="w-3.5 h-3.5 text-cyan-400" />
                    <span>공통 러닝화:</span>
                  </span>
                  <select
                    value={commonShoeId}
                    onChange={(e) => handleApplyCommonShoe(e.target.value)}
                    className="flex-1 max-w-xs px-2.5 py-1.5 glass-input rounded-xl text-xs text-white bg-slate-950 border border-white/10"
                  >
                    <option value="">개별 지정 유지 (선택 안 함)</option>
                    {shoes.map((s) => (
                      <option key={s.id} value={s.id}>
                        [{s.brand}] {s.name} ({s.category || '기본'}, {s.mileage}km)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Common Memo Apply */}
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={commonMemo}
                  onChange={(e) => setCommonMemo(e.target.value)}
                  placeholder="모든 훈련에 적용할 공통 메모 (예: 2025 마라톤 훈련 시즌)"
                  className="flex-1 px-3 py-1.5 glass-input rounded-xl text-xs text-white placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => handleApplyCommonMemo(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition-all cursor-pointer whitespace-nowrap"
                >
                  일괄 적용
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Body (Scrollable List or Table) */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {displayedItems.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs rounded-2xl bg-slate-950/50 border border-white/5">
              조건에 맞는 훈련 기록이 없습니다.
            </div>
          ) : viewMode === 'table' ? (
            /* ================= MODE 1: COMPACT FAST TABLE ================= */
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60 shadow-inner">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/90 text-slate-400 border-b border-white/10 font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3 w-28 whitespace-nowrap">훈련 일자</th>
                    <th className="p-3 min-w-[200px]">훈련 제목 ('제목')</th>
                    <th className="p-3 w-24 text-right whitespace-nowrap">거리</th>
                    <th className="p-3 w-24 whitespace-nowrap">시간</th>
                    <th className="p-3 w-24 whitespace-nowrap">평균 페이스</th>
                    <th className="p-3 w-28 whitespace-nowrap">심박수(평균/최대)</th>
                    <th className="p-3 min-w-[150px]">훈련 메모</th>
                    <th className="p-3 w-12 text-center">삭제</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayedItems.map((item, idx) => {
                    const isDup = duplicateIdSet.has(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-white/5 transition-colors ${
                          isDup && skipDuplicates ? 'opacity-40 bg-amber-950/10' : ''
                        }`}
                      >
                        <td className="p-3 text-center text-slate-500 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="p-3">
                          <input
                            type="date"
                            value={item.date}
                            onChange={(e) => handleUpdateItem(item.id, { date: e.target.value })}
                            className="bg-slate-900/80 border border-white/5 rounded-lg px-2 py-1 text-xs text-cyan-300 font-mono focus:border-cyan-400"
                          />
                          {isDup && (
                            <span className="block text-[9px] text-amber-400 font-medium mt-0.5">
                              ⚠️ 기존 중복
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                            placeholder="훈련 제목"
                            className="w-full bg-slate-900/80 border border-white/5 rounded-lg px-2.5 py-1 text-xs font-semibold text-white focus:border-emerald-400"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <strong className="text-emerald-400 font-athletic font-bold text-sm">
                            {item.totalDistanceKm.toFixed(2)}
                          </strong>{' '}
                          <span className="text-[10px] text-slate-400">km</span>
                        </td>
                        <td className="p-3 font-mono text-slate-200">{item.totalTime}</td>
                        <td className="p-3 font-mono font-bold text-cyan-300">{item.avgPace}</td>
                        <td className="p-3 font-mono text-slate-300 text-[11px]">
                          <span className="text-rose-400">{item.avgHr}</span> / {item.maxHr} bpm
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => handleUpdateItem(item.id, { notes: e.target.value })}
                            placeholder="메모 입력..."
                            className="w-full bg-slate-900/80 border border-white/5 rounded-lg px-2 py-1 text-xs text-slate-300 focus:border-blue-400"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                            title="이 훈련 제외"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ================= MODE 2: DETAILED CARDS ================= */
            <div className="space-y-4">
              {displayedItems.map((item, idx) => {
                const isDup = duplicateIdSet.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:p-5 rounded-2xl border space-y-3.5 transition-all shadow-md ${
                      isDup && skipDuplicates
                        ? 'bg-slate-950/40 border-amber-500/20 opacity-60'
                        : 'bg-slate-950/70 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Top Row */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold font-mono flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-mono text-slate-400 truncate" title={item.fileName}>
                          {item.fileName}
                        </span>
                        {isDup && (
                          <span className="text-[10px] px-2 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold whitespace-nowrap">
                            ⚠️ 기존 등록 데이터와 중복
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors cursor-pointer"
                        title="이 세션 업로드 제외"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Metadata Inputs (Date & Title) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-cyan-400" />
                          <span>훈련 일자</span>
                        </label>
                        <input
                          type="date"
                          value={item.date}
                          onChange={(e) => handleUpdateItem(item.id, { date: e.target.value })}
                          className="w-full px-3 py-1.5 glass-input rounded-xl text-xs font-mono text-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-emerald-400" />
                          <span>훈련 제목 (CSV '제목' 컬럼 반영)</span>
                        </label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                          placeholder="훈련 제목을 입력하세요"
                          className="w-full px-3 py-1.5 glass-input rounded-xl text-xs font-medium text-white"
                        />
                      </div>
                    </div>

                    {/* Stats Strip */}
                    <div className="grid grid-cols-2 xs:grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-white/5">
                        <span className="block text-[10px] text-slate-400">거리</span>
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          {item.totalDistanceKm.toFixed(2)} km
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-white/5">
                        <span className="block text-[10px] text-slate-400">시간</span>
                        <span className="font-mono font-bold text-white text-sm">
                          {item.totalTime}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-white/5">
                        <span className="block text-[10px] text-slate-400">평균 페이스</span>
                        <span className="font-mono font-bold text-cyan-400 text-sm">
                          {item.avgPace}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-white/5">
                        <span className="block text-[10px] text-slate-400">평균 / 최고심박</span>
                        <span className="font-mono font-bold text-rose-400 text-sm">
                          {item.avgHr} / {item.maxHr} bpm
                        </span>
                      </div>
                    </div>

                    {/* Shoe Selection */}
                    {shoes.length > 0 && (
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                          <Footprints className="w-3 h-3 text-amber-400" />
                          <span>착용 러닝화 (선택 시 마일리지 자동 합산)</span>
                        </label>
                        <select
                          value={item.shoeId || ''}
                          onChange={(e) => handleSelectShoeForItem(item.id, e.target.value)}
                          className="w-full px-3 py-1.5 glass-input rounded-xl text-xs font-medium text-white bg-slate-900 border border-white/10"
                        >
                          <option value="">러닝화 미지정 (추후 지정 가능)</option>
                          {shoes.map((s) => (
                            <option key={s.id} value={s.id}>
                              [{s.brand}] {s.name} ({s.category || '기본'} · {s.mileage}km 주행)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Workout Memo */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>훈련 메모 (컨디션, 날씨, 훈련 후기)</span>
                        </label>
                        <span className="text-[10px] text-slate-500">
                          {item.notes ? `${item.notes.length}자` : '비어있음'}
                        </span>
                      </div>

                      <textarea
                        rows={2}
                        value={item.notes}
                        onChange={(e) => handleUpdateItem(item.id, { notes: e.target.value })}
                        placeholder="훈련 메모를 입력하세요 (예: 2025 가을 빌드업 런 완료)"
                        className="w-full px-3 py-2 glass-input rounded-xl text-xs font-medium text-white placeholder:text-slate-500 leading-relaxed resize-none focus:border-emerald-400"
                      />

                      {/* Quick Memo Tags */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="text-[10px] text-slate-400 self-center mr-1">빠른 태그:</span>
                        {QUICK_MEMO_TAGS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleAppendTag(item.id, tag)}
                            className="px-2 py-0.5 rounded-lg text-[10px] bg-slate-900 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer"
                          >
                            +{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-white/10 flex flex-col gap-3">
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              총 <span className="text-white font-bold">{items.length}개</span> 훈련 중{' '}
              <strong className="text-emerald-300 font-bold">{toSaveCount}개</strong> 훈련 등록 예정
              {duplicateIdSet.size > 0 && skipDuplicates && (
                <span className="text-amber-400 ml-1.5">({duplicateIdSet.size}개 중복 자동 제외)</span>
              )}
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                취소
              </button>

              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isSubmitting || toSaveCount === 0}
                className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 rounded-xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? '훈련 세션 저장 중...'
                    : `총 ${toSaveCount}개 훈련 기록 및 메모 일괄 등록`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
