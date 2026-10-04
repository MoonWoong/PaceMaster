import {
  RunningShoe,
  WeeklyPlanDay,
  TrainingSession,
  ShoeCategory,
  RecommendedShoeInfo,
} from '../types';

/**
 * Base preference score by workout type (0 ~ 60)
 */
const CATEGORY_PREFERENCE: Record<string, Record<ShoeCategory, number>> = {
  인터벌: {
    스피드: 60,
    레이싱: 55,
    데일리: 20,
    장거리: 10,
    트레일: 5,
  },
  템포런: {
    스피드: 60,
    레이싱: 50,
    데일리: 35,
    장거리: 25,
    트레일: 5,
  },
  LSD: {
    장거리: 60,
    데일리: 45,
    스피드: 25,
    레이싱: 15,
    트레일: 10,
  },
  조깅: {
    데일리: 60,
    장거리: 45,
    스피드: 20,
    트레일: 15,
    레이싱: -15, // 레이싱화는 조깅/회복주에 관절 피로 유발
  },
  회복주: {
    데일리: 60,
    장거리: 50,
    스피드: 15,
    트레일: 15,
    레이싱: -25, // 카본 레이싱화는 초경량 회복주에 부적합
  },
  언덕훈련: {
    스피드: 60,
    데일리: 40,
    레이싱: 35,
    트레일: 35,
    장거리: 15,
  },
  대회: {
    레이싱: 65,
    스피드: 45,
    장거리: 30,
    데일리: 15,
    트레일: 10,
  },
};

/**
 * Recommend a shoe for a specific workout considering type, intensity, and rotation balance
 */
