import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  Search,
  Sparkles,
  Info,
  RotateCcw,
  Plus,
  Tag,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { RunningShoe, TrainingSession, ShoeCategory } from '../types';

interface TrainingShoeModalProps {
  session: TrainingSession;
  shoes: RunningShoe[];
  recentSessions?: TrainingSession[];
  onSave: (shoeName: string | undefined, shoeId?: string) => Promise<void>;
  onClose: () => void;
}

export const TrainingShoeModal: React.FC<TrainingShoeModalProps> = ({
  session,
  shoes = [],
  recentSessions = [],
  onSave,
  onClose,
}) => {
  const [selectedShoeName, setSelectedShoeName] = useState<string>(session.shoeName || '');
  const [selectedShoeId, setSelectedShoeId] = useState<string | undefined>(session.shoeId);
  const [customInput, setCustomInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Calculate usage count of each shoe in recent training records
  const shoeUsageCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    recentSessions.forEach((s) => {
      if (s.shoeName) {
        const key = s.shoeName.trim().toLowerCase();
        map[key] = (map[key] || 0) + 1;
      }
    });
    return map;
  }, [recentSessions]);

  // Categories list
  const categories: ('전체' | ShoeCategory)[] = ['전체', '데일리', '스피드', '장거리', '레이싱', '트레일'];

  // Filtered shoes
  const filteredShoes = useMemo(() => {
    return shoes.filter((shoe) => {
      const matchesCategory = selectedCategory === '전체' || shoe.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        shoe.name.toLowerCase().includes(q) ||
        shoe.brand.toLowerCase().includes(q) ||
        shoe.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [shoes, selectedCategory, searchQuery]);

  const handleSelectOwnedShoe = (shoe: RunningShoe) => {
    setSelectedShoeName(shoe.name);
    setSelectedShoeId(shoe.id);
    setCustomInput('');
  };

  const handleApplyCustom = async () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    try {
      await onSave(trimmed, undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = async () => {
    setIsSubmitting(true);
    try {
      await onSave(undefined, undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const isCustom = !!customInput.trim();
      const finalName = isCustom ? customInput.trim() : selectedShoeName.trim();
      const finalShoeId = isCustom ? undefined : (selectedShoeId || undefined);
      await onSave(finalName || undefined, finalShoeId);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lock body scroll and handle ESC key
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <span className="text-lg">👟</span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>훈련 착용 러닝화 입력 / 선택</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                기록된 훈련에 착용한 러닝화를 지정합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Training Session Info Badge */}
        <div className="px-4 sm:px-5 py-3 bg-slate-950/40 border-b border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 font-mono font-semibold border border-cyan-500/30">
              {session.date}
            </span>
            <span className="font-bold text-white truncate max-w-[200px] sm:max-w-xs">
              {session.title}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>거리: <strong className="text-white font-athletic">{session.totalDistanceKm}km</strong></span>
            <span>·</span>
            <span>페이스: <strong className="text-cyan-300 font-athletic">{session.avgPace}</strong></span>
          </div>
        </div>

        {/* Notice Banner: No mileage link */}
        <div className="px-4 sm:px-5 py-2.5 bg-emerald-950/30 border-b border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            <strong>안내:</strong> 러닝화 마일리지 수치는 변경되지 않으며, 단순 훈련별 착용 신발 기록용으로만 저장됩니다.
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Current Selection Status */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10 flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] text-slate-400 font-semibold mb-0.5">선택된 착용 러닝화</div>
              {selectedShoeName ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                    <span>👟</span>
                    <span>{selectedShoeName}</span>
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">아직 선택된 신발이 없습니다.</span>
              )}
            </div>

            {selectedShoeName && (
              <button
                type="button"
                onClick={() => {
                  setSelectedShoeName('');
                  setSelectedShoeId(undefined);
                  setCustomInput('');
                }}
                className="px-2 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/30 transition-all cursor-pointer"
              >
                선택 해제
              </button>
            )}
          </div>

          {/* Section: Select from Owned Shoes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>보유 러닝화 목록에서 선택</span>
                <span className="text-[11px] text-emerald-400 font-mono">({shoes.length}켤레)</span>
              </span>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-2.5 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-emerald-400 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative mb-2.5">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="신발 이름 또는 브랜드 검색..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            {/* Owned Shoes List Cards */}
            {filteredShoes.length === 0 ? (
              <div className="p-4 text-center rounded-xl bg-slate-950/40 border border-white/5 text-xs text-slate-400">
                일치하는 보유 러닝화가 없습니다. 아래에서 직접 입력해주세요.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {filteredShoes.map((shoe) => {
                  const isSelected = selectedShoeName === shoe.name;
                  const usageCount = shoeUsageCountMap[shoe.name.trim().toLowerCase()] || 0;

                  return (
                    <button
                      key={shoe.id}
                      type="button"
                      onClick={() => handleSelectOwnedShoe(shoe)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500/50 shadow-sm shadow-emerald-500/10'
                          : 'bg-slate-950/50 border-white/5 hover:border-white/20 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                              : 'border-slate-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-mono">[{shoe.brand}]</span>
                            <span className="text-xs font-bold text-white truncate">{shoe.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                shoe.category === '스피드' || shoe.category === '레이싱'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : shoe.category === '장거리'
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : 'bg-blue-500/20 text-blue-300'
                              }`}
                            >
                              {shoe.category}
                            </span>
                          </div>
                          {shoe.review && (
                            <p className="text-[10px] text-slate-400 truncate mt-0.5 max-w-xs">
                              {shoe.review}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Usage badge for rotation insight */}
                      <div className="flex-shrink-0 text-right pl-2">
                        {usageCount === 0 ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                            미착용 (추천)
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {usageCount}회 착용
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Direct Manual Input */}
          <div className="pt-2.5 border-t border-white/10">
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>또는 신발 이름 직접 입력</span>
              <span className="text-[11px] text-slate-400 font-normal">엔터 또는 [적용] 시 즉시 저장</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => {
                  setCustomInput(e.target.value);
                  if (e.target.value.trim()) {
                    setSelectedShoeName(e.target.value.trim());
                    setSelectedShoeId(undefined);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyCustom();
                  }
                }}
                placeholder="예: 호카 클리프톤 9, 아디오스 프로 3 등"
                className="flex-1 px-3 py-2 bg-slate-950/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
              <button
                type="button"
                onClick={handleApplyCustom}
                disabled={!customInput.trim() || isSubmitting}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                title="입력한 러닝화로 즉시 적용 및 저장"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>{isSubmitting ? '적용 중...' : '적용'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950/60 flex items-center justify-between gap-3">
          {session.shoeName ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClear}
              className="px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>러닝화 기록 해제</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{isSubmitting ? '저장 중...' : '러닝화 저장'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
