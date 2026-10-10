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
export const CATEGORY_PREFERENCE: Record<string, Record<ShoeCategory, number>> = {
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
 * Cross-Week Shoe Rotation Tracker:
 * Ensures dynamic shoe variety across weeks (Week 1, Week 2, Week 3, ...)
 * and actively factors in shoes actually worn in real training records.
 */
export interface ShoeRotationTracker {
  // Cumulative number of times recommended across the entire multi-week plan
  planCumulativeCounts: Record<string, number>;
  // Last week number a shoe was assigned for each workout type: `${shoeKey}_${workoutType}` -> weekNum
  lastAssignedWeekByType: Record<string, number>;
  // Last week number a shoe was assigned in general: shoeKey -> weekNum
  lastAssignedWeek: Record<string, number>;
  // Actual sessions where shoes were worn: shoeKey -> array of dates
  actualWornHistory: Record<string, { date: string; shoeName: string; workoutType?: string }[]>;
  // Last actual date shoe was worn: shoeKey -> timestamp
  lastActualWornTimestamp: Record<string, number>;
}

export function createShoeRotationTracker(
  shoes: RunningShoe[],
  trainingSessions: TrainingSession[] = []
): ShoeRotationTracker {
  const tracker: ShoeRotationTracker = {
    planCumulativeCounts: {},
    lastAssignedWeekByType: {},
    lastAssignedWeek: {},
    actualWornHistory: {},
    lastActualWornTimestamp: {},
  };

  shoes.forEach((s) => {
    const key = s.name.trim().toLowerCase();
    tracker.planCumulativeCounts[key] = 0;
  });

  // Populate actual wear history from real training sessions
  trainingSessions.forEach((s) => {
    if (s.shoeName && s.shoeName.trim()) {
      const key = s.shoeName.trim().toLowerCase();
      if (!tracker.actualWornHistory[key]) {
        tracker.actualWornHistory[key] = [];
      }
      tracker.actualWornHistory[key].push({
        date: s.date,
        shoeName: s.shoeName,
      });

      const t = new Date(s.date).getTime();
      if (!tracker.lastActualWornTimestamp[key] || t > tracker.lastActualWornTimestamp[key]) {
        tracker.lastActualWornTimestamp[key] = t;
      }
    }
  });

  return tracker;
}

/**
 * Recommend a shoe for a specific workout considering type, intensity, actual wear history,
 * and cross-week rotation balance.
 */
export function recommendShoeForWorkout(
  workout: { type: string; intensity: string; distanceKm: number; title: string },
  shoes: RunningShoe[],
  recentSessions: TrainingSession[] = [],
  assignedShoeNamesThisWeek: string[] = [],
  weekNumber: number = 1,
  rotationTracker?: ShoeRotationTracker
): RecommendedShoeInfo | undefined {
  if (!shoes || shoes.length === 0) return undefined;
  if (workout.type === '휴식') return undefined;

  // 1. Analyze historical usage from recent training records
  const usageCountMap: Record<string, number> = {};
  const lastUsedTimestampMap: Record<string, number> = {};

  const sortedSessions = [...recentSessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

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

  // Count times already assigned in this week's plan (within 7 days)
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
        categoryScore += 18;
      } else if (shoe.category === '데일리' && shoe.name.includes('맥스')) {
        categoryScore -= 10;
      }
    } else if (workout.intensity === '낮음') {
      if (shoe.category === '데일리' || shoe.category === '장거리') {
        categoryScore += 16;
      } else if (shoe.category === '레이싱') {
        categoryScore -= 22;
      }
    }

    // Distance consideration (e.g. LSD > 18km)
    if (workout.distanceKm >= 18 && shoe.category === '장거리') {
      categoryScore += 16;
    }

    // B. Real Actual Wear History Reflection ("실제 신은 신발 참고")
    let actualWearBonus = 0;
    let actualWearReason = '';

    const actualCount = usageCountMap[shoeKey] || 0;
    const lastActualTime =
      lastUsedTimestampMap[shoeKey] ||
      (rotationTracker?.lastActualWornTimestamp[shoeKey] || 0);

    if (actualCount > 0 && lastActualTime > 0) {
      const daysSinceActualUse = (now - lastActualTime) / (1000 * 60 * 60 * 24);
      if (daysSinceActualUse < 1.8) {
        // Just worn yesterday or 2 days ago in reality: let foam rest!
        actualWearBonus -= 25;
        actualWearReason = '실제 직전 훈련 착용 신발로 미드솔 폼 복원 휴식 부여';
      } else if (daysSinceActualUse >= 5 && daysSinceActualUse <= 14) {
        // Fully recovered and ready to rotate back
        actualWearBonus += 15;
        actualWearReason = `실제 훈련 ${Math.round(daysSinceActualUse)}일 전 착용 후 충분한 폼 회복 완료`;
      } else if (daysSinceActualUse > 14) {
        // Unworn for 2+ weeks in reality: prioritize rotating it in!
        actualWearBonus += 25;
        actualWearReason = '최근 2주간 실제 미착용 신발 우선 로테이션 추천';
      }
    } else {
      // Never worn in actual records: highest rotation priority!
      actualWearBonus += 30;
      actualWearReason = '실제 훈련 미착용 신발로 마일리지 균등 분산 순환';
    }

    // Direct penalty if worn in the very most recent session
    if (
      mostRecentSessionShoeName &&
      (mostRecentSessionShoeName.includes(shoeKey) || shoeKey.includes(mostRecentSessionShoeName))
    ) {
      actualWearBonus -= 30;
      actualWearReason = '직전 실제 훈련 연속 착용 방지 및 다른 러닝화 순환';
    }

    // C. Weekly intra-plan rotation penalty (already chosen on another day this week)
    const weekAssigned = planAssignedCountMap[shoeKey] || 0;
    const weekPenalty = weekAssigned * 55; // Heavy penalty within same week

    // D. Multi-Week Plan Rotation & Variety (주차별 순환 다양성)
    let multiWeekRotationBonus = 0;
    let crossWeekReason = '';

    if (rotationTracker) {
      const typeKey = `${shoeKey}_${workoutType}`;
      const lastAssignedWeekForThisType = rotationTracker.lastAssignedWeekByType[typeKey];
      const planCumulativeAssigned = rotationTracker.planCumulativeCounts[shoeKey] || 0;

      // 1) If this shoe was assigned for the exact same workout type last week (w - 1),
      // give OTHER compatible shoes a healthy boost to alternate weeks!
      if (lastAssignedWeekForThisType === weekNumber - 1) {
        multiWeekRotationBonus -= 25; // Don't assign the exact same shoe every week!
      } else if (lastAssignedWeekForThisType && lastAssignedWeekForThisType <= weekNumber - 2) {
        multiWeekRotationBonus += 20; // Ready for alternate week rotation!
        crossWeekReason = `지난 ${lastAssignedWeekForThisType}주차 착용 후 이번주 교차 순환 배정`;
      }

      // 2) Cumulative plan balance: shoes recommended less often across the plan get prioritized
      // so one shoe doesn't hog all 52 weeks while another sits unused
      const cumulativePenalty = planCumulativeAssigned * 8;
      multiWeekRotationBonus -= cumulativePenalty;

      // 3) Week-based alternating rotation seed:
      // Even weeks slightly favor different compatible shoes from odd weeks
      const shoeIndex = shoes.findIndex((s) => s.id === shoe.id);
      if ((weekNumber + shoeIndex) % 2 === 0) {
        multiWeekRotationBonus += 12;
      }
    }

    // E. Total Score Calculation
    const totalScore =
      categoryScore +
      actualWearBonus +
      multiWeekRotationBonus -
      weekPenalty;

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

    const rotationReason =
      crossWeekReason || actualWearReason || '주차별 마일리지 균형 로테이션';

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
 * Enriches an entire weekly plan with rotation-aware shoe recommendations,
 * updating the continuous rolling tracker across weeks.
 */
export function attachShoeRecommendationsToPlan(
  plan: WeeklyPlanDay[],
  shoes: RunningShoe[],
  recentSessions: TrainingSession[] = [],
  weekNumber: number = 1,
  rotationTracker?: ShoeRotationTracker
): WeeklyPlanDay[] {
  if (!shoes || shoes.length === 0) return plan;

  const assignedShoeNames: string[] = [];

  return plan.map((day) => {
    // 1. Rest day
    if (day.type === '휴식') {
      return {
        ...day,
        recommendedShoe: undefined,
      };
    }

    // 2. If day has an actual completed session with a shoe actually worn ("실제 신은 신발 반영")
    if (day.actualSession?.shoeName && day.actualSession.shoeName.trim()) {
      const wornName = day.actualSession.shoeName.trim();
      const matchedShoe = shoes.find(
        (s) => s.name.trim().toLowerCase() === wornName.toLowerCase()
      );

      // Update tracker so subsequent workouts know this shoe was actually worn on this date!
      if (rotationTracker) {
        const key = wornName.toLowerCase();
        rotationTracker.lastAssignedWeek[key] = weekNumber;
        rotationTracker.lastAssignedWeekByType[`${key}_${day.type}`] = weekNumber;
        rotationTracker.planCumulativeCounts[key] =
          (rotationTracker.planCumulativeCounts[key] || 0) + 1;
        if (day.dateStr) {
          rotationTracker.lastActualWornTimestamp[key] = new Date(day.dateStr).getTime();
        }
      }
      assignedShoeNames.push(wornName);

      return {
        ...day,
        recommendedShoe: {
          shoeId: matchedShoe?.id,
          shoeName: wornName,
          brand: matchedShoe?.brand,
          category: matchedShoe?.category,
          reason: '실제 착용 완료 · 훈련 기록 연동',
        },
      };
    }

    // 3. Planned workout: recommend shoe with cross-week rotation and actual wear awareness
    const rec = recommendShoeForWorkout(
      {
        type: day.type,
        intensity: day.intensity,
        distanceKm: day.distanceKm,
        title: day.title,
      },
      shoes,
      recentSessions,
      assignedShoeNames,
      weekNumber,
      rotationTracker
    );

    if (rec) {
      assignedShoeNames.push(rec.shoeName);

      // Update rolling tracker
      if (rotationTracker) {
        const key = rec.shoeName.trim().toLowerCase();
        rotationTracker.lastAssignedWeek[key] = weekNumber;
        rotationTracker.lastAssignedWeekByType[`${key}_${day.type}`] = weekNumber;
        rotationTracker.planCumulativeCounts[key] =
          (rotationTracker.planCumulativeCounts[key] || 0) + 1;
      }
    }

    return {
      ...day,
      recommendedShoe: rec || day.recommendedShoe,
    };
  });
}