export function recommendShoeForWorkout(
  workout: { type: string; intensity: string; distanceKm: number; title: string },
  shoes: RunningShoe[],
  recentSessions: TrainingSession[] = [],
  assignedShoeNamesThisWeek: string[] = []
): RecommendedShoeInfo | undefined {
  if (!shoes || shoes.length === 0) return undefined;
  if (workout.type === '휴식') return undefined;

  // 1. Analyze historical usage and recency of each shoe from recent training records
  const usageCountMap: Record<string, number> = {};
  const lastUsedTimestampMap: Record<string, number> = {};

  // Sort sessions descending by date
  const sortedSessions = [...recentSessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const mostRecentSessionDate = sortedSessions.length > 0 ? sortedSessions[0].date : null;
  const mostRecentSessionShoeName =
    sortedSessions.length > 0 && sortedSessions[0].shoeName
      ? sortedSessions[0].shoeName.trim().toLowerCase()
      : null;

  sortedSessions.forEach((s) => {
    if (s.shoeName) {
      const key = s.shoeName.trim().toLowerCase();
      usageCountMap[key] = (usageCountMap[key] || 0) + 1;
      const t = new Date(s.date).getTime();
      if (!lastUsedTimestampMap[key] || t > lastUsedTimestampMap[key]) {
        lastUsedTimestampMap[key] = t;
      }
    }
  });

  // Count times already assigned in this week's plan (rotation diversity)
  const planAssignedCountMap: Record<string, number> = {};
  assignedShoeNamesThisWeek.forEach((name) => {
    const key = name.trim().toLowerCase();
    planAssignedCountMap[key] = (planAssignedCountMap[key] || 0) + 1;
  });

  const workoutType = workout.type in CATEGORY_PREFERENCE ? workout.type : '조깅';
  const pref = CATEGORY_PREFERENCE[workoutType];
  const now = Date.now();

  interface ScoredShoe {
    shoe: RunningShoe;
    score: number;
    matchReason: string;
    rotationReason: string;
  }

  const scoredList: ScoredShoe[] = shoes.map((shoe) => {
    const shoeKey = shoe.name.trim().toLowerCase();

    // A. Category compatibility score (0 ~ 60)
    let categoryScore = pref[shoe.category] ?? 30;

    // Intensity bonus/penalty
    if (workout.intensity === '높음') {
      if (shoe.category === '스피드' || shoe.category === '레이싱') {
        categoryScore += 15;
      } else if (shoe.category === '데일리' && shoe.name.includes('맥스')) {
        categoryScore -= 10;
      }
    } else if (workout.intensity === '낮음') {
      if (shoe.category === '데일리' || shoe.category === '장거리') {
        categoryScore += 15;
      } else if (shoe.category === '레이싱') {
        categoryScore -= 20;
      }
    }

    // Distance consideration (e.g. LSD > 20km)
    if (workout.distanceKm >= 20 && shoe.category === '장거리') {
      categoryScore += 15;
    }

    // B. Historical usage frequency & freshness rotation bonus ("자주 안 신은 신발 돌리기")
    // Find past uses (check exact name or includes)
    let pastUses = usageCountMap[shoeKey] || 0;
    let lastUsedTime = lastUsedTimestampMap[shoeKey] || 0;

    if (!pastUses) {
      // Fuzzy check if shoe.name is partially matched in recorded shoeName
      for (const [recordedName, count] of Object.entries(usageCountMap)) {
        if (recordedName.includes(shoeKey) || shoeKey.includes(recordedName)) {
          pastUses = count;
          lastUsedTime = lastUsedTimestampMap[recordedName] || 0;
          break;
        }
      }
    }

    let historyBonus = 0;
    let rotationReason = '';

    if (pastUses === 0) {
      // Never worn in recent sessions: top rotation priority!
      historyBonus = 35;
      rotationReason = '최근 착용 이력이 없어 미드솔 복원 및 균등 순환 추천';
    } else {
      const daysSinceLastUse = lastUsedTime > 0 ? (now - lastUsedTime) / (1000 * 60 * 60 * 24) : 999;
      if (daysSinceLastUse >= 14) {
        historyBonus = 25;
        rotationReason = `최근 2주 이상 미착용(${pastUses}회) 신발 우선 로테이션`;
      } else if (daysSinceLastUse >= 7) {
        historyBonus = 15;
        rotationReason = `지난주 이후 충분한 폼 회복 완료(${pastUses}회 착용)`;
      } else if (pastUses <= 2) {
        historyBonus = 10;
        rotationReason = '누적 착용 빈도가 적어 주간 순환 배정';
      } else {
        historyBonus = Math.max(0, 15 - pastUses * 4);
        rotationReason = '훈련 목적에 맞춘 최적화 매칭';
      }
    }

    // Cooldown penalty if worn in the very most recent workout
    if (
      mostRecentSessionShoeName &&
      (mostRecentSessionShoeName.includes(shoeKey) || shoeKey.includes(mostRecentSessionShoeName))
    ) {
      historyBonus -= 25;
      rotationReason = '직전 훈련 연속 착용 방지 및 다른 신발 순환';
    }

    // C. Weekly rotation penalty (if already chosen for another workout this week)
    const weekAssigned = planAssignedCountMap[shoeKey] || 0;
    const weekPenalty = weekAssigned * 50; // Heavy penalty to ensure variety across 7 days

    // D. Cumulative mileage tie-breaker (lower mileage shoes slightly prioritized)
    const mileageTieBreaker = Math.max(0, 10 - Math.min(10, Math.floor(shoe.mileage / 100)));

    const totalScore = categoryScore + historyBonus - weekPenalty + mileageTieBreaker;

    // Craft matching reason text
    let matchReason = '';
    if (workoutType === '인터벌') {
      matchReason =
        shoe.category === '스피드' || shoe.category === '레이싱'
          ? '스피드 인터벌의 폭발적 탄성 & 경량성 지원'
          : '가벼운 페이스 가속 훈련에 적합';
    } else if (workoutType === '템포런') {
      matchReason =
        shoe.category === '스피드' || shoe.category === '레이싱'
          ? '젖산 역치 페이스 지속주에 최적화된 반발력'
          : '안정적인 템포 주행감 제공';
    } else if (workoutType === 'LSD') {
      matchReason =
        shoe.category === '장거리'
          ? '장거리 롱런 시 관절 충격을 완화하는 풍부한 쿠셔닝'
          : '장거리 지속주 피로를 흡수하는 안정적 쿠셔닝';
    } else {
      matchReason =
        shoe.category === '데일리'
          ? '부드러운 충격 흡수와 편안한 착화감의 데일리 트레이너'
          : '가벼운 유산소 회복 조깅에 적합';
    }

    return {
      shoe,
      score: totalScore,
      matchReason,
      rotationReason,
    };
  });

  // Sort descending by score
  scoredList.sort((a, b) => b.score - a.score);
  const best = scoredList[0];
  if (!best) return undefined;

  const combinedReason = `${best.matchReason} · ${best.rotationReason}`;

  return {
    shoeId: best.shoe.id,
    shoeName: best.shoe.name,
    brand: best.shoe.brand,
    category: best.shoe.category,
    reason: combinedReason,
  };
}

/**
 * Enriches an entire weekly plan with rotation-aware shoe recommendations
 */
export function attachShoeRecommendationsToPlan(
  plan: WeeklyPlanDay[],
  shoes: RunningShoe[],
  recentSessions: TrainingSession[] = []
): WeeklyPlanDay[] {
  if (!shoes || shoes.length === 0) return plan;

  const assignedShoeNames: string[] = [];

  return plan.map((day) => {
    if (day.type === '휴식' || day.isCompleted) {
      return {
        ...day,
        recommendedShoe: undefined,
      };
    }

    // If day already has a custom/manually selected shoe that the user locked in, preserve it
    const rec = recommendShoeForWorkout(
      {
        type: day.type,
        intensity: day.intensity,
        distanceKm: day.distanceKm,
        title: day.title,
      },
      shoes,
      recentSessions,
      assignedShoeNames
    );

    if (rec) {
      assignedShoeNames.push(rec.shoeName);
    }

    return {
      ...day,
      recommendedShoe: rec || day.recommendedShoe,
    };
  });
}
