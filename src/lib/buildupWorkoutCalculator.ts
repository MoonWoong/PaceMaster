import { WorkoutStage } from '../types';
import { formatPace, parseTimeToSeconds } from './vdot';

export type BuildupPatternType = 'block_3_4k' | 'continuous_1k' | 'continuous_400m';

export interface BuildupLapItem {
  lapIndex: number;
  distanceLabel: string;
  cumulativeDistKm: number;
  targetPaceStr: string;
  targetPaceSec: number;
  zone: string;
  description: string;
}

export interface BuildupWorkoutCalculation {
  pattern: BuildupPatternType;
  patternName: string;
  totalDistanceKm: number;
  startPaceStr: string;
  finishPaceStr: string;
  targetPaceRangeStr: string;
  targetZoneStr: string;
  summaryFormula: string;
  description: string;
  stages: WorkoutStage[];
  laps: BuildupLapItem[];
  coachingGuidance: string;
}

export interface BuildupCalculationOptions {
  totalDistanceKm?: number;
  targetPaceStr?: string; // e.g. "4'30\""
  currentVdot?: number;
  easyPaceSec?: number; // e.g. 330 (5'30")
  marathonPaceSec?: number; // e.g. 300 (5'00")
  thresholdPaceSec?: number; // e.g. 270 (4'30")
  pattern?: BuildupPatternType;
  rampSecPerUnit?: number; // e.g. 10s per 1k or 2~3s per 400m
}

/**
 * Helper to parse pace string (e.g. 5'30" or 05:30) to seconds per km
 */
export function paceStringToSec(pace?: string, fallbackSec: number = 300): number {
  if (!pace) return fallbackSec;
  const clean = pace.trim();
  if (clean.includes(':')) {
    const sec = parseTimeToSeconds(clean);
    return sec > 0 ? sec : fallbackSec;
  }
  const parts = clean.split("'");
  if (parts.length >= 2) {
    const min = parseInt(parts[0], 10) || 0;
    const s = parseInt(parts[1].replace('"', ''), 10) || 0;
    return min * 60 + s > 0 ? min * 60 + s : fallbackSec;
  }
  return fallbackSec;
}

/**
 * Core Buildup Progression Calculator
 * Supports:
 *  1. 3~4k 단위 블록 빌드업 (예: 3k 5'30" + 3k 5'00" + 3k 4'30")
 *  2. 1k 단위 지속 빌드업 (예: target pace까지 1k마다 5~10초씩 가속)
 *  3. 400m 트랙 단위 지속 빌드업 (예: 400m마다 2~3초씩 페이스 올리기)
 */
