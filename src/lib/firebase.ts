/**
 * Firebase Firestore Database Integration & Async CRUD Layer
 *
 * ==============================================================================
 * [Firebase DB 초기화 및 설정 객체 (Initialization Placeholder)]
 *
 * 모바일/PC 등 여러 기기에서 실시간 동기화를 원하시면 아래 설정 객체에
 * 사용자의 Firebase 프로젝트 정보를 직접 입력해 주세요.
 * (Firebase Console -> 프로젝트 설정 -> 일반 -> 내 앱 -> 웹 앱 구성)
 * ==============================================================================
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import {
  PhysicalInfo,
  RunningShoe,
  RegisteredRace,
  RunningRecords,
  RunningGoals,
  TrainingSession,
  WeeklyPlanDay,
} from '../types';
import { INITIAL_RUNNING_SHOES } from './shoeData';
import provisionedConfig from '../../firebase-applet-config.json';

// Provisioned Firebase Cloud Project Config
export const firebaseConfig = {
  apiKey: provisionedConfig.apiKey || "",
  authDomain: provisionedConfig.authDomain || "",
  projectId: provisionedConfig.projectId || "",
  storageBucket: provisionedConfig.storageBucket || "",
  messagingSenderId: provisionedConfig.messagingSenderId || "",
  appId: provisionedConfig.appId || "",
};

// Local storage key for custom runtime override if needed
const RUNNER_FB_CONFIG_KEY = 'runner_custom_firebase_config';

export function getActiveFirebaseConfig() {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      const saved = window.localStorage.getItem(RUNNER_FB_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.projectId && parsed.projectId.trim() && parsed.projectId !== 'YOUR_PROJECT_ID') {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.error('Failed to parse saved Firebase config', e);
  }

  // Use provisioned config from Firebase backend
  if (
    firebaseConfig.projectId &&
    firebaseConfig.projectId.trim() &&
    firebaseConfig.projectId !== 'YOUR_PROJECT_ID'
  ) {
    return firebaseConfig;
  }

  return null;
}

export function saveRuntimeFirebaseConfig(config: typeof firebaseConfig) {
  localStorage.setItem(RUNNER_FB_CONFIG_KEY, JSON.stringify(config));
  window.location.reload();
}

export function clearRuntimeFirebaseConfig() {
  localStorage.removeItem(RUNNER_FB_CONFIG_KEY);
  window.location.reload();
}

let firebaseAppInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let isFirebaseConnected = false;

const activeConfig = getActiveFirebaseConfig();

if (activeConfig && activeConfig.projectId) {
  try {
    firebaseAppInstance = getApps().length > 0 ? getApp() : initializeApp(activeConfig);
    // Initialize Firestore with specific database ID if configured, or default
    if (provisionedConfig.firestoreDatabaseId && provisionedConfig.firestoreDatabaseId !== '(default)') {
      firestoreInstance = getFirestore(firebaseAppInstance, provisionedConfig.firestoreDatabaseId);
    } else {
      firestoreInstance = getFirestore(firebaseAppInstance);
    }
    isFirebaseConnected = true;
    console.log('[Firebase] Cloud Firestore initialized with projectId:', activeConfig.projectId);

    // Validate server connection (per Firebase skill guidelines)
    getDocFromServer(doc(firestoreInstance, 'test', 'connection'))
      .catch((err) => {
        // Document doesn't need to exist; catching network error only
        if (err instanceof Error && err.message.includes('the client is offline')) {
          console.warn('[Firebase] Client is offline or Firestore is unreachable:', err.message);
        }
      });
  } catch (err) {
    console.warn('[Firebase] Init failed, falling back to local async sync mode:', err);
    isFirebaseConnected = false;
  }
} else {
  console.info(
    '[Firebase] Placeholder detected. Operating in asynchronous local-sync mode until Firebase Config is configured.'
  );
}

export function getDbConnectionStatus(): {
  isCloud: boolean;
  projectId: string;
} {
  return {
    isCloud: isFirebaseConnected && !!firestoreInstance,
    projectId: activeConfig?.projectId || '로컬 스토리지 모드 (Config 미입력)',
  };
}

/* ============================================================================
 * Initial Seed Data for immediate preview and testing
 * ============================================================================ */
