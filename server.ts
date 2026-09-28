import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Server-side Gemini client utility
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// In-memory cache structures with TTL (1 hour)
let globalDailyInsightCache: { key: string; data: any; timestamp: number } | null = null;
let globalPerformanceSummaryCache: { key: string; data: any; timestamp: number } | null = null;

// API: Daily Running Insight & Motivational Coach via Gemini AI
app.post('/api/daily-insight', async (req, res) => {
  try {
    const { runnerProfile, recentSessionsSummary, acwr, mileageTrend, fatigueRisk, upcomingRace } = req.body;

    const numAcwr = parseFloat(String(acwr)) || 1.0;
    const now = Date.now();

    // Cache key based on recent load & metrics
    const insightCacheKey = `${runnerProfile?.vdot || ''}_${recentSessionsSummary?.last7DaysKm || ''}_${acwr || ''}_${recentSessionsSummary?.latestRunSummary || ''}`;
    if (
      globalDailyInsightCache &&
      globalDailyInsightCache.key === insightCacheKey &&
      now - globalDailyInsightCache.timestamp < 3600000
    ) {
      return res.json(globalDailyInsightCache.data);
    }

    const ai = getAiClient();
    if (ai) {
      const systemPrompt = `당신은 마스터즈 마라토너 및 러너를 위한 최고 수준의 스포츠 사이언스 러닝 코치 'PaceMaster AI'입니다.
러너의 최근 훈련 세션 기록, 마일리지 추세, 급성:만성 운동부하비(ACWR), 피로도 위험도, 목표 마라톤 대회 D-day 정보를 종합 분석하여
오늘의 러닝 컨디션 진단, 과학적 코칭 가이드, 그리고 힘을 주는 러너 격려 메시지를 JSON 형식으로 제공하세요.

반드시 다음 JSON 스키마를 만족해야 합니다:
{
  "readinessScore": number (0~100 사이의 오늘 훈련 준비도 지수),
  "conditionLevel": string ("최상 (쾌조의 컨디션)" | "양호 (안정적 페이스 유지)" | "주의 (피로 누적 / 오버트레이닝 경계)" | "휴식 권장 (적극적 리커버리 필요)"),
  "title": string (예: "D-42, 심폐지구력 빌드업의 황금기", "안정적 80:20 훈련으로 부상 없는 성장 중"),
  "analysis": string (최근 달린 거리, 페이스, 심박, ACWR을 근거로 한 2~3문장의 명확한 스포츠 사이언스 진단),
  "recommendedToday": string (오늘 추천하는 구체적 러닝 세션 또는 리커버리 요령. 예: "Zone 2 이지 조깅 6~8km + 보강 스트레칭", "완전 휴식 또는 폼롤러 마사지"),
  "cheerMessage": string (러너의 열정을 북돋우는 진정성 있고 감동적인 격려 한마디)
}`;

      const userPrompt = `[러너 프로필 및 훈련 상태 데이터]
- VDOT: ${runnerProfile?.vdot || '측정중'}
- 최근 4주 주간 평균 마일리지: ${recentSessionsSummary?.avgWeeklyKm || 0} km
- 최근 7일 훈련 거리: ${recentSessionsSummary?.last7DaysKm || 0} km
- ACWR (급성:만성 부하비): ${acwr || '1.0'}
- 마일리지 추세: ${mileageTrend || '유지세'}
- 피로/부상 위험도: ${fatigueRisk || '안전(스위트스팟)'}
- 최근 세션: ${recentSessionsSummary?.latestRunSummary || '기록 없음'}
- 가장 가까운 목표 대회: ${upcomingRace ? `${upcomingRace.name} (${upcomingRace.date}, ${upcomingRace.dDay} 남음)` : '등록된 목표 대회 없음'}

위 데이터를 바탕으로 한국어로 친절하면서도 전문적인 오늘의 러닝 인사이트를 JSON으로 작성해주세요.`;

      // Try gemini-3.8-flash first, then fallback to gemini-3.1-flash-lite on 429
      const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
      for (const model of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: `${systemPrompt}\n\n${userPrompt}`,
            config: {
              responseMimeType: 'application/json',
            },
          });
          const text = response.text?.trim();
          if (text) {
            const parsed = JSON.parse(text);
            const data = { ...parsed, source: 'gemini' };
            globalDailyInsightCache = { key: insightCacheKey, data, timestamp: now };
            return res.json(data);
          }
        } catch (genErr: any) {
          // If 429 or quota error, proceed to try fallback model or sports-science engine
          console.warn(`[daily-insight] Model ${model} unavailable (${genErr?.status || 'quota reached'}), proceeding to fallback.`);
        }
      }
    }

    // High quality Sports-Science Engine fallback
    let readinessScore = 86;
    let conditionLevel = '양호 (안정적 페이스 유지)';
    let title = upcomingRace
      ? `${upcomingRace.name} D-${upcomingRace.dDay}, 페이스 빌드업 구간`
      : '안정적 유산소 베이스 빌드업 중';
    let analysis = `최근 훈련량과 마일리지 추이가 균형 있게 유지되고 있습니다. ACWR 지수(${numAcwr.toFixed(2)}) 기준 부상 위험 없는 안전 구간에 머물고 있습니다.`;
    let recommendedToday = 'Zone 2 가벼운 이지 조깅 5~7km + 코어 보강 스트레칭';
    let cheerMessage = '꾸준함이 곧 최고의 실력입니다. 오늘의 한 걸음이 목표 레이스의 자신감이 됩니다!';

    if (numAcwr > 1.35) {
      readinessScore = 58;
      conditionLevel = '주의 (피로 누적 / 오버트레이닝 경계)';
      title = '급성 피로도 상승, 적극적 리커버리 권장';
      analysis = `현재 급성:만성 운동부하비(ACWR)가 ${numAcwr.toFixed(2)}로 다소 높게 측정되었습니다. 부상 예방을 위해 무리한 질주보다는 유연성 회복에 집중하세요.`;
      recommendedToday = '완전 휴식 또는 폼롤러 마사지 + 가벼운 스트레칭';
      cheerMessage = '휴식도 가장 중요한 훈련의 일부입니다. 몸의 소리에 귀 기울이세요!';
    } else if (numAcwr >= 0.8 && numAcwr <= 1.3) {
      readinessScore = 94;
      conditionLevel = '최상 (쾌조의 컨디션)';
      title = upcomingRace
        ? `${upcomingRace.name} D-${upcomingRace.dDay}, 최적의 슈퍼컴펜세이션`
        : '스위트스팟 유지, 최상의 성장 곡선 달성';
      analysis = `운동부하비(ACWR ${numAcwr.toFixed(2)})가 부상 위험도가 가장 낮은 스위트스팟 구간에 있어 심폐지구력과 근지구력이 탄탄하게 성장하고 있습니다.`;
      recommendedToday = '목표 마라톤 페이스 지속주 6~8km 또는 쾌적한 템포런';
      cheerMessage = '가장 이상적인 훈련 리듬을 타고 있습니다! 목표 페이스를 믿고 힘차게 달려보세요.';
    }

    const fallbackResponse = {
      readinessScore,
      conditionLevel,
      title,
      analysis,
      recommendedToday,
      cheerMessage,
      source: 'sports-science-engine',
    };

    globalDailyInsightCache = { key: insightCacheKey, data: fallbackResponse, timestamp: now };
    return res.json(fallbackResponse);
  } catch (error: any) {
    console.warn('Unhandled error in daily-insight route:', error?.message);
    return res.json({
      readinessScore: 85,
      conditionLevel: '양호 (안정적 페이스 유지)',
      title: '페이스마스터 데일리 러닝 가이드',
      analysis: '규칙적인 러닝 패턴을 유지하며 건강한 마일리지를 쌓아가고 있습니다.',
      recommendedToday: '가벼운 조깅 5km 또는 보강 운동',
      cheerMessage: '오늘도 즐겁고 부상 없는 건강한 러닝 되세요!',
      source: 'fallback',
    });
  }
});

