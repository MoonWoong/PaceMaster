import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md p-6 bg-white rounded-2xl border border-stone-200 shadow-2xl text-stone-800">
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-300">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-stone-900 flex items-center gap-1.5">
              <span>보안 인증 확인</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600 inline" />
            </h3>
            <p className="text-xs text-stone-600">
              <span className="text-emerald-700 font-semibold">[{actionTitle}]</span> 작업을 진행하려면 비밀번호를 입력해 주세요.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
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
                className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 pr-12 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 hover:text-stone-800 px-1 py-0.5 cursor-pointer font-medium"
              >
                {showPassword ? '숨김' : '표시'}
              </button>
            </div>
            {errorMsg && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-700 font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            <p className="mt-2 text-[11px] text-stone-500">
              💡 기본 마스터 키는 시스템에 부여된 비밀번호입니다.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm border border-emerald-500 cursor-pointer"
            >
              인증 확인
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
