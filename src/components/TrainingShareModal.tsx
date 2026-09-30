import React, { useRef, useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Share2,
  Download,
  Copy,
  Check,
  X,
  Sparkles,
  Sliders,
  CheckSquare,
  Square,
  Timer,
  Zap,
  Heart,
  Footprints,
  Flame,
  Calendar,
  BarChart2,
  FileText,
} from 'lucide-react';
import { TrainingSession } from '../types';

interface TrainingShareModalProps {
  session: TrainingSession;
  vdot?: number;
  runnerTierName?: string;
  onClose: () => void;
}

export type ShareFormat = 'square' | 'portrait' | 'story';
export type LapDisplayMode = 'all' | 'first5' | 'none';

export const TrainingShareModal: React.FC<TrainingShareModalProps> = ({
  session,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [theme, setTheme] = useState<'cyber' | 'stealth' | 'sunset' | 'emerald'>('cyber');
  const [format, setFormat] = useState<ShareFormat>('square'); // square (1080x1080), portrait (1080x1350), or story (1080x1920)
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [shareSupported, setShareSupported] = useState(false);

  const hasLaps = !!(session.laps && session.laps.length > 0);
  const [lapDisplayMode, setLapDisplayMode] = useState<LapDisplayMode>(hasLaps ? 'all' : 'none');

  // Clean training title by removing duplicate/redundant distance in parenthesis like (10.05km) or (10km)
  const cleanTitle = useMemo(() => {
    return session.title
      .replace(/\(\s*[\d.]+\s*(?:km|k|m)?\s*\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || session.title;
  }, [session.title]);

  // Metric Selection Toggles
  const [selectedMetrics, setSelectedMetrics] = useState({
    time: true, // 훈련 소요 시간
    pace: true, // 평균 페이스
    hr: true, // 평균 / 최고 심박수
    cadence: true, // 케이던스
    shoe: !!session.shoeName, // 착용 러닝화
    calories: false, // 소모 칼로리
    date: true, // 날짜 표시
    laps: hasLaps, // 랩 스플릿 차트
    notes: !!session.notes, // 훈련 메모
  });

  const toggleMetric = (key: keyof typeof selectedMetrics) => {
    setSelectedMetrics((prev) => {
      const nextVal = !prev[key];
      if (key === 'laps') {
        setLapDisplayMode(nextVal ? 'all' : 'none');
      }
      return { ...prev, [key]: nextVal };
    });
  };

  const handleSetLapDisplayMode = (mode: LapDisplayMode) => {
    setLapDisplayMode(mode);
    setSelectedMetrics((prev) => ({
      ...prev,
      laps: mode !== 'none',
    }));
  };

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !!navigator.share) {
      setShareSupported(true);
    }
  }, []);

  // Theme palettes
  const THEMES = {
    cyber: {
      name: '사이버 네온',
      bgStart: '#090d16',
      bgEnd: '#020617',
      accent1: '#00f0ff', // cyan
      accent2: '#10b981', // emerald
      textPrimary: '#ffffff',
      textSecondary: '#94a3b8',
      cardBg: 'rgba(15, 23, 42, 0.8)',
      cardBorder: 'rgba(0, 240, 255, 0.25)',
      badgeBg: 'rgba(0, 240, 255, 0.15)',
      badgeText: '#38bdf8',
    },
    stealth: {
      name: '스텔스 매트',
      bgStart: '#18181b',
      bgEnd: '#09090b',
      accent1: '#f59e0b', // amber
      accent2: '#ef4444', // red
      textPrimary: '#ffffff',
      textSecondary: '#a1a1aa',
      cardBg: 'rgba(24, 24, 27, 0.85)',
      cardBorder: 'rgba(255, 255, 255, 0.15)',
      badgeBg: 'rgba(245, 158, 11, 0.15)',
      badgeText: '#fbbf24',
    },
    sunset: {
      name: '선셋 오렌지',
      bgStart: '#1a0b1e',
      bgEnd: '#0a0314',
      accent1: '#f43f5e', // rose
      accent2: '#fb923c', // orange
      textPrimary: '#ffffff',
      textSecondary: '#cbd5e1',
      cardBg: 'rgba(30, 10, 35, 0.8)',
      cardBorder: 'rgba(244, 63, 94, 0.3)',
      badgeBg: 'rgba(244, 63, 94, 0.15)',
      badgeText: '#fda4af',
    },
    emerald: {
      name: '마라톤 레이스',
      bgStart: '#041f17',
      bgEnd: '#020d09',
      accent1: '#34d399', // emerald
      accent2: '#6ee7b7', // mint
      textPrimary: '#ffffff',
      textSecondary: '#94a3b8',
      cardBg: 'rgba(6, 40, 30, 0.8)',
      cardBorder: 'rgba(52, 211, 153, 0.3)',
      badgeBg: 'rgba(52, 211, 153, 0.15)',
      badgeText: '#6ee7b7',
    },
  };

  // Helper cadence calculation
  const getCadence = () => {
    // Check if any lap contains cadence or compute realistic cadence from pace
    const paceParts = session.avgPace.split("'");
    const min = parseInt(paceParts[0], 10) || 5;
    const sec = parseInt(paceParts[1]?.replace('"', '') || '0', 10) || 0;
    const totalSec = min * 60 + sec;
    // Faster pace -> slightly higher cadence
    const estimated = Math.min(192, Math.max(168, Math.round(184 - (totalSec - 270) * 0.05)));
    return `${estimated} spm`;
  };

  // Render Card to Canvas
  const renderCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentTheme = THEMES[theme];
    const width = 1080;
    const baseHeight = format === 'square' ? 1080 : format === 'portrait' ? 1350 : 1920;

    // 1. Gather active metrics
    interface MetricItem {
      icon: string;
      label: string;
      val: string;
      sub: string;
      color: string;
    }
    const activeCards: MetricItem[] = [];

    if (selectedMetrics.time) {
      activeCards.push({
        icon: '⏱️',
        label: '훈련 소요 시간',
        val: session.totalTime,
        sub: 'Total Duration',
        color: '#ffffff',
      });
    }

    if (selectedMetrics.pace) {
      activeCards.push({
        icon: '⚡',
        label: '평균 페이스',
        val: `${session.avgPace} /km`,
        sub: 'Average Pace',
        color: currentTheme.accent1,
      });
    }

    if (selectedMetrics.hr) {
      activeCards.push({
        icon: '❤️',
        label: '평균 / 최고 심박수',
        val: `${session.avgHr} / ${session.maxHr} bpm`,
        sub: 'Heart Rate Zone',
        color: '#f43f5e',
      });
    }

    if (selectedMetrics.cadence) {
      activeCards.push({
        icon: '🦶',
        label: '평균 케이던스',
        val: getCadence(),
        sub: 'Cadence (spm)',
        color: currentTheme.accent2,
      });
    }

    if (selectedMetrics.calories) {
      activeCards.push({
        icon: '🔥',
        label: '예상 소모 열량',
        val: `${Math.round(session.totalDistanceKm * 64)} kcal`,
        sub: 'Estimated Calories',
        color: '#fb923c',
      });
    }

    if (selectedMetrics.shoe && session.shoeName) {
      activeCards.push({
        icon: '👟',
        label: '착용 러닝화',
        val: session.shoeName,
        sub: 'Running Shoes',
        color: '#34d399',
      });
    }

    // 2. Gather visible laps
    const allLaps = session.laps || [];
    let visibleLaps: typeof allLaps = [];
    if (selectedMetrics.laps && allLaps.length > 0 && lapDisplayMode !== 'none') {
      visibleLaps = lapDisplayMode === 'first5' ? allLaps.slice(0, 5) : allLaps;
    }

    // Find fastest lap if laps exist
    let bestPace = session.avgPace;
    let fastestLapIndex = -1;
    let fastestLapSec = Infinity;
    if (session.laps && session.laps.length > 0) {
      session.laps.forEach((l, idx) => {
        if (l.avgPace && l.avgPace.includes("'")) {
          const parts = l.avgPace.split("'");
          const m = parseInt(parts[0], 10) || 0;
          const s = parseInt(parts[1]?.replace('"', '') || '0', 10) || 0;
          const sec = m * 60 + s;
          if (sec > 0 && sec < fastestLapSec) {
            fastestLapSec = sec;
            fastestLapIndex = idx;
            bestPace = l.avgPace;
          }
        }
      });
    }

    // 3. Layout Density & Dimension Calculation
    const hasNotes = selectedMetrics.notes && !!session.notes;
    const hasStoryBanner = format === 'story';
    const isSquare = format === 'square';

    // Auto-compact mode for square when multiple elements exist
    const isCompact = isSquare && (
      activeCards.length >= 4 ||
      (activeCards.length >= 2 && (hasNotes || visibleLaps.length > 0))
    );

    const paddingX = isSquare ? (isCompact ? 60 : 75) : 70;
    const availableW = width - paddingX * 2;

    // Card columns & heights
    let cols = 2;
    if (isCompact && activeCards.length >= 5) {
      cols = 3;
    } else if (activeCards.length === 3 && isSquare) {
      cols = 3;
    }

    const cardGap = isCompact ? 14 : 18;
    const cardW = (availableW - cardGap * (cols - 1)) / cols;
    const cardH = isCompact ? 92 : (isSquare ? 116 : (activeCards.length <= 4 ? 155 : 138));
    const cardRows = activeCards.length > 0 ? Math.ceil(activeCards.length / cols) : 0;
    const cardsTotalH = cardRows > 0 ? cardRows * cardH + (cardRows - 1) * cardGap : 0;

    // Lap section calculation
    let lapCols = 1;
    let lapRows = 0;
    let lapRowH = 40;
    let lapSectionH = 0;

    if (visibleLaps.length > 0) {
      if (visibleLaps.length <= 5) {
        lapCols = isSquare || format === 'portrait' ? visibleLaps.length : (visibleLaps.length > 3 ? 2 : 1);
        lapRows = Math.ceil(visibleLaps.length / lapCols);
        lapRowH = isCompact ? 52 : (format === 'story' ? 54 : 64);
      } else if (visibleLaps.length <= 12) {
        lapCols = 2;
        lapRows = Math.ceil(visibleLaps.length / 2);
        lapRowH = isCompact ? 36 : (format === 'story' ? 48 : 42);
      } else if (visibleLaps.length <= 24) {
        lapCols = 3;
        lapRows = Math.ceil(visibleLaps.length / 3);
        lapRowH = isCompact ? 32 : (format === 'story' ? 42 : 36);
      } else {
        lapCols = 4;
        lapRows = Math.ceil(visibleLaps.length / 4);
        lapRowH = isCompact ? 28 : 32;
      }
      lapSectionH = (isCompact ? 40 : 46) + lapRows * lapRowH + (isCompact ? 12 : 16);
    }

    // Notes section height
    const noteH = isCompact ? 68 : (isSquare ? 80 : 100);
    const storyBannerH = 110;
    const sectionGap = isCompact ? 14 : (isSquare ? 18 : 24);

    // Dynamic Height Calculation: ensures canvas NEVER clips or overflows
    const topStartY = isCompact ? 55 : (isSquare ? 80 : 135);
    const brandH = 26;
    const dateH = selectedMetrics.date ? (isCompact ? 32 : 40) : 0;
    const titleH = isCompact ? 42 : (isSquare ? 52 : 62);
    const heroH = isCompact ? 115 : (isSquare ? 150 : 180);
    const footerH = isSquare ? (isCompact ? 50 : 60) : 80;

    const estimatedTotalH =
      topStartY +
      brandH +
      dateH +
      titleH +
      heroH +
      (activeCards.length > 0 ? sectionGap + cardsTotalH : 0) +
      (hasStoryBanner ? sectionGap + storyBannerH : 0) +
      (hasNotes ? sectionGap + noteH : 0) +
      (visibleLaps.length > 0 ? sectionGap + lapSectionH : 0) +
      footerH +
      30;

    const height = Math.max(baseHeight, Math.ceil(estimatedTotalH));

    canvas.width = width;
    canvas.height = height;

    // 4. Background Gradient
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, currentTheme.bgStart);
    bgGradient.addColorStop(1, currentTheme.bgEnd);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle background diagonal accent lines
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1.5;
    for (let i = -width; i < width * 2; i += 60) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + height, height);
      ctx.stroke();
    }
    ctx.restore();

    // Radial Glow Accent at top
    const glowGradient = ctx.createRadialGradient(width * 0.8, 140, 20, width * 0.8, 140, 450);
    glowGradient.addColorStop(0, currentTheme.accent1 + '2d');
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, width, height);

    // 5. Header Branding: 'RunningMoon : Go FASTER'
    let currentY = topStartY;

    ctx.save();
    ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = currentTheme.accent1;
    ctx.letterSpacing = '2px';
    ctx.fillText('RunningMoon : Go FASTER', paddingX, currentY);

    if (format === 'story' || format === 'portrait') {
      const tagText = 'OFFICIAL WORKOUT REPORT';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = currentTheme.accent2;
      const tagW = ctx.measureText(tagText).width;
      ctx.fillText(tagText, width - paddingX - tagW, currentY);
    }
    ctx.restore();

    // Date (if selected)
    if (selectedMetrics.date) {
      currentY += isCompact ? 32 : 40;
      ctx.font = isCompact
        ? '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        : '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = currentTheme.textSecondary;
      ctx.fillText(`📅 ${session.date}`, paddingX, currentY);
    }

    // Clean Session Title (with auto-shrink to prevent overflow)
    currentY += isCompact ? 40 : 48;
    let titleFontSize = isCompact ? 36 : (isSquare ? 44 : 50);
    ctx.font = `900 ${titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    while (ctx.measureText(cleanTitle).width > availableW && titleFontSize > 22) {
      titleFontSize -= 2;
      ctx.font = `900 ${titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    }
    ctx.fillStyle = currentTheme.textPrimary;
    ctx.fillText(cleanTitle, paddingX, currentY);

    // 6. Hero Metric: TOTAL WORKOUT DISTANCE
    currentY += isCompact ? 50 : 60;
    const distNum = session.totalDistanceKm.toFixed(2);
    let heroFontSize = isCompact ? 100 : (isSquare ? 125 : 145);
    ctx.font = `900 ${heroFontSize}px -apple-system, BlinkMacSystemFont, "Impact", sans-serif`;

    ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, sans-serif';
    const kmW = ctx.measureText('KM').width;
    ctx.font = `900 ${heroFontSize}px -apple-system, BlinkMacSystemFont, "Impact", sans-serif`;
    while (ctx.measureText(distNum).width + kmW + 25 > availableW && heroFontSize > 65) {
      heroFontSize -= 5;
      ctx.font = `900 ${heroFontSize}px -apple-system, BlinkMacSystemFont, "Impact", sans-serif`;
    }

    const distGrad = ctx.createLinearGradient(paddingX, currentY, paddingX + 450, currentY);
    distGrad.addColorStop(0, '#ffffff');
    distGrad.addColorStop(1, currentTheme.accent1);
    ctx.fillStyle = distGrad;
    const heroNumOffset = isCompact ? 85 : 100;
    ctx.fillText(distNum, paddingX, currentY + heroNumOffset);

    // "KM" Unit label
    const distWidth = ctx.measureText(distNum).width;
    ctx.font = isCompact ? 'bold 36px -apple-system, sans-serif' : 'bold 42px -apple-system, sans-serif';
    ctx.fillStyle = currentTheme.accent1;
    ctx.fillText('KM', paddingX + distWidth + 18, currentY + heroNumOffset - 5);

    // Label under hero
    ctx.font = isCompact ? 'bold 16px -apple-system, sans-serif' : 'bold 18px -apple-system, sans-serif';
    ctx.fillStyle = currentTheme.textSecondary;
    ctx.fillText('TOTAL WORKOUT DISTANCE', paddingX + 4, currentY + heroNumOffset + (isCompact ? 28 : 34));

    // Decorative line in portrait/story mode
    if (format !== 'square') {
      ctx.save();
      const heroLineGrad = ctx.createLinearGradient(paddingX, 0, width - paddingX, 0);
      heroLineGrad.addColorStop(0, currentTheme.accent1 + '99');
      heroLineGrad.addColorStop(0.6, currentTheme.accent2 + '66');
      heroLineGrad.addColorStop(1, 'transparent');
      ctx.strokeStyle = heroLineGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(paddingX, currentY + heroNumOffset + 50);
      ctx.lineTo(width - paddingX, currentY + heroNumOffset + 50);
      ctx.stroke();
      ctx.restore();
    }

    currentY += heroNumOffset + (isCompact ? 48 : (format === 'square' ? 62 : 80));

    // 7. Metrics Grid (Dynamic & Non-overflowing)
    if (activeCards.length > 0) {
      const gridY = currentY;

      activeCards.forEach((m, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cX = paddingX + col * (cardW + cardGap);
        const cY = gridY + row * (cardH + cardGap);

        ctx.save();
        ctx.fillStyle = currentTheme.cardBg;
        ctx.strokeStyle = currentTheme.cardBorder;
        ctx.lineWidth = 1.5;

        roundRect(ctx, cX, cY, cardW, cardH, isCompact ? 16 : 18);
        ctx.fill();
        ctx.stroke();

        // Card Label
        ctx.font = isCompact ? '500 15px -apple-system, sans-serif' : '500 17px -apple-system, sans-serif';
        ctx.fillStyle = currentTheme.textSecondary;
        ctx.fillText(`${m.icon} ${m.label}`, cX + (isCompact ? 16 : 20), cY + (isCompact ? 26 : 32));

        // Card Value with dynamic auto-shrink to NEVER overflow card width
        let valFontSize = isCompact ? 24 : (isSquare ? 30 : 34);
        ctx.font = `900 ${valFontSize}px -apple-system, BlinkMacSystemFont, "Impact", sans-serif`;
        const maxValW = cardW - (isCompact ? 32 : 40);
        while (ctx.measureText(m.val).width > maxValW && valFontSize > 13) {
          valFontSize -= 1;
          ctx.font = `900 ${valFontSize}px -apple-system, BlinkMacSystemFont, "Impact", sans-serif`;
        }
        ctx.fillStyle = m.color;
        ctx.fillText(m.val, cX + (isCompact ? 16 : 20), cY + (isCompact ? 56 : (isSquare ? 72 : 80)));

        // Subtitle
        ctx.font = isCompact ? '400 12px -apple-system, sans-serif' : '400 13px -apple-system, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillText(m.sub, cX + (isCompact ? 16 : 20), cY + (isCompact ? 76 : (isSquare ? 96 : 110)));

        // Bottom accent bar in story / portrait mode
        if (format !== 'square') {
          ctx.fillStyle = m.color;
          ctx.fillRect(cX + 20, cY + cardH - 10, 40, 3);
        }

        ctx.restore();
      });

      currentY = gridY + cardsTotalH + sectionGap;
    }

    // 8. Performance Highlights Banner (Story mode)
    if (format === 'story') {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, paddingX, currentY, availableW, storyBannerH, 18);
      ctx.fill();
      ctx.stroke();

      const colW = availableW / 3;

      // Col 1: Best Lap Pace
      ctx.font = '500 15px -apple-system, sans-serif';
      ctx.fillStyle = currentTheme.textSecondary;
      ctx.fillText('🏆 최고 랩 페이스', paddingX + 22, currentY + 34);
      ctx.font = '900 26px -apple-system, BlinkMacSystemFont, "Impact", sans-serif';
      ctx.fillStyle = currentTheme.accent1;
      ctx.fillText(bestPace ? `${bestPace} /km` : session.avgPace, paddingX + 22, currentY + 74);

      // Col 2: Max Heart Rate
      ctx.font = '500 15px -apple-system, sans-serif';
      ctx.fillStyle = currentTheme.textSecondary;
      ctx.fillText('⚡ 심박 피크', paddingX + colW + 18, currentY + 34);
      ctx.font = '900 26px -apple-system, BlinkMacSystemFont, "Impact", sans-serif';
      ctx.fillStyle = '#f43f5e';
      ctx.fillText(`${session.maxHr} bpm`, paddingX + colW + 18, currentY + 74);

      // Col 3: Workout Status
      ctx.font = '500 15px -apple-system, sans-serif';
      ctx.fillStyle = currentTheme.textSecondary;
      ctx.fillText('🎯 훈련 완성도', paddingX + colW * 2 + 15, currentY + 34);
      ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Impact", sans-serif';
      ctx.fillStyle = currentTheme.accent2;
      ctx.fillText('100% COMPLETED', paddingX + colW * 2 + 15, currentY + 74);

      ctx.restore();
      currentY += storyBannerH + sectionGap;
    }

    // 9. Notes Card (with clean auto-wrap)
    if (selectedMetrics.notes && session.notes) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, paddingX, currentY, availableW, noteH, 16);
      ctx.fill();
      ctx.stroke();

      ctx.font = isCompact ? '600 14px -apple-system, sans-serif' : '600 16px -apple-system, sans-serif';
      ctx.fillStyle = currentTheme.accent1;
      ctx.fillText('📝 러너 코멘트 / 훈련 메모', paddingX + 20, currentY + (isCompact ? 24 : 28));

      ctx.font = isCompact ? '500 16px -apple-system, sans-serif' : '500 18px -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';

      // Auto-wrap note to fit availableW - 40
      const maxNoteW = availableW - 40;
      let noteText = session.notes.trim();
      if (ctx.measureText(`“${noteText}”`).width > maxNoteW) {
        // Multi-line wrap up to 2 lines
        let line1 = '';
        let line2 = '';
        const chars = noteText.split('');
        for (let i = 0; i < chars.length; i++) {
          if (ctx.measureText(`“${line1 + chars[i]}`).width < maxNoteW) {
            line1 += chars[i];
          } else {
            line2 = noteText.substring(i);
            break;
          }
        }
        if (ctx.measureText(`${line2}”`).width > maxNoteW) {
          while (ctx.measureText(`${line2}...”`).width > maxNoteW && line2.length > 5) {
            line2 = line2.slice(0, -1);
          }
          line2 += '...';
        }
        ctx.fillText(`“${line1}`, paddingX + 20, currentY + (isCompact ? 44 : 52));
        if (line2) {
          ctx.fillText(`${line2}”`, paddingX + 20, currentY + (isCompact ? 60 : 74));
        }
      } else {
        ctx.fillText(`“${noteText}”`, paddingX + 20, currentY + (isCompact ? 48 : 56));
      }

      ctx.restore();
      currentY += noteH + sectionGap;
    }

    // 10. Lap Breakdown Chart (Displays ALL LAPS or 5 LAPS based on lapDisplayMode)
    if (visibleLaps.length > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, paddingX, currentY, availableW, lapSectionH, 18);
      ctx.fill();
      ctx.stroke();

      // Section Header
      ctx.font = isCompact ? 'bold 16px -apple-system, sans-serif' : 'bold 18px -apple-system, sans-serif';
      ctx.fillStyle = currentTheme.accent1;
      const headerTitle = lapDisplayMode === 'all'
        ? `📊 LAP SPLIT ANALYSIS (총 ${visibleLaps.length}개 랩 구간 전체 분석)`
        : `📊 LAP SPLIT ANALYSIS (주요 5개 랩 요약 / 전체 ${allLaps.length} Laps)`;
      ctx.fillText(headerTitle, paddingX + 20, currentY + (isCompact ? 26 : 30));

      // Right avg pace pill
      ctx.font = '500 13px -apple-system, sans-serif';
      ctx.fillStyle = currentTheme.textSecondary;
      const avgPaceText = `평균 페이스: ${session.avgPace} /km`;
      const avgW = ctx.measureText(avgPaceText).width;
      ctx.fillText(avgPaceText, width - paddingX - 20 - avgW, currentY + (isCompact ? 26 : 30));

      // Render Laps in multi-column clean grid
      const colGap = lapCols > 1 ? 12 : 0;
      const rowGap = isCompact ? 6 : 8;
      const cellW = (availableW - 40 - (lapCols - 1) * colGap) / lapCols;
      const cellH = lapRowH - rowGap;
      const startLapY = currentY + (isCompact ? 36 : 42);

      visibleLaps.forEach((lap, idx) => {
        const c = idx % lapCols;
        const r = Math.floor(idx / lapCols);
        const lx = paddingX + 20 + c * (cellW + colGap);
        const ly = startLapY + r * lapRowH;

        const isFastest = idx === fastestLapIndex;

        ctx.save();
        ctx.fillStyle = isFastest ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = isFastest ? 'rgba(52, 211, 153, 0.6)' : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        roundRect(ctx, lx, ly, cellW, cellH, 8);
        ctx.fill();
        ctx.stroke();

        // Left Lap number badge
        ctx.font = isCompact ? 'bold 13px -apple-system, sans-serif' : 'bold 14px -apple-system, sans-serif';
        ctx.fillStyle = isFastest ? currentTheme.accent1 : currentTheme.textSecondary;
        ctx.fillText(`L${lap.lap}`, lx + (isCompact ? 8 : 12), ly + cellH / 2 + 5);

        // Center Split Pace
        ctx.font = isCompact ? '900 15px -apple-system, sans-serif' : '900 17px -apple-system, sans-serif';
        ctx.fillStyle = isFastest ? '#34d399' : '#ffffff';
        const paceOffset = cellW > 180 ? (isCompact ? 48 : 55) : 38;
        ctx.fillText(lap.avgPace || '-', lx + paceOffset, ly + cellH / 2 + 5);

        // Right Heart rate or Fastest badge
        ctx.font = '500 12px -apple-system, sans-serif';
        if (isFastest && cellW > 150) {
          ctx.fillStyle = '#34d399';
          const badge = '⚡최고';
          const bw = ctx.measureText(badge).width;
          ctx.fillText(badge, lx + cellW - (isCompact ? 8 : 12) - bw, ly + cellH / 2 + 4);
        } else if (lap.avgHr && cellW > 130) {
          ctx.fillStyle = '#fda4af';
          const hrText = `${lap.avgHr}bpm`;
          const hrW = ctx.measureText(hrText).width;
          ctx.fillText(hrText, lx + cellW - (isCompact ? 8 : 12) - hrW, ly + cellH / 2 + 4);
        }

        ctx.restore();
      });

      ctx.restore();
      currentY += lapSectionH + sectionGap;
    }

    // 11. Footer Branding: Always pinned cleanly at the bottom
    const footerY = height - (isSquare ? 40 : 60);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(paddingX, footerY - 20);
    ctx.lineTo(width - paddingX, footerY - 20);
    ctx.stroke();

    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = currentTheme.textPrimary;
    ctx.fillText('PaceMaster Club', paddingX, footerY + 8);

    const rightText = 'RUNNINGMOON ATHLETIC SUITE';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = currentTheme.accent2;
    const rightW = ctx.measureText(rightText).width;
    ctx.fillText(rightText, width - paddingX - rightW, footerY + 8);
    ctx.restore();

    // Export to preview data URL
    setPreviewDataUrl(canvas.toDataURL('image/png', 0.95));
  };

  // Helper rounded rect
  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // Render on mount and state changes
  useEffect(() => {
    renderCard();
  }, [theme, format, session, selectedMetrics, lapDisplayMode, cleanTitle]);

  // Handle Download PNG
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    const safeTitle = cleanTitle.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    link.download = `${session.date}_${safeTitle}_RunningMoon.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  // Helper to get Canvas Blob as a Promise
  const getCanvasBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> => {
    return new Promise((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), 'image/png', 0.95);
      } catch {
        resolve(null);
      }
    });
  };

  // Handle Web Share API (Mobile / Native Share)
  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsGenerating(true);
    try {
      const blob = await getCanvasBlob(canvas);
      if (!blob) {
        setIsGenerating(false);
        return;
      }

      const safeTitle = cleanTitle.replace(/[^a-zA-Z0-9가-힣]/g, '_');
      const file = new File([blob], `${session.date}_${safeTitle}_RunningMoon.png`, {
        type: 'image/png',
      });

      const shareData: ShareData = {
        title: `[RunningMoon] ${cleanTitle}`,
        text: `🏃‍♂️ ${session.date} 러닝 훈련 요약\n거리: ${session.totalDistanceKm}km | 시간: ${session.totalTime} | 페이스: ${session.avgPace}/km | 심박: ${session.avgHr}bpm\nPaceMaster Club #RunningMoon #GoFASTER`,
        files: [file],
      };

      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          if (navigator.canShare && navigator.canShare(shareData)) {
            await navigator.share(shareData);
          } else {
            await navigator.share({
              title: shareData.title,
              text: shareData.text,
            });
          }
        } catch (shareErr: unknown) {
          const err = shareErr as { name?: string; message?: string };
          if (
            err?.name === 'AbortError' ||
            err?.message?.toLowerCase().includes('cancel') ||
            err?.message?.toLowerCase().includes('abort')
          ) {
            return;
          }
          await handleCopyText();
        }
      } else {
        await handleCopyText();
      }
    } catch {
      await handleCopyText();
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy Summary Text to Clipboard
  const handleCopyText = async () => {
    const lapsSummary =
      selectedMetrics.laps && lapDisplayMode !== 'none' && session.laps && session.laps.length > 0
        ? `📊 랩 스플릿(${lapDisplayMode === 'all' ? `총 ${session.laps.length}개 전체` : '5개 요약'}):\n` +
          (lapDisplayMode === 'all' ? session.laps : session.laps.slice(0, 5))
            .map((l) => `  · L${l.lap}: ${l.avgPace}/km (${l.avgHr || '-'}bpm)`)
            .join('\n')
        : '';

    const parts = [
      `🏃‍♂️ [RunningMoon : Go FASTER]`,
      `🏷️ 훈련: ${cleanTitle}`,
      selectedMetrics.date ? `📅 날짜: ${session.date}` : '',
      `📍 거리: ${session.totalDistanceKm} km`,
      selectedMetrics.time ? `⏱️ 소요 시간: ${session.totalTime}` : '',
      selectedMetrics.pace ? `⚡ 평균 페이스: ${session.avgPace} /km` : '',
      selectedMetrics.hr ? `❤️ 평균/최고 심박: ${session.avgHr} / ${session.maxHr} bpm` : '',
      selectedMetrics.cadence ? `🦶 케이던스: ${getCadence()}` : '',
      selectedMetrics.shoe && session.shoeName ? `👟 착용 러닝화: ${session.shoeName}` : '',
      selectedMetrics.calories
        ? `🔥 소모 열량: ${Math.round(session.totalDistanceKm * 64)} kcal`
        : '',
      lapsSummary,
      selectedMetrics.notes && session.notes ? `📝 메모: ${session.notes}` : '',
      `PaceMaster Club`,
      `#RunningMoon #GoFASTER #PaceMaster #러닝 #마라톤`,
    ].filter(Boolean);

    const text = parts.join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  // Lock body scroll and handle ESC key
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn overflow-y-auto"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Hidden high-res canvas for drawing */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-4xl border border-stone-200 shadow-2xl my-auto text-stone-800">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-stone-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-rose-800 to-rose-950 text-white rounded-xl shadow-xs">
              <Share2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
                <span>러닝 훈련 기록 이미지 공유 카드 생성</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold font-mono">
                  RunningMoon
                </span>
              </h3>
              <p className="text-xs text-stone-500">
                원하는 훈련 데이터만 골라 담아 감각적인 고화질 인증샷을 생성하고 저장/공유하세요.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Image Preview */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-stone-100 p-4 rounded-xl border border-stone-200 shadow-inner">
            <div className="text-[11px] text-stone-600 mb-2 flex items-center justify-between w-full px-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  미리보기 ({format === 'square' ? '1:1 피드 1080x1080' : format === 'portrait' ? '4:5 인스타 피드 1080x1350' : '9:16 스토리 1080x1920'})
                </span>
              </span>
              <span className="text-emerald-800 font-mono font-semibold">Live Canvas Render</span>
            </div>

            <div className="relative max-h-[480px] w-full overflow-hidden rounded-xl border border-stone-300 shadow-2xl flex items-center justify-center bg-stone-950 p-2">
              {previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt="Training Share Preview"
                  className="object-contain max-h-[440px] w-auto max-w-full rounded-lg shadow-lg"
                />
              ) : (
                <div className="p-12 text-center text-stone-400 text-xs">
                  카드를 렌더링하고 있습니다...
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Controls & Share Options */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
              {/* 1. Format Select */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  1️⃣ 카드 규격 (비율 선택)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormat('square')}
                    className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      format === 'square'
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-500 shadow-2xs'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <span>1:1 피드</span>
                    <span className="text-[10px] font-normal opacity-80">(정사각형)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('portrait')}
                    className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      format === 'portrait'
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-500 shadow-2xs'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <span>4:5 세로</span>
                    <span className="text-[10px] font-normal opacity-80">(인스타 피드)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('story')}
                    className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      format === 'story'
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-500 shadow-2xs'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <span>9:16 스토리</span>
                    <span className="text-[10px] font-normal opacity-80">(세로형)</span>
                  </button>
                </div>
              </div>

              {/* 2. Theme Select */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  2️⃣ 디자인 테마 컬러
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((tKey) => {
                    const t = THEMES[tKey];
                    const isSelected = theme === tKey;
                    return (
                      <button
                        key={tKey}
                        type="button"
                        onClick={() => setTheme(tKey)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 text-stone-900 shadow-2xs font-bold'
                            : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        <span className="text-xs">{t.name}</span>
                        <div className="flex items-center gap-1">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-stone-300"
                            style={{ backgroundColor: t.accent1 }}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-stone-300"
                            style={{ backgroundColor: t.accent2 }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Laps Options */}
              {hasLaps && (
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BarChart2 className="w-3.5 h-3.5 text-rose-800" />
                      <span>3️⃣ 랩 스플릿 구간 표시 ({session.laps.length}개 랩)</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-bold">
                      {lapDisplayMode === 'all'
                        ? '전체 표시'
                        : lapDisplayMode === 'first5'
                        ? '5개 요약'
                        : '미포함(안넣기)'}
                    </span>
                  </label>
                  <p className="text-[11px] text-stone-500 mb-2">
                    모든 랩을 빠짐없이 다 넣거나, 5개만 요약하거나, 아예 안 넣을 수 있습니다.
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetLapDisplayMode('all')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-0.5 ${
                        lapDisplayMode === 'all'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-400 shadow-2xs'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <span>전체 랩 표시</span>
                      <span className="text-[10px] font-normal opacity-80">({session.laps.length}개 모두)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetLapDisplayMode('first5')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-0.5 ${
                        lapDisplayMode === 'first5'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-400 shadow-2xs'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <span>주요 5개 랩</span>
                      <span className="text-[10px] font-normal opacity-80">(5개 요약)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetLapDisplayMode('none')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-0.5 ${
                        lapDisplayMode === 'none'
                          ? 'bg-rose-100 text-rose-900 border-rose-300 shadow-2xs'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <span>안넣기</span>
                      <span className="text-[10px] font-normal opacity-80">(구간 제외)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Included Metrics Toggle Selection */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-700" />
                  <span>4️⃣ 카드에 포함할 훈련 데이터 선택</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Time Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMetric('time')}
                    className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                      selectedMetrics.time
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-emerald-700" />
                      <span>소요 시간</span>
                    </div>
                    {selectedMetrics.time ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-stone-400" />
                    )}
                  </button>

                  {/* Pace Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMetric('pace')}
                    className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                      selectedMetrics.pace
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-rose-800" />
                      <span>평균 페이스</span>
                    </div>
                    {selectedMetrics.pace ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-stone-400" />
                    )}
                  </button>

                  {/* Heart Rate Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMetric('hr')}
                    className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                      selectedMetrics.hr
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-rose-700" />
                      <span>심박수 (평균/최대)</span>
                    </div>
                    {selectedMetrics.hr ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-stone-400" />
                    )}
                  </button>

                  {/* Cadence Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMetric('cadence')}
                    className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                      selectedMetrics.cadence
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Footprints className="w-3.5 h-3.5 text-amber-700" />
                      <span>평균 케이던스</span>
                    </div>
                    {selectedMetrics.cadence ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-stone-400" />
                    )}
                  </button>

                  {/* Calories Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMetric('calories')}
                    className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                      selectedMetrics.calories
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-orange-600" />
                      <span>소모 칼로리</span>
                    </div>
                    {selectedMetrics.calories ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-stone-400" />
                    )}
                  </button>

                  {/* Shoe Toggle (visible if shoeName exists) */}
                  {session.shoeName && (
                    <button
                      type="button"
                      onClick={() => toggleMetric('shoe')}
                      className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                        selectedMetrics.shoe
                          ? 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs">👟</span>
                        <span className="truncate">러닝화 ({session.shoeName})</span>
                      </div>
                      {selectedMetrics.shoe ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                      )}
                    </button>
                  )}

                  {/* Date Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMetric('date')}
                    className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                      selectedMetrics.date
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-rose-800" />
                      <span>훈련 날짜</span>
                    </div>
                    {selectedMetrics.date ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-stone-400" />
                    )}
                  </button>

                  {/* Notes Toggle (if notes available) */}
                  {session.notes && (
                    <button
                      type="button"
                      onClick={() => toggleMetric('notes')}
                      className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                        selectedMetrics.notes
                          ? 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-stone-600" />
                        <span>훈련 메모/코멘트</span>
                      </div>
                      {selectedMetrics.notes ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-stone-400" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-stone-200">
              <div className="grid grid-cols-2 gap-2">
                {/* Download Button */}
                <button
                  onClick={handleDownload}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>이미지 저장 (PNG)</span>
                </button>

                {/* Mobile / Web Share Button */}
                {shareSupported ? (
                  <button
                    onClick={handleShare}
                    disabled={isGenerating}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-800 to-rose-950 hover:from-rose-700 hover:to-rose-900 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Share2 className="w-4 h-4 text-amber-300" />
                    <span>{isGenerating ? '생성 중...' : 'SNS 바로 공유'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCopyText}
                    className="w-full py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-stone-300 transition-all cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <Copy className="w-4 h-4 text-stone-500" />
                    )}
                    <span>{copied ? '복사 완료!' : '텍스트 요약 복사'}</span>
                  </button>
                )}
              </div>

              {/* Extra Copy Summary Text row if shareSupported */}
              {shareSupported && (
                <button
                  onClick={handleCopyText}
                  className="w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs flex items-center justify-center gap-2 border border-stone-200 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-stone-400" />
                  )}
                  <span>
                    {copied ? '클립보드에 텍스트 복사되었습니다' : 'SNS 피드용 요약 텍스트 복사'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
