import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock, X, AlertCircle } from 'lucide-react';
import {
  registerSecurityPromptListener,
  unregisterSecurityPromptListener,
  resolveSecurityPrompt,
  RUNNER_SECURITY_KEY,
} from '../lib/security';

export const SecurityPromptModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [actionTitle, setActionTitle] = useState('데이터 변경');
  const [inputKey, setInputKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registerSecurityPromptListener((title) => {
      setActionTitle(title);
      setInputKey('');
      setErrorMsg('');
      setShowPassword(false);
      setIsOpen(true);
    });

    return () => {
      unregisterSecurityPromptListener();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputKey === RUNNER_SECURITY_KEY) {
      setIsOpen(false);
      resolveSecurityPrompt(inputKey);
    } else {
      setErrorMsg('비밀번호가 일치하지 않습니다. (입력값 오류)');
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolveSecurityPrompt(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md p-6 glass-panel rounded-2xl border border-white/20 shadow-2xl">
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
              <span>보안 인증 확인</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400 inline" />
            </h3>
            <p className="text-xs text-slate-300">
              <span className="text-emerald-400 font-semibold">[{actionTitle}]</span> 작업을 진행하려면 비밀번호를 입력해 주세요.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              보안 키 (러너 마스터 비밀번호)
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="비밀번호 입력..."
                className="w-full px-4 py-3 glass-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 pr-12 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 px-1 py-0.5"
              >
                {showPassword ? '숨김' : '표시'}
              </button>
            </div>
            {errorMsg && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-400">
              💡 기본 마스터 키는 시스템에 부여된 비밀번호입니다.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
            >
              인증 확인
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