export function calculateBuildupWorkout(options: BuildupCalculationOptions): BuildupWorkoutCalculation {
  const {
    totalDistanceKm = 10,
    targetPaceStr,
    easyPaceSec = 330, // 5'30"
    marathonPaceSec = 300, // 5'00"
    thresholdPaceSec = 270, // 4'30"
    pattern = 'block_3_4k',
    rampSecPerUnit,
  } = options;

  const effectiveDist = Math.max(3, Math.min(35, Math.round(totalDistanceKm * 10) / 10));

  // Determine final target finish pace
  let finalTargetSec = thresholdPaceSec;
  if (targetPaceStr) {
    const parsed = paceStringToSec(targetPaceStr, thresholdPaceSec);
    if (parsed > 0) {
      finalTargetSec = parsed;
    }
  }

  // Ensure logical hierarchy: easy > marathon > threshold/target
  let rawEasy = Math.max(easyPaceSec, marathonPaceSec + 15, finalTargetSec + 40);
  let rawMedium = Math.max(marathonPaceSec, finalTargetSec + 15);
  let rawFinish = finalTargetSec;

  if (rawFinish >= rawEasy) {
    rawEasy = rawFinish + 60;
    rawMedium = rawFinish + 30;
  } else if (rawFinish >= rawMedium) {
    rawMedium = Math.round((rawEasy + rawFinish) / 2);
  }

  // -------------------------------------------------------------
  // Mode 1: 3~4k 단위 블록 빌드업 (Block Progression)
  // 예: 3k 5'30" + 3k 5'00" + 3k 4'30" (9km)
  // 예: 3k 5'30" + 3k 5'00" + 4k 4'30" (10km)
  // 예: 4k 5'30" + 4k 5'00" + 4k 4'30" (12km)
  // -------------------------------------------------------------
  if (pattern === 'block_3_4k') {
    // Determine block distribution based on total distance
    let blockSizes: number[] = [];
    if (effectiveDist <= 7.2) {
      // Short distance (e.g. 6~7km): 2km + 2km + 2km
      const part = Math.max(2, Math.round((effectiveDist / 3) * 10) / 10);
      blockSizes = [part, part, Math.round((effectiveDist - part * 2) * 10) / 10];
    } else if (effectiveDist > 7.2 && effectiveDist < 8.6) {
      // 7.3~8.5km: 2.5k or 3k units (e.g. 2.5k + 2.5k + 2.3k or 3k + 3k + 2.5k)
      if (Math.abs(effectiveDist - 8.5) < 0.3) {
        blockSizes = [3, 3, 2.5];
      } else if (Math.abs(effectiveDist - 8) < 0.3) {
        blockSizes = [2.5, 2.5, 3];
      } else {
        const b1 = 2.5;
        const b2 = 2.5;
        blockSizes = [b1, b2, Math.round((effectiveDist - 5) * 10) / 10];
      }
    } else if (effectiveDist >= 8.6 && effectiveDist <= 11.5) {
      // Standard 9~11km: 3k or 4k units
      if (Math.abs(effectiveDist - 9) < 0.3) {
        blockSizes = [3, 3, 3];
      } else if (Math.abs(effectiveDist - 10) < 0.3) {
        blockSizes = [3, 3, 4];
      } else if (Math.abs(effectiveDist - 11) < 0.3) {
        blockSizes = [3, 4, 4];
      } else {
        const b1 = 3;
        const b2 = 3;
        const b3 = Math.round((effectiveDist - b1 - b2) * 10) / 10;
        blockSizes = [b1, b2, b3];
      }
    } else if (effectiveDist > 11.5 && effectiveDist <= 14.5) {
      // 12~14km: 4k~5k units
      if (Math.abs(effectiveDist - 12) < 0.3) {
        blockSizes = [4, 4, 4];
      } else if (Math.abs(effectiveDist - 13) < 0.3) {
        blockSizes = [4, 4, 5];
      } else if (Math.abs(effectiveDist - 14) < 0.3) {
        blockSizes = [4, 5, 5];
      } else {
        const b1 = 4;
        const b2 = Math.round(((effectiveDist - 4) / 2) * 10) / 10;
        const b3 = Math.round((effectiveDist - b1 - b2) * 10) / 10;
        blockSizes = [b1, b2, b3];
      }
    } else if (effectiveDist >= 15 && effectiveDist <= 18) {
      // 15~18km: 4 stages (e.g. 4k + 4k + 4k + 3k)
      const b1 = 4;
      const b2 = 4;
      const b3 = 4;
      const b4 = Math.round((effectiveDist - 12) * 10) / 10;
      blockSizes = [b1, b2, b3, b4];
    } else {
      // Long runs (20km+): 3 large blocks
      const part = Math.floor(effectiveDist / 3);
      blockSizes = [part, part, Math.round((effectiveDist - part * 2) * 10) / 10];
    }

    const numBlocks = blockSizes.length;
    const stages: WorkoutStage[] = [];
    const laps: BuildupLapItem[] = [];

    let currentKm = 0;
    const blockPaces = numBlocks === 4
      ? [
          { paceSec: rawEasy, zone: 'Zone 2 (출발)', name: '워밍업 & 초반 이지' },
          { paceSec: Math.round(rawEasy - (rawEasy - rawMedium) * 0.6), zone: 'Zone 2~3 (순항)', name: '유산소 순항' },
          { paceSec: rawMedium, zone: 'Zone 3 (마라톤)', name: '목표 M-페이스' },
          { paceSec: rawFinish, zone: 'Zone 4 (역치/피니시)', name: '역치 스피드 피니시' },
        ]
      : [
          { paceSec: rawEasy, zone: 'Zone 2 (출발)', name: '워밍업 & 초반 이지' },
          { paceSec: rawMedium, zone: 'Zone 3 (순항)', name: '목표 M-페이스 순항' },
          { paceSec: rawFinish, zone: 'Zone 4 (피니시)', name: '역치/타겟 스피드 피니시' },
        ];

    blockSizes.forEach((dist, idx) => {
      const pInfo = blockPaces[idx];
      const startDist = Math.round(currentKm * 10) / 10;
      currentKm += dist;
      const endDist = Math.round(currentKm * 10) / 10;
      const paceFormatted = formatPace(pInfo.paceSec);

      stages.push({
        step: `${idx + 1}구간: ${dist}km (${startDist}~${endDist}km)`,
        distanceKm: dist,
        pace: paceFormatted,
        zone: pInfo.zone,
        focus:
          idx === 0
            ? `편안한 이지 페이스(${paceFormatted})로 심폐와 관절을 부드럽게 웜업하고 일정한 러닝 폼 세팅`
            : idx === numBlocks - 1
            ? `실전 목표/역치 페이스(${paceFormatted})로 마지막까지 무너지지 않고 강한 팔치기로 피니시`
            : `호흡을 가다듬고 마라톤 목표 유산소 정속 페이스(${paceFormatted})로 리드미컬하게 순항`,
      });

      // Populate km lap breakdown
      for (let k = 1; k <= Math.round(dist); k++) {
        const lapKm = laps.length + 1;
        laps.push({
          lapIndex: lapKm,
          distanceLabel: `${lapKm}km`,
          cumulativeDistKm: lapKm,
          targetPaceStr: paceFormatted,
          targetPaceSec: pInfo.paceSec,
          zone: pInfo.zone,
          description: `${idx + 1}구간 (${pInfo.name})`,
        });
      }
    });

    const formulaParts = blockSizes.map((d, i) => `${d}k ${formatPace(blockPaces[i].paceSec)}`);
    const summaryFormula = formulaParts.join(' + ');

    return {
      pattern: 'block_3_4k',
      patternName: '3~4k 단위 블록 빌드업',
      totalDistanceKm: effectiveDist,
      startPaceStr: stages[0].pace,
      finishPaceStr: stages[stages.length - 1].pace,
      targetPaceRangeStr: `${stages[0].pace} ➡️ ${stages[stages.length - 1].pace}`,
      targetZoneStr: 'Zone 2 ➡️ Zone 4',
      summaryFormula,
      description: `총 ${effectiveDist}km를 3~4k 단위(${summaryFormula})로 나누어 점진적으로 가속합니다. 후반부 심박 상승과 근피로 속에서도 목표 페이스를 안정적으로 뽑아내는 레이스 페이스 인내력을 길러줍니다.`,
      stages,
      laps,
      coachingGuidance:
        '초반 1구간(Zone 2)에서 절대 서두르지 마세요. 1~2구간에서 체력과 글리코겐을 아껴두어야 마지막 3구간(Zone 4 역치)에서 완벽한 네거티브 스플릿 피니시를 달성할 수 있습니다.',
    };
  }

  // -------------------------------------------------------------
  // Mode 2: 1k 단위 지속 빌드업 (Continuous 1km Step-Down)
  // 예: target pace까지 1k마다 5~10초씩 페이스 올리기
  // 예: 9km with target 4'30" -> 1k 5'30", 2k 5'20", 3k 5'10", ..., 7~9k 4'30"
  // -------------------------------------------------------------
  if (pattern === 'continuous_1k') {
    const totalKmInt = Math.max(3, Math.round(effectiveDist));
    const stepSec = rampSecPerUnit && rampSecPerUnit > 0 ? rampSecPerUnit : 10; // 기본 1k마다 10초씩

    // Work backwards or forward: ensure finish reaches target pace
    const laps: BuildupLapItem[] = [];
    // Number of acceleration steps up to target
    // Starting pace = targetPace + (steps * stepSec)
    const maxSteps = Math.min(totalKmInt - 1, 8);
    const startSec = Math.min(rawEasy + 15, finalTargetSec + maxSteps * stepSec);

    for (let k = 1; k <= totalKmInt; k++) {
      let currentPaceSec: number;
      if (k <= maxSteps) {
        currentPaceSec = startSec - (k - 1) * stepSec;
      } else {
        // Holding at target pace or pushing last 1~2km strong
        const remaining = totalKmInt - k;
        currentPaceSec = remaining === 0 ? Math.max(210, finalTargetSec - 5) : finalTargetSec;
      }

      const ratio = currentPaceSec <= finalTargetSec ? 0.9 : currentPaceSec <= rawMedium ? 0.8 : 0.7;
      const zoneLabel =
        ratio >= 0.88 ? 'Zone 4 (역치)' : ratio >= 0.78 ? 'Zone 3 (템포)' : 'Zone 2 (유산소)';

      laps.push({
        lapIndex: k,
        distanceLabel: `${k}km`,
        cumulativeDistKm: k,
        targetPaceStr: formatPace(currentPaceSec),
        targetPaceSec: currentPaceSec,
        zone: zoneLabel,
        description:
          k === 1
            ? '출발 웜업 1km'
            : currentPaceSec <= finalTargetSec
            ? `실전 목표 페이스(${formatPace(finalTargetSec)}) 도달 & 유지`
            : `1km당 ${stepSec}초 가속`,
      });
    }

    // Synthesize into 3~4 representative stage phases for UI consistency
    const p1Km = Math.max(1, Math.floor(totalKmInt * 0.35));
    const p2Km = Math.max(1, Math.floor(totalKmInt * 0.35));
    const p3Km = totalKmInt - p1Km - p2Km;

    const stages: WorkoutStage[] = [
      {
        step: `초반 가속 단계 (1 ~ ${p1Km}km)`,
        distanceKm: p1Km,
        pace: `${laps[0].targetPaceStr} ➡️ ${laps[p1Km - 1].targetPaceStr}`,
        zone: 'Zone 2 ➡️ Zone 3',
        focus: `매 1km마다 ${stepSec}초씩 페이스를 당기며 체온 상승 및 러닝 리듬 조율`,
      },
      {
        step: `중반 순항 빌드업 (${p1Km + 1} ~ ${p1Km + p2Km}km)`,
        distanceKm: p2Km,
        pace: `${laps[p1Km].targetPaceStr} ➡️ ${laps[p1Km + p2Km - 1].targetPaceStr}`,
        zone: 'Zone 3 (마라톤 페이스)',
        focus: `호흡을 깊게 유지하며 목표 페이스 근접 구간까지 안정적 가속 지속`,
      },
      {
        step: `후반 타겟 피니시 (${p1Km + p2Km + 1} ~ ${totalKmInt}km)`,
        distanceKm: p3Km,
        pace: `${laps[p1Km + p2Km].targetPaceStr} ➡️ ${laps[totalKmInt - 1].targetPaceStr}`,
        zone: 'Zone 4 (역치/타겟)',
        focus: `최종 목표 페이스(${formatPace(finalTargetSec)}) 완벽 도달 및 마지막 km 피니시 스퍼트`,
      },
    ];

    const startPace = laps[0].targetPaceStr;
    const finishPace = laps[laps.length - 1].targetPaceStr;
    const summaryFormula = `1k마다 ${stepSec}초씩 빌드업 (출발 ${startPace} ➡️ 피니시 ${finishPace})`;

    return {
      pattern: 'continuous_1k',
      patternName: '1k 단위 지속 빌드업',
      totalDistanceKm: effectiveDist,
      startPaceStr: startPace,
      finishPaceStr: finishPace,
      targetPaceRangeStr: `${startPace} ➡️ ${finishPace}`,
      targetZoneStr: 'Zone 2 ➡️ Zone 4',
      summaryFormula,
      description: `총 ${effectiveDist}km를 달리는 동안 매 1km마다 ${stepSec}초씩 페이스를 올려 최종 ${finishPace}까지 가속하는 정밀 지속 빌드업주입니다. 시계 랩 알림마다 10초씩 빠르게 뛰는 감각을 체화합니다.`,
      stages,
      laps,
      coachingGuidance:
        `GPS 시계의 1km 오토랩 기능을 켜고 매 1km마다 정확히 -${stepSec}초씩 당기는 페이스 제어 훈련입니다. 초반에 흥분하여 급가속하지 않고 정밀하게 10초씩 깎아나가는 멘탈 컨트롤이 핵심입니다.`,
    };
  }

  // -------------------------------------------------------------
  // Mode 3: 400m 트랙 단위 지속 빌드업 (Track Lap Progression)
  // 예: 400m마다 2~3초씩 페이스 올리기 (트랙 훈련 특화)
  // -------------------------------------------------------------
  const totalLaps = Math.max(8, Math.min(30, Math.round((effectiveDist * 1000) / 400)));
  const trackDistKm = Math.round(((totalLaps * 400) / 1000) * 10) / 10;
  const stepPer400m = rampSecPerUnit && rampSecPerUnit > 0 ? rampSecPerUnit : 2; // 400m당 2초씩

  const laps: BuildupLapItem[] = [];
  const startSec400 = Math.min(rawEasy, finalTargetSec + Math.min(totalLaps - 1, 12) * stepPer400m);

  for (let l = 1; l <= totalLaps; l++) {
    const currentPaceSec = Math.max(finalTargetSec - 10, startSec400 - (l - 1) * stepPer400m);
    const lapTimeSec = Math.round((currentPaceSec * 0.4) * 10) / 10;
    const lapTimeFormatted = `${Math.floor(lapTimeSec / 60)}분 ${Math.round(lapTimeSec % 60)}초`;

    laps.push({
      lapIndex: l,
      distanceLabel: `트랙 ${l}바퀴 (${l * 400}m)`,
      cumulativeDistKm: Math.round(((l * 400) / 1000) * 10) / 10,
      targetPaceStr: formatPace(currentPaceSec),
      targetPaceSec: currentPaceSec,
      zone: currentPaceSec <= finalTargetSec ? 'Zone 4~5' : 'Zone 2~3',
      description: `바퀴당 소요: ${lapTimeFormatted} (400m당 -${stepPer400m}초 가속)`,
    });
  }

  const stages: WorkoutStage[] = [
    {
      step: `초반 적응 (1 ~ 4바퀴, 1.6km)`,
      distanceKm: 1.6,
      pace: `${laps[0].targetPaceStr} ➡️ ${laps[3].targetPaceStr}`,
      zone: 'Zone 2',
      focus: '트랙 1레인에서 부드러운 케이던스 세팅 및 체온 상승',
    },
    {
      step: `중반 빌드업 (5 ~ ${totalLaps - 4}바퀴)`,
      distanceKm: Math.round(((totalLaps - 8) * 0.4) * 10) / 10,
      pace: `${laps[4].targetPaceStr} ➡️ ${laps[totalLaps - 5].targetPaceStr}`,
      zone: 'Zone 3 (순항 가속)',
      focus: '코너링과 직선 주로에서 400m마다 2초씩 일정하게 당기기',
    },
    {
      step: `후반 타겟 질주 (${totalLaps - 3} ~ ${totalLaps}바퀴, 1.6km)`,
      distanceKm: 1.6,
      pace: `${laps[totalLaps - 4].targetPaceStr} ➡️ ${laps[totalLaps - 1].targetPaceStr}`,
      zone: 'Zone 4~5 (스피드 피니시)',
      focus: `목표 페이스(${formatPace(finalTargetSec)}) 완주 및 마지막 바퀴 스피드 스퍼트`,
    },
  ];

  const startPace = laps[0].targetPaceStr;
  const finishPace = laps[laps.length - 1].targetPaceStr;
  const summaryFormula = `400m 트랙마다 ${stepPer400m}초 가속 (${totalLaps}바퀴, ${trackDistKm}km)`;

  return {
    pattern: 'continuous_400m',
    patternName: '400m 트랙 단위 지속 빌드업',
    totalDistanceKm: trackDistKm,
    startPaceStr: startPace,
    finishPaceStr: finishPace,
    targetPaceRangeStr: `${startPace} ➡️ ${finishPace}`,
    targetZoneStr: 'Zone 2 ➡️ Zone 5',
    summaryFormula,
    description: `400m 우레탄 트랙에서 바퀴(400m)마다 약 ${stepPer400m}초씩 페이스를 당겨 총 ${totalLaps}바퀴(${trackDistKm}km)를 달리는 초정밀 트랙 빌드업입니다.`,
    stages,
    laps,
    coachingGuidance:
      '트랙의 100m, 200m 마크를 통과할 때마다 시계를 확인하며 감각적으로 페이스를 제어하세요. 직선에서는 부드럽게 밀고, 코너에서는 팔치기로 리듬을 유지합니다.',
  };
}