const DEFAULT_PHYSICAL: PhysicalInfo = {
  height: 176,
  weight: 68.5,
  age: 33,
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_SHOES: RunningShoe[] = INITIAL_RUNNING_SHOES;

const DEFAULT_RACES: RegisteredRace[] = [
  {
    id: 'race-1',
    name: '2026 JTBC 서울 마라톤',
    date: '2026-11-01',
    course: '풀 (42.195km)',
    location: '서울 상암월드컵경기장 ~ 잠실종합운동장',
    websiteUrl: 'https://marathon.jtbc.com',
    isTarget: true,
    createdAt: '2026-08-01',
  },
  {
    id: 'race-2',
    name: '2026 조선일보 춘천마라톤',
    date: '2026-10-25',
    course: '풀 (42.195km)',
    location: '강원도 춘천시 공지천 의암호 순환코스',
    websiteUrl: 'https://marathon.chosun.com',
    isTarget: false,
    createdAt: '2026-08-10',
  },
];

const DEFAULT_RECORDS: RunningRecords = {
  pb5k: '00:20:45',
  pb10k: '00:43:10',
  pbHalf: '01:36:25',
  pbFull: '03:24:50',
  maxHr: 191,
  thresholdHr: 172,
  updatedAt: new Date().toISOString(),
};

const DEFAULT_GOALS: RunningGoals = {
  target10k: '00:39:59',
  targetHalf: '01:29:59',
  targetFull: '03:09:59',
  targetRaceName: '2026 JTBC 서울 마라톤 (Sub-310 달성)',
  updatedAt: new Date().toISOString(),
};

const DEFAULT_TRAINING_SESSIONS: TrainingSession[] = [
  {
    id: 'ts-2026-09-20',
    date: '2026-09-20',
    title: '주말 25km LSD 장거리 지속주 (한강 남단 코스)',
    totalDistanceKm: 25.12,
    totalTime: '02:08:40',
    avgPace: "5'07\"",
    avgHr: 148,
    maxHr: 165,
    notes: '가을 바람이 시원하여 후반부에도 호흡이 안정적이었음. 20km 지점 파워젤 섭취.',
    laps: [
      { lap: 1, time: '05:22', cumulativeTime: '05:22', distanceKm: 1.0, avgPace: "5'22\"", avgHr: 132, maxHr: 140 },
      { lap: 2, time: '05:14', cumulativeTime: '10:36', distanceKm: 1.0, avgPace: "5'14\"", avgHr: 138, maxHr: 144 },
      { lap: 3, time: '05:09', cumulativeTime: '15:45', distanceKm: 1.0, avgPace: "5'09\"", avgHr: 142, maxHr: 147 },
      { lap: 4, time: '05:08', cumulativeTime: '20:53', distanceKm: 1.0, avgPace: "5'08\"", avgHr: 145, maxHr: 150 },
      { lap: 5, time: '05:05', cumulativeTime: '25:58', distanceKm: 1.0, avgPace: "5'05\"", avgHr: 147, maxHr: 153 },
      { lap: 6, time: '05:04', cumulativeTime: '31:02', distanceKm: 1.0, avgPace: "5'04\"", avgHr: 148, maxHr: 155 },
      { lap: 7, time: '05:02', cumulativeTime: '36:04', distanceKm: 1.0, avgPace: "5'02\"", avgHr: 150, maxHr: 157 },
      { lap: 8, time: '04:58', cumulativeTime: '41:02', distanceKm: 1.0, avgPace: "4'58\"", avgHr: 153, maxHr: 162 },
    ],
    createdAt: '2026-09-20T10:30:00Z',
  },
  {
    id: 'ts-2026-09-16',
    date: '2026-09-16',
    title: '수요일 10km 젖산 역치 템포런 (트랙 25바퀴)',
    totalDistanceKm: 10.05,
    totalTime: '00:44:12',
    avgPace: "4'24\"",
    avgHr: 168,
    maxHr: 179,
    notes: 'Zone 4 역치 심박을 유지하며 마지막 1km 빌드업으로 피니시.',
    laps: [
      { lap: 1, time: '04:40', cumulativeTime: '04:40', distanceKm: 1.0, avgPace: "4'40\"", avgHr: 149, maxHr: 158 },
      { lap: 2, time: '04:28', cumulativeTime: '09:08', distanceKm: 1.0, avgPace: "4'28\"", avgHr: 162, maxHr: 169 },
      { lap: 3, time: '04:25', cumulativeTime: '13:33', distanceKm: 1.0, avgPace: "4'25\"", avgHr: 167, maxHr: 172 },
      { lap: 4, time: '04:22', cumulativeTime: '17:55', distanceKm: 1.0, avgPace: "4'22\"", avgHr: 170, maxHr: 175 },
      { lap: 5, time: '04:18', cumulativeTime: '22:13', distanceKm: 1.0, avgPace: "4'18\"", avgHr: 173, maxHr: 179 },
    ],
    createdAt: '2026-09-16T20:15:00Z',
  },
  {
    id: 'ts-2026-08-28',
    date: '2026-08-28',
    title: '퇴근길 회복 Zone 2 조깅',
    totalDistanceKm: 8.2,
    totalTime: '00:46:40',
    avgPace: "5'41\"",
    avgHr: 133,
    maxHr: 142,
    notes: '호흡을 코로만 쉬며 심박수 135 미만 철저히 제어.',
    laps: [
      { lap: 1, time: '05:55', cumulativeTime: '05:55', distanceKm: 1.0, avgPace: "5'55\"", avgHr: 125, maxHr: 132 },
      { lap: 2, time: '05:42', cumulativeTime: '11:37', distanceKm: 1.0, avgPace: "5'42\"", avgHr: 131, maxHr: 137 },
      { lap: 3, time: '05:38', cumulativeTime: '17:15', distanceKm: 1.0, avgPace: "5'38\"", avgHr: 134, maxHr: 140 },
    ],
    createdAt: '2026-08-28T19:00:00Z',
  },
];

/* Helper for local fallback persistence */
function getLocalItem<T>(key: string, defaultVal: T): T {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      const s = window.localStorage.getItem(`pace_master_${key}`);
      return s ? JSON.parse(s) : defaultVal;
    }
    return defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocalItem<T>(key: string, val: T): void {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.setItem(`pace_master_${key}`, JSON.stringify(val));
    }
  } catch (e) {
    console.error('LocalStorage write error', e);
  }
}

