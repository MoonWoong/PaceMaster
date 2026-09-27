import React, { useState, useMemo } from 'react';
import {
  X,
  Calculator,
  Timer,
  Gauge,
  Flame,
  Zap,
  Award,
  ChevronRight,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Compass,
} from 'lucide-react';
import { calculateVDOT, formatPace, formatSecondsToTime, parseTimeToSeconds } from '../lib/vdot';

interface PaceCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVDOT?: number;
}

interface DistancePreset {
  label: string;
  nameKo: string;
  km: number;
}

const DISTANCE_PRESETS: DistancePreset[] = [
  { label: '5K', nameKo: '5km 단거리', km: 5.0 },
  { label: '10K', nameKo: '10km 로드 레이스', km: 10.0 },
  { label: '하프', nameKo: '하프 마라톤 (21.0975km)', km: 21.0975 },
  { label: '풀코스', nameKo: '풀 마라톤 (42.195km)', km: 42.195 },
  { label: '3K', nameKo: '3km 스피드 측정', km: 3.0 },
  { label: '1K', nameKo: '1km 타임트라이얼', km: 1.0 },
  { label: '15K', nameKo: '15km 중장거리', km: 15.0 },
  { label: '30K', nameKo: '30km LSD 훈련', km: 30.0 },
];

// Target time presets for common distances
const TIME_PRESETS_MAP: Record<string, { label: string; h: number; m: number; s: number }[]> = {
  '5K': [
    { label: 'Sub-20', h: 0, m: 19, s: 59 },
    { label: 'Sub-22', h: 0, m: 21, s: 59 },
    { label: 'Sub-25', h: 0, m: 24, s: 59 },
    { label: 'Sub-30', h: 0, m: 29, s: 59 },
  ],
  '10K': [
    { label: 'Sub-40', h: 0, m: 39, s: 59 },
    { label: 'Sub-45', h: 0, m: 44, s: 59 },
    { label: 'Sub-50', h: 0, m: 49, s: 59 },
    { label: 'Sub-55', h: 0, m: 54, s: 59 },
    { label: 'Sub-60', h: 0, m: 59, s: 59 },
  ],
  '하프': [
    { label: 'Sub-1:30', h: 1, m: 29, s: 59 },
    { label: 'Sub-1:40', h: 1, m: 39, s: 59 },
    { label: 'Sub-1:45', h: 1, m: 44, s: 59 },
    { label: 'Sub-1:50', h: 1, m: 49, s: 59 },
    { label: 'Sub-2:00', h: 1, m: 59, s: 59 },
  ],
  '풀코스': [
    { label: 'Sub-3 (서브3)', h: 2, m: 59, s: 59 },
    { label: 'Sub-3:15', h: 3, m: 14, s: 59 },
    { label: 'Sub-3:30 (서브330)', h: 3, m: 29, s: 59 },
    { label: 'Sub-3:45', h: 3, m: 44, s: 59 },
    { label: 'Sub-4 (서브4)', h: 3, m: 59, s: 59 },
    { label: 'Sub-4:30', h: 4, m: 29, s: 59 },
  ],
};

