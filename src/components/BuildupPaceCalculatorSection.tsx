import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Zap,
  Target,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  Info,
  Calendar,
  Layers,
  Flame,
  Clock,
  Compass,
} from 'lucide-react';
import { calculateBuildupWorkout, BuildupPatternType } from '../lib/buildupWorkoutCalculator';
import { formatPace, parseTimeToSeconds } from '../lib/vdot';

interface BuildupPaceCalculatorSectionProps {
  currentVDOT?: number;
}

const DISTANCE_PRESETS = [
  { label: '9km (3+3+3k)', km: 9 },
  { label: '10km (3+3+4k)', km: 10 },
  { label: '12km (4+4+4k)', km: 12 },
  { label: '15km (4+4+4+3k)', km: 15 },
  { label: '8km', km: 8 },
  { label: '6km', km: 6 },
];

const TARGET_PACE_PRESETS = [
  { label: "4'15\"", sec: 255 },
  { label: "4'30\"", sec: 270 },
  { label: "4'45\"", sec: 285 },
  { label: "5'00\"", sec: 300 },
  { label: "5'15\"", sec: 315 },
  { label: "5'30\"", sec: 330 },
];

export const BuildupPaceCalculatorSection: React.FC<BuildupPaceCalculatorSectionProps> = ({
  currentVDOT = 45,
}) => {
  const [pattern, setPattern] = useState<BuildupPatternType>('block_3_4k');
  const [totalKm, setTotalKm] = useState<number>(9);
  const [customKm, setCustomKm] = useState<string>('9');
  const [isCustomKm, setIsCustomKm] = useState<boolean>(false);

  // Target Finish Pace (e.g. 4'30" -> 270s)
  const [targetPaceMin, setTargetPaceMin] = useState<number>(4);
  const [targetPaceSec, setTargetPaceSec] = useState<number>(30);

  // Starting Easy Pace (e.g. 5'30" -> 330s)
  const [startPaceMin, setStartPaceMin] = useState<number>(5);
  const [startPaceSec, setStartPaceSec] = useState<number>(30);

  // Ramp Step (for continuous 1k)
  const [rampStepSec, setRampStepSec] = useState<number>(10);

  // Copy status
  const [copied, setCopied] = useState<boolean>(false);

  const effectiveDistance = isCustomKm ? (parseFloat(customKm) || 9) : totalKm;
  const targetPaceTotalSec = targetPaceMin * 60 + targetPaceSec;
  const startPaceTotalSec = startPaceMin * 60 + startPaceSec;

  const workoutCalculation = useMemo(() => {
    return calculateBuildupWorkout({
      totalDistanceKm: effectiveDistance,
      targetPaceStr: formatPace(targetPaceTotalSec),
      easyPaceSec: startPaceTotalSec,
      marathonPaceSec: Math.round((startPaceTotalSec + targetPaceTotalSec) / 2),
      thresholdPaceSec: targetPaceTotalSec,
      pattern,
      rampSecPerUnit: rampStepSec,
    });
  }, [effectiveDistance, targetPaceTotalSec, startPaceTotalSec, pattern, rampStepSec]);

  const handleCopy = () => {
    const lapsText = workoutCalculation.laps
      .map((l) => `  - ${l.distanceLabel}: ${l.targetPaceStr}/km (${l.description})`)
      .join('\n');

    const text = `[PaceMaster 포인트 빌드업주 계획표]
📌 방식: ${workoutCalculation.patternName}
🏁 총 거리: ${workoutCalculation.totalDistanceKm}km
⚡ 페이스 전개: ${workoutCalculation.targetPaceRangeStr}
💡 훈련 공식: ${workoutCalculation.summaryFormula}

[구간별 세부 계획]
${workoutCalculation.stages.map((s, i) => `${i + 1}. ${s.step} | ${s.pace}/km (${s.zone}) - ${s.focus}`).join('\n')}

[1km 단위 시계 랩 체크리스트]
${lapsText}

💪 코칭 팁: ${workoutCalculation.coachingGuidance}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Pattern Selector Tabs (User Request: 3~4k 단위 vs 1k/400m 지속 빌드업) */}
      <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-rose-50 dark:from-stone-850 dark:to-stone-800 border border-amber-300 dark:border-amber-700/60 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-amber-700 dark:text-amber-400" />
            <span>빌드업주(Progression Run) 방식 선택</span>
          </label>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 font-bold">
            포인트 훈련 특화
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setPattern('block_3_4k')}
            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
              pattern === 'block_3_4k'
                ? 'bg-white dark:bg-stone-800 border-amber-500 ring-2 ring-amber-400/50 text-stone-900 dark:text-white shadow-xs font-bold'
                : 'bg-white/60 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-amber-900 dark:text-amber-300">
                1. 3~4k 단위 블록 빌드업
              </span>
              {pattern === 'block_3_4k' && <Check className="w-4 h-4 text-amber-600" />}
            </div>
            <div className="text-[11px] text-stone-700 dark:text-stone-200 mt-1 font-semibold">
              예: 3k 5'30 + 3k 5'00 + 3k 4'30
            </div>
            <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
              Zone 2 이지 ➡️ Zone 3 MP ➡️ Zone 4 역치
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPattern('continuous_1k')}
            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
              pattern === 'continuous_1k'
                ? 'bg-white dark:bg-stone-800 border-amber-500 ring-2 ring-amber-400/50 text-stone-900 dark:text-white shadow-xs font-bold'
                : 'bg-white/60 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-amber-900 dark:text-amber-300">
                2. 1k 단위 지속 빌드업
              </span>
              {pattern === 'continuous_1k' && <Check className="w-4 h-4 text-amber-600" />}
            </div>
            <div className="text-[11px] text-stone-700 dark:text-stone-200 mt-1 font-semibold">
              예: 1k마다 10초씩 가속
            </div>
            <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
              타겟 페이스까지 매 1km 랩마다 정밀 단축
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPattern('continuous_400m')}
            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
              pattern === 'continuous_400m'
                ? 'bg-white dark:bg-stone-800 border-amber-500 ring-2 ring-amber-400/50 text-stone-900 dark:text-white shadow-xs font-bold'
                : 'bg-white/60 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-amber-900 dark:text-amber-300">
                3. 400m 트랙 지속 빌드업
              </span>
              {pattern === 'continuous_400m' && <Check className="w-4 h-4 text-amber-600" />}
            </div>
            <div className="text-[11px] text-stone-700 dark:text-stone-200 mt-1 font-semibold">
              예: 400m 랩마다 2~3초 가속
            </div>
            <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
              우레탄 트랙 바퀴별 랩타임 페이싱
            </div>
          </button>
        </div>
      </div>

      {/* Inputs: Distance & Paces */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Distance Selector */}
        <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-750 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>총 빌드업 거리</span>
            </label>
            <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 font-mono">
              {effectiveDistance} km
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {DISTANCE_PRESETS.map((d) => (
              <button
                key={d.km}
                type="button"
                onClick={() => {
                  setTotalKm(d.km);
                  setIsCustomKm(false);
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  !isCustomKm && totalKm === d.km
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-emerald-400'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="pt-1 flex items-center gap-2">
            <span className="text-[11px] text-stone-500 whitespace-nowrap">직접 입력:</span>
            <input
              type="number"
              min="3"
              max="42"
              step="0.5"
              value={customKm}
              onChange={(e) => {
                setCustomKm(e.target.value);
                setIsCustomKm(true);
              }}
              className="w-20 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
            />
            <span className="text-xs text-stone-500 font-mono">km</span>
          </div>
        </div>

        {/* Pace Controls */}
        <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-750 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
              <span>최종 타겟 피니시 페이스</span>
            </label>
            <span className="text-xs font-black text-rose-900 dark:text-rose-300 font-mono">
              {formatPace(targetPaceTotalSec)}/km
            </span>
          </div>

          <div className="grid grid-cols-6 gap-1">
            {TARGET_PACE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setTargetPaceMin(Math.floor(p.sec / 60));
                  setTargetPaceSec(p.sec % 60);
                }}
                className={`py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                  targetPaceTotalSec === p.sec
                    ? 'bg-rose-800 text-white border-rose-800 shadow-xs'
                    : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-rose-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="pt-1 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-stone-500">출발 이지 페이스:</span>
              <select
                value={startPaceTotalSec}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setStartPaceMin(Math.floor(val / 60));
                  setStartPaceSec(val % 60);
                }}
                className="px-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
              >
                <option value={360}>6'00"</option>
                <option value={345}>5'45"</option>
                <option value={330}>5'30"</option>
                <option value={315}>5'15"</option>
                <option value={300}>5'00"</option>
              </select>
            </div>

            {pattern === 'continuous_1k' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-stone-500">1k당 가속폭:</span>
                <select
                  value={rampStepSec}
                  onChange={(e) => setRampStepSec(parseInt(e.target.value, 10))}
                  className="px-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
                >
                  <option value={5}>5초/km</option>
                  <option value={8}>8초/km</option>
                  <option value={10}>10초/km (추천)</option>
                  <option value={15}>15초/km</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Highlighted Result Hero Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-emerald-500/10 border-2 border-amber-500/40 dark:border-amber-600/40 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse" />
            <span className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider">
              {workoutCalculation.patternName} 산출 결과
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white font-athletic">
            {workoutCalculation.summaryFormula}
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 max-w-xl">
            {workoutCalculation.description}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer whitespace-nowrap self-start sm:self-center"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? '복사 완료!' : '훈련 계획 복사'}</span>
        </button>
      </div>

      {/* Stage Progression Cards */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-amber-600" />
          <span>구간별 페이스 & 심박존 전개 가이드</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {workoutCalculation.stages.map((stg, sIdx) => (
            <div
              key={sIdx}
              className="p-3.5 rounded-xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-750 shadow-2xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-stone-900 dark:text-white">
                  {stg.step}
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  {stg.pace}/km
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-stone-500">
                <span className="font-semibold text-rose-800 dark:text-rose-400">{stg.zone}</span>
                <span>{stg.distanceKm}km 구간</span>
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-400 border-t border-stone-100 dark:border-stone-800 pt-1.5 leading-snug">
                {stg.focus}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 1km by 1km Lap Checklist Table */}
      <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-750 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>시계 랩 알림 체크리스트 ({workoutCalculation.laps.length}개 랩)</span>
          </h4>
          <span className="text-[10px] text-stone-500">
            시계 오토랩 알림 기준
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
          {workoutCalculation.laps.map((lap) => (
            <div
              key={lap.lapIndex}
              className="p-2 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs flex items-center justify-between gap-1 shadow-2xs"
            >
              <span className="font-bold text-stone-800 dark:text-stone-200 text-[11px]">
                {lap.distanceLabel}
              </span>
              <span className="font-mono font-black text-rose-900 dark:text-rose-300 text-xs">
                {lap.targetPaceStr}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Sports Science Coaching Tip */}
      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-950 dark:text-emerald-200">
        <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-bold">스포츠 사이언스 빌드업 원리: </strong>
          {workoutCalculation.coachingGuidance}
        </div>
      </div>
    </div>
  );
};
