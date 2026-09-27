import { TrainingSession, RunningRecords, RunningGoals, RunningShoe } from '../types';

export interface IntegratedWorkoutAnalysis {
  // Session specifics
  sessionDate: string;
  workoutType: string;
  workoutDistanceKm: number;
  workoutPace: string;
  workoutDurationMin: number;

  // Sports Science Load & Intensity
  trainingLoadScore: number; // TRIMP-like score (0-200)
  trainingLoadLevel: '가벼움' | '적정' | '고강도' | '극심함';
  intensityZone: string; // e.g. "Zone 2 (유산소 기초)" or "Zone 4 (젖산역치)"
  recommendedRecoveryHours: number;
  recoveryAdvice: string;

  // Integrated Weekly Impact
  thisWeekTotalKm: number;
  weeklyGoalKm: number;
  weeklyProgressPercent: number;
  weeklyRemainingKm: number;

  // Workload Trend (ACWR)
  acuteLoadKm: number; // Last 7 days
  chronicLoadKm: number; // 28-day weekly average
  acwr: number;
  acwrStatus: '안전(스위트스팟)' | '주의(과부하경고)' | '위험(오버트레이닝)' | '회복/빌드업기';
  acwrDescription: string;

  // Polarized 80/20 Ratio
  aerobicRatioPercent: number; // Low intensity (Zone 1-2)
  highIntensityRatioPercent: number; // High intensity (Zone 3-5)
  polarizedCompliance: string;

  // Shoe impact
  shoeName?: string;
  shoeUpdatedMileage?: number;

  // Coach takeaway message
  coachTakeaway: string;
}

/**
 * Calculates integrated analysis for a newly recorded or existing training session
 */
