import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Heart,
  TrendingDown,
  TrendingUp,
  Activity,
  Zap,
  ShieldCheck,
  Flame,
  Info,
  Calendar,
  Sparkles,
  Timer,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { TrainingSession } from '../types';
import { calculateHeartRateZones, formatPace, parseTimeToSeconds } from '../lib/vdot';

interface HeartRateTrendAnalyticsProps {
  sessions: TrainingSession[];
  maxHr?: number;
  thresholdHr?: number;
  isNested?: boolean;
}

export type HeartRateTimeRange = '4w' | '8w' | '16w' | '1y';

interface PaceBracketHrData {
  bracketKey: 'easy' | 'moderate' | 'tempo';
  label: string;
  sublabel: string;
  color: string;
  avgHr: number;
  avgPaceSec: number;
  distanceKm: number;
  sessionCount: number;
}

interface WeeklyHrDataPoint {
  weekKey: string;
  shortLabel: string;
  fullDateRange: string;
  mondayDate: Date;
  sundayDate: Date;
  overallAvgHr: number;
  overallAvgPaceSec: number;
  overallAvgPaceFormatted: string;
  totalDistanceKm: number;
  sessionCount: number;
  ef: number; // Efficiency Factor = speed(m/min) / hr
  easyBracket: PaceBracketHrData | null;
  moderateBracket: PaceBracketHrData | null;
  tempoBracket: PaceBracketHrData | null;
}

interface SessionScatterPoint {
  id: string;
  title: string;
  date: string;
  distanceKm: number;
  avgPaceSec: number;
  avgPaceStr: string;
  avgHr: number;
  maxHr: number;
  ef: number;
  zone: number;
  zoneColor: string;
}