export const PaceCalculatorModal: React.FC<PaceCalculatorModalProps> = ({
  isOpen,
  onClose,
  currentVDOT,
}) => {
  // Distance State
  const [selectedPreset, setSelectedPreset] = useState<string>('10K');
  const [distanceKm, setDistanceKm] = useState<number>(10.0);
  const [isCustomDistance, setIsCustomDistance] = useState<boolean>(false);
  const [customDistanceInput, setCustomDistanceInput] = useState<string>('10');

  // Target Time State
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(45);
  const [seconds, setSeconds] = useState<number>(0);

  // Copy status
  const [copied, setCopied] = useState<boolean>(false);

  // Strategy Mode: 'even' | 'negative'
  const [strategyMode, setStrategyMode] = useState<'even' | 'negative'>('even');

  // Handle Preset distance click
  const handleSelectPreset = (preset: DistancePreset) => {
    setSelectedPreset(preset.label);
    setIsCustomDistance(false);
    setDistanceKm(preset.km);
    setCustomDistanceInput(preset.km.toString());

    // Provide sensible default time if current time is empty or out of range
    if (preset.label === '5K' && (hours > 0 || minutes > 40)) {
      setHours(0);
      setMinutes(24);
      setSeconds(59);
    } else if (preset.label === '10K' && (hours > 1 || minutes < 25)) {
      setHours(0);
      setMinutes(44);
      setSeconds(59);
    } else if (preset.label === '하프' && hours === 0 && minutes < 60) {
      setHours(1);
      setMinutes(39);
      setSeconds(59);
    } else if (preset.label === '풀코스' && hours < 2) {
      setHours(3);
      setMinutes(29);
      setSeconds(59);
    }
  };

  // Handle Custom distance change
  const handleCustomDistanceChange = (valStr: string) => {
    setCustomDistanceInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      setDistanceKm(parsed);
      setIsCustomDistance(true);
      setSelectedPreset('custom');
    }
  };

  // Adjust time helper
  const adjustMinutes = (delta: number) => {
    const totalSec = Math.max(0, hours * 3600 + minutes * 60 + seconds + delta * 60);
    setHours(Math.floor(totalSec / 3600));
    setMinutes(Math.floor((totalSec % 3600) / 60));
    setSeconds(totalSec % 60);
  };

  const adjustSeconds = (delta: number) => {
    const totalSec = Math.max(0, hours * 3600 + minutes * 60 + seconds + delta);
    setHours(Math.floor(totalSec / 3600));
    setMinutes(Math.floor((totalSec % 3600) / 60));
    setSeconds(totalSec % 60);
  };

  // Calculations
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  const effectiveDistanceKm = distanceKm > 0 ? distanceKm : 1;

  // Pace in seconds per km
  const paceSecondsPerKm = totalSeconds > 0 ? totalSeconds / effectiveDistanceKm : 0;
  const paceFormatted = totalSeconds > 0 ? formatPace(paceSecondsPerKm) : "-'--\"";
  const paceMinutes = Math.floor(paceSecondsPerKm / 60);
  const paceSecondsRemainder = Math.round(paceSecondsPerKm % 60);

  // Speed in km/h
  const speedKmh = totalSeconds > 0 ? (effectiveDistanceKm / (totalSeconds / 3600)).toFixed(2) : '0.00';

  // Mile pace
  const paceSecondsPerMile = paceSecondsPerKm * 1.609344;
  const paceMileFormatted = totalSeconds > 0 ? formatPace(paceSecondsPerMile) : "-'--\"";

  // 400m Track Lap time
  const lap400mSeconds = paceSecondsPerKm * 0.4;
  const lap400mFormatted =
    totalSeconds > 0
      ? `${Math.floor(lap400mSeconds / 60)}분 ${(lap400mSeconds % 60).toFixed(1)}초`
      : '--';

  // 100m sprint segment
  const seg100mSeconds = (paceSecondsPerKm * 0.1).toFixed(1);

  // Jack Daniels VDOT estimation
  const targetVDOT =
    totalSeconds > 0 && effectiveDistanceKm > 0
      ? calculateVDOT(effectiveDistanceKm * 1000, totalSeconds)
      : 0;

  // Checkpoints Splits Table
  const checkpoints = useMemo(() => {
    if (totalSeconds <= 0 || effectiveDistanceKm <= 0) return [];

    let splits: number[] = [];

    if (effectiveDistanceKm <= 5.5) {
      splits = [1, 2, 3, 4, effectiveDistanceKm];
    } else if (effectiveDistanceKm <= 11) {
      splits = [1, 3, 5, 7, 8, effectiveDistanceKm];
    } else if (effectiveDistanceKm <= 22) {
      splits = [5, 10, 15, 20, effectiveDistanceKm];
    } else if (effectiveDistanceKm <= 43) {
      splits = [5, 10, 15, 20, 21.0975, 25, 30, 35, 40, effectiveDistanceKm];
    } else {
      const step = Math.max(1, Math.round(effectiveDistanceKm / 6));
      for (let d = step; d < effectiveDistanceKm; d += step) {
        splits.push(d);
      }
      splits.push(effectiveDistanceKm);
    }

    // Deduplicate and sort
    splits = Array.from(new Set(splits.map((s) => Math.round(s * 1000) / 1000))).sort((a, b) => a - b);

    return splits.map((km) => {
      let splitTimeSec = 0;

      if (strategyMode === 'negative') {
        // First half slightly slower (+3s/km), second half slightly faster (-3s/km)
        const halfDist = effectiveDistanceKm / 2;
        if (km <= halfDist) {
          splitTimeSec = km * (paceSecondsPerKm + 3);
        } else {
          splitTimeSec =
            halfDist * (paceSecondsPerKm + 3) + (km - halfDist) * (paceSecondsPerKm - 3);
        }
      } else {
        // Even pace
        splitTimeSec = km * paceSecondsPerKm;
      }

      const isFinish = Math.abs(km - effectiveDistanceKm) < 0.01;
      const label = isFinish
        ? `🏁 완주 (${km.toFixed(km % 1 === 0 ? 0 : 2)}km)`
        : `${km.toFixed(km % 1 === 0 ? 0 : 1)}km`;

      return {
        km,
        label,
        elapsed: formatSecondsToTime(splitTimeSec, true),
        isFinish,
      };
    });
  }, [totalSeconds, effectiveDistanceKm, paceSecondsPerKm, strategyMode]);

  // Copy summary to clipboard
  const handleCopy = () => {
    const text = `[PaceMaster 목표 페이스 계산기]
🎯 목표 거리: ${effectiveDistanceKm}km
⏱️ 목표 시간: ${formatSecondsToTime(totalSeconds, true)}
⚡ 필요한 평균 페이스: ${paceFormatted}/km (${speedKmh} km/h)
🏃 마일 페이스: ${paceMileFormatted}/mi
🏟️ 400m 트랙 1랩: ${lap400mFormatted}
🔥 요구 VDOT: ${targetVDOT > 0 ? targetVDOT.toFixed(1) : '-'}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-950/40 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-slate-950 font-bold shadow-md shadow-cyan-500/25">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white font-athletic">
                  목표 페이스 계산기
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                  TARGET PACE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                목표 거리와 완주 예상 시간을 입력하면 필요한 평균 페이스와 랩 타임을 계산합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Section 1: Target Distance Selection */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>1. 목표 거리 선택</span>
              </label>
              <div className="text-xs font-bold text-cyan-400">
                현재 거리: <span className="font-mono text-sm">{effectiveDistanceKm} km</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {DISTANCE_PRESETS.map((p) => {
                const isSelected = !isCustomDistance && selectedPreset === p.label;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20 font-extrabold'
                        : 'bg-slate-900/80 text-slate-300 border-white/10 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span>{p.label}</span>
                    <span className="text-[10px] font-normal opacity-80">{p.km}km</span>
                  </button>
                );
              })}
            </div>

            {/* Direct Distance Input */}
            <div className="pt-2 border-t border-white/5 flex items-center gap-3">
              <span className="text-xs text-slate-400 whitespace-nowrap">또는 직접 입력:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="200"
                  value={customDistanceInput}
                  onChange={(e) => handleCustomDistanceChange(e.target.value)}
                  placeholder="예: 7.5 또는 42.195"
                  className="w-full pl-3 pr-10 py-1.5 glass-input rounded-xl text-xs font-mono font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  km
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Target Finish Time */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Timer className="w-4 h-4 text-emerald-400" />
                <span>2. 예상 완주 시간 설정 (hh : mm : ss)</span>
              </label>
              <div className="text-xs font-bold text-emerald-400 font-mono">
                총 {totalSeconds > 0 ? formatSecondsToTime(totalSeconds, true) : '00:00:00'} (
                {totalSeconds.toLocaleString()}초)
              </div>
            </div>

            {/* Time Number Inputs */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
              {/* Hours */}
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-center">
                <span className="block text-[11px] text-slate-400 font-medium mb-1">시간 (Hours)</span>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHours((prev) => Math.max(0, prev - 1))}
                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-sm font-bold flex items-center justify-center"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={hours}
                    onChange={(e) => setHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-14 text-center py-1 bg-slate-950/80 border border-white/20 rounded-lg text-lg font-bold font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setHours((prev) => prev + 1)}
                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-sm font-bold flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Minutes */}
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-center">
                <span className="block text-[11px] text-slate-400 font-medium mb-1">분 (Minutes)</span>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustMinutes(-1)}
                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-sm font-bold flex items-center justify-center"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                    className="w-14 text-center py-1 bg-slate-950/80 border border-white/20 rounded-lg text-lg font-bold font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={() => adjustMinutes(1)}
                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-sm font-bold flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Seconds */}
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-center">
                <span className="block text-[11px] text-slate-400 font-medium mb-1">초 (Seconds)</span>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustSeconds(-1)}
                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-sm font-bold flex items-center justify-center"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={seconds}
                    onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                    className="w-14 text-center py-1 bg-slate-950/80 border border-white/20 rounded-lg text-lg font-bold font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={() => adjustSeconds(1)}
                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-sm font-bold flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Adjustment Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 mr-1">빠른 조절:</span>
              <button
                type="button"
                onClick={() => adjustMinutes(-5)}
                className="px-2 py-1 rounded-lg bg-slate-900 text-[11px] font-mono font-medium text-slate-300 hover:bg-slate-800 border border-white/10"
              >
                -5분
              </button>
              <button
                type="button"
                onClick={() => adjustMinutes(-1)}
                className="px-2 py-1 rounded-lg bg-slate-900 text-[11px] font-mono font-medium text-slate-300 hover:bg-slate-800 border border-white/10"
              >
                -1분
              </button>
              <button
                type="button"
                onClick={() => adjustMinutes(1)}
                className="px-2 py-1 rounded-lg bg-slate-900 text-[11px] font-mono font-medium text-slate-300 hover:bg-slate-800 border border-white/10"
              >
                +1분
              </button>
              <button
                type="button"
                onClick={() => adjustMinutes(5)}
                className="px-2 py-1 rounded-lg bg-slate-900 text-[11px] font-mono font-medium text-slate-300 hover:bg-slate-800 border border-white/10"
              >
                +5분
              </button>
              <button
                type="button"
                onClick={() => adjustMinutes(10)}
                className="px-2 py-1 rounded-lg bg-slate-900 text-[11px] font-mono font-medium text-slate-300 hover:bg-slate-800 border border-white/10"
              >
                +10분
              </button>
            </div>

            {/* Popular Distance Time Presets */}
            {TIME_PRESETS_MAP[selectedPreset] && (
              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-emerald-400 font-semibold mr-1">
                  {selectedPreset} 대표 목표치:
                </span>
                {TIME_PRESETS_MAP[selectedPreset].map((tp) => (
                  <button
                    key={tp.label}
                    type="button"
                    onClick={() => {
                      setHours(tp.h);
                      setMinutes(tp.m);
                      setSeconds(tp.s);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all"
                  >
                    {tp.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Primary Calculation Result (Hero Card) */}
          <div className="relative p-5 rounded-2xl bg-gradient-to-br from-cyan-950/80 via-slate-900/90 to-emerald-950/80 border-2 border-cyan-400/50 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Gauge className="w-32 h-32 text-cyan-400" />
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  필요한 평균 페이스
                </span>
                <div className="flex items-baseline gap-2">
                  <div className="text-4xl sm:text-5xl font-black text-white font-athletic tracking-tight">
                    {paceFormatted}
                  </div>
                  <span className="text-base sm:text-lg font-bold text-cyan-300">/ km</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  1km당 <span className="font-bold text-cyan-300">{paceMinutes}분 {paceSecondsRemainder}초</span>의 속도로 달려야 합니다.
                </p>
              </div>

              {/* Quick Stat Pill Highlights */}
              <div className="grid grid-cols-2 gap-2 sm:min-w-[220px]">
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-center">
                  <span className="block text-[10px] text-slate-400">평균 시속</span>
                  <span className="text-base font-bold text-white font-athletic">
                    {speedKmh} <span className="text-xs font-normal text-slate-400">km/h</span>
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-center">
                  <span className="block text-[10px] text-slate-400">마일 페이스</span>
                  <span className="text-base font-bold text-white font-athletic">
                    {paceMileFormatted} <span className="text-xs font-normal text-slate-400">/mi</span>
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-center">
                  <span className="block text-[10px] text-slate-400">400m 트랙 1랩</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {lap400mFormatted}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-center">
                  <span className="block text-[10px] text-slate-400">요구 VDOT</span>
                  <span className="text-xs font-bold text-cyan-300 font-mono">
                    {targetVDOT > 0 ? `VDOT ${targetVDOT.toFixed(1)}` : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* VDOT Comparison Note */}
            {currentVDOT !== undefined && currentVDOT > 0 && targetVDOT > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  내 현재 VDOT ({currentVDOT.toFixed(1)}) 대비:
                </span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-md ${
                    targetVDOT <= currentVDOT
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : targetVDOT <= currentVDOT + 3
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {targetVDOT <= currentVDOT
                    ? '🎯 충분히 달성 가능한 안정권 페이스'
                    : targetVDOT <= currentVDOT + 3
                    ? `🔥 도전적인 목표 (VDOT +${(targetVDOT - currentVDOT).toFixed(1)} 필요)`
                    : `⚠️ 고강도 목표 (충분한 주기화 훈련 필요)`}
                </span>
              </div>
            )}
          </div>

          {/* Section 4: Race Checkpoints Split Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-purple-400" />
                <span>3. 구간별 예상 통과 시간 (Splits)</span>
              </label>

              {/* Strategy Mode Toggle */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setStrategyMode('even')}
                  className={`px-2.5 py-0.5 rounded-lg font-medium transition-all ${
                    strategyMode === 'even'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  이븐 페이스
                </button>
                <button
                  type="button"
                  onClick={() => setStrategyMode('negative')}
                  className={`px-2.5 py-0.5 rounded-lg font-medium transition-all ${
                    strategyMode === 'negative'
                      ? 'bg-purple-500 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  네거티브 스플릿 (후반 가속)
                </button>
              </div>
            </div>

            {/* Split Table */}
            <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/70">
              <div className="max-h-56 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-900/90 sticky top-0 border-b border-white/10 text-slate-400">
                    <tr>
                      <th className="py-2.5 px-3.5 font-semibold">구간 (지점)</th>
                      <th className="py-2.5 px-3.5 font-semibold">구간 페이스</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">누적 경과 시간</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {checkpoints.map((cp, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          cp.isFinish
                            ? 'bg-cyan-500/10 font-bold text-cyan-200'
                            : 'hover:bg-white/5 text-slate-300'
                        }`}
                      >
                        <td className="py-2 px-3.5 flex items-center gap-1.5">
                          {cp.isFinish && <Award className="w-3.5 h-3.5 text-cyan-400" />}
                          <span>{cp.label}</span>
                        </td>
                        <td className="py-2 px-3.5 text-slate-400 font-mono">
                          {strategyMode === 'negative'
                            ? cp.km <= effectiveDistanceKm / 2
                              ? formatPace(paceSecondsPerKm + 3)
                              : formatPace(paceSecondsPerKm - 3)
                            : paceFormatted}
                          /km
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono font-bold text-white">
                          {cp.elapsed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              * 마라톤 대회 실전에서는 5km마다 에너지젤이나 급수대 통과 시간을 고려하여 초반 오버페이스를 방지하는 것이 완주 기록 단축의 핵심입니다.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-bold">복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>계산 결과 복사</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 hover:brightness-110 transition-all cursor-pointer"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
