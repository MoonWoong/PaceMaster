/**
 * Jack Daniels' VDOT & Running Physiology Utilities
 * Accurate running math: Jack Daniels' Running Formula, Karvonen / LTHR Heart Rate Zones,
 * and Training Pace conversions.
 */

// Helper to convert hh:mm:ss or mm:ss string into total seconds
export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr || !timeStr.trim()) return 0;
  const parts = timeStr.trim().split(':').map((p) => parseFloat(p) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

// Helper to parse pace strings like "4'15\"", "4'15", "4:15", "4'15\"/km" into seconds
export function parsePaceToSeconds(paceStr: string): number {
  if (!paceStr || !paceStr.trim()) return 0;
  const clean = paceStr.replace('/km', '').replace(/["'\s]/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');
  const parts = clean.split(':').map((p) => parseFloat(p) || 0);
  if (parts.length >= 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1 && parts[0] > 0) {
    return parts[0] * 60;
  }
  return parseTimeToSeconds(paceStr);
}

// Convert seconds into hh:mm:ss or mm:ss string
export function formatSecondsToTime(totalSeconds: number, includeHours = false): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return '--:--';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0 || includeHours) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

// Format seconds per kilometer into min'sec"/km e.g. "4'32\""
// 내림(floor) 처리하여 5'60"와 같이 60초가 출력되는 오류를 방지하고 정확한 5'59" 페이스를 보장
export function formatPace(secondsPerKm: number): string {
  if (isNaN(secondsPerKm) || secondsPerKm <= 0 || secondsPerKm > 1800) return "-'--\"";
  const totalSec = Math.floor(secondsPerKm);
  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.min(59, totalSec % 60);
  return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
}

/**
 * Calculate Jack Daniels' VDOT given race distance (meters) and race duration (seconds)
 */
export function calculateVDOT(distanceMeters: number, timeSeconds: number): number {
  if (distanceMeters <= 0 || timeSeconds <= 0) return 0;

  const t = timeSeconds / 60; // time in minutes
  const v = distanceMeters / t; // velocity in meters per minute

  // Fraction of VO2max sustainable for duration t
  const percentVO2max =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * t) +
    0.2989558 * Math.exp(-0.1932605 * t);

  // Oxygen cost of running at velocity v (VO2 ml/kg/min)
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * Math.pow(v, 2);

  const vdot = vo2 / percentVO2max;
  return Math.round(vdot * 10) / 10;
}

/**
 * Estimate VDOT from the best of available PB records
 */
export function estimateBestVDOT(records: {
  pb5k?: string;
  pb10k?: string;
  pbHalf?: string;
  pbFull?: string;
}): { vdot: number; bestDistance: string } {
  let maxVdot = 0;
  let bestDist = '미등록';

  const distances = [
    { label: '5K', dist: 5000, time: records.pb5k },
    { label: '10K', dist: 10000, time: records.pb10k },
    { label: '하프', dist: 21097.5, time: records.pbHalf },
    { label: '풀코스', dist: 42195, time: records.pbFull },
  ];

  for (const item of distances) {
    if (item.time) {
      const sec = parseTimeToSeconds(item.time);
      if (sec > 0) {
        const v = calculateVDOT(item.dist, sec);
        if (v > maxVdot) {
          maxVdot = v;
          bestDist = item.label;
        }
      }
    }
  }

  return { vdot: maxVdot, bestDistance: bestDist };
}

/**
 * Calculate velocity (m/min) at a given percentage of VO2max for a specific VDOT
 * Uses quadratic formula: 0.000104*v^2 + 0.182258*v - (targetVO2 + 4.60) = 0
 */
function getVelocityForVO2(targetVO2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -(targetVO2 + 4.6);
  // Quadratic root
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return 0;
  return (-b + Math.sqrt(discriminant)) / (2 * a);
}

/**
 * Training Paces based on VDOT (Jack Daniels Running Formula)
 */
export interface TrainingPaces {
  easyPaceRange: { min: string; max: string; rawMinSec: number; rawMaxSec: number };
  marathonPace: { pace: string; rawSec: number };
  thresholdPace: { pace: string; rawSec: number };
  intervalPace: { pace: string; rawSec: number };
  repetitionPace: { pace: string; rawSec: number };
}

export function getTrainingPaces(vdot: number): TrainingPaces | null {
  if (vdot < 25 || vdot > 85) return null;

  // Easy (E-Pace): 
  // Jack Daniels Running Formula specifies Easy pace as conversational aerobic running.
  // For VDOT 46.2, fast easy pace is ~5'30" (steady aerobic/zone 2) and slow easy/recovery is ~6'50" (light recovery/warm-up).
  // Corresponding to ~53% (slow easy/recovery) up to ~69% (aerobic steady easy) VO2max:
  const vEasySlow = getVelocityForVO2(vdot * 0.53);
  const vEasyFast = getVelocityForVO2(vdot * 0.69);
  // Marathon: ~82% VO2max
  const vMarathon = getVelocityForVO2(vdot * 0.82);
  // Threshold: ~88% VO2max
  const vThreshold = getVelocityForVO2(vdot * 0.88);
  // Interval: ~98% VO2max
  const vInterval = getVelocityForVO2(vdot * 0.98);
  // Repetition: ~105% VO2max
  const vRepetition = getVelocityForVO2(vdot * 1.05);

  const toSecPerKm = (v: number) => (v > 0 ? (1000 / v) * 60 : 0);

  const eSlowSec = toSecPerKm(vEasySlow);
  const eFastSec = toSecPerKm(vEasyFast);
  const mSec = toSecPerKm(vMarathon);
  const tSec = toSecPerKm(vThreshold);
  const iSec = toSecPerKm(vInterval);
  const rSec = toSecPerKm(vRepetition);

  return {
    easyPaceRange: {
      min: formatPace(eFastSec),
      max: formatPace(eSlowSec),
      rawMinSec: eFastSec,
      rawMaxSec: eSlowSec,
    },
    marathonPace: { pace: formatPace(mSec), rawSec: mSec },
    thresholdPace: { pace: formatPace(tSec), rawSec: tSec },
    intervalPace: { pace: formatPace(iSec), rawSec: iSec },
    repetitionPace: { pace: formatPace(rSec), rawSec: rSec },
  };
}

/**
 * Heart Rate Zones calculation based on Max HR & Lactate Threshold HR (LTHR)
 */
export interface HeartRateZone {
  zone: number;
  name: string;
  nameKo: string;
  minHr: number;
  maxHr: number;
  pctRange: string;
  purpose: string;
  color: string;
}

export function calculateHeartRateZones(maxHr: number, thresholdHr?: number): HeartRateZone[] {
  const effectiveMax = maxHr > 120 ? maxHr : 185;

  if (thresholdHr && thresholdHr > 100 && thresholdHr < effectiveMax) {
    // LTHR-based zones (Joe Friel model)
    return [
      {
        zone: 1,
        name: 'Active Recovery',
        nameKo: '회복 (Zone 1)',
        minHr: Math.round(thresholdHr * 0.65),
        maxHr: Math.round(thresholdHr * 0.81),
        pctRange: '< 81% LTHR',
        purpose: '혈류 촉진, 피로 회복, 워밍업 및 쿨다운',
        color: '#60a5fa', // Blue
      },
      {
        zone: 2,
        name: 'Aerobic Base',
        nameKo: '유산소 기초 (Zone 2)',
        minHr: Math.round(thresholdHr * 0.82),
        maxHr: Math.round(thresholdHr * 0.89),
        pctRange: '82 - 89% LTHR',
        purpose: '지방 산화 극대화, 모세혈관 발달, 마라톤 지구력의 핵심',
        color: '#34d399', // Emerald
      },
      {
        zone: 3,
        name: 'Tempo',
        nameKo: '템포 / 유산소 강화 (Zone 3)',
        minHr: Math.round(thresholdHr * 0.9),
        maxHr: Math.round(thresholdHr * 0.93),
        pctRange: '90 - 93% LTHR',
        purpose: '마라톤 페이스 적응, 글리코겐 지속 능력 강화',
        color: '#fbbf24', // Amber
      },
      {
        zone: 4,
        name: 'Lactate Threshold',
        nameKo: '젖산 역치 (Zone 4)',
        minHr: Math.round(thresholdHr * 0.94),
        maxHr: Math.round(thresholdHr * 0.99),
        pctRange: '94 - 99% LTHR',
        purpose: '젖산 분해 능력 향상, 10K~하프 스피드 지구력 향상',
        color: '#f97316', // Orange
      },
      {
        zone: 5,
        name: 'Anaerobic / VO2max',
        nameKo: '무산소·최대산소섭취 (Zone 5)',
        minHr: Math.round(thresholdHr * 1.0),
        maxHr: effectiveMax,
        pctRange: '100%+ LTHR',
        purpose: '최대 유산소 파워, 스피드 및 질주력 극대화',
        color: '#ef4444', // Red
      },
    ];
  }

  // Standard % of Max HR model
  return [
    {
      zone: 1,
      name: 'Active Recovery',
      nameKo: '회복 (Zone 1)',
      minHr: Math.round(effectiveMax * 0.5),
      maxHr: Math.round(effectiveMax * 0.6),
      pctRange: '50 - 60% Max HR',
      purpose: '혈류 촉진, 피로 회복, 가벼운 조깅',
      color: '#60a5fa',
    },
    {
      zone: 2,
      name: 'Aerobic Endurance',
      nameKo: '유산소 기초 (Zone 2)',
      minHr: Math.round(effectiveMax * 0.6),
      maxHr: Math.round(effectiveMax * 0.7),
      pctRange: '60 - 70% Max HR',
      purpose: '기적의 존2, 미토콘드리아 증식 및 지방 연소 최적화',
      color: '#34d399',
    },
    {
      zone: 3,
      name: 'Aerobic Power',
      nameKo: '템포런 (Zone 3)',
      minHr: Math.round(effectiveMax * 0.7),
      maxHr: Math.round(effectiveMax * 0.8),
      pctRange: '70 - 80% Max HR',
      purpose: '장거리 지속주, 심폐 지구력 및 마라톤 페이스 감각',
      color: '#fbbf24',
    },
    {
      zone: 4,
      name: 'Threshold',
      nameKo: '젖산 역치 (Zone 4)',
      minHr: Math.round(effectiveMax * 0.8),
      maxHr: Math.round(effectiveMax * 0.9),
      pctRange: '80 - 90% Max HR',
      purpose: '피로 저항력 극대화, 젖산 역치 상향 조정',
      color: '#f97316',
    },
    {
      zone: 5,
      name: 'Max / Anaerobic',
      nameKo: '무산소 파워 (Zone 5)',
      minHr: Math.round(effectiveMax * 0.9),
      maxHr: effectiveMax,
      pctRange: '90 - 100% Max HR',
      purpose: '인터벌 훈련, 최대 산소 섭취량(VO2max) 자극',
      color: '#ef4444',
    },
  ];
}

/**
 * Runner Tier label based on VDOT
 */
export function getRunnerTier(vdot: number): { label: string; badgeColor: string; description: string } {
  if (vdot >= 65) {
    return {
      label: '엘리트 / 마스터즈 최상위 (Sub-2:35)',
      badgeColor: 'text-rose-950 bg-rose-100 border-rose-300 font-bold',
      description: '전국 마스터즈 대회 입상권 수준의 탁월한 엔진',
    };
  } else if (vdot >= 54) {
    return {
      label: '서브-3 (Sub-3) 완주 주자',
      badgeColor: 'text-emerald-950 bg-emerald-100 border-emerald-300 font-bold',
      description: '동호인 상위 2% 이내, 풀코스 2시간대 주파 실력',
    };
  } else if (vdot >= 47) {
    return {
      label: '싱글 / 서브-330 (Sub-3:30)',
      badgeColor: 'text-emerald-900 bg-emerald-50 border-emerald-300 font-bold',
      description: '견고한 유산소 베이스와 템포주 능력을 겸비한 상급 러너',
    };
  } else if (vdot >= 40) {
    return {
      label: '서브-4 (Sub-4) 목표 주자',
      badgeColor: 'text-amber-900 bg-amber-50 border-amber-300 font-bold',
      description: '체계적인 훈련으로 풀코스 3시간대 진입을 노리는 탄탄한 중급자',
    };
  } else if (vdot >= 32) {
    return {
      label: '발전하는 러너 (Progressive Runner)',
      badgeColor: 'text-stone-800 bg-stone-100 border-stone-300 font-bold',
      description: '10K 50~60분대 안정적 완주, 하프 마라톤 도전 단계',
    };
  } else {
    return {
      label: '비기너 / 입문 러너 (Entry Runner)',
      badgeColor: 'text-stone-700 bg-stone-100 border-stone-200 font-medium',
      description: '부상 방지 조깅과 Zone 2 지구력 축적이 최우선인 즐거운 단계',
    };
  }
}

/**
 * Mock AI Goal Feasibility Evaluation logic:
 * Simulates intelligent sports analysis evaluating runner's target time against current VDOT
 */
export interface GoalEvaluationResult {
  targetVDOT: number;
  currentVDOT: number;
  diffVDOT: number;
  feasibilityScore: number; // 0 to 100
  feasibilityLevel: '매우 높음 (안정권)' | '적정 목표 (도전 가능)' | '공격적 (치밀한 훈련 필요)' | '과도한 목표 (부상 주의)';
  aiFeedback: string;
  recommendedTrainingFocus: string;
  targetPaces: TrainingPaces | null;
  requiredRacePace: string;
  requiredRacePaceSeconds: number;
}

export function evaluateRunningGoal(
  currentVdot: number,
  targetDistance: '10K' | '하프' | '풀코스',
  targetTimeStr: string
): GoalEvaluationResult | null {
  const targetSeconds = parseTimeToSeconds(targetTimeStr);
  if (targetSeconds <= 0) return null;

  const distMeters =
    targetDistance === '10K' ? 10000 : targetDistance === '하프' ? 21097.5 : 42195;
  const distKm = distMeters / 1000;

  // Exact required race pace for target distance & target time (목표 완주 시간에 정확히 부합하는 필수 대회 페이스)
  const requiredPaceSec = targetSeconds / distKm;
  const requiredRacePace = formatPace(requiredPaceSec);

  const targetVdot = calculateVDOT(distMeters, targetSeconds);
  const diffVdot = Math.round((targetVdot - currentVdot) * 10) / 10;
  const targetPaces = getTrainingPaces(targetVdot);

  let feasibilityScore = 75;
  let feasibilityLevel: GoalEvaluationResult['feasibilityLevel'] = '적정 목표 (도전 가능)';
  let aiFeedback = '';
  let recommendedTrainingFocus = '';

  if (currentVdot === 0) {
    feasibilityScore = 60;
    feasibilityLevel = '적정 목표 (도전 가능)';
    aiFeedback =
      `현재 PB 기록이 등록되지 않아 목표 수치만 분석되었습니다. 목표 달성을 위해서는 필수 대회 페이스 ${requiredRacePace}/km 유지 및 VDOT ${targetVdot}에 맞춘 체계적인 훈련 준수가 핵심입니다.`;
    recommendedTrainingFocus = '기초 Zone 2 조깅 70% + 주 1회 목표 페이스 템포런';
  } else if (diffVdot <= 0.5) {
    feasibilityScore = 92;
    feasibilityLevel = '매우 높음 (안정권)';
    aiFeedback = `현재 러닝 엔진(VDOT ${currentVdot})으로 충분히 도달 가능한 안정권 기록입니다. 목표 완주를 위한 필수 대회 페이스는 ${requiredRacePace}/km입니다. 대회 당일 초반 오버페이스 방지 페이스 전략(이븐 또는 네거티브 스플릿)만 지킨다면 높은 확률로 목표 달성이 예상됩니다.`;
    recommendedTrainingFocus = '컨디션 조절(테이퍼링) 및 목표 레이스 페이스 지속 훈련(M-Pace Run)';
  } else if (diffVdot <= 3.5) {
    feasibilityScore = 78;
    feasibilityLevel = '적정 목표 (도전 가능)';
    aiFeedback = `현 기량 대비 약 +${diffVdot}의 VDOT 향상이 필요한 도전적인 목표입니다. 목표 완주를 위한 필수 대회 페이스는 ${requiredRacePace}/km입니다. 8~12주간의 체계적인 빌드업을 통해 젖산 역치 페이스를 끌어올리면 실현 가능성이 매우 높습니다.`;
    recommendedTrainingFocus = '주간 주행거리 점진적 10% 증량 + 주 1회 8~10km 역치 템포런';
  } else if (diffVdot <= 6.5) {
    feasibilityScore = 52;
    feasibilityLevel = '공격적 (치밀한 훈련 필요)';
    aiFeedback = `현 기량 대비 +${diffVdot} 격차가 있는 공격적인 목표입니다. 목표 완주를 위한 필수 대회 페이스는 ${requiredRacePace}/km입니다. 단기간 무리한 스피드 훈련보다는 최소 16주 이상의 주기화 훈련과 목표 페이스 적응이 필수적입니다.`;
    recommendedTrainingFocus = '주말 25~30km LSD 완주력 확보 + 인터벌(400m x 8~10회) 스피드 보강';
  } else {
    feasibilityScore = 28;
    feasibilityLevel = '과도한 목표 (부상 주의)';
    aiFeedback = `현재 엔진(VDOT ${currentVdot})과의 격차(+${diffVdot})가 큽니다. 목표 필수 대회 페이스(${requiredRacePace}/km)를 단번에 노리기보다는 중간 목표 페이스를 설정하여 단계별 성취감을 얻는 것을 강력히 권장합니다.`;
    recommendedTrainingFocus = '중간 목표 설정 후 체중 조절 및 Zone 2 유산소 기반 재정립';
  }

  return {
    targetVDOT: targetVdot,
    currentVDOT: currentVdot,
    diffVDOT: diffVdot,
    feasibilityScore,
    feasibilityLevel,
    aiFeedback,
    recommendedTrainingFocus,
    targetPaces,
    requiredRacePace,
    requiredRacePaceSeconds: requiredPaceSec,
  };
}