export const HeartRateTrendAnalytics: React.FC<HeartRateTrendAnalyticsProps> = ({
  sessions,
  maxHr = 190,
  thresholdHr = 172,
  isNested = false,
}) => {
  const [timeRange, setTimeRange] = useState<HeartRateTimeRange>('4w');
  const [activeTabSubView, setActiveTabSubView] = useState<'trends' | 'scatter'>('trends');
  const [hoveredWeek, setHoveredWeek] = useState<WeeklyHrDataPoint | null>(null);
  const [hoveredScatter, setHoveredScatter] = useState<SessionScatterPoint | null>(null);

  // SVG Chart Refs
  const trendChartRef = useRef<SVGSVGElement | null>(null);
  const scatterChartRef = useRef<SVGSVGElement | null>(null);

  // Parse timeRange to number of calendar weeks
  const rangeWeeksCount = useMemo(() => {
    switch (timeRange) {
      case '4w':
        return 4;
      case '8w':
        return 8;
      case '16w':
        return 16;
      case '1y':
        return 52;
      default:
        return 4;
    }
  }, [timeRange]);

  // Helper: Convert pace string to seconds (e.g. 5'15" -> 315)
  const paceToSec = (paceStr?: string): number => {
    if (!paceStr) return 0;
    const clean = paceStr.trim();
    if (clean.includes(':')) {
      return parseTimeToSeconds(clean);
    }
    const parts = clean.split("'");
    const min = parseInt(parts[0], 10) || 0;
    const sec = parseInt(parts[1]?.replace('"', '') || '0', 10) || 0;
    return min * 60 + sec;
  };

  // 1. Group sessions by Monday-Sunday calendar weeks
  const allWeeklyHrData = useMemo(() => {
    if (!sessions || sessions.length === 0) return [];

    const weekMap: Record<
      string,
      {
        weekKey: string;
        mondayDate: Date;
        sundayDate: Date;
        sessions: TrainingSession[];
      }
    > = {};

    sessions.forEach((s) => {
      const d = new Date(s.date);
      if (isNaN(d.getTime())) return;

      const day = d.getDay();
      const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const y = monday.getFullYear();
      const m = String(monday.getMonth() + 1).padStart(2, '0');
      const dt = String(monday.getDate()).padStart(2, '0');
      const weekKey = `${y}-${m}-${dt}`;

      if (!weekMap[weekKey]) {
        weekMap[weekKey] = {
          weekKey,
          mondayDate: monday,
          sundayDate: sunday,
          sessions: [],
        };
      }
      weekMap[weekKey].sessions.push(s);
    });

    const sortedWeeks = Object.values(weekMap).sort(
      (a, b) => a.mondayDate.getTime() - b.mondayDate.getTime()
    );

    const result: WeeklyHrDataPoint[] = sortedWeeks.map((w) => {
      const validHrSessions = w.sessions.filter((s) => s.avgHr && s.avgHr > 0);
      const totalDistanceKm =
        Math.round(w.sessions.reduce((acc, s) => acc + s.totalDistanceKm, 0) * 10) / 10;

      let totalHrDist = 0;
      let totalPaceDist = 0;
      let hrDistCount = 0;
      let paceDistCount = 0;

      // Pace brackets:
      // Easy (>= 5'30"/km = 330s)
      // Moderate (4'45" ~ 5'29"/km = 285s ~ 329s)
      // Tempo/Speed (< 4'45"/km = < 285s)
      let easyHrDist = 0,
        easyPaceDist = 0,
        easyDist = 0,
        easyCount = 0;
      let modHrDist = 0,
        modPaceDist = 0,
        modDist = 0,
        modCount = 0;
      let tempoHrDist = 0,
        tempoPaceDist = 0,
        tempoDist = 0,
        tempoCount = 0;

      w.sessions.forEach((s) => {
        const pSec = paceToSec(s.avgPace);
        const dist = s.totalDistanceKm || 1;
        const hr = s.avgHr || 0;

        if (pSec > 0) {
          totalPaceDist += pSec * dist;
          paceDistCount += dist;
        }

        if (hr > 0) {
          totalHrDist += hr * dist;
          hrDistCount += dist;

          if (pSec >= 330) {
            easyHrDist += hr * dist;
            easyPaceDist += pSec * dist;
            easyDist += dist;
            easyCount += 1;
          } else if (pSec >= 285) {
            modHrDist += hr * dist;
            modPaceDist += pSec * dist;
            modDist += dist;
            modCount += 1;
          } else if (pSec > 0) {
            tempoHrDist += hr * dist;
            tempoPaceDist += pSec * dist;
            tempoDist += dist;
            tempoCount += 1;
          }
        }
      });

      const overallAvgHr = hrDistCount > 0 ? Math.round(totalHrDist / hrDistCount) : 0;
      const overallAvgPaceSec =
        paceDistCount > 0 ? Math.round(totalPaceDist / paceDistCount) : 330;
      const speedMperMin = overallAvgPaceSec > 0 ? 60000 / overallAvgPaceSec : 0;
      const ef =
        overallAvgHr > 0 && speedMperMin > 0
          ? Math.round((speedMperMin / overallAvgHr) * 100) / 100
          : 0;

      const easyBracket: PaceBracketHrData | null =
        easyDist > 0 && easyHrDist > 0
          ? {
              bracketKey: 'easy',
              label: '이지 조깅',
              sublabel: '≥ 5\'30"/km',
              color: '#059669', // Emerald
              avgHr: Math.round(easyHrDist / easyDist),
              avgPaceSec: Math.round(easyPaceDist / easyDist),
              distanceKm: Math.round(easyDist * 10) / 10,
              sessionCount: easyCount,
            }
          : null;

      const moderateBracket: PaceBracketHrData | null =
        modDist > 0 && modHrDist > 0
          ? {
              bracketKey: 'moderate',
              label: '모더레이트/M-페이스',
              sublabel: '4\'45" ~ 5\'29"/km',
              color: '#d97706', // Amber
              avgHr: Math.round(modHrDist / modDist),
              avgPaceSec: Math.round(modPaceDist / modDist),
              distanceKm: Math.round(modDist * 10) / 10,
              sessionCount: modCount,
            }
          : null;

      const tempoBracket: PaceBracketHrData | null =
        tempoDist > 0 && tempoHrDist > 0
          ? {
              bracketKey: 'tempo',
              label: '역치/스피드',
              sublabel: '< 4\'45"/km',
              color: '#9f1239', // Rose Burgundy
              avgHr: Math.round(tempoHrDist / tempoDist),
              avgPaceSec: Math.round(tempoPaceDist / tempoDist),
              distanceKm: Math.round(tempoDist * 10) / 10,
              sessionCount: tempoCount,
            }
          : null;

      const monM = String(w.mondayDate.getMonth() + 1).padStart(2, '0');
      const monD = String(w.mondayDate.getDate()).padStart(2, '0');
      const sunM = String(w.sundayDate.getMonth() + 1).padStart(2, '0');
      const sunD = String(w.sundayDate.getDate()).padStart(2, '0');

      return {
        weekKey: w.weekKey,
        shortLabel: `${monM}.${monD}`,
        fullDateRange: `${monM}.${monD} ~ ${sunM}.${sunD}`,
        mondayDate: w.mondayDate,
        sundayDate: w.sundayDate,
        overallAvgHr,
        overallAvgPaceSec,
        overallAvgPaceFormatted: formatPace(overallAvgPaceSec),
        totalDistanceKm,
        sessionCount: validHrSessions.length,
        ef,
        easyBracket,
        moderateBracket,
        tempoBracket,
      };
    });

    return result;
  }, [sessions]);

  // Filter based on selected time range (4w, 8w, 16w, 1y)
  const displayedWeeks = useMemo(() => {
    if (allWeeklyHrData.length === 0) return [];
    return allWeeklyHrData.slice(-rangeWeeksCount);
  }, [allWeeklyHrData, rangeWeeksCount]);

  // Scatter points: All individual sessions in the active range
  const scatterPoints = useMemo<SessionScatterPoint[]>(() => {
    if (!sessions || sessions.length === 0) return [];

    const hrZones = calculateHeartRateZones(maxHr, thresholdHr);
    const activeWeekKeys = new Set(displayedWeeks.map((w) => w.weekKey));

    const points: SessionScatterPoint[] = [];

    sessions.forEach((s) => {
      const d = new Date(s.date);
      if (isNaN(d.getTime())) return;

      const day = d.getDay();
      const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diffToMonday);
      const y = monday.getFullYear();
      const m = String(monday.getMonth() + 1).padStart(2, '0');
      const dt = String(monday.getDate()).padStart(2, '0');
      const weekKey = `${y}-${m}-${dt}`;

      if (!activeWeekKeys.has(weekKey)) return;

      const pSec = paceToSec(s.avgPace);
      const hr = s.avgHr;
      if (pSec < 150 || pSec > 600 || !hr || hr < 80 || hr > 220) return;

      // Find zone
      let zone = 2;
      let zoneColor = '#059669';
      for (const z of hrZones) {
        if (hr >= z.minHr && hr <= z.maxHr) {
          zone = z.zone;
          zoneColor = z.color;
          break;
        }
      }

      const speedMperMin = 60000 / pSec;
      const ef = Math.round((speedMperMin / hr) * 100) / 100;

      points.push({
        id: s.id,
        title: s.title,
        date: s.date,
        distanceKm: s.totalDistanceKm,
        avgPaceSec: pSec,
        avgPaceStr: s.avgPace,
        avgHr: hr,
        maxHr: s.maxHr || hr,
        ef,
        zone,
        zoneColor,
      });
    });

    return points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sessions, displayedWeeks, maxHr, thresholdHr]);

  // 2. High-level Summary KPI Metrics
  const summaryMetrics = useMemo(() => {
    if (displayedWeeks.length === 0) {
      return {
        avgEf: 1.35,
        efTrendPct: 0,
        easyAvgHr: 138,
        easyTrendDiff: 0,
        tempoAvgHr: 168,
        tempoMargin: 4,
        cardiacStability: '양호',
        totalHrSessions: 0,
      };
    }

    const weeksWithHr = displayedWeeks.filter((w) => w.overallAvgHr > 0 && w.ef > 0);
    const totalHrSessions = displayedWeeks.reduce((acc, w) => acc + w.sessionCount, 0);

    const avgEf =
      weeksWithHr.length > 0
        ? Math.round(
            (weeksWithHr.reduce((acc, w) => acc + w.ef, 0) / weeksWithHr.length) * 100
          ) / 100
        : 1.35;

    // EF Trend (compare first half to second half)
    let efTrendPct = 0;
    if (weeksWithHr.length >= 2) {
      const half = Math.floor(weeksWithHr.length / 2);
      const firstHalf = weeksWithHr.slice(0, half);
      const secondHalf = weeksWithHr.slice(half);

      const firstAvg =
        firstHalf.reduce((acc, w) => acc + w.ef, 0) / (firstHalf.length || 1);
      const secondAvg =
        secondHalf.reduce((acc, w) => acc + w.ef, 0) / (secondHalf.length || 1);

      if (firstAvg > 0) {
        efTrendPct = Math.round(((secondAvg - firstAvg) / firstAvg) * 1000) / 10;
      }
    }

    // Easy bracket stats
    const easyWeeks = displayedWeeks.filter((w) => w.easyBracket !== null);
    const easyAvgHr =
      easyWeeks.length > 0
        ? Math.round(
            easyWeeks.reduce((acc, w) => acc + w.easyBracket!.avgHr, 0) / easyWeeks.length
          )
        : 138;

    let easyTrendDiff = 0;
    if (easyWeeks.length >= 2) {
      const half = Math.floor(easyWeeks.length / 2);
      const firstHalf = easyWeeks.slice(0, half);
      const secondHalf = easyWeeks.slice(half);
      const fAvg = firstHalf.reduce((acc, w) => acc + w.easyBracket!.avgHr, 0) / firstHalf.length;
      const sAvg = secondHalf.reduce((acc, w) => acc + w.easyBracket!.avgHr, 0) / secondHalf.length;
      easyTrendDiff = Math.round((sAvg - fAvg) * 10) / 10; // negative is improvement!
    }

    // Tempo bracket stats
    const tempoWeeks = displayedWeeks.filter((w) => w.tempoBracket !== null);
    const tempoAvgHr =
      tempoWeeks.length > 0
        ? Math.round(
            tempoWeeks.reduce((acc, w) => acc + w.tempoBracket!.avgHr, 0) / tempoWeeks.length
          )
        : thresholdHr - 3;
    const tempoMargin = thresholdHr - tempoAvgHr;

    // Cardiac Stability Assessment
    let cardiacStability: '최상 (안정)' | '우수' | '적응기' | '피로 주의' = '우수';
    if (efTrendPct > 2.5 && easyTrendDiff <= 0) {
      cardiacStability = '최상 (안정)';
    } else if (efTrendPct >= 0) {
      cardiacStability = '우수';
    } else if (efTrendPct > -3.0) {
      cardiacStability = '적응기';
    } else {
      cardiacStability = '피로 주의';
    }

    return {
      avgEf,
      efTrendPct,
      easyAvgHr,
      easyTrendDiff,
      tempoAvgHr,
      tempoMargin,
      cardiacStability,
      totalHrSessions,
    };
  }, [displayedWeeks, thresholdHr]);

  // --------------------------------------------------------------------------
  // D3 Chart 1: Multi-line Weekly Pace-HR Flow
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (activeTabSubView !== 'trends' || !trendChartRef.current) return;

    const svgEl = trendChartRef.current;
    d3.select(svgEl).selectAll('*').remove();

    if (displayedWeeks.length === 0) return;

    const width = 840;
    const height = 300;
    const margin = { top: 25, right: 35, bottom: 40, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(svgEl)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%');

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale: Weeks
    const xScale = d3
      .scaleBand()
      .domain(displayedWeeks.map((w) => w.weekKey))
      .range([0, innerWidth])
      .padding(0.25);

    // Y Scale: Heart Rate (bpm)
    const allHrValues: number[] = [];
    displayedWeeks.forEach((w) => {
      if (w.easyBracket) allHrValues.push(w.easyBracket.avgHr);
      if (w.moderateBracket) allHrValues.push(w.moderateBracket.avgHr);
      if (w.tempoBracket) allHrValues.push(w.tempoBracket.avgHr);
      if (w.overallAvgHr > 0) allHrValues.push(w.overallAvgHr);
    });

    const minHr = allHrValues.length > 0 ? Math.max(90, Math.min(...allHrValues) - 10) : 120;
    const maxHrCalc = allHrValues.length > 0 ? Math.min(210, Math.max(...allHrValues) + 10) : 185;

    const yScale = d3
      .scaleLinear()
      .domain([minHr, maxHrCalc])
      .nice()
      .range([innerHeight, 0]);

    // Horizontal Grid Lines
    const yTicks = yScale.ticks(5);
    g.selectAll('.grid-line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#e7e5e4')
      .attr('stroke-dasharray', '3 3')
      .attr('opacity', 0.6);

    // Threshold HR Reference Line
    if (thresholdHr >= minHr && thresholdHr <= maxHrCalc) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(thresholdHr))
        .attr('y2', yScale(thresholdHr))
        .attr('stroke', '#f43f5e')
        .attr('stroke-dasharray', '4 4')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.7);

      g.append('text')
        .attr('x', innerWidth - 5)
        .attr('y', yScale(thresholdHr) - 6)
        .attr('text-anchor', 'end')
        .attr('fill', '#f43f5e')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .text(`역치 심박수 (LTHR ${thresholdHr} bpm)`);
    }

    // Helper to draw a line + dots for a bracket
    const drawBracketLine = (
      bracketKey: 'easy' | 'moderate' | 'tempo',
      color: string,
      strokeWidth: number
    ) => {
      const validPoints = displayedWeeks
        .map((w) => {
          const b =
            bracketKey === 'easy'
              ? w.easyBracket
              : bracketKey === 'moderate'
              ? w.moderateBracket
              : w.tempoBracket;
          if (!b) return null;
          return {
            weekKey: w.weekKey,
            x: (xScale(w.weekKey) || 0) + xScale.bandwidth() / 2,
            y: yScale(b.avgHr),
            hr: b.avgHr,
            bracket: b,
            week: w,
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);

      if (validPoints.length < 1) return;

      if (validPoints.length >= 2) {
        const lineGen = d3
          .line<{ x: number; y: number }>()
          .x((d) => d.x)
          .y((d) => d.y)
          .curve(d3.curveMonotoneX);

        g.append('path')
          .datum(validPoints)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', strokeWidth)
          .attr('stroke-linecap', 'round')
          .attr('d', lineGen);
      }

      // Dots
      g.selectAll(`.dot-${bracketKey}`)
        .data(validPoints)
        .enter()
        .append('circle')
        .attr('class', `dot-${bracketKey}`)
        .attr('cx', (d) => d.x)
        .attr('cy', (d) => d.y)
        .attr('r', 4.5)
        .attr('fill', color)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseenter', (_, d) => {
          setHoveredWeek(d.week);
        });
    };

    // Draw in order: Easy (Green), Moderate (Amber), Tempo (Rose)
    drawBracketLine('easy', '#059669', 2.8);
    drawBracketLine('moderate', '#d97706', 2.5);
    drawBracketLine('tempo', '#9f1239', 2.8);

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .tickFormat((d) => {
        const item = displayedWeeks.find((w) => w.weekKey === d);
        return item ? item.shortLabel : '';
      });

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.select('.domain').attr('stroke', '#e7e5e4');
    xAxisG.selectAll('.tick line').attr('stroke', '#e7e5e4');
    xAxisG
      .selectAll('.tick text')
      .attr('fill', '#78716c')
      .attr('font-size', '11px')
      .attr('dy', '1em');

    // Y Axis (bpm)
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d} bpm`);
    const yAxisG = g.append('g').call(yAxis);
    yAxisG.select('.domain').remove();
    yAxisG.selectAll('.tick line').remove();
    yAxisG.selectAll('.tick text').attr('fill', '#78716c').attr('font-size', '11px');

  }, [displayedWeeks, activeTabSubView, thresholdHr]);

  // --------------------------------------------------------------------------
  // D3 Chart 2: Scatter Plot (Pace vs. HR) with Cardiac Efficiency Line
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (activeTabSubView !== 'scatter' || !scatterChartRef.current) return;

    const svgEl = scatterChartRef.current;
    d3.select(svgEl).selectAll('*').remove();

    if (scatterPoints.length === 0) return;

    const width = 840;
    const height = 300;
    const margin = { top: 25, right: 35, bottom: 45, left: 55 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(svgEl)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%');

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale: Pace (seconds) - reverse so faster pace (lower sec) is on the right
    const paceExtent = d3.extent(scatterPoints, (d) => d.avgPaceSec) as [number, number];
    const xMin = Math.max(180, (paceExtent[0] || 240) - 15);
    const xMax = Math.min(480, (paceExtent[1] || 420) + 15);

    const xScale = d3.scaleLinear().domain([xMax, xMin]).range([0, innerWidth]);

    // Y Scale: Heart Rate (bpm)
    const hrExtent = d3.extent(scatterPoints, (d) => d.avgHr) as [number, number];
    const yMin = Math.max(100, (hrExtent[0] || 130) - 8);
    const yMax = Math.min(210, (hrExtent[1] || 185) + 8);

    const yScale = d3.scaleLinear().domain([yMin, yMax]).nice().range([innerHeight, 0]);

    // Grid lines
    g.selectAll('.grid-line')
      .data(yScale.ticks(5))
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#e7e5e4')
      .attr('stroke-dasharray', '3 3')
      .attr('opacity', 0.6);

    // Linear Regression Line (Least squares)
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0;
    const n = scatterPoints.length;
    scatterPoints.forEach((p) => {
      sumX += p.avgPaceSec;
      sumY += p.avgHr;
      sumXY += p.avgPaceSec * p.avgHr;
      sumXX += p.avgPaceSec * p.avgPaceSec;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
    const intercept = (sumY - slope * sumX) / (n || 1);

    const regX1 = xMax;
    const regY1 = slope * regX1 + intercept;
    const regX2 = xMin;
    const regY2 = slope * regX2 + intercept;

    if (n >= 3) {
      g.append('line')
        .attr('x1', xScale(regX1))
        .attr('y1', yScale(regY1))
        .attr('x2', xScale(regX2))
        .attr('y2', yScale(regY2))
        .attr('stroke', '#881337')
        .attr('stroke-width', 2.5)
        .attr('stroke-dasharray', '5 4')
        .attr('opacity', 0.75);

      g.append('text')
        .attr('x', xScale(regX2) - 10)
        .attr('y', yScale(regY2) - 8)
        .attr('text-anchor', 'end')
        .attr('fill', '#881337')
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .text('유산소 심폐 효율 회귀선 (Cardiac Efficiency Trend)');
    }

    // Scatter Bubbles
    g.selectAll('.scatter-dot')
      .data(scatterPoints)
      .enter()
      .append('circle')
      .attr('class', 'scatter-dot')
      .attr('cx', (d) => xScale(d.avgPaceSec))
      .attr('cy', (d) => yScale(d.avgHr))
      .attr('r', (d) => Math.max(4, Math.min(10, Math.sqrt(d.distanceKm) * 2.3)))
      .attr('fill', (d) => d.zoneColor)
      .attr('opacity', 0.8)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseenter', (_, d) => setHoveredScatter(d));

    // X Axis (Pace)
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(6)
      .tickFormat((d) => formatPace(Number(d)));

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.select('.domain').attr('stroke', '#e7e5e4');
    xAxisG.selectAll('.tick line').attr('stroke', '#e7e5e4');
    xAxisG
      .selectAll('.tick text')
      .attr('fill', '#78716c')
      .attr('font-size', '11px')
      .attr('dy', '1em');

    // X Axis Label
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 35)
      .attr('text-anchor', 'middle')
      .attr('fill', '#78716c')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text('평균 페이스 (min/km, 오른쪽으로 갈수록 고속)');

    // Y Axis (Heart Rate bpm)
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d}`);
    const yAxisG = g.append('g').call(yAxis);
    yAxisG.select('.domain').remove();
    yAxisG.selectAll('.tick line').remove();
    yAxisG.selectAll('.tick text').attr('fill', '#78716c').attr('font-size', '11px');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#78716c')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text('평균 심박수 (bpm)');

  }, [scatterPoints, activeTabSubView]);

  return (
    <div className={isNested ? 'w-full text-stone-800 dark:text-stone-100 space-y-6' : 'glass-panel rounded-2xl p-4 sm:p-6 border border-emerald-600/20 dark:border-stone-800 shadow-sm bg-white/95 dark:bg-stone-900/95 text-stone-800 dark:text-stone-100 space-y-6'}>
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-800 to-rose-950 text-white shadow-xs border border-rose-700/50">
              <Heart className="w-5 h-5 text-rose-300 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>페이스별 심박 흐름 & 유산소 효율 분석</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold font-athletic">
                  Cardiac Efficiency
                </span>
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                기록된 훈련 데이터를 바탕으로 페이스 구간별 심박수 추이와 유산소 엔진 효율(EF 지수)을 분석합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Time range selector (4주 / 8주 / 16주 / 1년) */}
        <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700 self-start sm:self-auto shadow-2xs">
          {(['4w', '8w', '16w', '1y'] as const).map((r) => {
            const labelMap: Record<HeartRateTimeRange, string> = {
              '4w': '4주',
              '8w': '8주',
              '16w': '16주',
              '1y': '1년',
            };
            const isSel = timeRange === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  isSel
                    ? 'bg-gradient-to-r from-rose-800 to-rose-950 text-white font-bold shadow-xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {labelMap[r]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: EF Index */}
        <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-1 shadow-2xs">
          <div className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 flex items-center justify-between">
            <span>유산소 효율 (EF 지수)</span>
            <Activity className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-900 dark:text-rose-300 font-athletic flex items-baseline gap-1.5">
            <span>{summaryMetrics.avgEf.toFixed(2)}</span>
            <span className="text-[11px] font-normal text-stone-500 dark:text-stone-400">m/min/bpm</span>
          </div>
          <div className="text-[10px] text-stone-500 dark:text-stone-400 font-medium flex items-center gap-1">
            {summaryMetrics.efTrendPct > 0 ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center">
                <ArrowUpRight className="w-3 h-3" />+{summaryMetrics.efTrendPct}% 향상
              </span>
            ) : summaryMetrics.efTrendPct < 0 ? (
              <span className="text-rose-700 dark:text-rose-400 font-bold flex items-center">
                <ArrowDownRight className="w-3 h-3" />{summaryMetrics.efTrendPct}%
              </span>
            ) : (
              <span className="text-stone-500 dark:text-stone-400 flex items-center">
                <Minus className="w-3 h-3" />안정 유지
              </span>
            )}
            <span>(전반기 대비)</span>
          </div>
        </div>

        {/* Card 2: Easy Pace Average HR */}
        <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-1 shadow-2xs">
          <div className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 flex items-center justify-between">
            <span>이지 조깅 (Z1~Z2) 심박</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-300 font-athletic flex items-baseline gap-1.5">
            <span>{summaryMetrics.easyAvgHr}</span>
            <span className="text-xs font-normal text-stone-500 dark:text-stone-400">bpm</span>
          </div>
          <div className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">
            {summaryMetrics.easyTrendDiff < 0 ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                {summaryMetrics.easyTrendDiff} bpm (동일 페이스 심박 안정화)
              </span>
            ) : summaryMetrics.easyTrendDiff > 0 ? (
              <span className="text-amber-700 dark:text-amber-400 font-bold">
                +{summaryMetrics.easyTrendDiff} bpm (피로 및 기온 영향)
              </span>
            ) : (
              <span>편안한 대화 가능 존2 유지</span>
            )}
          </div>
        </div>

        {/* Card 3: Tempo / Race Pace HR Margin */}
        <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-1 shadow-2xs">
          <div className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 flex items-center justify-between">
            <span>역치/템포 페이스 심박</span>
            <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white font-athletic flex items-baseline gap-1.5">
            <span>{summaryMetrics.tempoAvgHr}</span>
            <span className="text-xs font-normal text-stone-500 dark:text-stone-400">bpm</span>
          </div>
          <div className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">
            LTHR({thresholdHr} bpm) 대비{' '}
            <strong className="text-amber-700 dark:text-amber-400 font-bold">
              {summaryMetrics.tempoMargin > 0 ? `${summaryMetrics.tempoMargin} bpm 여유` : '역치 한계선 도달'}
            </strong>
          </div>
        </div>

        {/* Card 4: Cardiac Status Evaluation */}
        <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-1 shadow-2xs">
          <div className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 flex items-center justify-between">
            <span>심폐 엔진 상태 진단</span>
            <Sparkles className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
            <span>{summaryMetrics.cardiacStability}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-normal">
              {summaryMetrics.totalHrSessions}회 분석
            </span>
          </div>
          <div className="text-[10px] text-stone-500 dark:text-stone-400 font-medium truncate">
            {summaryMetrics.cardiacStability === '최상 (안정)' && '유산소 심폐 지구력 고도화'}
            {summaryMetrics.cardiacStability === '우수' && '안정된 심박-페이스 밸런스'}
            {summaryMetrics.cardiacStability === '적응기' && '증량기 심박 적응 진행 중'}
            {summaryMetrics.cardiacStability === '피로 주의' && '충분한 수면과 수분 보충 권장'}
          </div>
        </div>
      </div>

      {/* Chart View Switcher (주별 추이 vs 페이스 산점도) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTabSubView('trends')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTabSubView === 'trends'
                ? 'bg-rose-900 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-750 border border-stone-200 dark:border-stone-700'
            }`}
          >
            주별 페이스 구간 심박 추이
          </button>
          <button
            type="button"
            onClick={() => setActiveTabSubView('scatter')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTabSubView === 'scatter'
                ? 'bg-rose-900 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-750 border border-stone-200 dark:border-stone-700'
            }`}
          >
            페이스 vs 심박 산점도 & 효율 회귀선
          </button>
        </div>

        {/* Legend */}
        {activeTabSubView === 'trends' ? (
          <div className="flex items-center gap-3 text-[11px] font-medium flex-wrap text-stone-600 dark:text-stone-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span>이지 조깅 (≥5'30")</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>모더레이트/M (4'45"~5'29")</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-800" />
              <span>역치/스피드 (&lt;4'45")</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-[11px] font-medium text-stone-600 dark:text-stone-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>Z2 유산소</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Z3 템포</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-700" />
              <span>Z4~Z5 역치/인터벌</span>
            </span>
          </div>
        )}
      </div>

      {/* Main D3 Chart Canvas Area */}
      <div className="p-3.5 sm:p-5 rounded-2xl bg-stone-50/70 dark:bg-stone-850 border border-stone-200 dark:border-stone-750 relative overflow-hidden shadow-2xs">
        {activeTabSubView === 'trends' ? (
          <div>
            <div className="w-full overflow-x-auto">
              <div className="min-w-[640px] sm:min-w-0">
                <svg ref={trendChartRef} className="w-full h-auto" />
              </div>
            </div>

            {/* Hovered Week Tooltip Card */}
            {hoveredWeek && (
              <div className="mt-3 p-3 rounded-xl bg-white dark:bg-stone-800 border border-rose-200 dark:border-rose-900/60 shadow-xs animate-fadeIn flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-rose-700 dark:text-rose-400" />
                  <strong className="text-stone-900 dark:text-white font-bold">
                    {hoveredWeek.fullDateRange}
                  </strong>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-mono">
                    총 {hoveredWeek.totalDistanceKm}km ({hoveredWeek.sessionCount}회)
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {hoveredWeek.easyBracket && (
                    <span className="text-emerald-800 dark:text-emerald-300 font-medium">
                      이지: <strong>{hoveredWeek.easyBracket.avgHr} bpm</strong> ({formatPace(hoveredWeek.easyBracket.avgPaceSec)})
                    </span>
                  )}
                  {hoveredWeek.moderateBracket && (
                    <span className="text-amber-800 dark:text-amber-300 font-medium">
                      모더레이트: <strong>{hoveredWeek.moderateBracket.avgHr} bpm</strong> ({formatPace(hoveredWeek.moderateBracket.avgPaceSec)})
                    </span>
                  )}
                  {hoveredWeek.tempoBracket && (
                    <span className="text-rose-900 dark:text-rose-300 font-medium">
                      역치/스피드: <strong>{hoveredWeek.tempoBracket.avgHr} bpm</strong> ({formatPace(hoveredWeek.tempoBracket.avgPaceSec)})
                    </span>
                  )}
                  {hoveredWeek.ef > 0 && (
                    <span className="text-stone-600 dark:text-stone-400 font-athletic font-bold">
                      EF: {hoveredWeek.ef.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="w-full overflow-x-auto">
              <div className="min-w-[640px] sm:min-w-0">
                <svg ref={scatterChartRef} className="w-full h-auto" />
              </div>
            </div>

            {/* Hovered Scatter Tooltip Card */}
            {hoveredScatter && (
              <div className="mt-3 p-3 rounded-xl bg-white dark:bg-stone-800 border border-rose-200 dark:border-rose-900/60 shadow-xs animate-fadeIn flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-700 dark:text-rose-400" />
                  <strong className="text-stone-900 dark:text-white font-bold truncate max-w-[200px]">
                    {hoveredScatter.title}
                  </strong>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
                    {hoveredScatter.date}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-bold text-stone-900 dark:text-white">
                    {hoveredScatter.distanceKm}km
                  </span>
                  <span className="text-stone-600 dark:text-stone-300">
                    페이스: <strong className="font-athletic text-rose-900 dark:text-rose-300">{hoveredScatter.avgPaceStr}</strong>
                  </span>
                  <span className="text-stone-600 dark:text-stone-300">
                    평균 심박: <strong className="font-athletic text-emerald-800 dark:text-emerald-400">{hoveredScatter.avgHr} bpm</strong>
                  </span>
                  <span className="text-stone-500 dark:text-stone-400 font-athletic text-[11px]">
                    EF: {hoveredScatter.ef.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Heart Rate Trend Analysis Feedback Report */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-rose-50/80 to-amber-50/40 dark:from-stone-850 dark:to-stone-800 border border-rose-200/80 dark:border-stone-700 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-700 dark:text-rose-400" />
            <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white">
              기록된 훈련 기반 심박 추이 AI 진단 리포트
            </span>
          </div>
          <span className="text-[11px] font-bold text-rose-900 dark:text-rose-300 bg-white/80 dark:bg-stone-750 px-2.5 py-0.5 rounded-lg border border-rose-200 dark:border-stone-700">
            {timeRange === '4w' && '최근 4주 집중 진단'}
            {timeRange === '8w' && '최근 8주 중기 추세'}
            {timeRange === '16w' && '최근 16주 마라톤 주기화'}
            {timeRange === '1y' && '최근 1년 장기 엔진 추이'}
          </span>
        </div>

        <div className="text-xs text-stone-700 dark:text-stone-200 leading-relaxed space-y-1.5">
          <p>
            {summaryMetrics.efTrendPct > 1.5 ? (
              <span>
                • <strong className="text-emerald-800 dark:text-emerald-300">유산소 엔진 효율 상승:</strong> 최근 기간 동일 페이스 대비 심폐 효율(EF)이{' '}
                <strong className="text-emerald-800 dark:text-emerald-300">+{summaryMetrics.efTrendPct}%</strong> 향상되었습니다. 심장 1회 박출량(Stroke Volume) 증가와 말초 모세혈관 밀도가 성공적으로 발달하고 있습니다.
              </span>
            ) : summaryMetrics.efTrendPct < -2.0 ? (
              <span>
                • <strong className="text-amber-800 dark:text-amber-300">심박수 일시 상승 (피로 주의):</strong> 동일 페이스 대비 심박수가 다소 높아지는 경향이 관찰됩니다. 주간 마일리지 급증, 수면 부족 또는 기온 상승으로 인한 심박 드리프트(Cardiac Drift)일 수 있으므로 주 1~2회 편안한 Zone 1 회복주를 권장합니다.
              </span>
            ) : (
              <span>
                • <strong className="text-stone-900 dark:text-white">안정된 유산소 기저 유지:</strong> 페이스별 심박수 편차가 매우 균일하며, 이지 페이스(평균 {summaryMetrics.easyAvgHr} bpm)에서 탄탄한 유산소 기저를 유지하고 있습니다.
              </span>
            )}
          </p>

          <p>
            • <strong className="text-stone-900 dark:text-white">페이스-심박 매칭 진단:</strong>{' '}
            역치/템포 페이스 훈련 시 평균 {summaryMetrics.tempoAvgHr} bpm으로, 젖산 역치 심박수(LTHR {thresholdHr} bpm) 대비{' '}
            {summaryMetrics.tempoMargin > 0 ? (
              <span className="text-emerald-800 dark:text-emerald-300 font-bold">
                약 {summaryMetrics.tempoMargin} bpm의 안전 마진을 확보하여 오버트레이닝 없이 질주력을 발휘 중입니다.
              </span>
            ) : (
              <span className="text-rose-800 dark:text-rose-300 font-bold">
                역치 심박 한계선에 근접하여 피로 축적에 유의하며 인터벌 세트 간 불완전 회복 시간을 철저히 준수해야 합니다.
              </span>
            )}
          </p>

          <p>
            • <strong className="text-stone-900 dark:text-white">다음 단계 권장 훈련:</strong>{' '}
            {summaryMetrics.cardiacStability === '최상 (안정)' || summaryMetrics.cardiacStability === '우수'
              ? '주말 장거리 LSD는 현재의 안정된 Zone 2 심박을 그대로 정속 유지하고, 주중 1회 젖산 역치(T-Pace) 템포런 비중을 15% 수준으로 유지하여 스피드 지속력을 극대화하세요.'
              : '심박 안정화를 위해 고강도 세션 사이에 40분 이내 가벼운 회복 조깅(Zone 1~2)을 적극 배치하여 누적 피로를 해소하세요.'}
          </p>
        </div>
      </div>
    </div>
  );
};
