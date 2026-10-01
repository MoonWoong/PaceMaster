import { MarathonEvent } from '../types';
import SCRAPED_RACES_DATA from '../data/scrapedMarathons.json';

/**
 * Curated major premier marathon races
 */
const PREMIER_MARATHON_RACES: MarathonEvent[] = [
  {
    id: 'race-gyeongju-cherry-2027',
    title: '2027 제34회 경주 벚꽃 마라톤대회 (Gyeongju Cherry Blossom Marathon)',
    date: '2027-04-10',
    dayOfWeek: '토요일',
    region: '경상/대구/부산',
    courses: ['풀', '하프', '10K', '5K'],
    location: '경북 경주시 보문관광단지 헬기장 ~ 첨성대 벚꽃 코스',
    websiteUrl: 'https://cherrymarathon.com',
    status: '접수예정',
  },
  {
    id: 'race-gyeongju-intl-2027',
    title: '2027 동아일보 경주국제마라톤대회 (Gyeongju International Marathon)',
    date: '2027-10-17',
    dayOfWeek: '일요일',
    region: '경상/대구/부산',
    courses: ['풀', '하프', '10K', '5K'],
    location: '경북 경주시 시민운동장 및 시내 일원',
    websiteUrl: 'https://gyeongju-marathon.com',
    status: '접수예정',
  },
  {
    id: 'race-jtbc-2026',
    title: '2026 JTBC 서울 마라톤 (JTBC Seoul Marathon)',
    date: '2026-11-01',
    dayOfWeek: '일요일',
    region: '서울',
    courses: ['풀', '10K'],
    location: '서울 상암월드컵경기장 ~ 잠실종합운동장',
    websiteUrl: 'https://marathon.jtbc.com',
    status: '접수마감',
  },
  {
    id: 'race-chuncheon-2026',
    title: '2026 조선일보 춘천마라톤 (조마)',
    date: '2026-10-25',
    dayOfWeek: '일요일',
    region: '강원',
    courses: ['풀', '10K'],
    location: '강원 춘천시 공지천교 의암호 순환코스',
    websiteUrl: 'https://marathon.chosun.com',
    status: '마감임박',
  },
  {
    id: 'race-songdo-2026',
    title: '제15회 인천 송도국제마라톤대회',
    date: '2026-10-11',
    dayOfWeek: '일요일',
    region: '경기/인천',
    courses: ['하프', '10K', '5K'],
    location: '인천 연수구 송도 센트럴파크 일원',
    websiteUrl: 'http://www.songdorun.com',
    status: '접수중',
  },
  {
    id: 'race-gyeonggi-peace-2026',
    title: '2026 DMZ 평화통일 마라톤 대회',
    date: '2026-10-18',
    dayOfWeek: '일요일',
    region: '경기/인천',
    courses: ['풀', '하프', '10K', '5K'],
    location: '경기 파주시 임진각 평화누리 광장',
    websiteUrl: 'http://www.dmzpeace.co.kr',
    status: '접수중',
  },
  {
    id: 'race-daegu-2027',
    title: '2027 대구국제마라톤대회 (World Athletics Gold Label)',
    date: '2027-04-04',
    dayOfWeek: '일요일',
    region: '경상/대구/부산',
    courses: ['풀', '하프', '10K'],
    location: '대구 스타디움 및 시내 일원',
    websiteUrl: 'https://www.daegurace.com',
    status: '접수예정',
  },
  {
    id: 'race-seoul-donga-2027',
    title: '2027 동아일보 서울마라톤 (Seoul Marathon Platinum Label)',
    date: '2027-03-21',
    dayOfWeek: '일요일',
    region: '서울',
    courses: ['풀', '10K'],
    location: '서울 광화문 광장 ~ 잠실종합운동장',
    websiteUrl: 'https://seoul-marathon.com',
    status: '접수예정',
  },
  {
    id: 'race-daejeon-2026',
    title: '제23회 대전 3대하천 마라톤대회',
    date: '2026-10-31',
    dayOfWeek: '토요일',
    region: '충청/대전',
    courses: ['하프', '10K', '5K'],
    location: '대전 엑스포 시민광장 갑천변',
    websiteUrl: 'http://www.djmarathon.co.kr',
    status: '접수중',
  },
  {
    id: 'race-jeju-2026',
    title: '제21회 제주 감귤 국제마라톤대회',
    date: '2026-11-22',
    dayOfWeek: '일요일',
    region: '제주',
    courses: ['풀', '하프', '10K', '5K'],
    location: '제주 종합경기장 주경기장',
    websiteUrl: 'http://marathon.hallailbo.co.kr',
    status: '접수중',
  },
  {
    id: 'race-gwangju-2026',
    title: '2026 빛고을 광주 평화마라톤',
    date: '2026-11-14',
    dayOfWeek: '토요일',
    region: '전라/광주',
    courses: ['하프', '10K', '5K'],
    location: '광주 광산구 영산강변 자전거도로 일원',
    websiteUrl: 'http://www.gjmarathon.or.kr',
    status: '접수중',
  },
  {
    id: 'race-busan-beach-2026',
    title: '2026 부산 바다 하프마라톤 (광안대교 러닝)',
    date: '2026-10-24',
    dayOfWeek: '토요일',
    region: '경상/대구/부산',
    courses: ['하프', '10K', '5K'],
    location: '부산 벡스코 및 광안대교 상층부',
    websiteUrl: 'http://marathon.busan.com',
    status: '마감임박',
  },
];

