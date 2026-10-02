import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  X,
  HardDriveDownload,
  HardDriveUpload,
  ShieldCheck,
} from 'lucide-react';
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
  exportRunningDataAsJSON,
  validateBackupJSON,
  restoreRunningDataToStorage,
  BackupValidationResult,
} from '../lib/backupRestore';

interface DataBackupSectionProps {
  physicalInfo: PhysicalInfo;
  shoes: RunningShoe[];
  races: RegisteredRace[];
  runningRecords: RunningRecords;
  runningGoals: RunningGoals;
  trainingSessions: TrainingSession[];
  weeklyPlan: WeeklyPlanDay[];
  weeklyPlanSettings: WeeklyPlanSettings;
  onRestoreSuccess: (data: {
    physicalInfo: PhysicalInfo;
    shoes: RunningShoe[];
    races: RegisteredRace[];
    runningRecords: RunningRecords;
    runningGoals: RunningGoals;
    trainingSessions: TrainingSession[];
    weeklyPlan?: WeeklyPlanDay[];
    weeklyPlanSettings?: WeeklyPlanSettings;
  }) => void;
}

export const DataBackupSection: React.FC<DataBackupSectionProps> = ({
  physicalInfo,
  shoes,
  races,
  runningRecords,
  runningGoals,
  trainingSessions,
  weeklyPlan,
  weeklyPlanSettings,
  onRestoreSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<{
    validation: BackupValidationResult;
    fileName: string;
  } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // 1. Export JSON
  const handleExport = () => {
    try {
      const res = exportRunningDataAsJSON({
        physicalInfo,
        shoes,
        races,
        runningRecords,
        runningGoals,
        trainingSessions,
        weeklyPlan,
        weeklyPlanSettings,
      });

      const totalDist = trainingSessions.reduce((acc, s) => acc + (Number(s.totalDistanceKm) || 0), 0);
      showNotification(
        'success',
        `📦 '${res.fileName}' 다운로드 완료! (훈련 기록 ${trainingSessions.length}건 / ${Math.round(totalDist)}km, 신발 ${shoes.length}개, 대회 ${races.length}개 저장)`
      );
    } catch (err: any) {
      showNotification('error', `백업 파일 생성 실패: ${err?.message || '알 수 없는 오류'}`);
    }
  };

  // 2. Select file for import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const validation = validateBackupJSON(content);

      if (!validation.isValid || !validation.payload) {
        showNotification('error', validation.error || '백업 파일 유효성 검증 실패');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setPendingBackup({
        validation,
        fileName: file.name,
      });

      // Clear input so same file can be re-selected if cancelled
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onerror = () => {
      showNotification('error', '파일을 읽는 도중 오류가 발생했습니다.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  // 3. Confirm and execute restore
  const handleConfirmRestore = async () => {
    if (!pendingBackup?.validation.payload) return;

    setIsRestoring(true);
    try {
      const { payload } = pendingBackup.validation;
      await restoreRunningDataToStorage(payload);

      // Notify parent App component to update React state
      onRestoreSuccess(payload.data);

      setPendingBackup(null);
      showNotification(
        'success',
        `📥 백업 복원 완료! 훈련 세션 ${payload.data.trainingSessions.length}건, 러닝화 ${payload.data.shoes.length}개, 참가 대회 ${payload.data.races.length}개가 안전하게 복원되었습니다.`
      );
    } catch (err: any) {
      showNotification('error', `데이터 복원 중 오류 발생: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="w-full mt-6 pt-5 pb-4 px-4 sm:px-6 rounded-2xl bg-stone-900/90 text-stone-100 border border-emerald-500/30 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-black text-emerald-300 tracking-wide">
              데이터 유실 방지 & 안전 백업 (JSON Export / Import)
            </h4>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
              로컬 영구 보관
            </span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            비로그인 상태 이용이나 브라우저 캐시 삭제 시에도 안심할 수 있도록, 훈련 기록·신발·대회 일정을 내 컴퓨터나 스마트폰에 JSON 파일로 다운로드하고 언제든 복원하세요.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-shrink-0 flex-wrap">
          {/* Backup Button */}
          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 border border-emerald-400/40 hover:scale-[1.02] active:scale-[0.98]"
            title="모든 러닝 기록과 설정을 JSON 파일로 다운로드합니다"
          >
            <HardDriveDownload className="w-4 h-4 text-amber-200" />
            <span>내 러닝 데이터 백업 (JSON)</span>
          </button>

          {/* Restore Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-2 border border-stone-600 hover:border-emerald-400 active:scale-[0.98]"
            title="기존에 백업한 JSON 파일을 불러와 복원합니다"
          >
            <HardDriveUpload className="w-4 h-4 text-emerald-400" />
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

      {/* Notification Toast */}
      {notification && (
        <div
          className={`mt-3.5 p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/50'
              : notification.type === 'error'
              ? 'bg-rose-950/80 text-rose-200 border border-rose-500/50'
              : 'bg-stone-800 text-stone-200 border border-stone-600'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-white/10 rounded-md text-stone-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pending Restore Confirmation Modal */}
      {pendingBackup && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-stone-900 border-2 border-emerald-500/60 rounded-2xl max-w-lg w-full p-6 text-stone-100 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-stone-700">
              <div className="flex items-center gap-2 text-emerald-400">
                <FileCheck2 className="w-5 h-5" />
                <h3 className="text-base font-black">백업 데이터 복원 확인</h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                className="p-1.5 text-stone-400 hover:text-stone-100 rounded-lg hover:bg-stone-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-stone-800/80 rounded-xl border border-stone-700 flex items-center justify-between">
                <span className="text-stone-400 font-medium">선택된 파일:</span>
                <span className="font-mono font-bold text-amber-300 truncate max-w-[260px]">
                  {pendingBackup.fileName}
                </span>
              </div>

              <div className="p-3.5 bg-emerald-950/40 rounded-xl border border-emerald-600/30 space-y-2">
                <div className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>복원 대상 데이터 요약</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-stone-200">
                  <div className="bg-stone-900/60 p-2 rounded-lg border border-stone-800">
                    <span className="text-stone-400 block text-[11px]">훈련 세션</span>
                    <span className="font-bold text-sm text-emerald-400">
                      {pendingBackup.validation.summary?.sessionsCount ?? 0}건
                    </span>
                    <span className="text-[10px] text-stone-400 ml-1">
                      ({pendingBackup.validation.summary?.totalDistanceKm ?? 0} km)
                    </span>
                  </div>
                  <div className="bg-stone-900/60 p-2 rounded-lg border border-stone-800">
                    <span className="text-stone-400 block text-[11px]">보유 러닝화</span>
                    <span className="font-bold text-sm text-emerald-400">
                      {pendingBackup.validation.summary?.shoesCount ?? 0}켤레
                    </span>
                  </div>
                  <div className="bg-stone-900/60 p-2 rounded-lg border border-stone-800">
                    <span className="text-stone-400 block text-[11px]">참가 대회 (D-Day)</span>
                    <span className="font-bold text-sm text-emerald-400">
                      {pendingBackup.validation.summary?.racesCount ?? 0}개
                    </span>
                  </div>
                  <div className="bg-stone-900/60 p-2 rounded-lg border border-stone-800">
                    <span className="text-stone-400 block text-[11px]">신체 & 목표 설정</span>
                    <span className="font-bold text-sm text-emerald-400">정상 포함</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-950/30 rounded-xl border border-amber-600/30 text-amber-200 flex items-start gap-2 text-[11px]">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  주의: 복원을 진행하면 현재 기기의 로컬 저장소 및 연결된 Firebase 데이터가 백업 파일의 내용으로 안전하게 덮어쓰여집니다.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-700">
              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 border border-emerald-400/40 disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>복원 동기화 중...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                    <span>지금 복원하기</span>
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
