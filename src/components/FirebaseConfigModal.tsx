import React, { useState } from 'react';
import { Database, CheckCircle2, AlertTriangle, X, Cloud, HardDrive, RefreshCw } from 'lucide-react';
import {
  getActiveFirebaseConfig,
  saveRuntimeFirebaseConfig,
  clearRuntimeFirebaseConfig,
  getDbConnectionStatus,
  firebaseConfig as defaultFileConfig,
} from '../lib/firebase';
import { verifyRunnerSecurityKey } from '../lib/security';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseConfigModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const currentStatus = getDbConnectionStatus();
  const activeCfg = getActiveFirebaseConfig() || defaultFileConfig;

  const [apiKey, setApiKey] = useState(activeCfg.apiKey || '');
  const [authDomain, setAuthDomain] = useState(activeCfg.authDomain || '');
  const [projectId, setProjectId] = useState(activeCfg.projectId || '');
  const [storageBucket, setStorageBucket] = useState(activeCfg.storageBucket || '');
  const [messagingSenderId, setMessagingSenderId] = useState(activeCfg.messagingSenderId || '');
  const [appId, setAppId] = useState(activeCfg.appId || '');

  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const authorized = await verifyRunnerSecurityKey('Firebase DB 설정 저장');
    if (!authorized) return;

    const newConfig = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim(),
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim(),
    };

    saveRuntimeFirebaseConfig(newConfig);
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const handleResetToLocal = async () => {
    const authorized = await verifyRunnerSecurityKey('로컬 모드로 초기화');
    if (!authorized) return;
    clearRuntimeFirebaseConfig();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-750 shadow-2xl text-stone-800 dark:text-stone-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-white transition-colors"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white rounded-xl shadow-xs">
            <Database className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <span>Firebase (Firestore) 연동 설정</span>
              {currentStatus.isCloud ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold">
                  Cloud 연결됨
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-bold">
                  로컬 동기화 모드
                </span>
              )}
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              PC 및 모바일 등 여러 기기에서 러닝 기록을 실시간 공유할 수 있는 Firestore 설정
            </p>
          </div>
        </div>

        {/* Status card */}
        <div className="mb-6 p-4 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-750 flex items-start gap-3">
          {currentStatus.isCloud ? (
            <Cloud className="w-5 h-5 text-emerald-700 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <HardDrive className="w-5 h-5 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="text-xs text-stone-700 dark:text-stone-300 space-y-1">
            <p className="font-semibold text-stone-900 dark:text-white">
              현재 상태:{' '}
              {currentStatus.isCloud ? (
                <span className="text-emerald-800 dark:text-emerald-400 font-mono font-bold">{currentStatus.projectId}</span>
              ) : (
                <span className="text-amber-800 dark:text-amber-300 font-bold">로컬 스토리지 비동기 CRUD 작동 중</span>
              )}
            </p>
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
              {currentStatus.isCloud
                ? 'Firebase Firestore 백엔드가 안전하게 연결되어 모든 러너 데이터(신체 정보, 러닝화, 참가 대회, 훈련 기록, 주간 플랜)가 실시간 클라우드 DB에 동기화 및 보존됩니다.'
                : '소스 코드 내의 firebaseConfig 객체에 직접 입력하거나 아래 입력창에 기입 후 저장하면 자동 동기화됩니다.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Project ID <span className="text-emerald-700 dark:text-emerald-400">*필수</span>
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="예: my-running-app"
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-stone-400 dark:placeholder-stone-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSyD-..."
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-mono text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-stone-400 dark:placeholder-stone-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Auth Domain</label>
              <input
                type="text"
                value={authDomain}
                onChange={(e) => setAuthDomain(e.target.value)}
                placeholder="my-app.firebaseapp.com"
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-stone-400 dark:placeholder-stone-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">App ID</label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="1:1234567890:web:abcd..."
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-stone-400 dark:placeholder-stone-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Storage Bucket</label>
              <input
                type="text"
                value={storageBucket}
                onChange={(e) => setStorageBucket(e.target.value)}
                placeholder="my-app.appspot.com"
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-stone-400 dark:placeholder-stone-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Messaging Sender ID</label>
              <input
                type="text"
                value={messagingSenderId}
                onChange={(e) => setMessagingSenderId(e.target.value)}
                placeholder="123456789012"
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-stone-400 dark:placeholder-stone-500"
              />
            </div>
          </div>

          {savedSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>설정이 저장되었습니다. 페이지를 새로고침하여 Firebase와 연결합니다...</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={handleResetToLocal}
              className="text-xs text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 transition-colors flex items-center gap-1 font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>로컬 모드로 복원</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-700 rounded-lg transition-colors cursor-pointer"
              >
                닫기
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-lg transition-all shadow-sm border border-emerald-500 cursor-pointer"
              >
                Firebase 설정 저장
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
