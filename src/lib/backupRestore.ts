import {
  PhysicalInfo,
  RunningShoe,
  RegisteredRace,
  RunningRecords,
  RunningGoals,
  TrainingSession,
  WeeklyPlanDay,
  WeeklyPlanSettings,
  ComprehensiveTrainingPlan,
} from '../types';
import {
  savePhysicalInfo,
  setAllShoes,
  setAllRaces,
  saveRunningRecords,
  saveRunningGoals,
  setAllTrainingSessions,
  saveWeeklyPlan,
  saveWeeklyPlanSettings,
  saveComprehensiveTrainingPlan,
} from './firebase';

export interface PaceMasterBackupPayload {
  version: string;
  appName: string;
  exportedAt: string;
  data: {
    physicalInfo: PhysicalInfo;
    shoes: RunningShoe[];
    races: RegisteredRace[];
    runningRecords: RunningRecords;
    runningGoals: RunningGoals;
    trainingSessions: TrainingSession[];
    weeklyPlan?: WeeklyPlanDay[];
    weeklyPlanSettings?: WeeklyPlanSettings;
    trainingPlan?: ComprehensiveTrainingPlan | null;
  };
  stats?: {
    totalSessions: number;
    totalShoes: number;
    totalRaces: number;
    totalDistanceKm: number;
  };
}

export interface BackupValidationResult {
  isValid: boolean;
  error?: string;
  payload?: PaceMasterBackupPayload;
  summary?: {
    exportedAt: string;
    sessionsCount: number;
    shoesCount: number;
    racesCount: number;
    totalDistanceKm: number;
    hasPhysicalInfo: boolean;
    hasRecords: boolean;
    hasGoals: boolean;
  };
}

/**
 * Generates and downloads a JSON backup file containing all user running records and settings
 */
export function exportRunningDataAsJSON(state: {
  physicalInfo: PhysicalInfo;
  shoes: RunningShoe[];
  races: RegisteredRace[];
  runningRecords: RunningRecords;
  runningGoals: RunningGoals;
  trainingSessions: TrainingSession[];
  weeklyPlan: WeeklyPlanDay[];
  weeklyPlanSettings: WeeklyPlanSettings;
}): { fileName: string; totalBytes: number } {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');

  const totalDist = state.trainingSessions.reduce((acc, s) => acc + (Number(s.totalDistanceKm) || 0), 0);

  const payload: PaceMasterBackupPayload = {
    version: '1.0',
    appName: 'PaceMaster Running Dashboard',
    exportedAt: now.toISOString(),
    data: {
      physicalInfo: state.physicalInfo,
      shoes: state.shoes,
      races: state.races,
      runningRecords: state.runningRecords,
      runningGoals: state.runningGoals,
      trainingSessions: state.trainingSessions,
      weeklyPlan: state.weeklyPlan,
      weeklyPlanSettings: state.weeklyPlanSettings,
    },
    stats: {
      totalSessions: state.trainingSessions.length,
      totalShoes: state.shoes.length,
      totalRaces: state.races.length,
      totalDistanceKm: Math.round(totalDist * 100) / 100,
    },
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const fileName = `pacemaster_running_backup_${dateStr}_${timeStr}.json`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return { fileName, totalBytes: blob.size };
}

/**
 * Validates an uploaded JSON backup file format and structure
 */
export function validateBackupJSON(rawContent: string): BackupValidationResult {
  try {
    const parsed = JSON.parse(rawContent);

    // Support both root data wrapping and direct payload
    const data = parsed.data || parsed;

    if (!data || typeof data !== 'object') {
      return { isValid: false, error: '유효한 JSON 객체 형식이 아닙니다.' };
    }

    const sessions = Array.isArray(data.trainingSessions) ? data.trainingSessions : [];
    const shoes = Array.isArray(data.shoes) ? data.shoes : [];
    const races = Array.isArray(data.races) ? data.races : [];
    const phys = data.physicalInfo && typeof data.physicalInfo === 'object' ? data.physicalInfo : null;
    const records = data.runningRecords && typeof data.runningRecords === 'object' ? data.runningRecords : null;
    const goals = data.runningGoals && typeof data.runningGoals === 'object' ? data.runningGoals : null;

    if (!sessions.length && !shoes.length && !races.length && !phys && !records && !goals) {
      return {
        isValid: false,
        error: 'PaceMaster 러닝 데이터(훈련 기록, 신발, 대회, 목표 등)를 찾을 수 없는 파일입니다.',
      };
    }

    const totalDist = sessions.reduce((acc: number, s: any) => acc + (Number(s.distanceKm) || 0), 0);

    const normalizedPayload: PaceMasterBackupPayload = {
      version: parsed.version || '1.0',
      appName: parsed.appName || 'PaceMaster Running Dashboard',
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      data: {
        physicalInfo: phys || { height: 176, weight: 68.5, age: 33 },
        shoes,
        races,
        runningRecords: records || {
          pb5k: '00:20:45',
          pb10k: '00:43:10',
          pbHalf: '01:36:25',
          pbFull: '03:24:50',
          maxHr: 191,
          thresholdHr: 172,
        },
        runningGoals: goals || {
          target10k: '00:39:59',
          targetHalf: '01:29:59',
          targetFull: '03:09:59',
        },
        trainingSessions: sessions,
        weeklyPlan: Array.isArray(data.weeklyPlan) ? data.weeklyPlan : [],
        weeklyPlanSettings: data.weeklyPlanSettings || undefined,
      },
      stats: {
        totalSessions: sessions.length,
        totalShoes: shoes.length,
        totalRaces: races.length,
        totalDistanceKm: Math.round(totalDist * 100) / 100,
      },
    };

    return {
      isValid: true,
      payload: normalizedPayload,
      summary: {
        exportedAt: normalizedPayload.exportedAt,
        sessionsCount: sessions.length,
        shoesCount: shoes.length,
        racesCount: races.length,
        totalDistanceKm: Math.round(totalDist * 10) / 10,
        hasPhysicalInfo: Boolean(phys),
        hasRecords: Boolean(records),
        hasGoals: Boolean(goals),
      },
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `JSON 파일 파싱 실패: ${err?.message || '잘못된 형식입니다.'}`,
    };
  }
}

/**
 * Restores data to both localStorage and Firestore, updating all local entities
 */
export async function restoreRunningDataToStorage(
  payload: PaceMasterBackupPayload
): Promise<void> {
  const { data } = payload;

  const tasks: Promise<any>[] = [];

  if (data.physicalInfo) {
    tasks.push(savePhysicalInfo(data.physicalInfo));
  }
  if (Array.isArray(data.shoes)) {
    tasks.push(setAllShoes(data.shoes));
  }
  if (Array.isArray(data.races)) {
    tasks.push(setAllRaces(data.races));
  }
  if (data.runningRecords) {
    tasks.push(saveRunningRecords(data.runningRecords));
  }
  if (data.runningGoals) {
    tasks.push(saveRunningGoals(data.runningGoals));
  }
  if (Array.isArray(data.trainingSessions)) {
    tasks.push(setAllTrainingSessions(data.trainingSessions));
  }
  if (Array.isArray(data.weeklyPlan) && data.weeklyPlan.length > 0) {
    tasks.push(saveWeeklyPlan(data.weeklyPlan));
  }
  if (data.weeklyPlanSettings) {
    tasks.push(saveWeeklyPlanSettings(data.weeklyPlanSettings));
  }
  if (data.trainingPlan) {
    tasks.push(saveComprehensiveTrainingPlan(data.trainingPlan));
  }

  await Promise.all(tasks);
}
