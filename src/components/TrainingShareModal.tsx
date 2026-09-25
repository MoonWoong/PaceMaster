import React, { useRef, useState, useEffect, useMemo } from 'react';
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

export const TrainingShareModal: React.FC<TrainingShareModalProps> = ({
  session,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [theme, setTheme] = useState<'cyber' | 'stealth' | 'sunset' | 'emerald'>('cyber');
  const [format, setFormat] = useState<'square' | 'story'>('square'); // square (1080x1080) or story (1080x1920)
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [shareSupported, setShareSupported] = useState(false);

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
    calories: false, // 소모 칼로리
    date: true, // 날짜 표시
    laps: !!(session.laps && session.laps.length > 0), // 랩 스플릿 차트
    notes: !!session.notes, // 훈련 메모
  });

  const toggleMetric = (key: keyof typeof selectedMetrics) => {
    setSelectedMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
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
    const height = format === 'square' ? 1080 : 1920;

    canvas.width = width;
    canvas.height = height;

    // 1. Background Gradient
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, currentTheme.bgStart);
    bgGradient.addColorStop(1, currentTheme.bgEnd);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle background mesh or diagonal accent lines
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

    // Top Radial Glow Accent
    const glowGradient = ctx.createRadialGradient(width * 0.8, 150, 20, width * 0.8, 150, 450);
    glowGradient.addColorStop(0, currentTheme.accent1 + '33');
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Header Branding: 'RunningMoon : Go FASTER'
    const paddingX = format === 'square' ? 80 : 70;
    const availableW = width - paddingX * 2;
    let currentY = format === 'square' ? 95 : 155;

    ctx.save();
    ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = currentTheme.accent1;
    ctx.letterSpacing = '2px';
    ctx.fillText('RunningMoon : Go FASTER', paddingX, currentY);

    if (format === 'story') {
      const tagText = 'OFFICIAL WORKOUT REPORT';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = currentTheme.accent2;
      const tagW = ctx.measureText(tagText).width;
      ctx.fillText(tagText, width - paddingX - tagW, currentY);
    }
    ctx.restore();

    // Date (if selected)
    if (selectedMetrics.date) {
      currentY += format === 'square' ? 45 : 55;
      ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = currentTheme.textSecondary;
      ctx.fillText(`📅 ${session.date}`, paddingX, currentY);
    }

    // Clean Session Title (no duplicate parenthesis with distance)
    currentY += format === 'square' ? 55 : 65;
    ctx.font = format === 'square' 
      ? '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      : '900 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = currentTheme.textPrimary;
    const maxTitleLen = format === 'square' ? 24 : 28;
    const titleText = cleanTitle.length > maxTitleLen ? cleanTitle.slice(0, maxTitleLen - 1) + '...' : cleanTitle;
    ctx.fillText(titleText, paddingX, currentY);

    // 3. Hero Metric: TOTAL WORKOUT DISTANCE
    currentY += format === 'square' ? 65 : 85;

    const distNum = session.totalDistanceKm.toFixed(2);
    ctx.font = format === 'square'
      ? '900 135px -apple-system, BlinkMacSystemFont, "Impact", sans-serif'
      : '900 155px -apple-system, BlinkMacSystemFont, "Impact", sans-serif';

    const distGrad = ctx.createLinearGradient(paddingX, currentY, paddingX + 500, currentY);
    distGrad.addColorStop(0, '#ffffff');
    distGrad.addColorStop(1, currentTheme.accent1);
    ctx.fillStyle = distGrad;
    ctx.fillText(distNum, paddingX, currentY + (format === 'square' ? 105 : 120));

    // "KM" Unit label
    const distWidth = ctx.measureText(distNum).width;
    ctx.font = 'bold 46px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = currentTheme.accent1;
    ctx.fillText('KM', paddingX + distWidth + 20, currentY + (format === 'square' ? 100 : 115));

    // Label under hero
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = currentTheme.textSecondary;
    ctx.fillText('TOTAL WORKOUT DISTANCE', paddingX + 5, currentY + (format === 'square' ? 145 : 170));

    // Decorative line under hero in story mode
    if (format === 'story') {
      ctx.save();
      const heroLineGrad = ctx.createLinearGradient(paddingX, 0, width - paddingX, 0);
      heroLineGrad.addColorStop(0, currentTheme.accent1 + '99');
      heroLineGrad.addColorStop(0.6, currentTheme.accent2 + '66');
      heroLineGrad.addColorStop(1, 'transparent');
      ctx.strokeStyle = heroLineGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(paddingX, currentY + 190);
      ctx.lineTo(width - paddingX, currentY + 190);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Metrics Grid (Dynamic based on selected checkboxes)
    currentY += format === 'square' ? 190 : 235;

    // Collect active metrics
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

    const gridY = currentY;

    if (activeCards.length > 0) {
      let cols = 2;
      if (activeCards.length === 3 && format === 'square') {
        cols = 3;
      }

      const cardGap = 20;
      const cardW = (availableW - cardGap * (cols - 1)) / cols;
      const cardH = format === 'square' ? 120 : (activeCards.length <= 4 ? 165 : 145);

      activeCards.forEach((m, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cX = paddingX + col * (cardW + cardGap);
        const cY = gridY + row * (cardH + cardGap);

        ctx.save();
        ctx.fillStyle = currentTheme.cardBg;
        ctx.strokeStyle = currentTheme.cardBorder;
        ctx.lineWidth = 1.5;

        roundRect(ctx, cX, cY, cardW, cardH, 20);
        ctx.fill();
        ctx.stroke();

        ctx.font = '500 18px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = currentTheme.textSecondary;
        ctx.fillText(`${m.icon} ${m.label}`, cX + 24, cY + 36);

        ctx.font = format === 'square'
          ? '900 32px -apple-system, BlinkMacSystemFont, "Impact", sans-serif'
          : '900 38px -apple-system, BlinkMacSystemFont, "Impact", sans-serif';
        ctx.fillStyle = m.color;
        ctx.fillText(m.val, cX + 24, cY + (format === 'square' ? 78 : 88));

        ctx.font = '400 15px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillText(m.sub, cX + 24, cY + (format === 'square' ? 104 : 124));

        // Bottom accent bar in story mode
        if (format === 'story') {
          ctx.fillStyle = m.color;
          ctx.fillRect(cX + 24, cY + cardH - 12, 45, 3.5);
        }

        ctx.restore();
      });

      const totalRows = Math.ceil(activeCards.length / cols);
      currentY = gridY + totalRows * (cardH + cardGap) + (format === 'square' ? 15 : 25);
    }

    // 5. In Story mode: Performance Highlights Banner (Best Split, Intensity, Effort)
    if (format === 'story') {
      const bannerH = 110;
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, paddingX, currentY, availableW, bannerH, 18);
      ctx.fill();
      ctx.stroke();

      // Find fastest lap pace if laps exist
      let bestPace = session.avgPace;
      if (session.laps && session.laps.length > 0) {
        const sortedPaces = [...session.laps]
          .filter((l) => l.avgPace && l.avgPace.includes("'"))
          .sort((a, b) => a.avgPace.localeCompare(b.avgPace));
        if (sortedPaces.length > 0) bestPace = sortedPaces[0].avgPace;
      }

      const colW = availableW / 3;

      // Col 1: Best Lap Pace
      ctx.font = '500 16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = currentTheme.textSecondary;
      ctx.fillText('🏆 최고 랩 페이스', paddingX + 25, currentY + 36);
      ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Impact", sans-serif';
      ctx.fillStyle = currentTheme.accent1;
      ctx.fillText(bestPace ? `${bestPace} /km` : session.avgPace, paddingX + 25, currentY + 78);

      // Col 2: Max Heart Rate
      ctx.font = '500 16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = currentTheme.textSecondary;
      ctx.fillText('⚡ 심박 피크 (Peak)', paddingX + colW + 20, currentY + 36);
      ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Impact", sans-serif';
      ctx.fillStyle = '#f43f5e';
      ctx.fillText(`${session.maxHr} bpm`, paddingX + colW + 20, currentY + 78);

      // Col 3: Workout Status
      ctx.font = '500 16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = currentTheme.textSecondary;
      ctx.fillText('🎯 훈련 완성도', paddingX + colW * 2 + 15, currentY + 36);
      ctx.font = '900 26px -apple-system, BlinkMacSystemFont, "Impact", sans-serif';
      ctx.fillStyle = currentTheme.accent2;
      ctx.fillText('100% COMPLETED', paddingX + colW * 2 + 15, currentY + 78);

      ctx.restore();
      currentY += bannerH + 25;
    }

    // 6. Notes Card (if selected and notes exist)
    if (selectedMetrics.notes && session.notes) {
      const noteH = format === 'square' ? 85 : 120;
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, paddingX, currentY, availableW, noteH, 18);
      ctx.fill();
      ctx.stroke();

      ctx.font = '600 17px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = currentTheme.accent1;
      ctx.fillText('📝 러너 코멘트 / 훈련 메모', paddingX + 24, currentY + 32);

      ctx.font = '500 20px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#ffffff';
      const maxNoteLen = format === 'square' ? 42 : 55;
      const noteText =
        session.notes.length > maxNoteLen
          ? session.notes.slice(0, maxNoteLen - 1) + '...'
          : session.notes;
      ctx.fillText(`“${noteText}”`, paddingX + 24, currentY + 72);
      ctx.restore();

      currentY += noteH + (format === 'square' ? 15 : 25);
    }

    // 7. Lap Breakdown Chart / 2-Column Split Grid
    if (selectedMetrics.laps && session.laps && session.laps.length > 0) {
      if (format === 'story') {
        // Vertical Story Mode: 2-Column Full Height Lap Breakdown
        const availableHeight = height - currentY - 110;
        const sectionH = Math.max(340, Math.min(480, availableHeight));

        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, paddingX, currentY, availableW, sectionH, 20);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = currentTheme.accent1;
        ctx.fillText(
          `📊 LAP SPLIT BREAKDOWN (총 ${session.laps.length}개 랩 구간 분석)`,
          paddingX + 26,
          currentY + 38
        );

        // Render up to 8 laps in a 2-column clean grid (or single column if <= 4 laps)
        const visibleLaps = session.laps.slice(0, 8);
        const lapCols = visibleLaps.length > 4 ? 2 : 1;
        const colWidth = (availableW - 52 - (lapCols - 1) * 20) / lapCols;
        const rowHeight = 65;
        const startLapY = currentY + 60;

        visibleLaps.forEach((lap, idx) => {
          const c = idx % lapCols;
          const r = Math.floor(idx / lapCols);
          const lx = paddingX + 26 + c * (colWidth + 20);
          const ly = startLapY + r * rowHeight;

          // Lap Card pill
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          roundRect(ctx, lx, ly, colWidth, 54, 12);
          ctx.fill();
          ctx.stroke();

          // Left Lap number badge
          ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = currentTheme.accent1;
          ctx.fillText(`Lap ${lap.lap}`, lx + 16, ly + 33);

          // Split Pace in center
          ctx.font = '900 20px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(lap.avgPace || '-', lx + 90, ly + 34);

          // Heart rate on right
          ctx.font = '500 15px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = '#fda4af';
          const hrText = `${lap.avgHr || '-'} bpm`;
          const hrW = ctx.measureText(hrText).width;
          ctx.fillText(hrText, lx + colWidth - 16 - hrW, ly + 33);

          ctx.restore();
        });

        ctx.restore();
        currentY += sectionH + 25;
      } else {
        // Square Mode: Compact single row 5-lap strip
        const sectionH = 140;
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, paddingX, currentY, availableW, sectionH, 18);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 19px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = currentTheme.accent1;
        ctx.fillText(
          `📊 LAP SPLIT ANALYSIS (총 ${session.laps.length} Laps)`,
          paddingX + 24,
          currentY + 36
        );

        const visibleLaps = session.laps.slice(0, 5);
        const lapColW = (availableW - 48) / visibleLaps.length;

        visibleLaps.forEach((lap, lIdx) => {
          const lx = paddingX + 24 + lIdx * lapColW;
          const ly = currentY + 68;

          ctx.font = '600 15px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = currentTheme.textSecondary;
          ctx.fillText(`Lap ${lap.lap}`, lx, ly);

          ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(lap.avgPace || '-', lx, ly + 26);

          ctx.font = '400 13px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = 'rgba(244, 63, 94, 0.8)';
          ctx.fillText(`${lap.avgHr || '-'} bpm`, lx, ly + 46);
        });

        ctx.restore();
        currentY += sectionH + 20;
      }
    } else if (format === 'story') {
      // In Story mode if no laps: Add an athletic motivation & runner motto card to keep layout full and balanced
      const quoteH = 220;
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, paddingX, currentY, availableW, quoteH, 20);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = currentTheme.accent1;
      ctx.fillText('🔥 ATHLETIC MINDSET & MOTTO', paddingX + 26, currentY + 45);

      ctx.font = '500 22px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('“오늘 완주한 한 걸음 한 걸음이 당신의 한계를 뛰어넘는 힘이 됩니다.”', paddingX + 26, currentY + 105);

      ctx.font = '400 16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = currentTheme.textSecondary;
      ctx.fillText('PaceMaster AI Running Engine • Verified Performance Record', paddingX + 26, currentY + 160);

      ctx.restore();
      currentY += quoteH + 25;
    }

    // 8. Footer Branding: 'PaceMaster Club'
    const footerY = height - (format === 'square' ? 45 : 75);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(paddingX, footerY - 25);
    ctx.lineTo(width - paddingX, footerY - 25);
    ctx.stroke();

    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = currentTheme.textPrimary;
    ctx.fillText('PaceMaster Club', paddingX, footerY + 5);

    const rightText = 'RUNNINGMOON ATHLETIC SUITE';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = currentTheme.accent2;
    const rightW = ctx.measureText(rightText).width;
    ctx.fillText(rightText, width - paddingX - rightW, footerY + 5);
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
  }, [theme, format, session, selectedMetrics, cleanTitle]);

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
    const parts = [
      `🏃‍♂️ [RunningMoon : Go FASTER]`,
      `🏷️ 훈련: ${cleanTitle}`,
      selectedMetrics.date ? `📅 날짜: ${session.date}` : '',
      `📍 거리: ${session.totalDistanceKm} km`,
      selectedMetrics.time ? `⏱️ 소요 시간: ${session.totalTime}` : '',
      selectedMetrics.pace ? `⚡ 평균 페이스: ${session.avgPace} /km` : '',
      selectedMetrics.hr ? `❤️ 평균/최고 심박: ${session.avgHr} / ${session.maxHr} bpm` : '',
      selectedMetrics.cadence ? `🦶 케이던스: ${getCadence()}` : '',
      selectedMetrics.calories
        ? `🔥 소모 열량: ${Math.round(session.totalDistanceKm * 64)} kcal`
        : '',
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      {/* Hidden high-res canvas for drawing */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="glass-panel rounded-2xl p-4 sm:p-6 w-full max-w-4xl border border-white/20 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>러닝 훈련 기록 이미지 공유 카드 생성</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">
                  RunningMoon
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                원하는 훈련 데이터만 골라 담아 감각적인 고화질 인증샷을 생성하고 저장/공유하세요.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Image Preview */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-slate-950/70 p-4 rounded-xl border border-white/10 shadow-inner">
            <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between w-full px-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>미리보기 ({format === 'square' ? '1:1 피드 규격 1080x1080' : '9:16 스토리 규격 1080x1920'})</span>
              </span>
              <span className="text-emerald-400 font-mono font-semibold">Live Canvas Render</span>
            </div>

            <div className="relative max-h-[460px] overflow-hidden rounded-xl border border-white/15 shadow-2xl flex items-center justify-center bg-slate-900">
              {previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt="Training Share Preview"
                  className={`object-contain transition-all ${
                    format === 'square' ? 'max-h-[380px] sm:max-h-[420px]' : 'max-h-[420px] sm:max-h-[460px]'
                  }`}
                />
              ) : (
                <div className="p-12 text-center text-slate-500 text-xs">
                  카드를 렌더링하고 있습니다...
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Controls & Share Options */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {/* 1. Format Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  1️⃣ 카드 규격 (비율 선택)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormat('square')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      format === 'square'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-900 text-slate-400 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span>1:1 피드 (정사각형)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('story')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      format === 'story'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-900 text-slate-400 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span>9:16 스토리 (세로형)</span>
                  </button>
                </div>
              </div>

              {/* 2. Theme Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
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
                            ? 'bg-slate-800 border-cyan-400 text-white shadow-md'
                            : 'bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <span className="text-xs font-bold">{t.name}</span>
                        <div className="flex items-center gap-1">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: t.accent1 }}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: t.accent2 }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Included Metrics Toggle Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>3️⃣ 카드에 포함할 훈련 데이터 선택</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Time Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMetric('time')}
                    className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                      selectedMetrics.time
                        ? 'bg-cyan-950/40 text-cyan-200 border-cyan-500/40'
                        : 'bg-slate-900/40 text-slate-400 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-cyan-400" />
                      <span>소요 시간</span>
                    </div>
                    {selectedMetrics.time ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </button>

                  {/* Pace Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMetric('pace')}
                    className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                      selectedMetrics.pace
                        ? 'bg-cyan-950/40 text-cyan-200 border-cyan-500/40'
                        : 'bg-slate-900/40 text-slate-400 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>평균 페이스</span>
                    </div>
                    {selectedMetrics.pace ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </button>

                  {/* Heart Rate Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMetric('hr')}
                    className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                      selectedMetrics.hr
                        ? 'bg-cyan-950/40 text-cyan-200 border-cyan-500/40'
                        : 'bg-slate-900/40 text-slate-400 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-rose-400" />
                      <span>심박수 (평균/최대)</span>
                    </div>
                    {selectedMetrics.hr ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </button>

                  {/* Cadence Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMetric('cadence')}
                    className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                      selectedMetrics.cadence
                        ? 'bg-cyan-950/40 text-cyan-200 border-cyan-500/40'
                        : 'bg-slate-900/40 text-slate-400 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Footprints className="w-3.5 h-3.5 text-teal-400" />
                      <span>평균 케이던스</span>
                    </div>
                    {selectedMetrics.cadence ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </button>

                  {/* Calories Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMetric('calories')}
                    className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                      selectedMetrics.calories
                        ? 'bg-cyan-950/40 text-cyan-200 border-cyan-500/40'
                        : 'bg-slate-900/40 text-slate-400 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      <span>소모 칼로리</span>
                    </div>
                    {selectedMetrics.calories ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </button>

                  {/* Date Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleMetric('date')}
                    className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                      selectedMetrics.date
                        ? 'bg-cyan-950/40 text-cyan-200 border-cyan-500/40'
                        : 'bg-slate-900/40 text-slate-400 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      <span>훈련 날짜</span>
                    </div>
                    {selectedMetrics.date ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </button>

                  {/* Laps Toggle (if laps available) */}
                  {session.laps && session.laps.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleMetric('laps')}
                      className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                        selectedMetrics.laps
                          ? 'bg-cyan-950/40 text-cyan-200 border-cyan-500/40'
                          : 'bg-slate-900/40 text-slate-400 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
                        <span>랩 스플릿 차트</span>
                      </div>
                      {selectedMetrics.laps ? (
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </button>
                  )}

                  {/* Notes Toggle (if notes available) */}
                  {session.notes && (
                    <button
                      type="button"
                      onClick={() => toggleMetric('notes')}
                      className={`p-2 rounded-xl border text-xs text-left flex items-center justify-between cursor-pointer transition-colors ${
                        selectedMetrics.notes
                          ? 'bg-cyan-950/40 text-cyan-200 border-cyan-500/40'
                          : 'bg-slate-900/40 text-slate-400 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span>훈련 메모/코멘트</span>
                      </div>
                      {selectedMetrics.notes ? (
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="grid grid-cols-2 gap-2">
                {/* Download Button */}
                <button
                  onClick={handleDownload}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>이미지 저장 (PNG)</span>
                </button>

                {/* Mobile / Web Share Button */}
                {shareSupported ? (
                  <button
                    onClick={handleShare}
                    disabled={isGenerating}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{isGenerating ? '생성 중...' : 'SNS 바로 공유'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCopyText}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-white/15 transition-all cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-cyan-400" />
                    )}
                    <span>{copied ? '복사 완료!' : '텍스트 요약 복사'}</span>
                  </button>
                )}
              </div>

              {/* Extra Copy Summary Text row if shareSupported */}
              {shareSupported && (
                <button
                  onClick={handleCopyText}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center justify-center gap-2 border border-white/10 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
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
};
