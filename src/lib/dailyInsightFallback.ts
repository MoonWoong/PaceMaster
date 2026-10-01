import { TrainingSession, RegisteredRace, RunningRecords, RunningGoals } from '../types';
import { analyzeRunnerState } from './trainingPlanGenerator';
import { calculateDDay, getTodayDateStr } from './marathonData';

export interface DailyInsightData {
  readinessScore: number; // 0 ~ 100
  conditionLevel: '최상 (쾌조의 컨디션)' | '양호 (안정적 페이스 유지)' | '주의 (피로 누적 / 오버트레이닝 경계)' | '휴식 권장 (적극적 리커버리 필요)';
  title: string;
  analysis: string;
  recommendedToday: string;
  cheerMessage: string;
  generatedAt: string;
  source: 'gemini' | 'heuristic';
}

/**
 * High-accuracy sports science heuristic fallback for daily insight
 * Used when offline, during API fetch, or if server is unavailable
 */
export function generateHeuristicDailyInsight(params: {
  sessions: TrainingSession[];
  races: RegisteredRace[];
  records: RunningRecords;
  goals: RunningGoals;
}): DailyInsightData {
  const { sessions, races, records } = params;
  const analysis = analyzeRunnerState(sessions, records.pbFull ? '풀코스' : '하프');
  const now = new Date();

  // Find nearest race
  const todayStr = getTodayDateStr();
  const upcomingRaces = races
    .filter((r) => r.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  const targetRace = upcomingRaces[0];

  let dDayText = '';
  let daysLeft = 999;
  if (targetRace) {
    const dDayInfo = calculateDDay(targetRace.date);
    daysLeft = dDayInfo.daysDiff;
    dDayText = dDayInfo.text;
  }

  // Days since last run
  let daysSinceLastRun = 99;
  let lastSession: TrainingSession | null = null;
  if (sessions.length > 0) {
    const sorted = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    lastSession = sorted[0];
    const lastDate = new Date(lastSession.date);
    daysSinceLastRun = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Evaluate readiness and condition
  let readinessScore = 85;
  let conditionLevel: DailyInsightData['conditionLevel'] = '양호 (안정적 페이스 유지)';
  let title = '안정적인 페이스와 꾸준한 마일리지 축적 중';
  let analysisText = '';
  let recommendedToday = '';
  let cheerMessage = '';

  const acwr = analysis.acwr;
  const fatigueRisk = analysis.fatigueRisk;
  const lastWeekKm = analysis.lastWeekDistance;

  if (acwr > 1.35 || fatigueRisk === '주의(과부하 위험)') {
    readinessScore = 55;
    conditionLevel = '주의 (피로 누적 / 오버트레이닝 경계)';
    title = '최근 급성 운동부하 증가, 적극적 피로 회복 필요';
    analysisText = `최근 7일간 마일리지가 급증하여 ACWR(운동부하비)이 ${acwr}로 상승했습니다. 근육 피로와 관절 부하가 누적된 상태이므로 무리한 포인트 훈련은 피해야 합니다.`;
    recommendedToday = '가벼운 폼롤러 스트레칭, 마사지 및 완전 휴식(또는 저강도 워킹 20분)';
    cheerMessage = '“휴식도 훈련의 일부입니다. 오늘 잘 쉰 다리가 내일의 가벼운 질주를 만듭니다!”';
  } else if (daysSinceLastRun === 0 && lastSession && lastSession.totalDistanceKm >= 15) {
    readinessScore = 68;
    conditionLevel = '휴식 권장 (적극적 리커버리 필요)';
    title = `장거리 훈련(${lastSession.totalDistanceKm}km) 완주 후 글리코겐 재충전기`;
    analysisText = `오늘(또는 직전) ${lastSession.totalDistanceKm}km 장거리 세션을 완주하여 하체 근육의 미세 손상이 회복되는 과정입니다. 충분한 수분과 탄수화물 섭취가 핵심입니다.`;
    recommendedToday = '충분한 수면, 정적 스트레칭, 고단백 식단 및 편안한 휴식';
    cheerMessage = '“멋진 장거리 훈련을 해내셨습니다! 충분한 영양과 휴식으로 몸을 완벽하게 재생하세요.”';
  } else if (acwr >= 0.8 && acwr <= 1.3) {
    readinessScore = 92;
    conditionLevel = '최상 (쾌조의 컨디션)';
    title = targetRace
      ? `${targetRace.name} ${dDayText}, 최적의 부하(ACWR ${acwr})로 빌드업 순항!`
      : `최적의 훈련 밸런스(ACWR ${acwr}), 컨디션 쾌조!`;
    analysisText = `최근 4주 평균(${analysis.avgWeeklyMileage4Weeks}km) 대비 직전 주간 ${lastWeekKm}km로 이상적인 스위트스팟을 완벽하게 유지하고 있습니다. 심폐 기능과 근지구력이 안정적으로 향상되는 중입니다.`;
    
    if (daysSinceLastRun >= 2) {
      recommendedToday = '기분 좋은 조깅 6~8km 또는 가벼운 빌드업 런으로 다리 활력 깨우기';
      cheerMessage = '“몸이 가볍고 에너지가 충전된 날입니다. 오늘 주로에서 기분 좋은 페이스를 느껴보세요!”';
    } else {
      recommendedToday = 'Zone 2 편안한 조깅 5~7km 또는 가벼운 보강 근력 운동';
      cheerMessage = '“매일 쌓아가는 한 걸음이 위대한 완주의 밑거름이 됩니다. 오늘도 화이팅!”';
    }
  } else {
    readinessScore = 78;
    conditionLevel = '양호 (안정적 페이스 유지)';
    title = '기초 유산소 베이스 구축 및 점진적 마일리지 증량기';
    analysisText = `최근 4주 평균 마일리지는 ${analysis.avgWeeklyMileage4Weeks}km입니다. 큰 부상 위험 없이 안정적인 페이스를 유지하고 있으며, 주당 10% 이내로 거리를 점진적으로 늘려가기에 좋은 타이밍입니다.`;
    recommendedToday = 'Zone 2 이지 페이스 조깅 5~8km + 100m 질주(스트라이드) 3~4회';
    cheerMessage = '“꾸준함이 가장 강력한 재능입니다. 나만의 페이스를 유지하며 즐겁게 달려보세요!”';
  }

  // Adjust for upcoming race phase
  if (targetRace && daysLeft <= 10 && daysLeft >= 0) {
    title = `대회 ${dDayText} 테이퍼링 주간: 훈련량 감축 및 최상의 컨디션 집중`;
    recommendedToday = '짧고 경쾌한 3~4km 조깅 + 레이스 페이스 1km 점검';
    cheerMessage = `“${targetRace.name}이 얼마 남지 않았습니다! 지금껏 흘린 땀방울을 믿고 차분하게 몸을 아끼세요.”`;
  }

  return {
    readinessScore,
    conditionLevel,
    title,
    analysis: analysisText,
    recommendedToday,
    cheerMessage,
    generatedAt:
      now.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
      }) +
      ' ' +
      now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    source: 'heuristic',
  };
}