export function calculateIntegratedWorkoutAnalysis(
  newSession: TrainingSession,
  allSessions: TrainingSession[],
  records: RunningRecords,
  goals: RunningGoals,
  shoes: RunningShoe[] = []
): IntegratedWorkoutAnalysis {
  // 1. Time & Distance
  const distance = Number(newSession.totalDistanceKm) || 0;
  const timeParts = (newSession.totalTime || '00:00:00').split(':').map(Number);
  let durationMinutes = 0;
  if (timeParts.length === 3) {
    durationMinutes = timeParts[0] * 60 + timeParts[1] + timeParts[2] / 60;
  } else if (timeParts.length === 2) {
    durationMinutes = timeParts[0] + timeParts[1] / 60;
  }

  // 2. Training Load (TRIMP approximation based on HR & Duration)
  const maxHr = records.maxHr || 190;
  const avgHr = newSession.avgHr || Math.round(maxHr * 0.75);
  const hrRatio = Math.min(1.0, Math.max(0.4, avgHr / maxHr));

  // TRIMP formula: duration(min) * HR_ratio * exp(1.92 * HR_ratio)
  const rawLoad = Math.round(durationMinutes * hrRatio * Math.exp(1.8 * hrRatio) * 0.28);
  const trainingLoadScore = Math.max(15, rawLoad);

  let trainingLoadLevel: '가벼움' | '적정' | '고강도' | '극심함' = '적정';
  if (trainingLoadScore < 45) trainingLoadLevel = '가벼움';
  else if (trainingLoadScore <= 90) trainingLoadLevel = '적정';
  else if (trainingLoadScore <= 140) trainingLoadLevel = '고강도';
  else trainingLoadLevel = '극심함';

  // 3. Heart Rate Zone / Intensity Zone
  let intensityZone = 'Zone 2 (유산소 지구력)';
  if (hrRatio < 0.65) intensityZone = 'Zone 1 (회복 & 쿨다운)';
  else if (hrRatio < 0.78) intensityZone = 'Zone 2 (기초 유산소)';
  else if (hrRatio < 0.86) intensityZone = 'Zone 3 (템포 & 마라톤 페이스)';
  else if (hrRatio < 0.92) intensityZone = 'Zone 4 (젖산 역치)';
  else intensityZone = 'Zone 5 (무산소 & VO2Max)';

  // 4. Workout Type Auto-Detection or Refinement
  let workoutType = newSession.title || '일반 러닝';
  if (distance >= 20) workoutType = 'LSD 장거리 지속주';
  else if (hrRatio >= 0.88) workoutType = '고강도 인터벌 / 스피드런';
  else if (hrRatio >= 0.80) workoutType = '템포런 / 페이스주';
  else if (distance <= 5 && hrRatio < 0.70) workoutType = '리커버리 회복주';
  else if (distance >= 6 && distance < 18) workoutType = '기초 유산소 조깅';

  // 5. Recommended Recovery Hours
  let recoveryHours = 24;
  if (distance > 25 || trainingLoadScore > 140) {
    recoveryHours = 48;
  } else if (distance > 18 || trainingLoadScore > 100) {
    recoveryHours = 36;
  } else if (distance > 10 || trainingLoadScore > 65) {
    recoveryHours = 24;
  } else {
    recoveryHours = 14;
  }

  let recoveryAdvice = `약 ${recoveryHours}시간의 완전한 휴식 또는 폼롤러 스트레칭을 권장합니다.`;
  if (recoveryHours >= 48) {
    recoveryAdvice = `고강도 장거리 훈련으로 근육 피로도가 높습니다. 최소 48시간 동안 무리한 포인트 훈련을 피하고 단백질 보충과 수면을 충분히 취하세요.`;
  } else if (recoveryHours <= 18) {
    recoveryAdvice = `부담 없는 적정 부하 세션입니다. 내일 가벼운 회복주나 정상적인 훈련 루틴을 이어갈 수 있습니다.`;
  }

  // 6. Integrated Weekly Impact (Group by Monday-Sunday)
  // Ensure the new session is included in all sessions
  const combinedSessions = allSessions.some((s) => s.id === newSession.id)
    ? allSessions
    : [newSession, ...allSessions];

  const now = new Date(newSession.date || new Date().toISOString().split('T')[0]);
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  let thisWeekTotalKm = 0;
  for (const s of combinedSessions) {
    const sDate = new Date(s.date);
    if (sDate >= monday && sDate <= sunday) {
      thisWeekTotalKm += s.totalDistanceKm || 0;
    }
  }
  thisWeekTotalKm = Math.round(thisWeekTotalKm * 10) / 10;

  // Determine weekly goal volume
  const isFull = goals.targetFull || records.pbFull;
  const defaultWeeklyGoal = isFull ? 50 : 35;
  const weeklyGoalKm = defaultWeeklyGoal;
  const weeklyProgressPercent = Math.min(100, Math.round((thisWeekTotalKm / weeklyGoalKm) * 100));
  const weeklyRemainingKm = Math.max(0, Math.round((weeklyGoalKm - thisWeekTotalKm) * 10) / 10);

  // 7. ACWR (Acute:Chronic Workload Ratio)
  // Acute: last 7 days total km
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  let acuteLoadKm = 0;
  for (const s of combinedSessions) {
    const sDate = new Date(s.date);
    if (sDate >= sevenDaysAgo && sDate <= now) {
      acuteLoadKm += s.totalDistanceKm || 0;
    }
  }
  acuteLoadKm = Math.round(acuteLoadKm * 10) / 10;

  // Chronic: 28 days total km divided by 4
  const twentyEightDaysAgo = new Date(now);
  twentyEightDaysAgo.setDate(now.getDate() - 28);
  twentyEightDaysAgo.setHours(0, 0, 0, 0);

  let chronicTotal28 = 0;
  for (const s of combinedSessions) {
    const sDate = new Date(s.date);
    if (sDate >= twentyEightDaysAgo && sDate <= now) {
      chronicTotal28 += s.totalDistanceKm || 0;
    }
  }
  const chronicLoadKm = Math.max(10, Math.round((chronicTotal28 / 4) * 10) / 10);
  const acwr = Math.round((acuteLoadKm / chronicLoadKm) * 100) / 100;

  let acwrStatus: '안전(스위트스팟)' | '주의(과부하경고)' | '위험(오버트레이닝)' | '회복/빌드업기' =
    '안전(스위트스팟)';
  let acwrDescription = '체력 향상과 부상 예방의 최적 밸런스(0.8~1.3)를 유지하고 있습니다.';

  if (acwr > 1.5) {
    acwrStatus = '위험(오버트레이닝)';
    acwrDescription =
      '최근 7일간 훈련량이 급증하여 관절 및 건(건염) 부상 위험이 높습니다. 주간 거리를 일시적으로 줄이세요.';
  } else if (acwr > 1.3) {
    acwrStatus = '주의(과부하경고)';
    acwrDescription =
      '피로 누적 주의 단계입니다. 다음 2~3일간은 강한 포인트 훈련 대신 이지런을 권장합니다.';
  } else if (acwr < 0.8) {
    acwrStatus = '회복/빌드업기';
    acwrDescription =
      '체력 소모가 적은 빌드업 또는 회복 구간입니다. 점진적으로 볼륨을 늘려갈 여유가 있습니다.';
  }

  // 8. 80/20 Polarized Breakdown
  let aerobicKm = 0;
  let highIntensityKm = 0;
  for (const s of combinedSessions.slice(0, 20)) {
    const isHigh =
      (s.avgHr && s.avgHr / maxHr >= 0.82) ||
      (s.title && (s.title.includes('인터벌') || s.title.includes('템포') || s.title.includes('대회')));
    if (isHigh) {
      highIntensityKm += s.totalDistanceKm || 0;
    } else {
      aerobicKm += s.totalDistanceKm || 0;
    }
  }
  const totalAnalyzed = aerobicKm + highIntensityKm || 1;
  const aerobicRatioPercent = Math.round((aerobicKm / totalAnalyzed) * 100);
  const highIntensityRatioPercent = 100 - aerobicRatioPercent;

  let polarizedCompliance = '엘리트 마라톤 훈련의 80/20 유산소 법칙에 매우 잘 부합합니다.';
  if (highIntensityRatioPercent > 30) {
    polarizedCompliance =
      '고강도 비중이 30%를 초과하여 피로 누적이 가속될 수 있습니다. 저강도 이지런 비중을 늘려보세요.';
  }

  // 9. Shoe integration
  let shoeName: string | undefined;
  let shoeUpdatedMileage: number | undefined;
  if (newSession.shoeId) {
    const found = shoes.find((sh) => sh.id === newSession.shoeId);
    if (found) {
      shoeName = `${found.brand} ${found.name}`;
      shoeUpdatedMileage = Math.round(((found.mileage || 0) + distance) * 10) / 10;
    }
  } else if (newSession.shoeName) {
    shoeName = newSession.shoeName;
  }

  // 10. Personalized Coach Takeaway
  let coachTakeaway = `오늘 ${distance.toFixed(1)}km ${workoutType} 완료! 이번 주 목표의 ${weeklyProgressPercent}%를 달성했습니다. ${recoveryAdvice}`;

  return {
    sessionDate: newSession.date,
    workoutType,
    workoutDistanceKm: distance,
    workoutPace: newSession.avgPace,
    workoutDurationMin: Math.round(durationMinutes),
    trainingLoadScore,
    trainingLoadLevel,
    intensityZone,
    recommendedRecoveryHours: recoveryHours,
    recoveryAdvice,
    thisWeekTotalKm,
    weeklyGoalKm,
    weeklyProgressPercent,
    weeklyRemainingKm,
    acuteLoadKm,
    chronicLoadKm,
    acwr,
    acwrStatus,
    acwrDescription,
    aerobicRatioPercent,
    highIntensityRatioPercent,
    polarizedCompliance,
    shoeName,
    shoeUpdatedMileage,
    coachTakeaway,
  };
}