/**
 * Clean & normalize title for deduplication comparison
 */
function normalizeTitle(title: string): string {
  return title
    .replace(/제\s*\d+\s*회/g, '')
    .replace(/202[5-7]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/**
 * Get today's local date string formatted as YYYY-MM-DD
 */
export function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Combined and deduplicated list of upcoming marathon races strictly from live scraped MarathonGo data
 * Filtered to exclude past events (>= today)
 */
function buildCombinedRaces(): MarathonEvent[] {
  const todayStr = getTodayDateStr();
  const seenTitles = new Set<string>();
  const combined: MarathonEvent[] = [];

  // Add scraped live races from MarathonGo
  const typedScraped = (SCRAPED_RACES_DATA as MarathonEvent[]) || [];
  for (const r of typedScraped) {
    if (r.date >= todayStr) {
      const key = normalizeTitle(r.title);
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        combined.push(r);
      }
    }
  }

  // Sort by date ascending (closest upcoming first)
  return combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export const MOCK_MARATHON_RACES: MarathonEvent[] = buildCombinedRaces();

/**
 * Filter marathon races excluding past dates and applying criteria
 */
export function getFilteredMarathons(
  races: MarathonEvent[],
  filters: {
    selectedRegions: string[];
    selectedCourses: string[];
    selectedDays: string[];
    searchQuery: string;
  },
  referenceDateStr?: string
): MarathonEvent[] {
  const todayDefault = getTodayDateStr();
  const refClean = (referenceDateStr || todayDefault).split('T')[0];
  const [ry, rm, rd] = refClean.split('-').map(Number);
  const refDate = new Date(ry, (rm || 1) - 1, rd || 1, 0, 0, 0, 0);

  return races.filter((race) => {
    // 1. Exclude past dates
    const raceClean = race.date.split('T')[0];
    const [ry2, rm2, rd2] = raceClean.split('-').map(Number);
    const raceDate = new Date(ry2, (rm2 || 1) - 1, rd2 || 1, 0, 0, 0, 0);
    if (raceDate < refDate) {
      return false;
    }

    // 2. Region filter
    if (
      filters.selectedRegions.length > 0 &&
      !filters.selectedRegions.includes(race.region)
    ) {
      return false;
    }

    // 3. Course filter
    if (filters.selectedCourses.length > 0) {
      const hasCourse = race.courses.some((c) =>
        filters.selectedCourses.includes(c)
      );
      if (!hasCourse) return false;
    }

    // 4. Day of week filter
    if (
      filters.selectedDays.length > 0 &&
      !filters.selectedDays.includes(race.dayOfWeek)
    ) {
      return false;
    }

    // 5. Search query
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim();
      const matchTitle = race.title.toLowerCase().includes(query);
      const matchLoc = race.location.toLowerCase().includes(query);
      if (!matchTitle && !matchLoc) return false;
    }

    return true;
  });
}

/**
 * Calculate D-day string and numeric value based dynamically on today's local date
 */
export function calculateDDay(
  targetDateStr: string,
  currentDateStr?: string
): { text: string; daysDiff: number; isPassed: boolean; isToday: boolean } {
  if (!targetDateStr) {
    return { text: '-', daysDiff: 0, isPassed: false, isToday: false };
  }

  // Parse target date YYYY-MM-DD
  const targetClean = targetDateStr.split('T')[0];
  const [tYear, tMonth, tDay] = targetClean.split('-').map(Number);
  const target = new Date(tYear, (tMonth || 1) - 1, tDay || 1, 0, 0, 0, 0);

  // Current date (today by default in local time)
  let current: Date;
  if (currentDateStr) {
    const currentClean = currentDateStr.split('T')[0];
    const [cYear, cMonth, cDay] = currentClean.split('-').map(Number);
    current = new Date(cYear, (cMonth || 1) - 1, cDay || 1, 0, 0, 0, 0);
  } else {
    const now = new Date();
    current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  const diffMs = target.getTime() - current.getTime();
  const daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) {
    return { text: 'D-Day', daysDiff: 0, isPassed: false, isToday: true };
  } else if (daysDiff > 0) {
    return { text: `D-${daysDiff}`, daysDiff, isPassed: false, isToday: false };
  } else {
    return { text: `D+${Math.abs(daysDiff)}`, daysDiff, isPassed: true, isToday: false };
  }
}
