import React, { useState, useMemo, useEffect } from 'react';
import {
  UserCheck,
  Scale,
  Calendar,
  Footprints,
  Plus,
  Trash2,
  Edit2,
  Check,
  Sparkles,
  Award,
  ExternalLink,
  Search,
  RotateCcw,
  Save,
  Target,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Info,
  SlidersHorizontal,
  ShieldAlert,
  Trophy,
  Tag,
  Clock,
  History,
} from 'lucide-react';
import { PhysicalInfo, RunningShoe, RegisteredRace, ShoeCategory, TrainingSession } from '../types';
import { calculateDDay, getTodayDateStr } from '../lib/marathonData';
import { verifyRunnerSecurityKey } from '../lib/security';

interface TabMyInfoProps {
  physicalInfo: PhysicalInfo;
  shoes: RunningShoe[];
  races: RegisteredRace[];
  sessions?: TrainingSession[];
  onSavePhysical: (info: PhysicalInfo) => Promise<void>;
  onAddShoe: (shoe: Omit<RunningShoe, 'id'>) => Promise<void>;
  onUpdateShoe: (shoe: RunningShoe) => Promise<void>;
  onDeleteShoe: (id: string) => Promise<void>;
  onResetShoes: () => Promise<void>;
  onAddRace: (race: Omit<RegisteredRace, 'id'>) => Promise<void>;
  onDeleteRace: (id: string) => Promise<void>;
  onUpdateRace?: (race: RegisteredRace) => Promise<void>;
}

