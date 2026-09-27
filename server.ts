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

// API: Daily Running Insight & Motivational Coach via Gemini AI
app.post('/api/daily-insight', async (req, res) => {
  try {
    const { runnerProfile, recentSessionsSummary, acwr, mileageTrend, fatigueRisk, upcomingRace } = req.body;

    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({ error: 'Gemini API Key is not configured on server' });
    }

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

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `${systemPrompt}\n\n${userPrompt}`,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text?.trim() || '{}';
      const parsed = JSON.parse(text);
      return res.json({ ...parsed, source: 'gemini' });
    } catch (apiErr: any) {
      // Gracefully fallback when quota is exceeded (429) or model is overloaded
      console.warn('[daily-insight] Gemini AI unavailable or quota reached, serving sports-science fallback:', apiErr?.message);

      const numAcwr = parseFloat(String(acwr)) || 1.0;
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

      return res.json({
        readinessScore,
        conditionLevel,
        title,
        analysis,
        recommendedToday,
        cheerMessage,
        source: 'sports-science-engine',
      });
    }
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
