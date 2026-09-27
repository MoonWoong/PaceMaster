import { TrainingSession, RunningRecords, RunningGoals } from '../types';

export interface PerformanceStrength {
  title: string;
  metric: string;
  description: string;
}

export interface PerformanceImprovement {
  title: string;
  priority: '높음' | '중간' | '권장';
  actionPlan: string;
  targetMetric: string;
}

export interface RunnerPerformanceSummaryData {
  runnerType: string;
  overallScore: number;
  summaryTitle: string;
  aiSummary: string;
  strengths: PerformanceStrength[];
  improvements: PerformanceImprovement[];
  keyAdvice: string;
  recommendedRoutine: string;
  generatedAt: string;
  source: 'gemini' | 'sports-science-engine' | 'fallback';
}

interface HeuristicParams {
  sessions: TrainingSession[];
  records?: RunningRecords;
  goals?: RunningGoals;
  upcomingRace?: { name: string; date: string; dDay: number } | null;
}

export function generateHeuristicPerformanceSummary({
  sessions,
  records,
  goals,
  upcomingRace,
}: HeuristicParams): RunnerPerformanceSummaryData {
  const now = new Date();
  const generatedAt =
    now.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    }) +
    ' ' +
    now.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });

  // Empty state handler
  if (!sessions || sessions.length === 0) {
    return {
      runnerType: '새로운 도전을 시작하는 스타트 러너',
      overallScore: 70,
      summaryTitle: '첫 훈련 세션 기록을 등록해보세요!',
      aiSummary:
        '현재 등록된 러닝 세션이 없습니다. 상단의 "오늘의 훈련 직접 기록" 또는 "CSV 다중 파일 업로드"로 훈련 일지를 등록하시면, 누적 거리·페이스·심박수를 정밀 분석하여 러너의 강점과 보완점을 AI가 즉시 진단해 드립니다.',
      strengths: [
        {
          title: '잠재된 러닝 성장 가능성',
          metric: '체계적인 데이터 관리 준비 완료',
          description:
            '규칙적인 훈련 기록 작성은 마라톤 완주와 부상 예방을 위한 가장 중요한 첫걸음입니다.',
        },
      ],
      improvements: [
        {
          title: '기초 유산소 조깅 세션 시작',
          priority: '높음',
          actionPlan:
            '주 2~3회 편안하게 대화할 수 있는 Zone 2 페이스로 3~5km 조깅부터 가볍게 시작하세요.',
          targetMetric: '주간 10km 유산소 마일리지 달성',
        },
      ],
      keyAdvice: '처음에는 페이스보다 규칙적인 주 3회 러닝 습관 형성이 가장 중요합니다.',
      recommendedRoutine: '화/목 3~5km 이지 조깅 + 토 5km 지속주',
      generatedAt,
      source: 'sports-science-engine',
    };
  }

  // Statistical calculations
  const totalSessions = sessions.length;
  const totalDist =
    Math.round(sessions.reduce((acc, s) => acc + (s.totalDistanceKm || 0), 0) * 100) / 100;
  const longestRun = Math.max(...sessions.map((s) => s.totalDistanceKm || 0), 0);

  // Heart rate stats
  const validHrSessions = sessions.filter((s) => s.avgHr && s.avgHr > 60 && s.avgHr < 220);
  const avgHr =
    validHrSessions.length > 0
      ? Math.round(validHrSessions.reduce((acc, s) => acc + s.avgHr, 0) / validHrSessions.length)
      : 148;

  // Pace stats
  const paceSecondsList: number[] = [];
  sessions.forEach((s) => {
    if (s.avgPace) {
      const match = s.avgPace.match(/(\d+)[':](\d{2})/);
      if (match) {
        paceSecondsList.push(parseInt(match[1], 10) * 60 + parseInt(match[2], 10));
      }
    }
  });

  const avgPaceSec =
    paceSecondsList.length > 0
      ? Math.round(paceSecondsList.reduce((a, b) => a + b, 0) / paceSecondsList.length)
      : 330;
  const avgPaceMin = Math.floor(avgPaceSec / 60);
  const avgPaceRemainSec = avgPaceSec % 60;
  const avgPaceFormatted = `${avgPaceMin}'${avgPaceRemainSec.toString().padStart(2, '0')}"`;

  // Long run proportion (>= 14km)
  const longRuns = sessions.filter((s) => (s.totalDistanceKm || 0) >= 14);
  const longRunRatio = Math.round((longRuns.length / totalSessions) * 100);

  // High intensity runs (avgHr > 165 or fast pace)
  const highIntensityRuns = sessions.filter((s) => (s.avgHr || 0) >= 165);

  // Score determination
  let score = 78;
  if (totalSessions >= 10) score += 5;
  if (totalSessions >= 25) score += 5;
  if (longestRun >= 15) score += 4;
  if (longestRun >= 21.1) score += 4;
  if (totalDist >= 150) score += 4;
  score = Math.min(score, 96);

  // Runner Type
  let runnerType = '지구력 중심의 꾸준한 마일리지 빌더';
  if (avgPaceSec < 285) {
    runnerType = '스피드 감각과 페이스 조절력이 뛰어난 템포 러너';
  } else if (longestRun >= 21) {
    runnerType = '하프·풀코스 실전 지구력이 검증된 롱디스턴스 러너';
  } else if (avgHr <= 145 && totalDist >= 50) {
    runnerType = '심폐 안정성이 탁월한 유산소 베이스 러너';
  }

  // Strengths
  const strengths: PerformanceStrength[] = [];

  if (totalSessions >= 5) {
    strengths.push({
      title: '우수한 훈련 일관성과 마일리지 축적력',
      metric: `누적 ${totalDist}km · 총 ${totalSessions}회 완주`,
      description:
        '규칙적인 훈련 빈도로 유산소 베이스가 탄탄하게 다져져 있으며, 부상 없는 지속 가능한 마일리지를 구축하고 있습니다.',
    });
  }

  if (avgHr <= 152) {
    strengths.push({
      title: '뛰어난 심폐 지구력과 유산소 대사 효율',
      metric: `전체 평균 심박 ${avgHr}bpm (안정적 Zone 2~3)`,
      description:
        '주행 중 심박 급상승(Cardiac Drift)이 적고 산소 공급 및 젖산 완충 능력이 안정적으로 작동하고 있습니다.',
    });
  } else {
    strengths.push({
      title: '높은 심박 대역에서의 파워풀한 젖산 역치 주행력',
      metric: `평균 심박 ${avgHr}bpm 적극 활용`,
      description:
        '고강도 부하에서도 근육 피로를 이겨내는 젖산 역치 훈련 수행 능력이 우수하며 심폐 활성도가 매우 뛰어납니다.',
    });
  }

  if (longestRun >= 12) {
    strengths.push({
      title: '견고한 롱런 지속력과 글리코겐 보존 능력',
      metric: `최장 ${longestRun}km 완주 기록 보유`,
      description:
        '10km 이상의 장거리 주행을 소화할 수 있는 하체 지지근력과 장시간 페이스 통제력이 검증되었습니다.',
    });
  } else {
    strengths.push({
      title: '민첩한 단·중거리 페이스 제어력',
      metric: `평균 페이스 ${avgPaceFormatted}`,
      description:
        '무리한 과부하 없이 자신의 페이스 구간을 충실히 지키며 훈련을 완성하는 영리한 페이싱을 보여줍니다.',
    });
  }

  // Improvements
  const improvements: PerformanceImprovement[] = [];

  if (longestRun < 15) {
    improvements.push({
      title: '15km+ 장거리(LSD) 세션 비중 확대',
      priority: '높음',
      actionPlan:
        '주말 1회 Zone 2 편안한 페이스로 12km에서 15~18km까지 격주로 2km씩 거리를 점진적으로 늘려보세요.',
      targetMetric: '월 2회 이상 15km+ 장거리 지속주 완료',
    });
  } else {
    improvements.push({
      title: 'LSD 후반부 네거티브 스플릿 훈련',
      priority: '중간',
      actionPlan:
        '장거리 주행 마지막 2~3km 구간에서 목표 마라톤 페이스로 점진적 빌드업하여 대회 후반부 방전 현상을 예방하세요.',
      targetMetric: '후반 3km 페이스 15초 단축',
    });
  }

  if (highIntensityRuns.length === 0 && totalSessions >= 5) {
    improvements.push({
      title: '주 1회 젖산 역치 템포런 / 파틀렉 도입',
      priority: '중간',
      actionPlan:
        '매주 수요일 또는 목요일, 20~30분간 약간 숨이 찬 역치 페이스(Zone 4)로 달리는 템포런을 추가하면 심박 효율이 극대화됩니다.',
      targetMetric: '주 1회 20~30분 템포런 세션 고정',
    });
  } else if (highIntensityRuns.length > totalSessions * 0.4) {
    improvements.push({
      title: '80:20 분극화 훈련(Polarized Training) 회복주 준수',
      priority: '높음',
      actionPlan:
        '고강도 훈련 후에는 최소 48시간 이상 가벼운 회복 조깅(Zone 1~2) 또는 완전 휴식으로 근섬유를 초과회복시키세요.',
      targetMetric: '전체 훈련의 80%를 편안한 유산소 페이스로 유지',
    });
  } else {
    improvements.push({
      title: '케이던스 175~185 spm 최적화 및 보강 드릴',
      priority: '권장',
      actionPlan:
        '보폭을 무리하게 넓히지 않고 분당 180회에 가까운 피치 주법을 적용하면 지면 접촉 시간과 무릎 부하를 20% 이상 줄일 수 있습니다.',
      targetMetric: '평균 케이던스 175 spm 이상 유지',
    });
  }

  // Key Advice & Routine
  const keyAdvice = upcomingRace
    ? `${upcomingRace.name} D-${upcomingRace.dDay}를 앞두고 있습니다. 무리한 고강도 질주보다 '부상 방지'와 '목표 페이스의 몸 기억화'가 최고의 기록 단축 전략입니다.`
    : '마라톤 성장의 90%는 무리하지 않는 꾸준한 유산소 마일리지와 충분한 수면 및 회복에서 결정됩니다.';

  const recommendedRoutine =
    longestRun >= 15
      ? '화: 6~8km 이지런 | 목: 8km 템포런 | 토/일: 15~20km LSD 지속주'
      : '화: 5km 이지런 | 목: 6km 빌드업런 | 토: 10~12km 주말 장거리';

  const summaryTitle = `누적 ${totalDist}km를 돌파한 탄탄한 유산소 베이스의 러너`;
  const aiSummary = `현재까지 총 ${totalSessions}회, ${totalDist}km의 훈련을 기록하며 평균 페이스 ${avgPaceFormatted}, 평균 심박 ${avgHr}bpm의 균형 잡힌 주행 데이터를 축적했습니다. 최장 주행 거리 ${longestRun}km를 바탕으로 중장거리 러닝 적응력이 탄탄히 형성되어 있으며, 장거리 LSD와 젖산 역치 세션의 비중을 80:20으로 유지할 때 가장 높은 성장을 기대할 수 있습니다.`;

  return {
    runnerType,
    overallScore: score,
    summaryTitle,
    aiSummary,
    strengths,
    improvements,
    keyAdvice,
    recommendedRoutine,
    generatedAt,
    source: 'sports-science-engine',
  };
}