// API: Cumulative Running Performance AI Summary (Strengths & Areas for Improvement)
app.post('/api/performance-summary', async (req, res) => {
  try {
    const {
      totalSessions = 0,
      totalDistanceKm = 0,
      longestRunKm = 0,
      overallAvgPace = "5'30\"",
      overallAvgHr = 150,
      avgWeeklyKm = 0,
      lastWeekKm = 0,
      vdot,
      upcomingRace,
      sampleRecentSessions = [],
    } = req.body;

    const numDist = Number(totalDistanceKm) || 0;
    const numLongest = Number(longestRunKm) || 0;
    const numSessions = Number(totalSessions) || 0;
    const numAvgHr = Number(overallAvgHr) || 150;
    const now = Date.now();

    // Sanity check: Ensure avgWeeklyKm is accurate and does NOT confuse lifetime cumulative distance with weekly mileage
    let safeAvgWeeklyKm = Number(avgWeeklyKm) || 0;
    if (safeAvgWeeklyKm > 140 || (numDist > 0 && safeAvgWeeklyKm > numDist)) {
      if (sampleRecentSessions && sampleRecentSessions.length > 0) {
        const recentSum = sampleRecentSessions.reduce(
          (acc: number, s: any) => acc + (Number(s.totalDistanceKm) || 0),
          0
        );
        safeAvgWeeklyKm = Math.min(80, Math.round((recentSum / Math.max(1, sampleRecentSessions.length / 3)) * 10) / 10);
      } else {
        safeAvgWeeklyKm = Math.min(50, Math.round((numDist / Math.max(1, numSessions / 3)) * 10) / 10);
      }
    }

    // Cache key for performance summary based on cumulative session count & distance (TTL: 1 hour)
    const perfCacheKey = `v2_${numSessions}_${numDist.toFixed(1)}_${numLongest.toFixed(1)}_${safeAvgWeeklyKm.toFixed(1)}_${vdot || ''}`;
    if (
      globalPerformanceSummaryCache &&
      globalPerformanceSummaryCache.key === perfCacheKey &&
      now - globalPerformanceSummaryCache.timestamp < 3600000
    ) {
      return res.json(globalPerformanceSummaryCache.data);
    }

    const ai = getAiClient();
    if (ai) {
      const systemPrompt = `당신은 마스터즈 마라토너 및 엘리트 러너를 지도하는 국가대표 수석 러닝 코치 'PaceMaster AI'입니다.
러너가 지금까지 기록한 전체 러닝 훈련 세션 데이터(총 세션 수, 누적 총거리, 최장거리, 평균 페이스, 평균 심박수, 최근 4주 주간 평균 거리, 최근 세션 양상 등)를 면밀히 분석하여
러너의 '핵심 강점(Strengths)' 2~3가지와 '보완점 및 맞춤 트레이닝 처방(Areas for Improvement)' 2~3가지를 도출하고,
러너 유형 칭호(runnerType), 종합 러닝 완성도 점수(overallScore, 100점 만점), AI 총평 요약(aiSummary)을 반드시 유효한 JSON 형식으로 출력하세요.

[필수 데이터 해석 원칙 - 매우 중요]
1. [누적 총 훈련 거리]와 [주간 평균 훈련량(마일리지)]를 절대 혼동하지 마십시오.
   - 누적 총 훈련 거리(예: 수백~수천 km)는 수개월 혹은 수년에 걸쳐 축적된 전체 합계입니다.
   - 최근 4주 주간 평균 거리(avgWeeklyKm)는 1주일(7일) 동안 소화하는 평균 훈련 볼륨입니다(일반적인 아마추어/마스터즈 러너는 주 20~60km, 상급 마스터즈는 60~100km 수준).
   - 누적 총 거리를 주간 거리로 잘못 지칭하거나, "주간 평균 200km 이상", "주간 270km" 같은 왜곡되거나 터무니없는 수치를 절대 언급하지 마십시오.
2. 분석 텍스트(aiSummary, strengths, improvements)에서 언급하는 모든 수치(거리, 페이스, 심박수, 주간 볼륨)는 제공된 입력 데이터와 100% 일치해야 합니다.

반드시 다음 JSON 스키마를 만족해야 합니다:
{
  "runnerType": string (예: "지구력 중심의 꾸준한 마일리지 빌더", "페이스 감각이 탁월한 스피드 템포 러너", "심폐 안정성이 뛰어난 유산소 러너"),
  "overallScore": number (70~98 사이의 누적 데이터 기반 러닝 완성도 점수),
  "summaryTitle": string (예: "탄탄한 유산소 베이스와 높은 훈련 일관성을 지닌 성장형 러너"),
  "aiSummary": string (러너의 누적 훈련량과 심박수, 페이스 안정성 등을 분석한 3~4문장의 전문적이고 신뢰도 높은 브리핑),
  "strengths": [
    {
      "title": string (강점 제목, 예: "우수한 심폐 효율 및 안정적 심박 유지"),
      "metric": string (관련 데이터 지표, 예: "평균 심박 145bpm 대비 일정한 페이스 유지"),
      "description": string (해당 강점에 대한 과학적 분석 및 긍정적 피드백 1~2문장)
    }
  ],
  "improvements": [
    {
      "title": string (보완점 제목, 예: "장거리 LSD (15km+) 세션 비중 확대"),
      "priority": string ("높음" | "중간" | "권장"),
      "actionPlan": string (구체적인 주간 실행 방법 및 페이스/거리 가이드),
      "targetMetric": string (목표 지표, 예: "월 2회 이상 15km+ 지속주 완주")
    }
  ],
  "keyAdvice": string (다음 마라톤 목표 달성을 위한 핵심 코칭 조언 한마디),
  "recommendedRoutine": string (추천하는 주간 핵심 훈련 루틴 요약)
}`;

      const recentRunsText = (sampleRecentSessions || [])
        .slice(0, 8)
        .map(
          (s: any) =>
            `- ${s.date}: ${s.totalDistanceKm}km (페이스 ${s.avgPace}, 심박 ${s.avgHr}bpm, 제목: ${s.title || '러닝'})`
        )
        .join('\n');

      const userPrompt = `[러너의 전체 누적 러닝 데이터]
- 총 기록된 세션 수: ${totalSessions}회
- 누적 총 훈련 거리: ${numDist.toFixed(2)} km (전체 기간 누적 합계)
- 최장 1회 주행 거리: ${numLongest.toFixed(2)} km
- 전체 평균 페이스: ${overallAvgPace}
- 전체 평균 심박수: ${numAvgHr} bpm
- 최근 4주 주간 평균 거리: ${safeAvgWeeklyKm.toFixed(1)} km/주 (7일 평균 마일리지)
- 직전 주간 훈련 거리: ${Number(lastWeekKm || 0).toFixed(1)} km
- VDOT: ${vdot || '측정중'}
- 가장 가까운 목표 대회: ${upcomingRace ? `${upcomingRace.name} (${upcomingRace.date}, D-${upcomingRace.dDay})` : '등록된 목표 대회 없음'}

[최근 주요 세션 기록]
${recentRunsText || '최근 세션 없음'}

위 누적 훈련 기록 데이터를 바탕으로 러너의 강점과 보완점을 과학적이고 사실에 기반하여 분석하고 한국어 JSON으로 제공해주세요.`;

      // Try gemini-3.8-flash first, then fallback to gemini-3.1-flash-lite on 429
      const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
      for (const model of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: `${systemPrompt}\n\n${userPrompt}`,
            config: {
              responseMimeType: 'application/json',
            },
          });

          const text = response.text?.trim();
          if (text) {
            const parsed = JSON.parse(text);
            const data = { ...parsed, source: 'gemini' };
            globalPerformanceSummaryCache = { key: perfCacheKey, data, timestamp: now };
            return res.json(data);
          }
        } catch (apiErr: any) {
          console.warn(`[performance-summary] Model ${model} unavailable (${apiErr?.status || 'quota reached'}), proceeding to fallback.`);
        }
      }
    }

    // High quality Sports Science Engine fallback
    let runnerType = '지구력 중심의 꾸준한 마일리지 빌더';
    if (numLongest >= 21) runnerType = '하프·풀코스 실전 지구력이 검증된 롱디스턴스 러너';
    else if (numAvgHr <= 145 && numDist >= 50) runnerType = '심폐 안정성이 탁월한 유산소 베이스 러너';

    const fallbackResponse = {
      runnerType,
      overallScore: Math.min(94, 75 + Math.floor(numSessions / 3) + (numLongest >= 15 ? 5 : 0)),
      summaryTitle: `누적 ${numDist.toFixed(1)}km를 기록 중인 안정적 유산소 베이스의 러너`,
      aiSummary: `총 ${numSessions}회 세션 동안 ${numDist.toFixed(1)}km를 달리며 평균 페이스 ${overallAvgPace}, 심박 ${numAvgHr}bpm을 기록했습니다. 최근 주간 평균 ${safeAvgWeeklyKm > 0 ? `${safeAvgWeeklyKm.toFixed(1)}km` : '안정적인'} 마일리지를 소화하며 유산소 베이스가 꾸준히 축적되어 있습니다.`,
      strengths: [
        {
          title: '안정적인 훈련 지속성과 유산소 베이스 구축',
          metric: `누적 ${numDist.toFixed(1)}km · 총 ${numSessions}회 세션 완주`,
          description: '규칙적인 러닝 패턴을 통해 심근 강화와 모세혈관 발달이 순조롭게 진행되고 있습니다.',
        },
        {
          title: '일정한 페이스 통제력과 심폐 안정성',
          metric: `평균 페이스 ${overallAvgPace} · 평균 심박 ${numAvgHr}bpm`,
          description: '무리한 오버페이스 없이 목표 존을 유지하는 능력이 우수합니다.',
        },
      ],
      improvements: [
        {
          title: '15km+ 장거리(LSD) 세션 비중 강화',
          priority: '높음',
          actionPlan: '격주 주말 15~18km 편안한 지속주를 배치하여 장거리 지구력과 글리코겐 보존 능력을 키우세요.',
          targetMetric: '월 2회 이상 15km+ LSD 완주',
        },
        {
          title: '80:20 분극화 훈련 및 회복주 철저 준수',
          priority: '중간',
          actionPlan: '고강도 훈련 후에는 Zone 1~2 가벼운 회복주로 피로 물질을 빠르게 배출하세요.',
          targetMetric: '주간 훈련의 80%는 편안한 유산소 페이스로 소화',
        },
      ],
      keyAdvice: upcomingRace
        ? `${upcomingRace.name} D-${upcomingRace.dDay} 완주를 위해 부상 없는 일관된 리듬 유지가 핵심입니다.`
        : '페이스보다 꾸준한 주간 마일리지와 충분한 수면이 실력 향상의 지름길입니다.',
      recommendedRoutine: '화/목 6~8km 이지 조깅 + 토 12~15km 장거리 지속주',
      source: 'sports-science-engine',
    };

    globalPerformanceSummaryCache = { key: perfCacheKey, data: fallbackResponse, timestamp: now };
    return res.json(fallbackResponse);
  } catch (error: any) {
    console.warn('Unhandled error in performance-summary route:', error?.message);
    return res.status(500).json({ error: 'Failed to generate performance summary' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
