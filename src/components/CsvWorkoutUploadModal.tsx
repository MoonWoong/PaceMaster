import React, { useState, useEffect } from 'react';
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
  onClose,
  onSaveBatch,
}) => {
  const [items, setItems] = useState<ParsedCsvUploadItem[]>([]);
  const [commonMemo, setCommonMemo] = useState<string>('');
  const [commonShoeId, setCommonShoeId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync state when parsedItems change
  useEffect(() => {
    if (parsedItems && parsedItems.length > 0) {
      setItems(parsedItems);
      setSubmitError(null);
    }
  }, [parsedItems]);

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

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Omit<TrainingSession, 'id' | 'createdAt'>[] = items.map(
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
    Math.round(items.reduce((acc, it) => acc + it.totalDistanceKm, 0) * 100) / 100;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl my-auto rounded-3xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-4 bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border-b border-white/10 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-md shadow-blue-500/10">
              <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  CSV 훈련 기록 업로드 & 훈련 메모 작성
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono font-bold">
                  {items.length}개 세션 감지 (총 {totalDistanceSum}km)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                업로드할 훈련 세션의 제목, 날짜, <span className="text-emerald-400 font-semibold">훈련 메모</span>, 착용 러닝화를 검토 및 보완하세요.
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

        {/* Modal Body (Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {items.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs rounded-2xl bg-slate-950/50 border border-white/5">
              등록할 CSV 훈련 세션이 없습니다.
            </div>
          ) : (
            <>
              {/* Bulk Actions Panel (Visible when multiple files are uploaded) */}
              {items.length > 1 && (
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-blue-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      <span>다중 업로드 일괄 편의 도구 (공통 메모 & 러닝화)</span>
                    </span>
                    <span className="text-[10px] text-slate-400">모든 세션에 한 번에 적용</span>
                  </div>

                  {/* Common Memo Input */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={commonMemo}
                      onChange={(e) => setCommonMemo(e.target.value)}
                      placeholder="모든 세션에 적용할 공통 훈련 메모 (예: 가을 러닝 시즌 빌드업)"
                      className="flex-1 px-3 py-2 glass-input rounded-xl text-xs font-medium text-white placeholder:text-slate-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyCommonMemo(false)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition-all cursor-pointer whitespace-nowrap"
                      >
                        일괄 덮어쓰기
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyCommonMemo(true)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-all cursor-pointer whitespace-nowrap"
                      >
                        메모 뒤에 추가
                      </button>
                    </div>
                  </div>

                  {/* Common Shoe Select */}
                  {shoes.length > 0 && (
                    <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Footprints className="w-3 h-3 text-cyan-400" />
                        <span>공통 러닝화:</span>
                      </span>
                      <select
                        value={commonShoeId}
                        onChange={(e) => handleApplyCommonShoe(e.target.value)}
                        className="flex-1 sm:max-w-xs px-3 py-1.5 glass-input rounded-xl text-xs font-medium text-white bg-slate-900 border border-white/10"
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
                </div>
              )}

              {/* Individual Session Cards */}
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3.5 hover:border-white/20 transition-all shadow-md"
                  >
                    {/* Top Row: File Name & Remove Button */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold font-mono flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-mono text-slate-400 truncate" title={item.fileName}>
                          {item.fileName}
                        </span>
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
                          <span>훈련 제목</span>
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
                          className="w-full px-3 py-2 glass-input rounded-xl text-xs font-medium text-white bg-slate-900 border border-white/10"
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

                    {/* Workout Memo (훈련 메모 입력란) */}
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
                        placeholder="오늘의 훈련 메모를 남겨주세요 (예: 날씨 선선함, 마지막 2km 빌드업 성공, 무릎 통증 없음)"
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
                ))}
              </div>
            </>
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

          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              총 <span className="text-white font-bold">{items.length}개</span> 훈련 세션 등록 준비 완료
            </div>

            <div className="flex items-center gap-2">
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
                disabled={isSubmitting || items.length === 0}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 rounded-xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? '훈련 세션 저장 중...' : `총 ${items.length}개 훈련 기록 및 메모 저장`}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
