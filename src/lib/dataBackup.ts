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

export interface PaceMasterBackupPayload {
  version: '1.0';
  appName: 'PaceMaster';
  exportedAt: string;
  summary: {
    totalSessions: number;
    totalShoes: number;
    totalRaces: number;
    hasWeeklyPlan: boolean;
  };
  data: {
    physicalInfo: PhysicalInfo;
    runningRecords: RunningRecords;
    runningGoals: RunningGoals;
    shoes: RunningShoe[];
    races: RegisteredRace[];
    trainingSessions: TrainingSession[];
    weeklyPlan: WeeklyPlanDay[];
    weeklyPlanSettings: WeeklyPlanSettings;
  };
}

export interface BackupValidationResult {
  isValid: boolean;
  error?: string;
  payload?: PaceMasterBackupPayload;
  summaryText?: string;
}

/**
 * Downloads a complete JSON backup file of all PaceMaster user data
 */
export function exportBackupData(payloadData: {
  physicalInfo: PhysicalInfo;
  runningRecords: RunningRecords;
  runningGoals: RunningGoals;
  shoes: RunningShoe[];
  races: RegisteredRace[];
  trainingSessions: TrainingSession[];
  weeklyPlan: WeeklyPlanDay[];
  weeklyPlanSettings: WeeklyPlanSettings;
}): void {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `PaceMaster_Backup_${dateStr}_${timeStr}.json`;

  const backupObject: PaceMasterBackupPayload = {
    version: '1.0',
    appName: 'PaceMaster',
    exportedAt: now.toISOString(),
    summary: {
      totalSessions: payloadData.trainingSessions.length,
      totalShoes: payloadData.shoes.length,
      totalRaces: payloadData.races.length,
      hasWeeklyPlan: payloadData.weeklyPlan.length > 0,
    },
    data: {
      physicalInfo: payloadData.physicalInfo,
      runningRecords: payloadData.runningRecords,
      runningGoals: payloadData.runningGoals,
      shoes: payloadData.shoes,
      races: payloadData.races,
      trainingSessions: payloadData.trainingSessions,
      weeklyPlan: payloadData.weeklyPlan,
      weeklyPlanSettings: payloadData.weeklyPlanSettings,
    },
  };

  const jsonString = JSON.stringify(backupObject, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses and validates an uploaded JSON backup file
 */
export function parseAndValidateBackupJson(jsonContent: string): BackupValidationResult {
  try {
    const parsed = JSON.parse(jsonContent);

    // Support both direct root and nested .data structure
    const dataCandidate = parsed.data || parsed;

    if (!dataCandidate || typeof dataCandidate !== 'object') {
      return {
        isValid: false,
        error: '올바른 JSON 데이터 형식이 아닙니다.',
      };
    }

    // Check essential fields
    const sessions = Array.isArray(dataCandidate.trainingSessions) ? dataCandidate.trainingSessions : [];
    const shoes = Array.isArray(dataCandidate.shoes) ? dataCandidate.shoes : [];
    const races = Array.isArray(dataCandidate.races) ? dataCandidate.races : [];
    const physical = dataCandidate.physicalInfo || { height: 175, weight: 68, age: 30 };
    const records = dataCandidate.runningRecords || { pb5k: '', pb10k: '', pbHalf: '', pbFull: '', maxHr: 190, thresholdHr: 170 };
    const goals = dataCandidate.runningGoals || { target10k: '', targetHalf: '', targetFull: '' };
    const weeklyPlan = Array.isArray(dataCandidate.weeklyPlan) ? dataCandidate.weeklyPlan : [];
    const weeklyPlanSettings = dataCandidate.weeklyPlanSettings || {
      trainingDays: ['화요일', '목요일', '토요일', '일요일'],
      speedDay: '화요일',
      speedWorkoutType: '인터벌',
      longRunDay: '일요일',
      targetRaceCourse: '풀코스',
    };

    const validPayload: PaceMasterBackupPayload = {
      version: '1.0',
      appName: 'PaceMaster',
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      summary: {
        totalSessions: sessions.length,
        totalShoes: shoes.length,
        totalRaces: races.length,
        hasWeeklyPlan: weeklyPlan.length > 0,
      },
      data: {
        physicalInfo: physical,
        runningRecords: records,
        runningGoals: goals,
        shoes,
        races,
        trainingSessions: sessions,
        weeklyPlan,
        weeklyPlanSettings,
      },
    };

    const summaryText = `러닝 세션 ${sessions.length}건, 러닝화 ${shoes.length}켤레, 참가 대회 ${races.length}개, 개인 최고기록 및 훈련 계획 데이터`;

    return {
      isValid: true,
      payload: validPayload,
      summaryText,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `JSON 파싱 실패: ${err.message || '파일 내용을 읽을 수 없습니다.'}`,
    };
  }
}
