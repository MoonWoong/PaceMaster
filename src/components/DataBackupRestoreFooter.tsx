import React, { useRef, useState } from 'react';
import { Download, Upload, ShieldCheck, AlertCircle, CheckCircle2, FileJson, RefreshCw } from 'lucide-react';
import {
  PhysicalInfo,
  RunningShoe,
  RegisteredRace,
  RunningRecords,
  RunningGoals,
  TrainingSession,
  WeeklyPlanDay,
  WeeklyPlanSettings,
} from '../types';
import {
  exportBackupData,
  parseAndValidateBackupJson,
  PaceMasterBackupPayload,
} from '../lib/dataBackup';
import { verifyRunnerSecurityKey } from '../lib/security';

interface DataBackupRestoreFooterProps {
  physicalInfo: PhysicalInfo;
  runningRecords: RunningRecords;
  runningGoals: RunningGoals;
  shoes: RunningShoe[];
  races: RegisteredRace[];
  trainingSessions: TrainingSession[];
  weeklyPlan: WeeklyPlanDay[];
  weeklyPlanSettings: WeeklyPlanSettings;
  onRestoreComplete: (restored: PaceMasterBackupPayload['data']) => Promise<void>;
}

export const DataBackupRestoreFooter: React.FC<DataBackupRestoreFooterProps> = ({
  physicalInfo,
  runningRecords,
  runningGoals,
  shoes,
  races,
  trainingSessions,
  weeklyPlan,
  weeklyPlanSettings,
  onRestoreComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingRestorePayload, setPendingRestorePayload] = useState<PaceMasterBackupPayload | null>(null);

  // 1. Export JSON Backup
  const handleExport = () => {
    try {
      exportBackupData({
        physicalInfo,
        runningRecords,
        runningGoals,
        shoes,
        races,
        trainingSessions,
        weeklyPlan,
        weeklyPlanSettings,
      });

      setStatusMessage({
        type: 'success',
        text: `📦 러닝 데이터 백업 완료! (세션 ${trainingSessions.length}건, 러닝화 ${shoes.length}개, 대회 ${races.length}개)`,
      });
      setTimeout(() => setStatusMessage(null), 4500);
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: `백업 다운로드 실패: ${e?.message || '알 수 없는 오류'}`,
      });
      setTimeout(() => setStatusMessage(null), 4500);
    }
  };

  // 2. Trigger File Picker
  const handleTriggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // 3. Process Uploaded JSON File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = parseAndValidateBackupJson(content);

      if (!result.isValid || !result.payload) {
        setStatusMessage({
          type: 'error',
          text: result.error || '유효하지 않은 백업 파일입니다.',
        });
        setTimeout(() => setStatusMessage(null), 5000);
        return;
      }

      // Open confirm modal with summary
      setPendingRestorePayload(result.payload);
    };

    reader.onerror = () => {
      setStatusMessage({
        type: 'error',
        text: '파일을 읽는 도중 오류가 발생했습니다.',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    };

    reader.readAsText(file, 'utf-8');
  };

  // 4. Confirm Restore Action with Security Key
  const handleConfirmRestore = async () => {
    if (!pendingRestorePayload) return;

    const authorized = await verifyRunnerSecurityKey('러닝 데이터 백업 복원');
    if (!authorized) return;

    setIsProcessing(true);
    try {
      await onRestoreComplete(pendingRestorePayload.data);

      const s = pendingRestorePayload.summary;
      setStatusMessage({
        type: 'success',
        text: `📥 백업 복원 완료! (세션 ${s.totalSessions}건, 러닝화 ${s.totalShoes}개, 대회 ${s.totalRaces}개 복원됨)`,
      });
      setPendingRestorePayload(null);
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `복원 중 오류 발생: ${err?.message || '알 수 없는 오류'}`,
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full mt-6 space-y-3">
      {/* Toast Alert Banner */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-stone-500 hover:text-stone-900 cursor-pointer text-xs ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Backup & Restore Toolbar Card */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-emerald-800/15 shadow-sm bg-white/95 text-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Info & Description */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300">
              <FileJson className="w-4 h-4 text-emerald-800" />
            </span>
            <h4 className="text-sm font-bold text-stone-900">
              데이터 유실 방지: 로컬 JSON 백업 & 복원
            </h4>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium border border-stone-200">
              오프라인 보존 지원
            </span>
          </div>
          <p className="text-[11px] text-stone-600 leading-relaxed">
            비로그인 상태 또는 브라우저 캐시 삭제 시에도 훈련 기록, 러닝화, 목표 대회가 유실되지 않도록 JSON 파일로 다운로드하여 영구 보관할 수 있습니다.
          </p>
        </div>

        {/* Buttons Group */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap flex-shrink-0">
          {/* Export Button */}
          <button
            type="button"
            onClick={handleExport}
            className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-emerald-600 active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5 text-emerald-200" />
            <span>내 러닝 데이터 백업 (JSON 다운로드)</span>
          </button>

          {/* Import Button */}
          <button
            type="button"
            onClick={handleTriggerFileSelect}
            disabled={isProcessing}
            className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs shadow-2xs transition-all flex items-center gap-2 cursor-pointer border border-stone-300 active:scale-[0.98]"
          >
            <Upload className="w-3.5 h-3.5 text-stone-600" />
            <span>백업 파일 복원</span>
          </button>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Confirmation Modal for Restore */}
      {pendingRestorePayload && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setPendingRestorePayload(null)}
        >
          <div
            className="w-full max-w-md p-5 sm:p-6 rounded-2xl bg-white border border-stone-200 shadow-2xl text-stone-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-stone-200 pb-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-900 border border-amber-300">
                <ShieldCheck className="w-5 h-5 text-amber-800" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  러닝 데이터 복원 확인
                </h3>
                <p className="text-[11px] text-stone-500">
                  백업 파일 일시: {new Date(pendingRestorePayload.exportedAt).toLocaleString('ko-KR')}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs bg-stone-50 p-3.5 rounded-xl border border-stone-200">
              <div className="font-semibold text-stone-800 mb-1">
                복원될 데이터 요약:
              </div>
              <ul className="space-y-1 text-stone-700">
                <li className="flex items-center justify-between">
                  <span>🏃‍♂️ 실훈련 세션 및 랩타임:</span>
                  <strong className="font-mono font-bold text-emerald-800">
                    {pendingRestorePayload.summary.totalSessions}건
                  </strong>
                </li>
                <li className="flex items-center justify-between">
                  <span>👟 보유 러닝화 컬렉션:</span>
                  <strong className="font-mono font-bold text-emerald-800">
                    {pendingRestorePayload.summary.totalShoes}켤레
                  </strong>
                </li>
                <li className="flex items-center justify-between">
                  <span>🏅 참가 목표 대회:</span>
                  <strong className="font-mono font-bold text-emerald-800">
                    {pendingRestorePayload.summary.totalRaces}개
                  </strong>
                </li>
                <li className="flex items-center justify-between">
                  <span>🎯 PB 기록 & 목표 페이스:</span>
                  <strong className="text-emerald-800 font-bold">포함됨</strong>
                </li>
                <li className="flex items-center justify-between">
                  <span>📅 주간 훈련 계획표 & 신체정보:</span>
                  <strong className="text-emerald-800 font-bold">포함됨</strong>
                </li>
              </ul>
            </div>

            <p className="text-xs text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200 leading-relaxed">
              ⚠️ <strong>주의:</strong> 복원을 진행하면 현재 대시보드의 훈련 기록과 설정이 백업 파일의 내용으로 완전히 갱신 및 동기화됩니다.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingRestorePayload(null)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>복원 적용 중...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>복원 실행</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
