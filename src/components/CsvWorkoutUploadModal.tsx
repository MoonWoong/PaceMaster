import React, { useState, useMemo } from 'react';
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
  Trash2,
  Save,
  Check,
  AlertTriangle,
  Flame,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { TrainingSession, RunningShoe } from '../types';
import { verifyRunnerSecurityKey } from '../lib/security';

interface CsvWorkoutUploadModalProps {
  isOpen: boolean;
  parsedItems: Omit<TrainingSession, 'id' | 'createdAt'>[];
  shoes: RunningShoe[];
  existingSessions?: TrainingSession[];
  onSave: (items: Omit<TrainingSession, 'id' | 'createdAt'>[]) => Promise<void>;
  onClose: () => void;
}

export const CsvWorkoutUploadModal: React.FC<CsvWorkoutUploadModalProps> = ({
  isOpen,
  parsedItems: initialItems,
  shoes,
  existingSessions = [],
  onSave,
  onClose,
}) => {
  const [items, setItems] = useState<Omit<TrainingSession, 'id' | 'createdAt'>[]>(initialItems);
  const [selectedShoeId, setSelectedShoeId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Synchronize initial items
  React.useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Aggregate stats
  const totalCount = items.length;
  const totalKm = useMemo(() => {
    return Math.round(items.reduce((sum, item) => sum + (item.totalDistanceKm || 0), 0) * 10) / 10;
  }, [items]);

  // Check duplicate sessions by matching date & close distance (+-0.2km)
  const duplicateSet = useMemo(() => {
    const dupIndices = new Set<number>();
    if (!existingSessions || existingSessions.length === 0) return dupIndices;

    items.forEach((item, idx) => {
      const match = existingSessions.some(
        (es) => es.date === item.date && Math.abs((es.totalDistanceKm || 0) - (item.totalDistanceKm || 0)) < 0.2
      );
      if (match) {
        dupIndices.add(idx);
      }
    });
    return dupIndices;
  }, [items, existingSessions]);

  // Handle single item field update
  const handleUpdateItem = (
    index: number,
    field: keyof Omit<TrainingSession, 'id' | 'createdAt'>,
    value: any
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Handle delete item
  const handleDeleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Apply batch shoe to all sessions
  const handleApplyShoeToAll = (shoeId: string) => {
    setSelectedShoeId(shoeId);
    if (!shoeId) return;
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        shoeId: shoeId,
      }))
    );
  };

  // Handle Save All
  const handleSaveAll = async () => {
    if (items.length === 0) {
      alert('등록할 훈련 항목이 없습니다.');
      return;
    }

    const ok = await verifyRunnerSecurityKey(`가민 CSV 훈련 ${items.length}건 일괄 등록`);
    if (!ok) return;

    try {
      setIsSaving(true);
      await onSave(items);
      setSaveSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      alert('훈련 기록 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp text-stone-800">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-stone-200 flex items-center justify-between bg-stone-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-xl shadow-xs">
              <FileSpreadsheet className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2 flex-wrap">
                <span>가민 CSV 훈련 다중 파일 업로드</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-bold">
                  {totalCount}개 세션 분석됨
                </span>
              </h2>
              <p className="text-xs text-stone-600 mt-0.5 keep-all">
                선택한 CSV 파일(날짜_훈련제목 형식)의 랩 데이터와 심박수가 분석되었습니다. 검토 후 일괄 등록하세요.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            title="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Batch Controls Bar */}
        <div className="p-3 sm:p-4 bg-stone-50 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-stone-700 font-medium">
              <span>총 훈련 거리:</span>
              <strong className="text-emerald-800 font-athletic text-sm font-bold">{totalKm} km</strong>
            </div>
            {duplicateSet.size > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>기존 등록 기록과 날짜 중복 {duplicateSet.size}건 감지</span>
              </span>
            )}
          </div>

          {/* Quick Shoe Assign to All */}
          {shoes.length > 0 && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-stone-600 text-[11px] whitespace-nowrap font-medium">모든 세션 러닝화 일괄 배정:</span>
              <select
                value={selectedShoeId}
                onChange={(e) => handleApplyShoeToAll(e.target.value)}
                className="bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[200px] truncate shadow-2xs"
              >
                <option value="">러닝화 선택 안함 (개별 지정)</option>
                {shoes.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.brand}] {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Workout Items List (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-stone-100/50">
          {items.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-sm">
              업로드할 훈련 항목이 없습니다.
            </div>
          ) : (
            items.map((item, idx) => {
              const isDuplicate = duplicateSet.has(idx);

              return (
                <div
                  key={idx}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                    isDuplicate
                      ? 'bg-amber-50/70 border-amber-300'
                      : 'bg-white border-stone-200 hover:border-emerald-300 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left: Date, Title, Laps */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 whitespace-nowrap">
                          #{idx + 1}
                        </span>
                        <input
                          type="date"
                          value={item.date}
                          onChange={(e) => handleUpdateItem(idx, 'date', e.target.value)}
                          className="bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-xs text-stone-800 font-mono focus:outline-none focus:border-emerald-500"
                        />
                        {isDuplicate && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            <span>기존 기록 중복 주의</span>
                          </span>
                        )}
                        {item.laps && item.laps.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-300 font-mono font-medium">
                            {item.laps.length}개 랩 스플릿
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateItem(idx, 'title', e.target.value)}
                          placeholder="훈련 제목 (예: 10km 빌드업)"
                          className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Middle: Metrics Stats */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-wrap bg-stone-50 p-2.5 rounded-xl border border-stone-200 flex-shrink-0 shadow-2xs">
                      <div className="text-center min-w-[50px]">
                        <div className="text-[10px] text-stone-500 font-medium">거리</div>
                        <div className="text-sm font-bold text-emerald-800 font-athletic">
                          {item.totalDistanceKm}km
                        </div>
                      </div>
                      <div className="h-6 w-px bg-stone-200" />
                      <div className="text-center min-w-[50px]">
                        <div className="text-[10px] text-stone-500 font-medium">시간</div>
                        <div className="text-xs font-bold text-stone-900 font-mono">
                          {item.totalTime}
                        </div>
                      </div>
                      <div className="h-6 w-px bg-stone-200" />
                      <div className="text-center min-w-[50px]">
                        <div className="text-[10px] text-stone-500 font-medium">페이스</div>
                        <div className="text-xs font-bold text-emerald-800 font-athletic">
                          {item.avgPace}
                        </div>
                      </div>
                      {item.avgHr > 0 && (
                        <>
                          <div className="h-6 w-px bg-stone-200" />
                          <div className="text-center min-w-[50px]">
                            <div className="text-[10px] text-stone-500 font-medium">평균심박</div>
                            <div className="text-xs font-bold text-rose-900 font-mono">
                              {item.avgHr} bpm
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Right: Shoe selection & Delete button */}
                    <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                      {shoes.length > 0 && (
                        <select
                          value={item.shoeId || ''}
                          onChange={(e) => handleUpdateItem(idx, 'shoeId', e.target.value)}
                          className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs text-stone-700 focus:outline-none focus:border-emerald-500 max-w-[150px] truncate shadow-2xs"
                          title="훈련 시 착용한 러닝화 지정"
                        >
                          <option value="">러닝화 미지정</option>
                          {shoes.map((s) => (
                            <option key={s.id} value={s.id}>
                              [{s.brand}] {s.name}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteItem(idx)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                        title="이 훈련 제외"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-stone-600">
            총 <strong className="text-stone-900 font-bold">{items.length}개</strong> 훈련을 내 기록 및 주간 마일리지에 일괄 반영합니다.
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              disabled={isSaving || items.length === 0}
              onClick={handleSaveAll}
              className={`px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white border border-emerald-500'
              }`}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>등록 완료!</span>
                </>
              ) : isSaving ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>등록 중...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{items.length}개 훈련 일괄 등록</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