export const TabMyInfo: React.FC<TabMyInfoProps> = ({
  physicalInfo,
  shoes,
  races,
  sessions = [],
  onSavePhysical,
  onAddShoe,
  onUpdateShoe,
  onDeleteShoe,
  onResetShoes,
  onAddRace,
  onDeleteRace,
  onUpdateRace,
}) => {
  // Physical Info State
  const [height, setHeight] = useState(physicalInfo?.height != null ? physicalInfo.height.toString() : '175');
  const [weight, setWeight] = useState(physicalInfo?.weight != null ? physicalInfo.weight.toString() : '68');
  const [age, setAge] = useState(physicalInfo?.age != null ? physicalInfo.age.toString() : '30');
  const [isSavingPhysical, setIsSavingPhysical] = useState(false);
  const [physicalSavedAlert, setPhysicalSavedAlert] = useState(false);
  const [isPhysicalTouched, setIsPhysicalTouched] = useState(false);

  // Sync form inputs with physicalInfo prop whenever updated from Firestore or storage
  useEffect(() => {
    if (!isPhysicalTouched && physicalInfo) {
      if (physicalInfo.height != null) setHeight(physicalInfo.height.toString());
      if (physicalInfo.weight != null) setWeight(physicalInfo.weight.toString());
      if (physicalInfo.age != null) setAge(physicalInfo.age.toString());
    }
  }, [physicalInfo?.height, physicalInfo?.weight, physicalInfo?.age, isPhysicalTouched]);

  // Shoes State
  const [selectedShoeCategory, setSelectedShoeCategory] = useState<string>('데일리');
  const [shoeStatusFilter, setShoeStatusFilter] = useState<'all' | 'needs_replacement' | 'safe'>('all');
  const [shoeSortBy, setShoeSortBy] = useState<'urgent_first' | 'mileage_desc' | 'wear_pct_desc' | 'recent_worn' | 'name_asc'>('urgent_first');
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(false);
  const [shoeSearchQuery, setShoeSearchQuery] = useState<string>('');
  const [isShoeModalOpen, setIsShoeModalOpen] = useState(false);
  const [newShoeName, setNewShoeName] = useState('');
  const [newShoeBrand, setNewShoeBrand] = useState('Nike');
  const [newShoeCategory, setNewShoeCategory] = useState<ShoeCategory>('데일리');
  const [newShoeMileage, setNewShoeMileage] = useState('0');
  const [newShoeMaxMileage, setNewShoeMaxMileage] = useState('600');
  const [newShoeSize, setNewShoeSize] = useState('');

  // Editing Shoe Full Details State
  const [editingShoe, setEditingShoe] = useState<RunningShoe | null>(null);
  const [editShoeName, setEditShoeName] = useState<string>('');
  const [editShoeBrand, setEditShoeBrand] = useState<string>('Nike');
  const [editShoeCategory, setEditShoeCategory] = useState<ShoeCategory>('데일리');
  const [editShoeSize, setEditShoeSize] = useState<string>('');
  const [editMileage, setEditMileage] = useState<string>('0');
  const [editMaxMileage, setEditMaxMileage] = useState<string>('600');

  // Races State & Tabs
  const [raceViewTab, setRaceViewTab] = useState<'upcoming' | 'history'>('upcoming');
  const [isRaceModalOpen, setIsRaceModalOpen] = useState(false);
  const [newRaceName, setNewRaceName] = useState('');
  const [newRaceDate, setNewRaceDate] = useState(() => getTodayDateStr());
  const [newRaceCourse, setNewRaceCourse] = useState('풀 (42.195km)');
  const [newRaceCustomKm, setNewRaceCustomKm] = useState('');
  const [newRaceCustomCourseName, setNewRaceCustomCourseName] = useState('');
  const [newRaceLocation, setNewRaceLocation] = useState('서울');
  const [newRaceTargetTime, setNewRaceTargetTime] = useState('');
  const [newRacePriority, setNewRacePriority] = useState<'A' | 'B' | 'C'>('A');
  const [newRaceBibNumber, setNewRaceBibNumber] = useState('');
  const [newRaceIsPastMode, setNewRaceIsPastMode] = useState(false);
  const [newRaceActualRecord, setNewRaceActualRecord] = useState('');
  const [newRaceActualPace, setNewRaceActualPace] = useState('');
  const [newRaceRank, setNewRaceRank] = useState('');
  const [newRaceStatus, setNewRaceStatus] = useState<'completed' | 'scheduled' | 'dnf' | 'dns'>('scheduled');
  const [newRaceReview, setNewRaceReview] = useState('');

  // Recording Race Result & Bib Number Modal State
  const [recordingRaceResult, setRecordingRaceResult] = useState<RegisteredRace | null>(null);
  const [resultBibNumber, setResultBibNumber] = useState('');
  const [resultActualRecord, setResultActualRecord] = useState('');
  const [resultActualPace, setResultActualPace] = useState('');
  const [resultCustomKm, setResultCustomKm] = useState('');
  const [resultRank, setResultRank] = useState('');
  const [resultStatus, setResultStatus] = useState<'completed' | 'dnf' | 'dns'>('completed');
  const [resultReview, setResultReview] = useState('');

  // Editing Race Modal State
  const [editingRaceForTarget, setEditingRaceForTarget] = useState<RegisteredRace | null>(null);
  const [editRaceCourse, setEditRaceCourse] = useState('풀 (42.195km)');
  const [editRaceCustomKm, setEditRaceCustomKm] = useState('');
  const [editRaceCustomCourseName, setEditRaceCustomCourseName] = useState('');
  const [editRaceTargetTime, setEditRaceTargetTime] = useState('');
  const [editRacePriority, setEditRacePriority] = useState<'A' | 'B' | 'C'>('A');
  const [editRaceIsTarget, setEditRaceIsTarget] = useState(false);
  const [editRaceBibNumber, setEditRaceBibNumber] = useState('');
  const [editRaceActualRecord, setEditRaceActualRecord] = useState('');
  const [editRaceActualPace, setEditRaceActualPace] = useState('');
  const [editRaceRank, setEditRaceRank] = useState('');
  const [editRaceStatus, setEditRaceStatus] = useState<'completed' | 'scheduled' | 'dnf' | 'dns'>('scheduled');
  const [editRaceReview, setEditRaceReview] = useState('');

  // Calculate BMI
  const heightM = parseFloat(height) / 100;
  const weightKg = parseFloat(weight);
  const bmi = heightM > 0 && weightKg > 0 ? (weightKg / (heightM * heightM)).toFixed(1) : '-';
  const getBmiDesc = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    if (num < 18.5) return '저체중 (가벼운 주법에 유리)';
    if (num < 23) return '정상 체중 (마라톤 최적 구간)';
    if (num < 25) return '과체중 (관절 보호 및 서서히 감량 추천)';
    return '비만 (부상 방지 조깅 위주 추천)';
  };

  // Handle Physical Save
  const handleSavePhysical = async (e: React.FormEvent) => {
    e.preventDefault();
    const authorized = await verifyRunnerSecurityKey('신체 정보 저장/수정');
    if (!authorized) return;

    setIsSavingPhysical(true);
    const updatedHeight = parseFloat(height) || 175;
    const updatedWeight = parseFloat(weight) || 68;
    const updatedAge = parseInt(age, 10) || 30;

    await onSavePhysical({
      height: updatedHeight,
      weight: updatedWeight,
      age: updatedAge,
    });
    setIsPhysicalTouched(false);
    setIsSavingPhysical(false);
    setPhysicalSavedAlert(true);
    setTimeout(() => setPhysicalSavedAlert(false), 2500);
  };

  // Handle Add Shoe
  const handleAddShoeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShoeName.trim()) return;

    const authorized = await verifyRunnerSecurityKey('러닝화 등록');
    if (!authorized) return;

    await onAddShoe({
      name: newShoeName.trim(),
      brand: newShoeBrand.trim(),
      category: newShoeCategory,
      size: newShoeSize.trim() || undefined,
      mileage: Math.round((parseFloat(newShoeMileage) || 0) * 100) / 100,
      maxMileage: newShoeCategory === '레이싱' ? 300 : (Math.round((parseFloat(newShoeMaxMileage) || 600) * 100) / 100),
      review: '',
      createdAt: new Date().toISOString().split('T')[0],
    });

    setNewShoeName('');
    setNewShoeMileage('0');
    setNewShoeMaxMileage('600');
    setNewShoeSize('');
    setIsShoeModalOpen(false);
  };

  // Open Edit Modal for a Shoe (Full information editing)
  const handleOpenEditShoe = (shoe: RunningShoe) => {
    setEditingShoe(shoe);
    setEditShoeName(shoe.name);
    setEditShoeBrand(shoe.brand);
    setEditShoeCategory(shoe.category);
    setEditShoeSize(shoe.size || '');
    setEditMileage(shoe.mileage.toString());
    setEditMaxMileage((shoe.maxMileage || (shoe.category === '레이싱' ? 300 : 600)).toString());
  };

  // Handle Save Edited Shoe
  const handleSaveEditShoeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShoe) return;
    if (!editShoeName.trim()) {
      alert('러닝화 모델명을 입력해주세요.');
      return;
    }

    const authorized = await verifyRunnerSecurityKey(`'${editShoeName.trim()}' 러닝화 정보 수정`);
    if (!authorized) return;

    await onUpdateShoe({
      ...editingShoe,
      name: editShoeName.trim(),
      brand: editShoeBrand.trim(),
      category: editShoeCategory,
      size: editShoeSize.trim() || undefined,
      mileage: Math.round((parseFloat(editMileage) || 0) * 100) / 100,
      maxMileage: Math.round((parseFloat(editMaxMileage) || (editShoeCategory === '레이싱' ? 300 : 600)) * 100) / 100,
      review: '',
    });

    setEditingShoe(null);
  };

  // Standard preset course options
  const STANDARD_COURSE_PRESETS = [
    '풀 (42.195km)',
    '하프 (21.0975km)',
    '32K (32.0km)',
    '20K (20.0km)',
    '15K (15.0km)',
    '10K (10.0km)',
    '5K (5.0km)',
    '3K (3.0km)',
    '기타 (거리 직접 입력)',
  ];

  // Quick chips for non-standard / custom distance selection
  const QUICK_CUSTOM_DISTANCES = [3, 7, 8, 12, 15, 20, 25, 30, 32, 50];

  // Distance helper in KM for pace calculation (supports custom distances)
  const getCourseDistanceKm = (course: string, customKm?: number | string): number => {
    if (customKm !== undefined && customKm !== null && customKm !== '') {
      const parsed = typeof customKm === 'number' ? customKm : parseFloat(String(customKm));
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const lower = (course || '').toLowerCase().trim();
    if (lower.includes('풀') || lower.includes('full') || lower.includes('42.195')) return 42.195;
    if (lower.includes('하프') || lower.includes('half') || lower.includes('21.0975')) return 21.0975;
    if (lower.includes('32k') || lower.includes('32km')) return 32.0;
    if (lower.includes('30k') || lower.includes('30km')) return 30.0;
    if (lower.includes('25k') || lower.includes('25km')) return 25.0;
    if (lower.includes('20k') || lower.includes('20km')) return 20.0;
    if (lower.includes('15k') || lower.includes('15km')) return 15.0;
    if (lower.includes('10k') || lower.includes('10km')) return 10.0;
    if (lower.includes('5k') || lower.includes('5km')) return 5.0;
    if (lower.includes('3k') || lower.includes('3km')) return 3.0;

    const match = course.match(/(\d+(?:\.\d+)?)\s*(?:km|k|킬로|m)?/i);
    if (match && parseFloat(match[1])) {
      const v = parseFloat(match[1]);
      if (v >= 42 && v <= 43) return 42.195;
      if (v >= 21 && v <= 22) return 21.0975;
      return v;
    }
    return 10.0;
  };

  // Auto calculate average pace from time and course (supports custom distance)
  const autoCalcPace = (timeStr: string, course: string, customKm?: number | string): string => {
    if (!timeStr || !timeStr.trim()) return '';
    const parts = timeStr.trim().split(':').map((p) => parseFloat(p) || 0);
    let totalSec = 0;
    if (parts.length === 3) totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) totalSec = parts[0] * 60 + parts[1];
    else return '';
    if (totalSec <= 0) return '';
    const dist = getCourseDistanceKm(course, customKm);
    if (dist <= 0) return '';
    const paceSec = Math.round(totalSec / dist);
    const min = Math.floor(paceSec / 60);
    const sec = paceSec % 60;
    return `${min}'${sec < 10 ? '0' : ''}${sec}"`;
  };

  // Open Add Race Modal for Upcoming / History
  const handleOpenAddUpcomingRace = () => {
    setNewRaceName('');
    setNewRaceDate(getTodayDateStr());
    setNewRaceCourse('풀 (42.195km)');
    setNewRaceCustomKm('');
    setNewRaceCustomCourseName('');
    setNewRaceLocation('서울');
    setNewRaceTargetTime('');
    setNewRacePriority('A');
    setNewRaceBibNumber('');
    setNewRaceIsPastMode(false);
    setNewRaceActualRecord('');
    setNewRaceActualPace('');
    setNewRaceRank('');
    setNewRaceStatus('scheduled');
    setNewRaceReview('');
    setIsRaceModalOpen(true);
  };

  // Open Add Race Modal for Past History
  const handleOpenAddPastRace = () => {
    setNewRaceName('');
    const d = new Date();
    d.setDate(d.getDate() - 14);
    setNewRaceDate(d.toISOString().split('T')[0]);
    setNewRaceCourse('하프 (21.0975km)');
    setNewRaceCustomKm('');
    setNewRaceCustomCourseName('');
    setNewRaceLocation('서울');
    setNewRaceTargetTime('');
    setNewRacePriority('B');
    setNewRaceBibNumber('');
    setNewRaceIsPastMode(true);
    setNewRaceActualRecord('');
    setNewRaceActualPace('');
    setNewRaceRank('');
    setNewRaceStatus('completed');
    setNewRaceReview('');
    setIsRaceModalOpen(true);
  };

  // Handle Add Race
  const handleAddRaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRaceName.trim()) return;

    const isCustom = newRaceCourse === '기타 (거리 직접 입력)';
    const customDistNum = isCustom ? parseFloat(newRaceCustomKm) : undefined;
    if (isCustom && (!customDistNum || isNaN(customDistNum) || customDistNum <= 0)) {
      alert('기타 코스의 유효한 거리를 km 단위 숫자로 입력해주세요 (예: 7.5, 32).');
      return;
    }

    const finalCourseName = isCustom
      ? (newRaceCustomCourseName.trim() || `${customDistNum}km 코스`)
      : newRaceCourse;

    const isPast = calculateDDay(newRaceDate).isPassed || newRaceIsPastMode || newRaceStatus === 'completed';
    const authorized = await verifyRunnerSecurityKey(isPast ? '과거 참가 대회 기록 등록' : '참가 대회 등록');
    if (!authorized) return;

    const computedPace = newRaceActualPace.trim() || autoCalcPace(newRaceActualRecord, finalCourseName, customDistNum);

    await onAddRace({
      name: newRaceName.trim(),
      date: newRaceDate,
      course: finalCourseName,
      customDistanceKm: customDistNum && customDistNum > 0 ? customDistNum : undefined,
      location: newRaceLocation,
      targetTime: newRaceTargetTime.trim() || undefined,
      isTarget: !isPast && (races.length === 0 || newRacePriority === 'A'),
      priority: newRacePriority,
      importance:
        newRacePriority === 'A'
          ? 'A-Race (메인 목표)'
          : newRacePriority === 'B'
          ? 'B-Race (중간 점검)'
          : 'C-Race (연습 대회)',
      bibNumber: newRaceBibNumber.trim() || undefined,
      actualRecord: newRaceActualRecord.trim() || undefined,
      actualPace: computedPace || undefined,
      rank: newRaceRank.trim() || undefined,
      status: isPast ? (newRaceStatus || 'completed') : 'scheduled',
      raceReview: newRaceReview.trim() || undefined,
      createdAt: new Date().toISOString(),
    });

    setIsRaceModalOpen(false);
    if (isPast) {
      setRaceViewTab('history');
    } else {
      setRaceViewTab('upcoming');
    }
  };

  // Open Record Result Modal for existing race
  const handleOpenRecordResult = (race: RegisteredRace) => {
    setRecordingRaceResult(race);
    setResultBibNumber(race.bibNumber || '');
    setResultActualRecord(race.actualRecord || '');
    const dist = race.customDistanceKm || getCourseDistanceKm(race.course);
    setResultCustomKm(dist ? String(dist) : '');
    setResultActualPace(race.actualPace || autoCalcPace(race.actualRecord || '', race.course, race.customDistanceKm));
    setResultRank(race.rank || '');
    setResultStatus((race.status as 'completed' | 'dnf' | 'dns') || 'completed');
    setResultReview(race.raceReview || '');
  };

  // Save Race Result Submit
  const handleSaveRaceResultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingRaceResult || !onUpdateRace) return;

    const customDistNum = parseFloat(resultCustomKm);
    const effectiveDist = !isNaN(customDistNum) && customDistNum > 0 ? customDistNum : recordingRaceResult.customDistanceKm;

    const computedPace = resultActualPace.trim() || autoCalcPace(resultActualRecord, recordingRaceResult.course, effectiveDist);

    await onUpdateRace({
      ...recordingRaceResult,
      bibNumber: resultBibNumber.trim() || undefined,
      actualRecord: resultActualRecord.trim() || undefined,
      actualPace: computedPace || undefined,
      customDistanceKm: effectiveDist,
      rank: resultRank.trim() || undefined,
      status: resultStatus,
      raceReview: resultReview.trim() || undefined,
    });

    setRecordingRaceResult(null);
    if (resultStatus === 'completed') {
      setRaceViewTab('history');
    }
  };

  // Handle Edit Full Race
  const handleOpenEditRace = (race: RegisteredRace) => {
    setEditingRaceForTarget(race);
    setEditRaceTargetTime(race.targetTime || '');
    setEditRacePriority(
      race.priority === 'C' || race.importance?.includes('C')
        ? 'C'
        : race.priority === 'B' || race.importance?.includes('B')
        ? 'B'
        : 'A'
    );
    setEditRaceIsTarget(!!race.isTarget);
    setEditRaceBibNumber(race.bibNumber || '');
    setEditRaceActualRecord(race.actualRecord || '');

    const standardMatches = [
      { key: '풀', label: '풀 (42.195km)' },
      { key: '하프', label: '하프 (21.0975km)' },
      { key: '32k', label: '32K (32.0km)' },
      { key: '20k', label: '20K (20.0km)' },
      { key: '15k', label: '15K (15.0km)' },
      { key: '10k', label: '10K (10.0km)' },
      { key: '5k', label: '5K (5.0km)' },
      { key: '3k', label: '3K (3.0km)' },
    ];

    if (race.customDistanceKm) {
      setEditRaceCourse('기타 (거리 직접 입력)');
      setEditRaceCustomKm(String(race.customDistanceKm));
      setEditRaceCustomCourseName(race.course);
    } else {
      const match = standardMatches.find((sm) => race.course.toLowerCase().includes(sm.key));
      if (match) {
        setEditRaceCourse(match.label);
        setEditRaceCustomKm('');
        setEditRaceCustomCourseName('');
      } else {
        setEditRaceCourse('기타 (거리 직접 입력)');
        setEditRaceCustomKm(String(getCourseDistanceKm(race.course)));
        setEditRaceCustomCourseName(race.course);
      }
    }

    setEditRaceActualPace(race.actualPace || autoCalcPace(race.actualRecord || '', race.course, race.customDistanceKm));
    setEditRaceRank(race.rank || '');
    setEditRaceStatus(race.status || (calculateDDay(race.date).isPassed ? 'completed' : 'scheduled'));
    setEditRaceReview(race.raceReview || '');
  };

  const handleSaveRaceTargetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRaceForTarget || !onUpdateRace) return;

    const isCustom = editRaceCourse === '기타 (거리 직접 입력)';
    const customDistNum = isCustom ? parseFloat(editRaceCustomKm) : undefined;
    if (isCustom && (!customDistNum || isNaN(customDistNum) || customDistNum <= 0)) {
      alert('기타 코스의 유효한 거리를 km 단위 숫자로 입력해주세요 (예: 7.5, 32).');
      return;
    }

    const finalCourseName = isCustom
      ? (editRaceCustomCourseName.trim() || `${customDistNum}km 코스`)
      : editRaceCourse;

    const computedPace = editRaceActualPace.trim() || autoCalcPace(editRaceActualRecord, finalCourseName, customDistNum);

    await onUpdateRace({
      ...editingRaceForTarget,
      course: finalCourseName,
      customDistanceKm: customDistNum && customDistNum > 0 ? customDistNum : undefined,
      targetTime: editRaceTargetTime.trim() || undefined,
      priority: editRacePriority,
      isTarget: editRaceIsTarget,
      importance:
        editRacePriority === 'A'
          ? 'A-Race (메인 목표)'
          : editRacePriority === 'B'
          ? 'B-Race (중간 점검)'
          : 'C-Race (연습 대회)',
      bibNumber: editRaceBibNumber.trim() || undefined,
      actualRecord: editRaceActualRecord.trim() || undefined,
      actualPace: computedPace || undefined,
      rank: editRaceRank.trim() || undefined,
      status: editRaceStatus,
      raceReview: editRaceReview.trim() || undefined,
    });

    setEditingRaceForTarget(null);
  };

  // Quick 1-click Priority Switcher on Race Cards
  const handleQuickChangePriority = async (race: RegisteredRace, newPriority: 'A' | 'B' | 'C') => {
    if (!onUpdateRace) return;
    await onUpdateRace({
      ...race,
      priority: newPriority,
      importance:
        newPriority === 'A'
          ? 'A-Race (메인 목표)'
          : newPriority === 'B'
          ? 'B-Race (중간 점검)'
          : 'C-Race (연습 대회)',
    });
  };

  // Map session history to shoes (last worn date, sessions count, total session km)
  const shoeSessionStats = useMemo(() => {
    const stats: Record<
      string,
      { count: number; lastWornDate?: string; lastSessionTitle?: string; totalSessionKm: number }
    > = {};

    sessions.forEach((sess) => {
      const matchShoe = shoes.find(
        (s) =>
          (sess.shoeId && s.id === sess.shoeId) ||
          (sess.shoeName && sess.shoeName.toLowerCase().includes(s.name.toLowerCase()))
      );

      if (matchShoe) {
        if (!stats[matchShoe.id]) {
          stats[matchShoe.id] = {
            count: 0,
            lastWornDate: sess.date,
            lastSessionTitle: sess.title,
            totalSessionKm: 0,
          };
        }
        stats[matchShoe.id].count += 1;
        stats[matchShoe.id].totalSessionKm =
          Math.round((stats[matchShoe.id].totalSessionKm + (sess.totalDistanceKm || 0)) * 10) / 10;

        if (
          !stats[matchShoe.id].lastWornDate ||
          new Date(sess.date).getTime() > new Date(stats[matchShoe.id].lastWornDate!).getTime()
        ) {
          stats[matchShoe.id].lastWornDate = sess.date;
          stats[matchShoe.id].lastSessionTitle = sess.title;
        }
      }
    });

    return stats;
  }, [shoes, sessions]);

  // Analyzed Shoes with wear rate and status
  const analyzedShoes = useMemo(() => {
    return shoes.map((shoe) => {
      const maxMil = shoe.maxMileage && shoe.maxMileage > 0 ? shoe.maxMileage : (shoe.category === '레이싱' ? 300 : 600);
      const mileage = Math.round((shoe.mileage || 0) * 10) / 10;
      const wearPct = Math.round((mileage / maxMil) * 100);
      const remainingKm = Math.round((maxMil - mileage) * 10) / 10;
      const sessionStat = shoeSessionStats[shoe.id];

      let status: 'optimal' | 'warning' | 'near_limit' | 'overdue';
      let statusLabel: string;
      let statusColor: string;
      let badgeBg: string;

      if (wearPct >= 100) {
        status = 'overdue';
        statusLabel = '수명 완료';
        statusColor = 'text-rose-900';
        badgeBg = 'bg-rose-100 text-rose-900 border-rose-300';
      } else if (wearPct >= 80) {
        status = 'near_limit';
        statusLabel = '사용 중';
        statusColor = 'text-stone-700';
        badgeBg = 'bg-stone-100 text-stone-700 border-stone-200';
      } else if (wearPct >= 50) {
        status = 'warning';
        statusLabel = '사용 중';
        statusColor = 'text-stone-700';
        badgeBg = 'bg-stone-100 text-stone-700 border-stone-200';
      } else {
        status = 'optimal';
        statusLabel = '최상 컨디션';
        statusColor = 'text-emerald-800';
        badgeBg = 'bg-emerald-100 text-emerald-900 border-emerald-300';
      }

      return {
        ...shoe,
        effectiveMaxMileage: maxMil,
        effectiveMileage: mileage,
        wearPct,
        remainingKm,
        status,
        statusLabel,
        statusColor,
        badgeBg,
        sessionCount: sessionStat?.count || 0,
        lastWornDate: sessionStat?.lastWornDate,
        lastSessionTitle: sessionStat?.lastSessionTitle,
      };
    });
  }, [shoes, shoeSessionStats]);

  // Executive Metrics
  const shoeMetrics = useMemo(() => {
    const totalShoes = analyzedShoes.length;
    const totalMileage = Math.round(analyzedShoes.reduce((sum, s) => sum + s.effectiveMileage, 0) * 10) / 10;
    const totalMaxMileage = Math.round(analyzedShoes.reduce((sum, s) => sum + s.effectiveMaxMileage, 0) * 10) / 10;
    const overdueCount = analyzedShoes.filter((s) => s.status === 'overdue').length;
    const nearLimitCount = analyzedShoes.filter((s) => s.status === 'near_limit').length;
    const warningCount = analyzedShoes.filter((s) => s.status === 'warning').length;
    const optimalCount = analyzedShoes.filter((s) => s.status === 'optimal').length;
    const urgentCount = overdueCount + nearLimitCount;
    const safeCount = optimalCount + warningCount;

    const totalWearPct =
      totalMaxMileage > 0
        ? Math.round((totalMileage / totalMaxMileage) * 100)
        : 0;

    return {
      totalShoes,
      totalMileage,
      totalMaxMileage,
      overdueCount,
      nearLimitCount,
      warningCount,
      optimalCount,
      urgentCount,
      safeCount,
      totalWearPct,
      avgWearPct: totalWearPct,
    };
  }, [analyzedShoes]);

  // Categories list
  const shoeCategories: ('전체' | ShoeCategory)[] = [
    '전체',
    '데일리',
    '스피드',
    '장거리',
    '레이싱',
    '트레일',
  ];

  // Filtered & Sorted Shoes
  const filteredAndSortedShoes = useMemo(() => {
    let result = [...analyzedShoes];

    // Status filter
    if (shoeStatusFilter === 'needs_replacement') {
      result = result.filter((s) => s.status === 'overdue' || s.status === 'near_limit');
    } else if (shoeStatusFilter === 'safe') {
      result = result.filter((s) => s.status === 'optimal' || s.status === 'warning');
    }

    // Category filter
    if (selectedShoeCategory !== '전체') {
      result = result.filter((s) => s.category === selectedShoeCategory);
    }

    // Search query
    if (shoeSearchQuery.trim()) {
      const q = shoeSearchQuery.toLowerCase().trim();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.brand.toLowerCase().includes(q)
      );
    }

    // Sort
    if (shoeSortBy === 'urgent_first') {
      const order = { overdue: 0, near_limit: 1, warning: 2, optimal: 3 };
      result.sort((a, b) => order[a.status] - order[b.status] || b.wearPct - a.wearPct);
    } else if (shoeSortBy === 'mileage_desc') {
      result.sort((a, b) => b.effectiveMileage - a.effectiveMileage);
    } else if (shoeSortBy === 'wear_pct_desc') {
      result.sort((a, b) => b.wearPct - a.wearPct);
    } else if (shoeSortBy === 'recent_worn') {
      result.sort((a, b) => {
        const timeA = a.lastWornDate ? new Date(a.lastWornDate).getTime() : 0;
        const timeB = b.lastWornDate ? new Date(b.lastWornDate).getTime() : 0;
        return timeB - timeA;
      });
    } else if (shoeSortBy === 'name_asc') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }

    return result;
  }, [analyzedShoes, shoeStatusFilter, selectedShoeCategory, shoeSearchQuery, shoeSortBy]);

  // Upcoming Races: Date is strictly today or future, and not marked as completed
  const upcomingRaces = useMemo(() => {
    return [...races]
      .filter((r) => {
        const dDay = calculateDDay(r.date);
        return !dDay.isPassed && r.status !== 'completed';
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [races]);

  // Race History: Date has passed OR marked as completed (최신순 정렬)
  const historyRaces = useMemo(() => {
    return [...races]
      .filter((r) => {
        const dDay = calculateDDay(r.date);
        return dDay.isPassed || r.status === 'completed';
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [races]);

  return (
    <div className="space-y-8 animate-fadeIn text-stone-800">
      {/* 1. 신체 정보 섹션 */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-emerald-600/20 shadow-sm bg-white/95">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-xl border border-rose-700/40 shadow-xs">
              <Scale className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-stone-900">러너 신체 정보</h2>
              <p className="text-xs text-stone-600">
                체중과 키는 페이스 효율성 및 VO2max 계산의 중요한 기준입니다.
              </p>
            </div>
          </div>

          {physicalSavedAlert && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs border border-emerald-300 font-bold animate-pulse">
              <Check className="w-3.5 h-3.5" />
              <span>저장 완료</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSavePhysical}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                신장 (키 cm)
              </label>
              <input
                type="number"
                step="0.1"
                value={height}
                onChange={(e) => {
                  setIsPhysicalTouched(true);
                  setHeight(e.target.value);
                }}
                required
                className="w-full px-4 py-2.5 glass-input rounded-xl text-sm font-semibold"
                placeholder="175"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                체중 (몸무게 kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => {
                  setIsPhysicalTouched(true);
                  setWeight(e.target.value);
                }}
                required
                className="w-full px-4 py-2.5 glass-input rounded-xl text-sm font-semibold"
                placeholder="68"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                나이 (만 연령)
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => {
                  setIsPhysicalTouched(true);
                  setAge(e.target.value);
                }}
                required
                className="w-full px-4 py-2.5 glass-input rounded-xl text-sm font-semibold"
                placeholder="32"
              />
            </div>
          </div>

          {/* Realtime BMI & Runner Weight Analysis */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 mb-5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-stone-600 font-medium">BMI 체질량지수:</span>
              <span className="text-emerald-800 font-black font-athletic text-sm">{bmi}</span>
              <span className="text-stone-700 font-semibold">({getBmiDesc(bmi)})</span>
            </div>
            <div className="text-stone-500 text-[11px]">
              * 1kg 체중 감량 시 풀코스 완주 시간 약 2~3분 단축 효과
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingPhysical}
              className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-emerald-500"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingPhysical ? '저장 중...' : '신체 정보 저장'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. 보유 러닝화 로테이션 & 마일리지 수명 관리 섹션 */}
      <section id="shoe-closet-section" className="glass-panel rounded-2xl p-5 sm:p-7 border border-emerald-600/20 shadow-sm bg-white/95 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-2xl border border-rose-700/40 shadow-sm">
              <Footprints className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
                  <span>보유 러닝화 로테이션 & 마일리지 수명 관리</span>
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-bold">
                  {shoes.length}켤레
                </span>
                {shoeMetrics.urgentCount > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                    교체 알림 {shoeMetrics.urgentCount}켤레
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 mt-1">
                신발별 실시간 누적 주행거리와 목표 마일리지 수명 소진율을 모니터링하고 교체 주기를 관리합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsGuidanceOpen((prev) => !prev)}
              className="px-3 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isGuidanceOpen ? '가이드 접기' : '교체 기준 가이드'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsShoeModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border border-emerald-500"
            >
              <Plus className="w-4 h-4" />
              <span>러닝화 등록</span>
            </button>
          </div>
        </div>

        {/* Executive Key Stat Gauges */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>총 누적 주행</span>
              <TrendingUp className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono">
              {shoeMetrics.totalMileage.toLocaleString()} <span className="text-xs font-normal text-stone-500">km</span>
            </div>
            <div className="text-[11px] text-stone-500 mt-1 flex items-center justify-between">
              <span>보유 신발</span>
              <strong className="text-stone-800">{shoeMetrics.totalShoes}켤레</strong>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>전체 수명 소진율</span>
              <BarChart3 className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono">
              {shoeMetrics.totalWearPct} <span className="text-xs font-normal text-stone-500">%</span>
            </div>
            <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  shoeMetrics.totalWearPct >= 80 ? 'bg-amber-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.min(shoeMetrics.totalWearPct, 100)}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>교체 임박 & 수명 초과</span>
              <AlertTriangle className={`w-4 h-4 ${shoeMetrics.urgentCount > 0 ? 'text-rose-600' : 'text-stone-400'}`} />
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${shoeMetrics.urgentCount > 0 ? 'text-rose-900' : 'text-stone-700'}`}>
              {shoeMetrics.urgentCount} <span className="text-xs font-normal text-stone-500">켤레</span>
            </div>
            <div className="text-[11px] text-stone-500 mt-1 flex items-center justify-between">
              <span>수명 초과: <strong className="text-rose-900">{shoeMetrics.overdueCount}</strong></span>
              <span>임박: <strong className="text-amber-700">{shoeMetrics.nearLimitCount}</strong></span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>안전 & 최상 컨디션</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-800 font-mono">
              {shoeMetrics.optimalCount} <span className="text-xs font-normal text-stone-500">켤레</span>
            </div>
            <div className="text-[11px] text-stone-500 mt-1 flex items-center justify-between">
              <span>마모 진행: <strong className="text-amber-700">{shoeMetrics.warningCount}</strong></span>
              <span>최적: <strong className="text-emerald-800">{shoeMetrics.optimalCount}</strong></span>
            </div>
          </div>
        </div>

        {/* Replacement Alert Banner (특정 마일리지 도달 시 교체 알림) */}
        {shoeMetrics.urgentCount > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 border border-rose-300 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-800 border border-rose-200 flex-shrink-0 mt-0.5">
                  <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-rose-700" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-1.5">
                      <span>러닝화 교체 및 은퇴 권장 알림</span>
                    </h3>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-bold">
                      🚨 총 {shoeMetrics.urgentCount}켤레 대상
                    </span>
                  </div>
                  <p className="text-xs text-stone-700 leading-relaxed keep-all">
                    미드솔 완충 폼의 수명이 한계에 도달했습니다. 쿠션 반발력 저하는 
                    <strong className="text-rose-900"> 족저근막염, 정강이 통증(신스프린트), 무릎 관절 부상</strong>의 주된 원인이 됩니다.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {analyzedShoes
                      .filter((s) => s.status === 'overdue' || s.status === 'near_limit')
                      .map((s) => (
                        <span
                          key={s.id}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 whitespace-nowrap ${
                            s.status === 'overdue'
                              ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                          }`}
                        >
                          <span>{s.name}</span>
                          <span className="font-mono text-[11px]">
                            ({s.effectiveMileage}km / {s.effectiveMaxMileage}km, {s.wearPct}%)
                          </span>
                        </span>
                      ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShoeStatusFilter(shoeStatusFilter === 'needs_replacement' ? 'all' : 'needs_replacement')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer self-start sm:self-center ${
                  shoeStatusFilter === 'needs_replacement'
                    ? 'bg-rose-900 text-white shadow-sm'
                    : 'bg-rose-100 text-rose-900 hover:bg-rose-200 border border-rose-300'
                }`}
              >
                <span>{shoeStatusFilter === 'needs_replacement' ? '전체 보기로 복귀' : '교체 대상만 모아보기'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Sports Science Guidance Expandable Panel */}
        {isGuidanceOpen && (
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-stone-700 space-y-3 animate-fadeIn">
            <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>스포츠 사이언스 기반 러닝화 카테고리별 교체 기준</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-white border border-stone-200 space-y-1 shadow-2xs">
                <span className="text-xs font-bold text-rose-900">카본 레이싱화 (250~350km)</span>
                <p className="text-[11px] text-stone-600">
                  초임계 폼(ZoomX, Lightstrike Pro 등)과 카본 플레이트의 최고 반발탄성은 300km 내외에서 감쇄됩니다. 대회용 이후에는 템포/인터벌 연습화로 전환 추천.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-stone-200 space-y-1 shadow-2xs">
                <span className="text-xs font-bold text-amber-800">스피드/템포 트레이너 (400~500km)</span>
                <p className="text-[11px] text-stone-600">
                  인터벌 및 빠른 페이스 주행을 지탱하는 나일론 플레이트/반발 쿠션화. 지면 충격 흡수 한계 도달 시 교체 준비.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-stone-200 space-y-1 shadow-2xs">
                <span className="text-xs font-bold text-emerald-800">데일리 쿠션화 (600~800km)</span>
                <p className="text-[11px] text-stone-600">
                  매일 신는 조깅/회복주 신발. 겉창(아웃솔) 마모가 보이지 않더라도 미드솔 내부 기포가 영구 압축되므로 600km 초과 시 관절 보호를 위해 교체 요망.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-stone-200 space-y-1 shadow-2xs">
                <span className="text-xs font-bold text-emerald-300">장거리 LSD / 맥스쿠션 (600~750km)</span>
                <p className="text-[11px] text-slate-400">
                  장거리 20~35km 주행 시 체중의 3~4배 하중을 분산. 힐카운터 비틀림 및 미드솔 주름 발생 시 즉각 은퇴 권장.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search bar & Category Filter Buttons */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={shoeSearchQuery}
                onChange={(e) => setShoeSearchQuery(e.target.value)}
                placeholder="러닝화 모델명 또는 브랜드 검색 (예: 베이퍼플라이, 알파플라이, 아디오스, 메타스피드, 호카, 나이트로)..."
                className="w-full pl-9 pr-4 py-2 glass-input rounded-xl text-xs"
              />
              {shoeSearchQuery && (
                <button
                  onClick={() => setShoeSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  지우기
                </button>
              )}
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
                <span>정렬:</span>
              </div>
              <select
                value={shoeSortBy}
                onChange={(e) => setShoeSortBy(e.target.value as any)}
                className="bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs text-stone-800 font-medium focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs"
              >
                <option value="urgent_first">교체 시급순 (경고 우선)</option>
                <option value="mileage_desc">누적 마일리지 높은 순</option>
                <option value="wear_pct_desc">수명 소진율(%) 높은 순</option>
                <option value="recent_worn">최근 착용일 순</option>
                <option value="name_asc">모델명 가나다순</option>
              </select>
            </div>
          </div>

          {/* Category & Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 bg-stone-100 rounded-xl border border-stone-200 overflow-x-auto scrollbar-none">
            {/* Status quick filters */}
            <button
              type="button"
              onClick={() => setShoeStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                shoeStatusFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              전체 ({shoes.length})
            </button>

            <button
              type="button"
              onClick={() => setShoeStatusFilter('needs_replacement')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                shoeStatusFilter === 'needs_replacement'
                  ? 'bg-rose-900 text-white shadow-2xs font-bold'
                  : 'text-rose-900 hover:text-rose-950 hover:bg-rose-100/70 font-semibold'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-rose-300" />
              <span>교체 대상 ({shoeMetrics.urgentCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setShoeStatusFilter('safe')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                shoeStatusFilter === 'safe'
                  ? 'bg-emerald-700 text-white shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              정상·양호 ({shoeMetrics.safeCount})
            </button>

            <div className="h-4 w-px bg-stone-300 mx-1 flex-shrink-0" />

            {/* Category tabs */}
            <button
              type="button"
              onClick={() => setSelectedShoeCategory('전체')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedShoeCategory === '전체'
                  ? 'bg-white text-emerald-900 font-bold border border-emerald-400 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <span>전체 분류</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedShoeCategory === '전체' ? 'bg-emerald-100 text-emerald-900 font-bold' : 'bg-stone-200 text-stone-600'
              }`}>
                {shoes.length}
              </span>
            </button>

            {shoeCategories.filter((c) => c !== '전체').map((cat) => {
              const count = shoes.filter((s) => s.category === cat).length;
              if (count === 0) return null;
              const isSelected = selectedShoeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedShoeCategory(isSelected ? '전체' : cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-white text-emerald-900 font-bold border border-emerald-400 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-emerald-100 text-emerald-900 font-bold' : 'bg-stone-200 text-stone-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shoes Grid */}
        {filteredAndSortedShoes.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-stone-50 border border-stone-200">
            <Footprints className="w-10 h-10 text-stone-400 mx-auto mb-2" />
            <p className="text-sm text-stone-600">선택한 조건에 해당하는 러닝화가 없습니다.</p>
            <button
              onClick={() => {
                setSelectedShoeCategory('전체');
                setShoeStatusFilter('all');
                setShoeSearchQuery('');
              }}
              className="mt-3 text-xs text-emerald-700 hover:underline cursor-pointer font-semibold"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAndSortedShoes.map((shoe) => {
              const categoryBadgeColors: Record<ShoeCategory, string> = {
                데일리: 'bg-emerald-50 text-emerald-900 border-emerald-300',
                스피드: 'bg-amber-50 text-amber-900 border-amber-300',
                장거리: 'bg-emerald-100 text-emerald-900 border-emerald-400',
                레이싱: 'bg-rose-50 text-rose-900 border-rose-300',
                트레일: 'bg-stone-100 text-stone-800 border-stone-300',
              };

              // Progress Bar Color: 50% yellow, 80% orange, 100%+ burgundy/red
              let barColor = 'from-emerald-600 to-emerald-500';
              if (shoe.status === 'overdue') {
                barColor = 'from-rose-800 to-rose-950 animate-pulse';
              } else if (shoe.status === 'near_limit') {
                barColor = 'from-amber-500 to-orange-500'; // 80% 주황색
              } else if (shoe.status === 'warning') {
                barColor = 'from-amber-400 to-yellow-500'; // 50% 노란색
              }

              return (
                <div
                  key={shoe.id}
                  className={`rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between ${
                    shoe.status === 'overdue'
                      ? 'bg-rose-50/70 border-rose-300 hover:border-rose-400 shadow-sm'
                      : shoe.status === 'near_limit'
                      ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400 shadow-2xs'
                      : 'bg-white border-stone-200 hover:border-emerald-300 shadow-2xs'
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Header: Category & Brand & Status Badge & Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${
                            categoryBadgeColors[shoe.category]
                          }`}
                        >
                          {shoe.category}
                        </span>
                        <span className="text-xs text-stone-500 font-medium">{shoe.brand}</span>
                        {shoe.size && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md font-mono font-semibold bg-stone-100 text-stone-700 border border-stone-300">
                            {shoe.size.endsWith('mm') ? shoe.size : `${shoe.size}mm`}
                          </span>
                        )}
                        <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold border ${shoe.badgeBg} flex items-center gap-1`}>
                          {shoe.status === 'overdue' && <AlertTriangle className="w-3 h-3 text-rose-700" />}
                          {shoe.status === 'near_limit' && <AlertCircle className="w-3 h-3 text-orange-700" />}
                          {shoe.status === 'optimal' && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
                          <span>{shoe.statusLabel}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleOpenEditShoe(shoe)}
                          className="p-1.5 text-stone-400 hover:text-emerald-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          title="러닝화 정보 및 마일리지 수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await verifyRunnerSecurityKey(
                              `'${shoe.name}' 러닝화 삭제`
                            );
                            if (ok) onDeleteShoe(shoe.id);
                          }}
                          className="p-1.5 text-stone-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="삭제 (비밀번호 확인)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Shoe Model Name */}
                    <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">{shoe.name}</h3>

                    {/* Unified Mileage & Lifespan Management Contents */}
                    <div className="space-y-2 pt-1">
                      {/* Unified Mileage Header */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-500 font-medium">누적 주행거리</span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className={`text-base font-black ${
                            shoe.status === 'overdue' ? 'text-rose-900' : 'text-emerald-800'
                          }`}>
                            {shoe.effectiveMileage}km
                          </span>
                          <span className="text-stone-500">/ {shoe.effectiveMaxMileage}km</span>
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ml-1 ${
                            shoe.wearPct >= 100
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : shoe.wearPct >= 80
                              ? 'bg-orange-100 text-orange-900 border border-orange-300'
                              : shoe.wearPct >= 50
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                          }`}>
                            {shoe.wearPct}%
                          </span>
                        </div>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full h-2.5 rounded-full bg-stone-200 p-0.5 border border-stone-300 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${barColor}`}
                          style={{ width: `${Math.min(shoe.wearPct, 100)}%` }}
                        />
                      </div>

                      {/* Milestone Tick Labels */}
                      <div className="flex justify-between text-[10px] text-stone-500 font-mono px-0.5">
                        <span className="whitespace-nowrap">0km</span>
                        <span className="text-amber-700 font-semibold whitespace-nowrap">50%</span>
                        <span className="text-orange-700 font-semibold whitespace-nowrap">80%</span>
                        <span className="text-rose-900 font-semibold whitespace-nowrap text-right">
                          {shoe.effectiveMaxMileage}km
                        </span>
                      </div>

                      {/* Wear Status Callout: 수명 초과 시에만 직관적으로 알림 */}
                      {shoe.status === 'overdue' && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2 font-bold keep-all leading-relaxed">
                          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                          <span>⚠️ {Math.abs(shoe.remainingKm)}km 초과 주행 — 완충 한계 도달 (관절 부상 방지를 위해 즉시 교체 요망)</span>
                        </div>
                      )}

                      {/* Recent Workout Note if linked in sessions */}
                      {shoe.lastWornDate && (
                        <div className="text-[11px] text-stone-600 font-mono flex items-center gap-1.5 pt-0.5">
                          <span className="px-2 py-0.5 bg-stone-100 rounded border border-stone-200 text-stone-700">
                            최근 훈련: {shoe.lastWornDate}
                          </span>
                          {shoe.lastSessionTitle && (
                            <span className="text-stone-500 truncate max-w-[200px]">({shoe.lastSessionTitle})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. 참가 대회 & 완주 기록 허브 (Race Hub) */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-emerald-600/20 shadow-sm bg-white/95 text-stone-800">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-xl border border-rose-700/40 shadow-xs">
              <Trophy className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2 flex-wrap">
                <span>마라톤 참가 대회 및 완주 기록 허브</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-mono font-bold">
                  총 {races.length}개
                </span>
              </h2>
              <p className="text-xs text-stone-600 mt-0.5">
                참가 예정 대회의 D-Day와 목표 페이스를 관리하고, 완주한 대회의 실제 기록과 배번호(#11111)를 히스토리로 영구 보관합니다.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleOpenAddUpcomingRace}
              className="px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 border border-emerald-500 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>참가예정 및 완주 대회 등록</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher: 참가 예정 대회 vs 참가 대회 히스토리 */}
        <div className="flex items-center gap-2 p-1.5 bg-stone-100/90 rounded-2xl border border-stone-200 mb-6">
          <button
            type="button"
            onClick={() => setRaceViewTab('upcoming')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              raceViewTab === 'upcoming'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <Calendar className="w-4 h-4 text-rose-700" />
            <span>참가 예정 대회</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
              raceViewTab === 'upcoming' ? 'bg-rose-100 text-rose-900 border border-rose-300' : 'bg-stone-200 text-stone-700'
            }`}>
              {upcomingRaces.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRaceViewTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              raceViewTab === 'history'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-600" />
            <span>대회 참가 히스토리</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
              raceViewTab === 'history' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-stone-200 text-stone-700'
            }`}>
              {historyRaces.length}
            </span>
          </button>
        </div>

        {/* Tab 1: 참가 예정 대회 */}
        {raceViewTab === 'upcoming' && (
          <div>
            {upcomingRaces.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <Calendar className="w-10 h-10 text-stone-400 mx-auto" />
                <p className="text-sm font-semibold text-stone-700">현재 등록된 참가 예정 대회가 없습니다.</p>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  올해 출전할 마라톤 대회를 등록하거나 전국 마라톤 일정에서 원하는 대회를 추가해 보세요.
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleOpenAddUpcomingRace}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl cursor-pointer"
                  >
                    + 참가 예정 대회 등록
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcomingRaces.map((race) => {
                  const dDay = calculateDDay(race.date);
                  const badgeColor = dDay.isToday
                    ? 'bg-rose-600 text-white border-rose-700 animate-pulse font-black'
                    : dDay.daysDiff <= 14
                    ? 'bg-rose-100 text-rose-900 border-rose-400 animate-pulse font-extrabold'
                    : dDay.daysDiff <= 45
                    ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold';

                  return (
                    <div
                      key={race.id}
                      className="rounded-2xl p-5 border border-stone-200 hover:border-emerald-400 bg-white transition-all flex flex-col justify-between shadow-2xs space-y-4"
                    >
                      <div>
                        {/* Header: D-Day, Date, Bib Number & Delete */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-sm px-3 py-1 rounded-xl font-extrabold font-athletic border ${badgeColor} shadow-2xs`}
                            >
                              {dDay.text}
                            </span>
                            <span className="text-xs text-stone-500 font-mono font-medium">{race.date}</span>

                            {/* Bib Number Badge */}
                            {race.bibNumber ? (
                              <span
                                onClick={() => handleOpenRecordResult(race)}
                                className="text-xs px-2.5 py-0.5 rounded-lg font-mono font-bold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1 cursor-pointer hover:bg-purple-200 transition-colors"
                                title="클릭하여 배번호 수정"
                              >
                                <Tag className="w-3 h-3 text-purple-700" />
                                <span>{race.bibNumber}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenRecordResult(race)}
                                className="text-[11px] px-2 py-0.5 rounded-lg text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Tag className="w-3 h-3" />
                                <span>+ 배번호 입력</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditRace(race)}
                              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                              title="대회 정보 수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await verifyRunnerSecurityKey(
                                  `'${race.name}' 대회 삭제`
                                );
                                if (ok) onDeleteRace(race.id);
                              }}
                              className="p-1.5 text-stone-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Title, Course & Location */}
                        <h3 className="text-base sm:text-lg font-bold text-stone-900 mt-1 mb-1 tracking-tight">
                          {race.name}
                        </h3>
                        <div className="text-xs text-stone-600 flex items-center gap-2 mb-3">
                          <span className="text-rose-900 font-semibold px-2 py-0.5 rounded bg-rose-50 border border-rose-200">
                            {race.course}
                            {race.customDistanceKm && !race.course.includes(`${race.customDistanceKm}`) ? ` (${race.customDistanceKm}km)` : ''}
                          </span>
                          <span>·</span>
                          <span className="text-stone-500">{race.location}</span>
                        </div>

                        {/* Target Time */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs mb-2.5">
                          <div className="flex items-center gap-1.5">
                            <Target className="w-4 h-4 text-rose-800" />
                            <span className="text-stone-600 font-medium">목표 기록:</span>
                            <span className="font-bold font-mono text-rose-900 text-sm">
                              {race.targetTime || '미설정'}
                            </span>
                          </div>
                          {onUpdateRace && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditRace(race)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors cursor-pointer"
                            >
                              목표 수정
                            </button>
                          )}
                        </div>

                        {/* Priority Selector */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-stone-700">대회 중요도:</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                race.priority === 'C' || race.importance?.includes('C')
                                  ? 'bg-stone-200 text-stone-800 border-stone-300'
                                  : race.priority === 'B' || race.importance?.includes('B')
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              }`}
                            >
                              {race.priority === 'C' || race.importance?.includes('C')
                                ? 'C-Race (연습대회)'
                                : race.priority === 'B' || race.importance?.includes('B')
                                ? 'B-Race (중간점검)'
                                : 'A-Race (메인목표)'}
                            </span>
                            {race.isTarget && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-900 font-bold border border-rose-300">
                                ★ 대표 목표
                              </span>
                            )}
                          </div>

                          {/* Quick 1-Click Priority Switcher */}
                          {onUpdateRace && (
                            <div className="flex items-center gap-1 self-end sm:self-auto">
                              {(['A', 'B', 'C'] as const).map((p) => {
                                const isCurrent =
                                  p === 'A'
                                    ? (!race.priority || race.priority === 'A' || race.importance?.includes('A')) &&
                                      !race.importance?.includes('B') &&
                                      !race.importance?.includes('C')
                                    : p === 'B'
                                    ? race.priority === 'B' || race.importance?.includes('B')
                                    : race.priority === 'C' || race.importance?.includes('C');
                                return (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => handleQuickChangePriority(race, p)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                                      isCurrent
                                        ? p === 'A'
                                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                                          : p === 'B'
                                          ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                          : 'bg-stone-700 text-white border-stone-800 shadow-xs'
                                        : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-100'
                                    }`}
                                  >
                                    {p}-Race
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions: Website & Complete Record Logger */}
                      <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-stone-500 font-medium">
                            {dDay.isToday ? '🔥 오늘이 결승의 날!' : `${dDay.daysDiff}일 남음`}
                          </span>
                          {race.websiteUrl && (
                            <a
                              href={race.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 font-medium text-[11px]"
                            >
                              <span>홈페이지</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        {/* Dedicated Action Button: 실제 완주 기록 입력 (moves to history) */}
                        <button
                          type="button"
                          onClick={() => handleOpenRecordResult(race)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Trophy className="w-3.5 h-3.5 text-emerald-700" />
                          <span>실제 완주 기록 입력</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: 참가 대회 히스토리 (완주/기록 관리) */}
        {raceViewTab === 'history' && (
          <div>
            {historyRaces.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <Trophy className="w-10 h-10 text-stone-400 mx-auto" />
                <p className="text-sm font-semibold text-stone-700">등록된 대회 참가 히스토리가 없습니다.</p>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  이미 완주한 이전 마라톤 대회의 실제 완주 기록과 배번호(#11111)를 등록하여 나만의 마라톤 완주 역사를 관리해 보세요.
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleOpenAddPastRace}
                    className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl cursor-pointer"
                  >
                    + 지난 대회 완주 기록 직접 등록
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {historyRaces.map((race) => {
                  const dDay = calculateDDay(race.date);
                  const isDNF = race.status === 'dnf';
                  const isDNS = race.status === 'dns';

                  return (
                    <div
                      key={race.id}
                      className="rounded-2xl p-5 border border-stone-200 hover:border-amber-400 bg-white transition-all flex flex-col justify-between shadow-2xs space-y-4"
                    >
                      <div>
                        {/* Header: Status, Date, Bib Number & Delete */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-xs px-2.5 py-1 rounded-xl font-bold border flex items-center gap-1 ${
                                isDNF
                                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                                  : isDNS
                                  ? 'bg-stone-200 text-stone-700 border-stone-300'
                                  : 'bg-emerald-100 text-emerald-950 border-emerald-300'
                              }`}
                            >
                              <Trophy className="w-3.5 h-3.5 text-amber-600" />
                              <span>{isDNF ? 'DNF (미완주)' : isDNS ? 'DNS (불참)' : '🏆 완주 완료'}</span>
                            </span>
                            <span className="text-xs text-stone-500 font-mono font-medium">{race.date}</span>
                            <span className="text-[11px] text-stone-500 font-medium">({dDay.text})</span>

                            {/* Bib Number Badge */}
                            <span className="text-xs px-2.5 py-0.5 rounded-lg font-mono font-extrabold bg-purple-100 text-purple-950 border border-purple-300 flex items-center gap-1">
                              <Tag className="w-3 h-3 text-purple-700" />
                              <span>{race.bibNumber || '배번호 미등록'}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenRecordResult(race)}
                              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                              title="기록 및 배번호 수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await verifyRunnerSecurityKey(
                                  `'${race.name}' 대회 삭제`
                                );
                                if (ok) onDeleteRace(race.id);
                              }}
                              className="p-1.5 text-stone-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Title, Course & Location */}
                        <h3 className="text-base sm:text-lg font-bold text-stone-900 mt-1 mb-1 tracking-tight">
                          {race.name}
                        </h3>
                        <div className="text-xs text-stone-600 flex items-center gap-2 mb-3">
                          <span className="text-stone-800 font-semibold px-2 py-0.5 rounded bg-stone-100 border border-stone-200">
                            {race.course}
                            {race.customDistanceKm && !race.course.includes(`${race.customDistanceKm}`) ? ` (${race.customDistanceKm}km)` : ''}
                          </span>
                          <span>·</span>
                          <span className="text-stone-500">{race.location}</span>
                        </div>

                        {/* Actual Finish Record Showcase Box */}
                        <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-emerald-50/80 border border-emerald-300/80 space-y-1.5 mb-2.5">
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-emerald-700" />
                              <span>실제 완주 기록</span>
                            </span>
                            <span className="text-xl sm:text-2xl font-black font-athletic text-emerald-950 tracking-tight">
                              {race.actualRecord || '기록 미입력'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-stone-700 pt-1 border-t border-emerald-200/60">
                            <span className="font-mono">
                              평균 페이스: <strong className="text-emerald-950">{race.actualPace || autoCalcPace(race.actualRecord || '', race.course, race.customDistanceKm) || '-'}</strong>
                              {race.actualPace && !race.actualPace.includes('/km') ? '/km' : ''}
                            </span>

                            {race.targetTime && race.actualRecord && (
                              <span className="text-[11px] font-semibold text-stone-600">
                                목표: {race.targetTime}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Rank & Review if available */}
                        {(race.rank || race.raceReview) && (
                          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1.5">
                            {race.rank && (
                              <div className="flex items-center gap-1.5 text-stone-800 font-semibold">
                                <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>순위:</span>
                                <span className="font-mono text-emerald-900">{race.rank}</span>
                              </div>
                            )}
                            {race.raceReview && (
                              <div className="text-stone-600 text-[11px] italic leading-relaxed pl-1 border-l-2 border-amber-300">
                                "{race.raceReview}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                        <span className="text-stone-500 font-medium">
                          {dDay.text} 완주 완료
                        </span>

                        <div className="flex items-center gap-2">
                          {race.websiteUrl && (
                            <a
                              href={race.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-stone-600 hover:text-stone-900 hover:underline flex items-center gap-1 font-medium text-[11px]"
                            >
                              <span>홈페이지</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 러닝화 등록 모달 */}
      {isShoeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-stone-200 shadow-2xl text-stone-800">
            <h3 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
              <Footprints className="w-5 h-5 text-emerald-700" />
              <span>새 러닝화 등록</span>
            </h3>

            <form onSubmit={handleAddShoeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">신발 이름 / 모델명</label>
                <input
                  type="text"
                  required
                  value={newShoeName}
                  onChange={(e) => setNewShoeName(e.target.value)}
                  placeholder="예: 알파플라이 3, 줌 플라이 5"
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs font-semibold text-stone-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">브랜드</label>
                  <input
                    type="text"
                    required
                    value={newShoeBrand}
                    onChange={(e) => setNewShoeBrand(e.target.value)}
                    placeholder="Nike, Adidas..."
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs text-stone-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">사이즈 (mm)</label>
                  <input
                    type="text"
                    value={newShoeSize}
                    onChange={(e) => setNewShoeSize(e.target.value)}
                    placeholder="직접 입력 (선택)"
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold text-stone-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">카테고리</label>
                  <select
                    value={newShoeCategory}
                    onChange={(e) => {
                      const cat = e.target.value as ShoeCategory;
                      setNewShoeCategory(cat);
                      setNewShoeMaxMileage(cat === '레이싱' ? '300' : '600');
                    }}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs bg-white text-stone-800 font-medium"
                  >
                    <option value="데일리">데일리 (조깅용)</option>
                    <option value="스피드">스피드 (인터벌/템포)</option>
                    <option value="장거리">장거리 (LSD)</option>
                    <option value="레이싱">레이싱 (대회용 카본)</option>
                    <option value="트레일">트레일 (산악/비포장)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">현재 주행거리 (km)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newShoeMileage}
                    onChange={(e) => setNewShoeMileage(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold text-stone-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">목표 교체 수명 (km)</label>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    value={newShoeMaxMileage}
                    onChange={(e) => setNewShoeMaxMileage(e.target.value)}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold text-stone-800"
                  />
                </div>
              </div>

              {/* Quick Lifespan Mileage Presets */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <span className="text-[11px] font-semibold text-stone-700 block">
                  카테고리별 권장 수명 프리셋 선택:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewShoeMaxMileage('300')}
                    className={`px-2 py-1.5 text-[11px] rounded-lg border text-left transition-all cursor-pointer ${
                      newShoeMaxMileage === '300'
                        ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:text-stone-900'
                    }`}
                  >
                    300km (카본 레이싱)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewShoeMaxMileage('450')}
                    className={`px-2 py-1.5 text-[11px] rounded-lg border text-left transition-all cursor-pointer ${
                      newShoeMaxMileage === '450'
                        ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:text-stone-900'
                    }`}
                  >
                    450km (스피드/템포)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewShoeMaxMileage('600')}
                    className={`px-2 py-1.5 text-[11px] rounded-lg border text-left transition-all cursor-pointer ${
                      newShoeMaxMileage === '600'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:text-stone-900'
                    }`}
                  >
                    600km (데일리 쿠션)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewShoeMaxMileage('700')}
                    className={`px-2 py-1.5 text-[11px] rounded-lg border text-left transition-all cursor-pointer ${
                      newShoeMaxMileage === '700'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:text-stone-900'
                    }`}
                  >
                    700km (장거리 맥스쿠션)
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsShoeModalOpen(false)}
                  className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 참가 대회 등록 모달 (참가 예정 및 지난 대회 완주 기록 직접 등록 지원) */}
      {isRaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg border border-stone-200 shadow-2xl text-stone-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                {newRaceIsPastMode ? (
                  <>
                    <History className="w-5 h-5 text-amber-700" />
                    <span>지난 대회 완주 기록 직접 등록</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-5 h-5 text-rose-800" />
                    <span>새 마라톤 대회 등록</span>
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setIsRaceModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-xs px-2 py-1 cursor-pointer"
              >
                닫기
              </button>
            </div>

            {/* Mode Toggle inside Modal */}
            <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200 mb-4">
              <button
                type="button"
                onClick={() => {
                  setNewRaceIsPastMode(false);
                  setNewRaceStatus('scheduled');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  !newRaceIsPastMode
                    ? 'bg-white text-stone-900 shadow-xs border border-stone-200'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                🏃 참가 예정 대회
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewRaceIsPastMode(true);
                  setNewRaceStatus('completed');
                  if (!newRaceBibNumber) setNewRaceBibNumber('#');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  newRaceIsPastMode
                    ? 'bg-white text-amber-900 shadow-xs border border-stone-200'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                🏅 지난 대회 완주 기록
              </button>
            </div>

            <form onSubmit={handleAddRaceSubmit} className="space-y-4">
              {/* 대회명 */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  대회명 <span className="text-rose-700">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newRaceName}
                  onChange={(e) => setNewRaceName(e.target.value)}
                  placeholder="예: 2026 손기정 평화마라톤, 2025 JTBC 서울마라톤"
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs font-semibold text-stone-800"
                />
              </div>

              {/* 대회 일자 & 참가 코스 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-stone-700">대회 일자 (날짜)</label>
                    {newRaceDate && (
                      <span className="text-[11px] font-bold text-rose-900 font-athletic">
                        {calculateDDay(newRaceDate).text}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    required
                    value={newRaceDate}
                    onChange={(e) => {
                      const newD = e.target.value;
                      setNewRaceDate(newD);
                      if (calculateDDay(newD).isPassed) {
                        setNewRaceIsPastMode(true);
                        setNewRaceStatus('completed');
                      }
                    }}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs text-stone-800 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">참가 코스</label>
                  <select
                    value={newRaceCourse}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewRaceCourse(val);
                      if (val !== '기타 (거리 직접 입력)') {
                        if (newRaceActualRecord) {
                          setNewRaceActualPace(autoCalcPace(newRaceActualRecord, val));
                        }
                      } else {
                        if (newRaceActualRecord) {
                          setNewRaceActualPace(autoCalcPace(newRaceActualRecord, newRaceCustomCourseName || '기타', newRaceCustomKm));
                        }
                      }
                    }}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs bg-white text-stone-800 font-medium"
                  >
                    {STANDARD_COURSE_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 기타 코스 거리 직접 설정 패널 */}
              {newRaceCourse === '기타 (거리 직접 입력)' && (
                <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200/80 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-purple-700" />
                      <span>기타 코스 거리 직접 설정</span>
                    </span>
                    <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded font-semibold">
                      거리(km) 자유 설정
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        코스 거리 (km) <span className="text-rose-700">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        required
                        value={newRaceCustomKm}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewRaceCustomKm(val);
                          if (!newRaceCustomCourseName || newRaceCustomCourseName.endsWith('km 코스')) {
                            setNewRaceCustomCourseName(val ? `${val}km 코스` : '');
                          }
                          if (newRaceActualRecord) {
                            setNewRaceActualPace(autoCalcPace(newRaceActualRecord, newRaceCustomCourseName || '기타', val));
                          }
                        }}
                        placeholder="예: 7.5, 32, 15, 25"
                        className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold text-purple-950 focus:border-purple-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        코스 명칭 (선택)
                      </label>
                      <input
                        type="text"
                        value={newRaceCustomCourseName}
                        onChange={(e) => setNewRaceCustomCourseName(e.target.value)}
                        placeholder="예: 7.5km 단축, 25K 트레일"
                        className="w-full px-3 py-2 glass-input rounded-xl text-xs text-stone-800"
                      />
                    </div>
                  </div>

                  {/* 자주 달리는 기타 거리 빠른 선택 */}
                  <div>
                    <span className="text-[10px] text-stone-500 font-medium block mb-1">
                      자주 달리는 코스 거리 빠른 선택:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_CUSTOM_DISTANCES.map((dist) => (
                        <button
                          key={dist}
                          type="button"
                          onClick={() => {
                            const str = String(dist);
                            setNewRaceCustomKm(str);
                            setNewRaceCustomCourseName(`${dist}km 코스`);
                            if (newRaceActualRecord) {
                              setNewRaceActualPace(autoCalcPace(newRaceActualRecord, `${dist}km 코스`, dist));
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer border ${
                            newRaceCustomKm === String(dist)
                              ? 'bg-purple-700 text-white border-purple-800 shadow-2xs'
                              : 'bg-white text-purple-900 border-purple-200 hover:bg-purple-100'
                          }`}
                        >
                          {dist}km
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 개최 장소 & 배번호 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">개최 장소</label>
                  <input
                    type="text"
                    value={newRaceLocation}
                    onChange={(e) => setNewRaceLocation(e.target.value)}
                    placeholder="예: 서울 잠실종합운동장"
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs text-stone-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-purple-700" />
                      <span>배번호 (Bib No.)</span>
                    </span>
                    <span className="text-[10px] text-stone-400 font-normal">선택</span>
                  </label>
                  <input
                    type="text"
                    value={newRaceBibNumber}
                    onChange={(e) => setNewRaceBibNumber(e.target.value)}
                    placeholder="예: #11111, A-1024"
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold text-purple-950 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* 대회 중요도 & 목표 기록 (예정 대회일 때) */}
              {!newRaceIsPastMode && (
                <div className="space-y-3 p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      대회 중요도 (우선순위 & 테이퍼링 강도 설정)
                    </label>
                    <select
                      value={newRacePriority}
                      onChange={(e) => setNewRacePriority(e.target.value as 'A' | 'B' | 'C')}
                      className="w-full px-3 py-2 glass-input rounded-xl text-xs bg-white text-stone-800 font-semibold"
                    >
                      <option value="A">A-Race (최우선 메인 목표) — 전력 완주 & 2~3주 정밀 테이퍼링</option>
                      <option value="B">B-Race (중간 점검 / 준비) — 실전 페이스 점검 & 3~5일 미니 감량</option>
                      <option value="C">C-Race (연습 / 훈련 대회) — 훈련용 대회 & 테이퍼링 최소화(마일리지 유지)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      대회 목표 완주 기록 (선택)
                    </label>
                    <input
                      type="text"
                      value={newRaceTargetTime}
                      onChange={(e) => setNewRaceTargetTime(e.target.value)}
                      placeholder="예: 03:29:59 (hh:mm:ss)"
                      className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-semibold text-stone-800"
                    />
                  </div>
                </div>
              )}

              {/* 지난 대회 완주 기록 섹션 (과거 모드이거나 날짜가 지난 경우) */}
              {(newRaceIsPastMode || calculateDDay(newRaceDate).isPassed) && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-700" />
                      <span>실제 완주 기록 및 대회 성적 (히스토리)</span>
                    </span>
                    <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-semibold">
                      완주 히스토리 탭에 자동 저장
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        실제 완주 시간 (hh:mm:ss)
                      </label>
                      <input
                        type="text"
                        value={newRaceActualRecord}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewRaceActualRecord(val);
                          setNewRaceActualPace(autoCalcPace(val, newRaceCourse, newRaceCustomKm));
                        }}
                        placeholder="예: 01:29:45, 03:15:20"
                        className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-black text-emerald-950 focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        평균 페이스 (자동 계산)
                      </label>
                      <input
                        type="text"
                        value={newRaceActualPace}
                        onChange={(e) => setNewRaceActualPace(e.target.value)}
                        placeholder="예: 4'15&quot;"
                        className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold text-stone-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">참가 상태</label>
                      <select
                        value={newRaceStatus}
                        onChange={(e) => setNewRaceStatus(e.target.value as 'completed' | 'scheduled' | 'dnf' | 'dns')}
                        className="w-full px-3 py-2 glass-input rounded-xl text-xs bg-white text-stone-800 font-semibold"
                      >
                        <option value="completed">🏆 완주 (Completed)</option>
                        <option value="dnf">⚠️ DNF (중도 포기)</option>
                        <option value="dns">DNS (미출전/불참)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">대회 순위 (선택)</label>
                      <input
                        type="text"
                        value={newRaceRank}
                        onChange={(e) => setNewRaceRank(e.target.value)}
                        placeholder="예: 전체 142위 / 3,500명"
                        className="w-full px-3 py-2 glass-input rounded-xl text-xs text-stone-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      대회 소감 및 후기 (선택)
                    </label>
                    <textarea
                      rows={2}
                      value={newRaceReview}
                      onChange={(e) => setNewRaceReview(e.target.value)}
                      placeholder="대회 당일 코스 컨디션, 날씨, 페이스 전략, 느낀 점 등을 메모하세요."
                      className="w-full px-3 py-2 glass-input rounded-xl text-xs text-stone-800 resize-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsRaceModalOpen(false)}
                  className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{newRaceIsPastMode ? '완주 기록 등록' : '대회 등록'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 러닝화 전체 정보 및 마일리지 수정 모달 */}
      {editingShoe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-stone-200 shadow-2xl text-stone-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-700" />
                <span>러닝화 정보 및 사이즈 수정</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingShoe(null)}
                className="text-stone-400 hover:text-stone-700 text-xs px-2 py-1 cursor-pointer"
              >
                닫기
              </button>
            </div>

            <form onSubmit={handleSaveEditShoeSubmit} className="space-y-4">
              {/* 1. 신발 모델명 */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  신발 이름 / 모델명 <span className="text-rose-700">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editShoeName}
                  onChange={(e) => setEditShoeName(e.target.value)}
                  placeholder="예: 알파플라이 3, 줌 플라이 5"
                  className="w-full px-3 py-2.5 glass-input rounded-xl text-xs font-bold text-stone-900 focus:border-emerald-600"
                />
              </div>

              {/* 2. 브랜드, 사이즈 & 카테고리 */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">브랜드</label>
                  <input
                    type="text"
                    required
                    value={editShoeBrand}
                    onChange={(e) => setEditShoeBrand(e.target.value)}
                    placeholder="Nike, Adidas..."
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs text-stone-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">사이즈 (mm)</label>
                  <input
                    type="text"
                    value={editShoeSize}
                    onChange={(e) => setEditShoeSize(e.target.value)}
                    placeholder="직접 입력 (선택)"
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold text-stone-900 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">카테고리</label>
                  <select
                    value={editShoeCategory}
                    onChange={(e) => {
                      const cat = e.target.value as ShoeCategory;
                      setEditShoeCategory(cat);
                    }}
                    className="w-full px-3 py-2 glass-input rounded-xl text-xs bg-white text-stone-800"
                  >
                    <option value="데일리">데일리 (조깅용)</option>
                    <option value="스피드">스피드 (인터벌/템포)</option>
                    <option value="장거리">장거리 (LSD)</option>
                    <option value="레이싱">레이싱 (대회용 카본)</option>
                    <option value="트레일">트레일 (산악/비포장)</option>
                  </select>
                </div>
              </div>

              {/* 3. 누적 마일리지 & 목표 권장 수명 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-emerald-800 mb-1">
                    현재 누적 주행거리 (km)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editMileage}
                    onChange={(e) => setEditMileage(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 glass-input rounded-xl text-sm font-mono font-bold text-stone-900 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    목표 수명 마일리지 (km)
                  </label>
                  <input
                    type="number"
                    min="50"
                    step="50"
                    required
                    value={editMaxMileage}
                    onChange={(e) => setEditMaxMileage(e.target.value)}
                    className="w-full px-3 py-2.5 glass-input rounded-xl text-sm font-mono text-stone-800 font-bold"
                  />
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setEditMaxMileage('300')}
                      className="px-2 py-0.5 text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded cursor-pointer transition-colors border border-stone-200"
                    >
                      300km (레이싱)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMaxMileage('450')}
                      className="px-2 py-0.5 text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded cursor-pointer transition-colors border border-stone-200"
                    >
                      450km (스피드)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMaxMileage('600')}
                      className="px-2 py-0.5 text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded cursor-pointer transition-colors border border-stone-200"
                    >
                      600km (데일리)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMaxMileage('700')}
                      className="px-2 py-0.5 text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded cursor-pointer transition-colors border border-stone-200"
                    >
                      700km (LSD)
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. 실시간 수명 소진율 & 마모 상태 프리뷰 (50% yellow, 80% orange) */}
              {(() => {
                const currentKm = parseFloat(editMileage) || 0;
                const maxKm = parseFloat(editMaxMileage) || 600;
                const wearPct = maxKm > 0 ? Math.round((currentKm / maxKm) * 100) : 0;
                const remaining = Math.round((maxKm - currentKm) * 10) / 10;
                const isOverdue = wearPct >= 100;
                const isNearLimit = wearPct >= 80 && wearPct < 100;
                const isWarning = wearPct >= 50 && wearPct < 80;

                return (
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-600 font-medium">수명 소진율 및 상태 프리뷰</span>
                      <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                        isOverdue
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : isNearLimit
                          ? 'bg-orange-100 text-orange-900 border border-orange-300'
                          : isWarning
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}>
                        {wearPct}% {isOverdue ? '(수명 종료)' : isNearLimit ? '(80% 도달)' : isWarning ? '(50% 도달)' : '(양호)'}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOverdue
                            ? 'bg-rose-600'
                            : isNearLimit
                            ? 'bg-orange-500'
                            : isWarning
                            ? 'bg-amber-400'
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(wearPct, 100)}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-stone-600">
                      {remaining <= 0 ? (
                        <span className="text-rose-900 font-semibold">
                          ⚠️ 권장 수명을 {Math.abs(remaining)}km 초과했습니다. 쿠션 꺼짐으로 인한 무릎·발목 충격 주의!
                        </span>
                      ) : (
                        <span>
                          수명 한계까지 약 <strong className="text-emerald-800 font-mono font-bold">{remaining}km</strong> 남았습니다.
                        </span>
                      )}
                    </p>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditingShoe(null)}
                  className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>수정사항 저장</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 대회별 중요도 및 목표 완주 기록 수정 모달 */}
      {editingRaceForTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-stone-200 shadow-2xl text-stone-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-stone-900 mb-2 flex items-center gap-2">
              <Target className="w-5 h-5 text-rose-800" />
              <span>대회 정보 및 맞춤 설정 수정</span>
            </h3>
            <p className="text-xs text-stone-600 mb-4">
              <strong className="text-stone-900">{editingRaceForTarget.name}</strong> ({editingRaceForTarget.course})의 중요도, 목표 완주 시간, 배번호 및 기록을 설정합니다.
            </p>

            <form onSubmit={handleSaveRaceTargetSubmit} className="space-y-4">
              {/* 참가 코스 & 기타 거리 설정 */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  참가 코스
                </label>
                <select
                  value={editRaceCourse}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditRaceCourse(val);
                    if (val !== '기타 (거리 직접 입력)') {
                      if (editRaceActualRecord) {
                        setEditRaceActualPace(autoCalcPace(editRaceActualRecord, val));
                      }
                    } else {
                      if (editRaceActualRecord) {
                        setEditRaceActualPace(autoCalcPace(editRaceActualRecord, editRaceCustomCourseName || '기타', editRaceCustomKm));
                      }
                    }
                  }}
                  className="w-full px-3 py-2.5 glass-input rounded-xl text-xs bg-white text-stone-800 font-semibold"
                >
                  {STANDARD_COURSE_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
              </div>

              {/* 기타 코스 거리 직접 입력 (수정 모달) */}
              {editRaceCourse === '기타 (거리 직접 입력)' && (
                <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200/80 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-purple-700" />
                      <span>기타 코스 거리 직접 설정</span>
                    </span>
                    <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded font-semibold">
                      소수점 거리 지원 (km)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        코스 거리 (km) <span className="text-rose-700">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        required
                        value={editRaceCustomKm}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditRaceCustomKm(val);
                          if (!editRaceCustomCourseName || editRaceCustomCourseName.endsWith('km 코스')) {
                            setEditRaceCustomCourseName(val ? `${val}km 코스` : '');
                          }
                          if (editRaceActualRecord) {
                            setEditRaceActualPace(autoCalcPace(editRaceActualRecord, editRaceCustomCourseName || '기타', val));
                          }
                        }}
                        placeholder="예: 7.5, 32, 15, 25"
                        className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono font-bold text-purple-950 focus:border-purple-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        코스 명칭 (선택)
                      </label>
                      <input
                        type="text"
                        value={editRaceCustomCourseName}
                        onChange={(e) => setEditRaceCustomCourseName(e.target.value)}
                        placeholder="예: 7.5km 단축, 25K 트레일"
                        className="w-full px-3 py-2 glass-input rounded-xl text-xs text-stone-800"
                      />
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div>
                    <span className="text-[10px] text-stone-500 font-medium block mb-1">
                      자주 달리는 코스 거리 빠른 선택:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_CUSTOM_DISTANCES.map((dist) => (
                        <button
                          key={dist}
                          type="button"
                          onClick={() => {
                            const str = String(dist);
                            setEditRaceCustomKm(str);
                            setEditRaceCustomCourseName(`${dist}km 코스`);
                            if (editRaceActualRecord) {
                              setEditRaceActualPace(autoCalcPace(editRaceActualRecord, `${dist}km 코스`, dist));
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer border ${
                            editRaceCustomKm === String(dist)
                              ? 'bg-purple-700 text-white border-purple-800 shadow-2xs'
                              : 'bg-white text-purple-900 border-purple-200 hover:bg-purple-100'
                          }`}
                        >
                          {dist}km
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 1. 배번호 */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-purple-700" />
                    <span>배번호 (Bib Number)</span>
                  </span>
                  <span className="text-[10px] text-stone-400">예: #11111</span>
                </label>
                <input
                  type="text"
                  value={editRaceBibNumber}
                  onChange={(e) => setEditRaceBibNumber(e.target.value)}
                  placeholder="예: #11111, A-1024"
                  className="w-full px-3 py-2.5 glass-input rounded-xl text-xs font-mono font-bold text-purple-950 focus:border-purple-500"
                />
              </div>

              {/* 2. 대회 중요도 (우선순위) */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  대회 중요도 (우선순위 & 테이퍼링 강도)
                </label>
                <select
                  value={editRacePriority}
                  onChange={(e) => setEditRacePriority(e.target.value as 'A' | 'B' | 'C')}
                  className="w-full px-3 py-2.5 glass-input rounded-xl text-xs bg-white text-stone-800 font-semibold"
                >
                  <option value="A">A-Race (최우선 메인 목표) — 전력 완주 & 2~3주 정밀 테이퍼링</option>
                  <option value="B">B-Race (중간 점검 / 준비) — 실전 페이스 점검 & 3~5일 미니 감량</option>
                  <option value="C">C-Race (연습 / 훈련 대회) — 훈련용 대회 & 테이퍼링 최소화(마일리지 유지)</option>
                </select>
                <span className="text-[10px] text-stone-500 mt-1 block keep-all">
                  💡 <strong>테이퍼링 자동 연동:</strong> C-Race나 목표 강도가 낮은 대회는 조기 감량으로 인한 심폐 능력 저하를 막기 위해 테이퍼링을 최소화하고 주간 훈련 마일리지를 온전히 유지합니다.
                </span>
              </div>

              {/* 3. 목표 완주 시간 */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  목표 완주 시간 (hh:mm:ss)
                </label>
                <input
                  type="text"
                  value={editRaceTargetTime}
                  onChange={(e) => setEditRaceTargetTime(e.target.value)}
                  placeholder="예: 03:19:59"
                  className="w-full px-3 py-2.5 glass-input rounded-xl text-sm font-mono font-bold text-stone-900"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  대회마다 목표 완주 기록을 개별적으로 설정하여 관리할 수 있습니다.
                </span>
              </div>

              {/* 4. 실제 완주 기록 & 평균 페이스 (선택) */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5">
                <span className="text-xs font-bold text-stone-800 block">🏅 실제 대회 결과 (기록이 있을 때)</span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">실제 완주 시간</label>
                    <input
                      type="text"
                      value={editRaceActualRecord}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditRaceActualRecord(val);
                        const isCustom = editRaceCourse === '기타 (거리 직접 입력)';
                        setEditRaceActualPace(autoCalcPace(val, isCustom ? (editRaceCustomCourseName || '기타') : editRaceCourse, isCustom ? editRaceCustomKm : undefined));
                      }}
                      placeholder="예: 01:29:45"
                      className="w-full px-2.5 py-1.5 glass-input rounded-lg text-xs font-mono font-bold text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">평균 페이스</label>
                    <input
                      type="text"
                      value={editRaceActualPace}
                      onChange={(e) => setEditRaceActualPace(e.target.value)}
                      placeholder="예: 4'15&quot;"
                      className="w-full px-2.5 py-1.5 glass-input rounded-lg text-xs font-mono text-stone-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">참가 상태</label>
                    <select
                      value={editRaceStatus}
                      onChange={(e) => setEditRaceStatus(e.target.value as 'completed' | 'scheduled' | 'dnf' | 'dns')}
                      className="w-full px-2.5 py-1.5 glass-input rounded-lg text-xs bg-white text-stone-800 font-medium"
                    >
                      <option value="scheduled">참가 예정 (Scheduled)</option>
                      <option value="completed">🏆 완주 완료 (Completed)</option>
                      <option value="dnf">⚠️ DNF (중도 포기)</option>
                      <option value="dns">DNS (불참)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">순위 (선택)</label>
                    <input
                      type="text"
                      value={editRaceRank}
                      onChange={(e) => setEditRaceRank(e.target.value)}
                      placeholder="예: 전체 142위"
                      className="w-full px-2.5 py-1.5 glass-input rounded-lg text-xs text-stone-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">소감 및 후기 메모</label>
                  <textarea
                    rows={2}
                    value={editRaceReview}
                    onChange={(e) => setEditRaceReview(e.target.value)}
                    placeholder="대회 메모"
                    className="w-full px-2.5 py-1.5 glass-input rounded-lg text-xs text-stone-800 resize-none"
                  />
                </div>
              </div>

              {/* 5. 대표 목표 대회 설정 여부 */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    checked={editRaceIsTarget}
                    onChange={(e) => setEditRaceIsTarget(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-stone-300"
                  />
                  <span>이 대회를 대표 메인 목표 대회로 지정</span>
                </label>
                <span className="text-[10px] text-stone-500 mt-1 block pl-6">
                  * 홈 화면 상단 D-Day 위젯과 훈련 계획 생성 시 최우선 기준으로 분석됩니다.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditingRaceForTarget(null)}
                  className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>설정 저장</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. 대회 실제 완주 기록 & 배번호 입력 전용 모달 */}
      {recordingRaceResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-stone-200 shadow-2xl text-stone-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-600" />
                <span>대회 실제 완주 기록 & 배번호 입력</span>
              </h3>
              <button
                type="button"
                onClick={() => setRecordingRaceResult(null)}
                className="text-stone-400 hover:text-stone-700 text-xs px-2 py-1 cursor-pointer"
              >
                닫기
              </button>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 mb-4 text-xs space-y-1">
              <div className="font-bold text-stone-900 text-sm">{recordingRaceResult.name}</div>
              <div className="text-stone-600 flex items-center gap-2">
                <span>{recordingRaceResult.date}</span>
                <span>·</span>
                <span className="font-semibold text-rose-800">{recordingRaceResult.course}</span>
                {recordingRaceResult.targetTime && (
                  <>
                    <span>·</span>
                    <span className="text-stone-500 font-mono">목표: {recordingRaceResult.targetTime}</span>
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveRaceResultSubmit} className="space-y-4">
              {/* 배번호 */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-purple-700" />
                    <span>배번호 (Bib Number)</span>
                  </span>
                  <span className="text-[10px] text-stone-400">예: #11111</span>
                </label>
                <input
                  type="text"
                  value={resultBibNumber}
                  onChange={(e) => setResultBibNumber(e.target.value)}
                  placeholder="예: #11111, A-1024"
                  className="w-full px-3 py-2.5 glass-input rounded-xl text-xs font-mono font-bold text-purple-950 focus:border-purple-500"
                />
              </div>

              {/* 코스 거리 확인 및 직접 설정 */}
              <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-purple-950 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                  <Target className="w-3.5 h-3.5 text-purple-700" />
                  <span>코스 거리 (km 단위 직접 설정)</span>
                </span>
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={resultCustomKm}
                    onChange={(e) => {
                      const val = e.target.value;
                      setResultCustomKm(val);
                      if (resultActualRecord) {
                        setResultActualPace(autoCalcPace(resultActualRecord, recordingRaceResult.course, val));
                      }
                    }}
                    placeholder="예: 21.0975, 10.0, 7.5"
                    className="w-28 px-2 py-1 glass-input rounded-lg text-xs font-mono font-bold text-purple-950 text-right focus:border-purple-600"
                  />
                  <span className="text-stone-500 font-mono text-[11px]">km</span>
                </div>
              </div>

              {/* 실제 완주 기록 & 평균 페이스 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    실제 완주 기록 (hh:mm:ss) <span className="text-rose-700">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={resultActualRecord}
                    onChange={(e) => {
                      const val = e.target.value;
                      setResultActualRecord(val);
                      setResultActualPace(autoCalcPace(val, recordingRaceResult.course, resultCustomKm));
                    }}
                    placeholder="예: 01:29:45"
                    className="w-full px-3 py-2.5 glass-input rounded-xl text-sm font-mono font-black text-emerald-950 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    평균 페이스
                  </label>
                  <input
                    type="text"
                    value={resultActualPace}
                    onChange={(e) => setResultActualPace(e.target.value)}
                    placeholder="예: 4'15&quot;"
                    className="w-full px-3 py-2.5 glass-input rounded-xl text-xs font-mono font-bold text-stone-800"
                  />
                </div>
              </div>

              {/* Target Comparison Realtime Alert */}
              {recordingRaceResult.targetTime && resultActualRecord && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                  <span className="font-semibold">목표({recordingRaceResult.targetTime}) 대비 성적</span>
                  <span className="font-mono font-bold">
                    {resultActualRecord <= recordingRaceResult.targetTime
                      ? '🎉 목표 완주 시간 달성 성공!'
                      : '기분 좋은 완주 완료'}
                  </span>
                </div>
              )}

              {/* 참가 상태 & 순위 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">참가 상태</label>
                  <select
                    value={resultStatus}
                    onChange={(e) => setResultStatus(e.target.value as 'completed' | 'dnf' | 'dns')}
                    className="w-full px-3 py-2.5 glass-input rounded-xl text-xs bg-white text-stone-800 font-semibold"
                  >
                    <option value="completed">🏆 완주 (Completed)</option>
                    <option value="dnf">⚠️ DNF (중도 포기)</option>
                    <option value="dns">DNS (미출전/불참)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">순위 (선택)</label>
                  <input
                    type="text"
                    value={resultRank}
                    onChange={(e) => setResultRank(e.target.value)}
                    placeholder="예: 전체 142위 / 연령대 18위"
                    className="w-full px-3 py-2.5 glass-input rounded-xl text-xs text-stone-800"
                  />
                </div>
              </div>

              {/* 대회 소감 및 후기 */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  대회 소감 및 후기 (선택)
                </label>
                <textarea
                  rows={2}
                  value={resultReview}
                  onChange={(e) => setResultReview(e.target.value)}
                  placeholder="대회 당일 코스 상태, 날씨, 페이스 전략, 느낀 점 등을 메모하세요."
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs text-stone-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setRecordingRaceResult(null)}
                  className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>기록 저장 및 히스토리 보관</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