/* ============================================================================
 * Async CRUD Operations: 1. Physical Info (신체 정보)
 * ============================================================================ */
export async function getPhysicalInfo(): Promise<PhysicalInfo> {
  if (firestoreInstance) {
    try {
      const snap = await getDoc(doc(firestoreInstance, 'runner_data', 'physical'));
      if (snap.exists()) {
        return snap.data() as PhysicalInfo;
      }
    } catch (e) {
      console.warn('Firestore getPhysicalInfo failed, reading local', e);
    }
  }
  return getLocalItem<PhysicalInfo>('physical', DEFAULT_PHYSICAL);
}

export async function savePhysicalInfo(data: PhysicalInfo): Promise<void> {
  const updated = { ...data, updatedAt: new Date().toISOString() };
  setLocalItem('physical', updated);

  if (firestoreInstance) {
    try {
      await setDoc(doc(firestoreInstance, 'runner_data', 'physical'), updated, { merge: true });
    } catch (e) {
      console.error('Firestore savePhysicalInfo failed', e);
    }
  }
}

/* ============================================================================
 * Async CRUD Operations: 2. Running Shoes (러닝화)
 * ============================================================================ */
export async function getShoes(): Promise<RunningShoe[]> {
  if (firestoreInstance) {
    try {
      const colRef = collection(firestoreInstance, 'shoes');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RunningShoe));
      }
    } catch (e) {
      console.warn('Firestore getShoes failed, reading local', e);
    }
  }

  // Version check for shoe migration: if stored list has old shoes, upgrade to requested 41 shoes
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    const storedVersion = window.localStorage.getItem('pace_master_shoes_v3_synced');
    if (storedVersion !== '41_collection_v3_zero_init') {
      setLocalItem('shoes', DEFAULT_SHOES);
      window.localStorage.setItem('pace_master_shoes_v3_synced', '41_collection_v3_zero_init');
      return DEFAULT_SHOES;
    }
  }

  return getLocalItem<RunningShoe[]>('shoes', DEFAULT_SHOES);
}

