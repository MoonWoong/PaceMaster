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
  deleteField,
  writeBatch,
} from 'firebase/firestore';
import {
  PhysicalInfo,
  RunningShoe,
  RegisteredRace,
  RunningRecords,
  RunningGoals,
  TrainingSession,
  WeeklyPlanDay,
  WeeklyPlanSettings,
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

export let firebaseAppInstance: FirebaseApp | null = null;
export let firestoreInstance: Firestore | null = null;
export let isFirebaseConnected = false;

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
    targetTime: '03:09:59',
    priority: 'A',
    importance: 'A-Race (메인 목표)',
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
    targetTime: '03:19:59',
    priority: 'B',
    importance: 'B-Race (중간 점검)',
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

const DEFAULT_TRAINING_SESSIONS: TrainingSession[] = [];

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

/**
 * Recursively cleans objects and arrays to prevent Firestore from throwing:
 * "Function setDoc() called with invalid data. Unsupported field value: undefined"
 *
 * - When convertUndefinedToDeleteField is true (used for setDoc with merge: true):
 *   top-level properties with undefined values are converted to deleteField() so Firestore
 *   removes those fields from the document.
 * - When convertUndefinedToDeleteField is false (used for document creation or nested objects):
 *   properties with undefined values are omitted entirely.
 */
export function cleanFirestoreData<T>(obj: T, convertUndefinedToDeleteField = false): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item, false)) as unknown as T;
  }

  if (typeof obj === 'object') {
    // Preserve Firestore FieldValues (like deleteField()) and non-plain Objects (Date, etc.)
    if (obj.constructor && obj.constructor.name !== 'Object') {
      return obj;
    }

    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val === undefined) {
        if (convertUndefinedToDeleteField) {
          cleaned[key] = deleteField();
        }
        // Otherwise omit key
      } else if (val !== null && typeof val === 'object') {
        cleaned[key] = cleanFirestoreData(val, false);
      } else {
        cleaned[key] = val;
      }
    }
    return cleaned as T;
  }

  return obj;
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
      await setDoc(doc(firestoreInstance, 'runner_data', 'physical'), cleanFirestoreData(updated, false), { merge: true });
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
        await setDoc(doc(firestoreInstance, 'shoes', shoe.id), cleanFirestoreData(shoe, false));
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
      await setDoc(doc(firestoreInstance, 'shoes', newShoe.id), cleanFirestoreData(newShoe, false));
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
      await setDoc(doc(firestoreInstance, 'shoes', updatedShoe.id), cleanFirestoreData(updatedShoe, false), { merge: true });
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
        return snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as RegisteredRace))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
    } catch (e) {
      console.warn('Firestore getRaces failed, reading local', e);
    }
  }
  const local = getLocalItem<RegisteredRace[]>('races', DEFAULT_RACES);
  return local.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
      await setDoc(doc(firestoreInstance, 'races', newRace.id), cleanFirestoreData(newRace, false));
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

export async function updateRace(race: RegisteredRace): Promise<void> {
  const current = await getRaces();
  const nextList = current.map((r) => (r.id === race.id ? race : r));
  setLocalItem('races', nextList);

  if (firestoreInstance) {
    try {
      await setDoc(doc(firestoreInstance, 'races', race.id), cleanFirestoreData(race, false));
    } catch (e) {
      console.error('Firestore updateRace failed', e);
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
      await setDoc(doc(firestoreInstance, 'runner_data', 'records'), cleanFirestoreData(updated, false), { merge: true });
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
      await setDoc(doc(firestoreInstance, 'runner_data', 'goals'), cleanFirestoreData(updated, false), { merge: true });
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
    id: `ts_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  const current = await getTrainingSessions();
  const nextList = [newSession, ...current].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  setLocalItem('training_sessions', nextList);

  if (firestoreInstance) {
    try {
      await setDoc(doc(firestoreInstance, 'training_sessions', newSession.id), cleanFirestoreData(newSession, false));
    } catch (e) {
      console.error('Firestore addTrainingSession failed', e);
    }
  }

  return newSession;
}

export async function addBatchTrainingSessions(
  sessions: Omit<TrainingSession, 'id' | 'createdAt'>[]
): Promise<TrainingSession[]> {
  if (!sessions || sessions.length === 0) return [];

  const baseTimestamp = Date.now();
  const createdSessions: TrainingSession[] = sessions.map((s, idx) => ({
    ...s,
    id: `ts_${baseTimestamp}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date(baseTimestamp + idx * 10).toISOString(),
  }));

  // Update local storage first for instant UI response and offline safety
  const current = await getTrainingSessions();
  const nextList = [...createdSessions, ...current].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  setLocalItem('training_sessions', nextList);

  // Firestore sync: batch commit (chunked in groups of 400 to respect Firestore 500-write limit)
  if (firestoreInstance) {
    try {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < createdSessions.length; i += CHUNK_SIZE) {
        const chunk = createdSessions.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(firestoreInstance);
        for (const s of chunk) {
          const ref = doc(firestoreInstance, 'training_sessions', s.id);
          batch.set(ref, cleanFirestoreData(s, false));
        }
        await batch.commit();
      }
      console.log(`[Firebase] Batch added ${createdSessions.length} training sessions.`);
    } catch (e) {
      console.error('Firestore addBatchTrainingSessions failed, falling back to parallel setDoc', e);
      try {
        await Promise.all(
          createdSessions.map((s) =>
            setDoc(doc(firestoreInstance!, 'training_sessions', s.id), cleanFirestoreData(s, false))
          )
        );
      } catch (err2) {
        console.error('Individual fallback setDoc failed', err2);
      }
    }
  }

  return createdSessions;
}