export async function setAllShoes(shoesList: RunningShoe[]): Promise<void> {
  setLocalItem('shoes', shoesList);
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    window.localStorage.setItem('pace_master_shoes_v3_synced', '41_collection_v3_zero_init');
  }

  if (firestoreInstance) {
    try {
      // Overwrite collection
      for (const shoe of shoesList) {
        await setDoc(doc(firestoreInstance, 'shoes', shoe.id), shoe);
      }
    } catch (e) {
      console.error('Firestore setAllShoes failed', e);
    }
  }
}

export async function resetShoesToDefault(): Promise<RunningShoe[]> {
  await setAllShoes(DEFAULT_SHOES);
  return DEFAULT_SHOES;
}

export async function addShoe(shoe: Omit<RunningShoe, 'id'>): Promise<RunningShoe> {
  const newShoe: RunningShoe = {
    ...shoe,
    id: `shoe_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  };

  const current = await getShoes();
  const nextList = [newShoe, ...current];
  setLocalItem('shoes', nextList);

  if (firestoreInstance) {
    try {
      await setDoc(doc(firestoreInstance, 'shoes', newShoe.id), newShoe);
    } catch (e) {
      console.error('Firestore addShoe failed', e);
    }
  }

  return newShoe;
}

export async function updateShoe(updatedShoe: RunningShoe): Promise<void> {
  const current = await getShoes();
  const nextList = current.map((s) => (s.id === updatedShoe.id ? updatedShoe : s));
  setLocalItem('shoes', nextList);

  if (firestoreInstance) {
    try {
      await setDoc(doc(firestoreInstance, 'shoes', updatedShoe.id), updatedShoe, { merge: true });
    } catch (e) {
      console.error('Firestore updateShoe failed', e);
    }
  }
}

export async function deleteShoe(shoeId: string): Promise<void> {
  const current = await getShoes();
  const nextList = current.filter((s) => s.id !== shoeId);
  setLocalItem('shoes', nextList);

  if (firestoreInstance) {
    try {
      await deleteDoc(doc(firestoreInstance, 'shoes', shoeId));
    } catch (e) {
      console.error('Firestore deleteShoe failed', e);
    }
  }
}

/* ============================================================================
 * Async CRUD Operations: 3. Registered Races & D-Day (참가 대회)
 * ============================================================================ */
export async function getRaces(): Promise<RegisteredRace[]> {
  if (firestoreInstance) {
    try {
      const snap = await getDocs(collection(firestoreInstance, 'races'));
      if (!snap.empty) {
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RegisteredRace));
      }
    } catch (e) {
      console.warn('Firestore getRaces failed, reading local', e);
    }
  }
  return getLocalItem<RegisteredRace[]>('races', DEFAULT_RACES);
}

export async function addRace(race: Omit<RegisteredRace, 'id'>): Promise<RegisteredRace> {
  const newRace: RegisteredRace = {
    ...race,
    id: `race_${Date.now()}`,
  };

  const current = await getRaces();
  const nextList = [...current, newRace].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  setLocalItem('races', nextList);

  if (firestoreInstance) {
    try {
      await setDoc(doc(firestoreInstance, 'races', newRace.id), newRace);
    } catch (e) {
      console.error('Firestore addRace failed', e);
    }
  }

  return newRace;
}

export async function deleteRace(raceId: string): Promise<void> {
  const current = await getRaces();
  const nextList = current.filter((r) => r.id !== raceId);
  setLocalItem('races', nextList);

  if (firestoreInstance) {
    try {
      await deleteDoc(doc(firestoreInstance, 'races', raceId));
    } catch (e) {
      console.error('Firestore deleteRace failed', e);
    }
  }
}

/* ============================================================================
 * Async CRUD Operations: 4. Running Records (PB & HR)
 * ============================================================================ */
export async function getRunningRecords(): Promise<RunningRecords> {
  if (firestoreInstance) {
    try {
      const snap = await getDoc(doc(firestoreInstance, 'runner_data', 'records'));
      if (snap.exists()) {
        return snap.data() as RunningRecords;
      }
    } catch (e) {
      console.warn('Firestore getRunningRecords failed, reading local', e);
    }
  }
  return getLocalItem<RunningRecords>('records', DEFAULT_RECORDS);
}

export async function saveRunningRecords(records: RunningRecords): Promise<void> {
  const updated = { ...records, updatedAt: new Date().toISOString() };
  setLocalItem('records', updated);

  if (firestoreInstance) {
    try {
      await setDoc(doc(firestoreInstance, 'runner_data', 'records'), updated, { merge: true });
    } catch (e) {
      console.error('Firestore saveRunningRecords failed', e);
    }
  }
}

/* ============================================================================
 * Async CRUD Operations: 5. Running Goals (러닝 목표)
 * ============================================================================ */
export async function getRunningGoals(): Promise<RunningGoals> {
  if (firestoreInstance) {
    try {
      const snap = await getDoc(doc(firestoreInstance, 'runner_data', 'goals'));
      if (snap.exists()) {
        return snap.data() as RunningGoals;
      }
    } catch (e) {
      console.warn('Firestore getRunningGoals failed, reading local', e);
    }
  }
  return getLocalItem<RunningGoals>('goals', DEFAULT_GOALS);
}

export async function saveRunningGoals(goals: RunningGoals): Promise<void> {
  const updated = { ...goals, updatedAt: new Date().toISOString() };
  setLocalItem('goals', updated);

  if (firestoreInstance) {
    try {
      await setDoc(doc(firestoreInstance, 'runner_data', 'goals'), updated, { merge: true });
    } catch (e) {
      console.error('Firestore saveRunningGoals failed', e);
    }
  }
}

/* ============================================================================
 * Async CRUD Operations: 6. Training Sessions & Laps (CSV 훈련 기록)
 * ============================================================================ */
export async function getTrainingSessions(): Promise<TrainingSession[]> {
  if (firestoreInstance) {
    try {
      const snap = await getDocs(collection(firestoreInstance, 'training_sessions'));
      if (!snap.empty) {
        return snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as TrainingSession))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
    } catch (e) {
      console.warn('Firestore getTrainingSessions failed, reading local', e);
    }
  }
  const local = getLocalItem<TrainingSession[]>('training_sessions', DEFAULT_TRAINING_SESSIONS);
  return local.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function addTrainingSession(
  session: Omit<TrainingSession, 'id' | 'createdAt'>
): Promise<TrainingSession> {
  const newSession: TrainingSession = {
    ...session,
    id: `ts_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  const current = await getTrainingSessions();
  const nextList = [newSession, ...current];
  setLocalItem('training_sessions', nextList);

  if (firestoreInstance) {
    try {
      await setDoc(doc(firestoreInstance, 'training_sessions', newSession.id), newSession);
    } catch (e) {
      console.error('Firestore addTrainingSession failed', e);
    }
  }

  return newSession;
}

export async function deleteTrainingSession(sessionId: string): Promise<void> {
  const current = await getTrainingSessions();
  const nextList = current.filter((s) => s.id !== sessionId);
  setLocalItem('training_sessions', nextList);

  if (firestoreInstance) {
    try {
      await deleteDoc(doc(firestoreInstance, 'training_sessions', sessionId));
    } catch (e) {
      console.error('Firestore deleteTrainingSession failed', e);
    }
  }
}

/* ============================================================================
 * Async CRUD Operations: 7. Weekly Training Plan (일자별 주간훈련 상세계획표)
 * ============================================================================ */
export async function getWeeklyPlan(): Promise<WeeklyPlanDay[]> {
  if (firestoreInstance) {
    try {
      const snap = await getDoc(doc(firestoreInstance, 'runner_data', 'weekly_plan'));
      if (snap.exists() && snap.data().days) {
        return snap.data().days as WeeklyPlanDay[];
      }
    } catch (e) {
      console.warn('Firestore getWeeklyPlan failed, reading local', e);
    }
  }
  return getLocalItem<WeeklyPlanDay[]>('weekly_plan', []);
}

export async function saveWeeklyPlan(days: WeeklyPlanDay[]): Promise<void> {
  setLocalItem('weekly_plan', days);

  if (firestoreInstance) {
    try {
      await setDoc(doc(firestoreInstance, 'runner_data', 'weekly_plan'), {
        days,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Firestore saveWeeklyPlan failed', e);
    }
  }
}