export async function updateTrainingSession(
  sessionId: string,
  updates: Partial<TrainingSession>
): Promise<TrainingSession | null> {
  const current = await getTrainingSessions();
  const index = current.findIndex((s) => s.id === sessionId);
  if (index === -1) return null;

  // Clean local memory copy: delete keys explicitly set to undefined
  const updatedSession = { ...current[index] };
  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined) {
      delete (updatedSession as any)[key];
    } else {
      (updatedSession as any)[key] = val;
    }
  }

  current[index] = updatedSession;
  setLocalItem('training_sessions', current);

  if (firestoreInstance) {
    try {
      const firestoreUpdates = cleanFirestoreData(updates, true);
      await setDoc(doc(firestoreInstance, 'training_sessions', sessionId), firestoreUpdates, { merge: true });
    } catch (e) {
      console.error('Firestore updateTrainingSession failed', e);
    }
  }

  return updatedSession;
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

export async function clearAllTrainingSessions(): Promise<void> {
  setLocalItem('training_sessions', []);

  if (firestoreInstance) {
    try {
      const snap = await getDocs(collection(firestoreInstance, 'training_sessions'));
      for (const d of snap.docs) {
        await deleteDoc(doc(firestoreInstance, 'training_sessions', d.id));
      }
    } catch (e) {
      console.error('Firestore clearAllTrainingSessions failed', e);
    }
  }
}

/* ============================================================================
 * Async CRUD Operations: 7. Weekly Training Plan (일자별 주간훈련 상세계획표)
 * ============================================================================ */
export const DEFAULT_WEEKLY_PLAN_SETTINGS: WeeklyPlanSettings = {
  trainingDays: ['화요일', '목요일', '토요일', '일요일'],
  speedDay: '화요일',
  speedWorkoutType: '인터벌',
  longRunDay: '일요일',
  targetRaceCourse: '풀코스',
  updatedAt: new Date().toISOString(),
};

export async function getWeeklyPlanSettings(): Promise<WeeklyPlanSettings> {
  if (firestoreInstance) {
    try {
      const snap = await getDoc(doc(firestoreInstance, 'runner_data', 'weekly_plan'));
      if (snap.exists() && snap.data().settings) {
        return snap.data().settings as WeeklyPlanSettings;
      }
    } catch (e) {
      console.warn('Firestore getWeeklyPlanSettings failed, reading local', e);
    }
  }
  return getLocalItem<WeeklyPlanSettings>('weekly_plan_settings', DEFAULT_WEEKLY_PLAN_SETTINGS);
}

export async function saveWeeklyPlanSettings(settings: WeeklyPlanSettings): Promise<void> {
  const updated = { ...settings, updatedAt: new Date().toISOString() };
  setLocalItem('weekly_plan_settings', updated);

  if (firestoreInstance) {
    try {
      await setDoc(
        doc(firestoreInstance, 'runner_data', 'weekly_plan'),
        cleanFirestoreData(
          {
            settings: updated,
            updatedAt: new Date().toISOString(),
          },
          false
        ),
        { merge: true }
      );
    } catch (e) {
      console.error('Firestore saveWeeklyPlanSettings failed', e);
    }
  }
}

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

export async function saveWeeklyPlan(
  days: WeeklyPlanDay[],
  settings?: WeeklyPlanSettings
): Promise<void> {
  setLocalItem('weekly_plan', days);
  if (settings) {
    setLocalItem('weekly_plan_settings', settings);
  }

  if (firestoreInstance) {
    try {
      const payload: Record<string, any> = {
        days,
        updatedAt: new Date().toISOString(),
      };
      if (settings) {
        payload.settings = { ...settings, updatedAt: new Date().toISOString() };
      }
      await setDoc(doc(firestoreInstance, 'runner_data', 'weekly_plan'), cleanFirestoreData(payload, false), {
        merge: true,
      });
    } catch (e) {
      console.error('Firestore saveWeeklyPlan failed', e);
    }
  }
}
