import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  TrendingUp,
  Activity,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Award,
  ChevronRight,
  Flame,
  Calendar,
  BarChart3,
  PieChart as PieIcon,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { TrainingSession } from '../types';
import { calculateHeartRateZones, HeartRateZone } from '../lib/vdot';

interface TrainingAnalyticsDashboardProps {
  sessions: TrainingSession[];
  maxHr?: number;
  thresholdHr?: number;
  onLoadDemo?: () => void;
}

interface WeeklyDataPoint {
  weekKey: string;
  weekLabel: string;
  shortLabel: string;
  mondayDate: Date;
  sundayDate: Date;
  totalDistance: number;
  sessionCount: number;
  avgPaceSeconds: number;
  avgPaceFormatted: string;
  avgHr: number;
  movingAverage: number;
  wowGrowthPct: number | null; // Week over week growth percentage
}

interface IntensityZoneData {
  zone: number;
  name: string;
  nameKo: string;
  color: string;
  distanceKm: number;
  percentage: number;
  sessionCount: number;
  purpose: string;
}

export const TrainingAnalyticsDashboard: React.FC<TrainingAnalyticsDashboardProps> = ({
  sessions,
  maxHr = 190,
  thresholdHr = 172,
  onLoadDemo,
}) => {
  const [timeRange, setTimeRange] = useState<'8w' | '12w' | 'all'>('8w');
  const [hoveredWeek, setHoveredWeek] = useState<WeeklyDataPoint | null>(null);
  const [hoveredZone, setHoveredZone] = useState<IntensityZoneData | null>(null);

  // SVG Refs
  const mileageChartRef = useRef<SVGSVGElement | null>(null);
  const intensityChartRef = useRef<SVGSVGElement | null>(null);

  // 1. Group sessions by Monday-Sunday calendar weeks
  const allWeeklyData = useMemo(() => {
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

    // Sort weeks chronologically (oldest to newest)
    const sortedWeeks = Object.values(weekMap).sort(
      (a, b) => a.mondayDate.getTime() - b.mondayDate.getTime()
    );

    // Compute metrics and moving average
    const result: WeeklyDataPoint[] = sortedWeeks.map((w, idx) => {
      const totalDistance =
        Math.round(w.sessions.reduce((acc, s) => acc + s.totalDistanceKm, 0) * 10) / 10;
      const sessionCount = w.sessions.length;

      // Calculate weighted avg pace
      let totalPaceSeconds = 0;
      let paceCount = 0;
      let totalHr = 0;
      let hrCount = 0;

      w.sessions.forEach((s) => {
        if (s.avgPace) {
          const parts = s.avgPace.split("'");
          const min = parseInt(parts[0], 10) || 5;
          const sec = parseInt(parts[1]?.replace('"', '') || '0', 10) || 0;
          totalPaceSeconds += (min * 60 + sec) * s.totalDistanceKm;
          paceCount += s.totalDistanceKm;
        }
        if (s.avgHr && s.avgHr > 0) {
          totalHr += s.avgHr * s.totalDistanceKm;
          hrCount += s.totalDistanceKm;
        }
      });

      const avgPaceSec = paceCount > 0 ? Math.round(totalPaceSeconds / paceCount) : 300;
      const paceMin = Math.floor(avgPaceSec / 60);
      const paceRemSec = avgPaceSec % 60;
      const avgPaceFormatted = `${paceMin}'${String(paceRemSec).padStart(2, '0')}"`;
      const avgHr = hrCount > 0 ? Math.round(totalHr / hrCount) : 150;

      // 4-week rolling average
      const windowStart = Math.max(0, idx - 3);
      const windowWeeks = sortedWeeks.slice(windowStart, idx + 1);
      const movingAvg =
        Math.round(
          (windowWeeks.reduce(
            (acc, prev) =>
              acc + prev.sessions.reduce((sAcc, sess) => sAcc + sess.totalDistanceKm, 0),
            0
          ) /
            windowWeeks.length) *
            10
        ) / 10;

      // Week-over-Week growth
      let wowGrowthPct: number | null = null;
      if (idx > 0) {
        const prevDistance = sortedWeeks[idx - 1].sessions.reduce(
          (acc, s) => acc + s.totalDistanceKm,
          0
        );
        if (prevDistance > 0) {
          wowGrowthPct = Math.round(((totalDistance - prevDistance) / prevDistance) * 100);
        }
      }

      const monM = String(w.mondayDate.getMonth() + 1).padStart(2, '0');
      const monD = String(w.mondayDate.getDate()).padStart(2, '0');
      const sunM = String(w.sundayDate.getMonth() + 1).padStart(2, '0');
      const sunD = String(w.sundayDate.getDate()).padStart(2, '0');

      return {
        weekKey: w.weekKey,
        weekLabel: `${monM}.${monD} ~ ${sunM}.${sunD}`,
        shortLabel: `${monM}.${monD}`,
        mondayDate: w.mondayDate,
        sundayDate: w.sundayDate,
        totalDistance,
        sessionCount,
        avgPaceSeconds: avgPaceSec,
        avgPaceFormatted,
        avgHr,
        movingAverage: movingAvg,
        wowGrowthPct,
      };
    });

    return result;
  }, [sessions]);

  // Filter weekly data based on timeRange
  const displayedWeeklyData = useMemo(() => {
    if (allWeeklyData.length === 0) return [];
    if (timeRange === '8w') {
      return allWeeklyData.slice(-8);
    } else if (timeRange === '12w') {
      return allWeeklyData.slice(-12);
    }
    return allWeeklyData;
  }, [allWeeklyData, timeRange]);

  // 2. Training Intensity Distribution Calculation
  const intensityData = useMemo(() => {
    const hrZones: HeartRateZone[] = calculateHeartRateZones(maxHr, thresholdHr);

    // Initialize zones
    const zoneDistMap: Record<number, { distance: number; count: number }> = {
      1: { distance: 0, count: 0 },
      2: { distance: 0, count: 0 },
      3: { distance: 0, count: 0 },
      4: { distance: 0, count: 0 },
      5: { distance: 0, count: 0 },
    };

    // Calculate intensity across sessions in the selected range
    const activeWeeksSet = new Set(displayedWeeklyData.map((w) => w.weekKey));
    const activeSessions = sessions.filter((s) => {
      const d = new Date(s.date);
      const day = d.getDay();
      const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diffToMonday);
      const y = monday.getFullYear();
      const m = String(monday.getMonth() + 1).padStart(2, '0');
      const dt = String(monday.getDate()).padStart(2, '0');
      const weekKey = `${y}-${m}-${dt}`;
      return activeWeeksSet.has(weekKey);
    });

    activeSessions.forEach((s) => {
      // If laps exist with heart rate, distribute by lap
      if (s.laps && s.laps.length > 0) {
        s.laps.forEach((lap) => {
          const hr = lap.avgHr || s.avgHr;
          const lapDist = lap.distanceKm || s.totalDistanceKm / s.laps!.length;

          let matchedZone = 2; // Default Zone 2
          for (const z of hrZones) {
            if (hr >= z.minHr && hr <= z.maxHr) {
              matchedZone = z.zone;
              break;
            }
          }
          if (hr > hrZones[4]?.maxHr) matchedZone = 5;
          if (hr < hrZones[0]?.minHr) matchedZone = 1;

          zoneDistMap[matchedZone].distance += lapDist;
          zoneDistMap[matchedZone].count += 1;
        });
      } else {
        // Fallback to session avgHr
        const hr = s.avgHr;
        let matchedZone = 2;
        for (const z of hrZones) {
          if (hr >= z.minHr && hr <= z.maxHr) {
            matchedZone = z.zone;
            break;
          }
        }
        if (hr > hrZones[4]?.maxHr) matchedZone = 5;
        if (hr < hrZones[0]?.minHr) matchedZone = 1;

        zoneDistMap[matchedZone].distance += s.totalDistanceKm;
        zoneDistMap[matchedZone].count += 1;
      }
    });

    const totalDist = Object.values(zoneDistMap).reduce((acc, z) => acc + z.distance, 0);

    const result: IntensityZoneData[] = hrZones.map((z) => {
      const dist = Math.round(zoneDistMap[z.zone].distance * 10) / 10;
      const pct = totalDist > 0 ? Math.round((dist / totalDist) * 100) : 0;
      return {
        zone: z.zone,
        name: z.name,
        nameKo: z.nameKo,
        color: z.color,
        distanceKm: dist,
        percentage: pct,
        sessionCount: zoneDistMap[z.zone].count,
        purpose: z.purpose,
      };
    });

    return result;
  }, [sessions, maxHr, thresholdHr, displayedWeeklyData]);

  // Polarized 80:20 metric: Zone 1 + Zone 2 = Low, Zone 3 = Medium, Zone 4 + 5 = High
  const polarizedRatio = useMemo(() => {
    const lowDist = (intensityData[0]?.distanceKm || 0) + (intensityData[1]?.distanceKm || 0);
    const medDist = intensityData[2]?.distanceKm || 0;
    const highDist = (intensityData[3]?.distanceKm || 0) + (intensityData[4]?.distanceKm || 0);
    const total = lowDist + medDist + highDist;

    if (total === 0) return { lowPct: 80, medPct: 15, highPct: 5, score: '양호' };

    const lowPct = Math.round((lowDist / total) * 100);
    const medPct = Math.round((medDist / total) * 100);
    const highPct = Math.round((highDist / total) * 100);

    let score = '이상적 (80:20)';
    let badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    let feedback = '유산소 기초(Zone 1-2) 비율이 75% 이상으로 부상 없는 80:20 양극화 훈련을 모범적으로 실천하고 있습니다!';

    if (lowPct < 65) {
      score = '고강도 과다 (부상 위험)';
      badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      feedback = '중고강도 훈련 비중이 높습니다. 회복주 및 천천히 달리는 조깅(Zone 2) 거리를 늘려 부상을 예방하세요.';
    } else if (medPct > 25) {
      score = 'Zone 3(블랙홀) 주의';
      badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      feedback = '어정쩡한 중간 강도(Zone 3) 달리기가 많습니다. 가벼운 날은 더 가볍게, 빠른 날은 확실히 빠르게 달리세요.';
    }

    return { lowPct, medPct, highPct, score, badgeColor, feedback };
  }, [intensityData]);

  // Overall KPI metrics
  const currentWeekDistance = displayedWeeklyData[displayedWeeklyData.length - 1]?.totalDistance || 0;
  const rollingAvgDistance = displayedWeeklyData[displayedWeeklyData.length - 1]?.movingAverage || 0;
  const peakWeeklyDistance = Math.max(0, ...displayedWeeklyData.map((d) => d.totalDistance));

  // --------------------------------------------------------------------------
  // D3 Chart 1: Mileage Trend Line & Bar Chart
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mileageChartRef.current || displayedWeeklyData.length === 0) return;

    const svgEl = mileageChartRef.current;
    d3.select(svgEl).selectAll('*').remove();

    const margin = { top: 25, right: 30, bottom: 45, left: 45 };
    const width = 640;
    const height = 280;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(svgEl)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%');

    // Gradient definitions
    const defs = svg.append('defs');

    // Area Gradient
    const areaGrad = defs
      .append('linearGradient')
      .attr('id', 'mileageAreaGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.45);
    areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.0);

    // Bar Gradient
    const barGrad = defs
      .append('linearGradient')
      .attr('id', 'mileageBarGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    barGrad.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.85);
    barGrad.append('stop').attr('offset', '100%').attr('stop-color', '#0284c7').attr('stop-opacity', 0.35);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3
      .scaleBand()
      .domain(displayedWeeklyData.map((d) => d.weekKey))
      .range([0, innerWidth])
      .padding(0.35);

    const maxDist = Math.max(peakWeeklyDistance * 1.2, 40);
    const yScale = d3.scaleLinear().domain([0, maxDist]).range([innerHeight, 0]).nice();

    // Horizontal Grid lines
    const yAxisTicks = yScale.ticks(5);
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yAxisTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', 'rgba(255, 255, 255, 0.07)')
      .attr('stroke-dasharray', '3,3');

    // Bars: Weekly Mileage
    g.selectAll('.bar')
      .data(displayedWeeklyData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => xScale(d.weekKey) || 0)
      .attr('y', (d) => yScale(d.totalDistance))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => innerHeight - yScale(d.totalDistance))
      .attr('fill', 'url(#mileageBarGradient)')
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('stroke', 'rgba(6, 182, 212, 0.5)')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        setHoveredWeek(d);
        d3.select(event.currentTarget as any).attr('fill', '#38bdf8').attr('stroke', '#ffffff');
      })
      .on('mouseleave', (event) => {
        setHoveredWeek(null);
        d3.select(event.currentTarget as any).attr('fill', 'url(#mileageBarGradient)').attr('stroke', 'rgba(6, 182, 212, 0.5)');
      });

    // Area: 4-week Moving Average Area
    const areaGen = d3
      .area<WeeklyDataPoint>()
      .x((d) => (xScale(d.weekKey) || 0) + xScale.bandwidth() / 2)
      .y0(innerHeight)
      .y1((d) => yScale(d.movingAverage))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(displayedWeeklyData)
      .attr('fill', 'url(#mileageAreaGradient)')
      .attr('d', areaGen);

    // Line: 4-week Moving Average Trend Line
    const lineGen = d3
      .line<WeeklyDataPoint>()
      .x((d) => (xScale(d.weekKey) || 0) + xScale.bandwidth() / 2)
      .y((d) => yScale(d.movingAverage))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(displayedWeeklyData)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2.5)
      .attr('d', lineGen);

    // Dots on trend line
    g.selectAll('.dot')
      .data(displayedWeeklyData)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', (d) => (xScale(d.weekKey) || 0) + xScale.bandwidth() / 2)
      .attr('cy', (d) => yScale(d.movingAverage))
      .attr('r', 3.5)
      .attr('fill', '#10b981')
      .attr('stroke', '#064e3b')
      .attr('stroke-width', 2);

    // X-Axis (Dates)
    const xAxis = d3
      .axisBottom(xScale)
      .tickFormat((d) => {
        const item = displayedWeeklyData.find((w) => w.weekKey === d);
        return item ? item.shortLabel : '';
      });

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.2)');
    xAxisG.selectAll('.tick line').attr('stroke', 'rgba(255, 255, 255, 0.2)');
    xAxisG
      .selectAll('.tick text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '11px')
      .attr('dy', '1em');

    // Y-Axis (Distance km)
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d}k`);
    const yAxisG = g.append('g').call(yAxis);
    yAxisG.select('.domain').remove();
    yAxisG.selectAll('.tick line').remove();
    yAxisG.selectAll('.tick text').attr('fill', '#94a3b8').attr('font-size', '11px');

  }, [displayedWeeklyData, peakWeeklyDistance]);

  // --------------------------------------------------------------------------
  // D3 Chart 2: Training Intensity Donut Chart
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!intensityChartRef.current) return;

    const svgEl = intensityChartRef.current;
    d3.select(svgEl).selectAll('*').remove();

    const width = 280;
    const height = 280;
    const radius = Math.min(width, height) / 2 - 15;
    const innerRadius = radius * 0.65; // Donut thickness

    const svg = d3
      .select(svgEl)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%')
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // Filter out 0 distance zones if all have 0, show default dummy pie
    const validData = intensityData.some((z) => z.distanceKm > 0)
      ? intensityData.filter((z) => z.distanceKm > 0)
      : intensityData;

    const pie = d3
      .pie<IntensityZoneData>()
      .value((d) => (d.distanceKm > 0 ? d.distanceKm : 1))
      .sort(null)
      .padAngle(0.03);

    const arc = d3
      .arc<d3.PieArcDatum<IntensityZoneData>>()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .cornerRadius(5);

    const arcHover = d3
      .arc<d3.PieArcDatum<IntensityZoneData>>()
      .innerRadius(innerRadius - 3)
      .outerRadius(radius + 7)
      .cornerRadius(6);

    const slices = svg
      .selectAll('.slice')
      .data(pie(validData))
      .enter()
      .append('g')
      .attr('class', 'slice');

    slices
      .append('path')
      .attr('d', arc)
      .attr('fill', (d) => d.data.color)
      .attr('stroke', '#090d16')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        setHoveredZone(d.data);
        d3.select(event.currentTarget as any)
          .transition()
          .duration(150)
          .attr('d', arcHover as any)
          .attr('filter', 'brightness(1.15)');
      })
      .on('mouseleave', (event) => {
        setHoveredZone(null);
        d3.select(event.currentTarget as any)
          .transition()
          .duration(150)
          .attr('d', arc as any)
          .attr('filter', 'none');
      });

    // Center Text: Donut Summary
    const centerG = svg.append('g').attr('text-anchor', 'middle');

    if (hoveredZone) {
      centerG
        .append('text')
        .attr('y', -12)
        .attr('fill', hoveredZone.color)
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .text(`Zone ${hoveredZone.zone}`);

      centerG
        .append('text')
        .attr('y', 14)
        .attr('fill', '#ffffff')
        .attr('font-size', '20px')
        .attr('font-weight', '900')
        .text(`${hoveredZone.percentage}%`);

      centerG
        .append('text')
        .attr('y', 32)
        .attr('fill', '#94a3b8')
        .attr('font-size', '11px')
        .text(`${hoveredZone.distanceKm} km`);
    } else {
      centerG
        .append('text')
        .attr('y', -14)
        .attr('fill', '#34d399')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .text('유산소 기초 (Z1+Z2)');

      centerG
        .append('text')
        .attr('y', 14)
        .attr('fill', '#ffffff')
        .attr('font-size', '24px')
        .attr('font-weight', '900')
        .text(`${polarizedRatio.lowPct}%`);

      centerG
        .append('text')
        .attr('y', 34)
        .attr('fill', '#94a3b8')
        .attr('font-size', '11px')
        .text('80:20 최적 타겟');
    }
  }, [intensityData, hoveredZone, polarizedRatio]);

  return (
    <section className="glass-panel rounded-2xl p-4 sm:p-6 border border-white/10 shadow-xl space-y-6">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>주간 마일리지 추세 & 훈련 강도 분석</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  D3.js Data Engine
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                훈련 부하 추세(10% 증량 룰)와 80:20 심박존 양극화 훈련 분포를 체계적으로 분석합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Time range filter buttons */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTimeRange('8w')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              timeRange === '8w'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            최근 8주
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('12w')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              timeRange === '12w'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            최근 12주
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              timeRange === 'all'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            전체 기간
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>이번 주 훈련 거리</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-athletic">
            {currentWeekDistance} <span className="text-xs font-normal text-slate-400">km</span>
          </div>
          <div className="text-[10px] text-slate-400">
            주간 계획 대비 진행 현황
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>4주 이동 평균 마일리지</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-300 font-athletic">
            {rollingAvgDistance} <span className="text-xs font-normal text-slate-400">km/주</span>
          </div>
          <div className="text-[10px] text-slate-400">
            만성 훈련 부하(Chronic Load)
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>주간 최고 마일리지 (Peak)</span>
            <Award className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-300 font-athletic">
            {peakWeeklyDistance} <span className="text-xs font-normal text-slate-400">km</span>
          </div>
          <div className="text-[10px] text-slate-400">
            기간 내 달성한 주간 최고 기록
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>80:20 양극화 훈련 비율</span>
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-300 font-athletic">
            {polarizedRatio.lowPct}% <span className="text-xs font-normal text-slate-400">유산소</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate" title={polarizedRatio.score}>
            상태: <strong className="text-slate-200">{polarizedRatio.score}</strong>
          </div>
        </div>
      </div>

      {/* Main Charts Grid: Left Mileage Trend, Right Intensity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Chart: Weekly Mileage Trend (8 cols) */}
        <div className="lg:col-span-7 bg-slate-950/60 rounded-xl p-4 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs sm:text-sm font-bold text-white">
                주간 마일리지 추세 (Weekly Mileage Trend)
              </h4>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400/80" />
                <span className="text-slate-400">주간 거리(km)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-400" />
                <span className="text-slate-400">4주 이동평균</span>
              </div>
            </div>
          </div>

          {/* D3 Render Area */}
          <div className="relative w-full aspect-[16/8] min-h-[220px]">
            {displayedWeeklyData.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                <p className="text-xs text-slate-400 mb-2">등록된 훈련 세션 데이터가 없습니다.</p>
                {onLoadDemo && (
                  <button
                    onClick={onLoadDemo}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg cursor-pointer transition-colors"
                  >
                    가민 샘플 데이터로 분석 체험하기
                  </button>
                )}
              </div>
            ) : (
              <svg ref={mileageChartRef} className="w-full h-full overflow-visible" />
            )}

            {/* Hover Tooltip Overlay */}
            {hoveredWeek && (
              <div className="absolute top-2 right-2 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl border border-cyan-500/30 shadow-xl text-xs space-y-1 pointer-events-none animate-fadeIn z-10 min-w-[170px]">
                <div className="font-bold text-cyan-300 border-b border-white/10 pb-1 flex justify-between">
                  <span>{hoveredWeek.weekLabel}</span>
                  <span>{hoveredWeek.sessionCount}회</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>주간 총 주행거리:</span>
                  <strong className="text-white font-athletic">{hoveredWeek.totalDistance} km</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>평균 페이스:</span>
                  <strong className="text-cyan-200">{hoveredWeek.avgPaceFormatted}/km</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>4주 이동 평균:</span>
                  <strong className="text-emerald-300 font-athletic">{hoveredWeek.movingAverage} km</strong>
                </div>
                {hoveredWeek.wowGrowthPct !== null && (
                  <div className="flex justify-between pt-0.5 border-t border-white/5 text-[11px]">
                    <span className="text-slate-400">전주 대비 증감:</span>
                    <strong
                      className={
                        hoveredWeek.wowGrowthPct > 15
                          ? 'text-rose-400'
                          : hoveredWeek.wowGrowthPct >= 0
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                      }
                    >
                      {hoveredWeek.wowGrowthPct > 0 ? `+${hoveredWeek.wowGrowthPct}%` : `${hoveredWeek.wowGrowthPct}%`}
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-300">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>부상 예방 10% 원칙: 주간 마일리지는 전주 대비 최대 10% 내외로 점진적 증량을 권장합니다.</span>
            </span>
          </div>
        </div>

        {/* Right Chart: Training Intensity Distribution (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/60 rounded-xl p-4 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs sm:text-sm font-bold text-white">
                심박존 훈련 강도 분포 (Intensity)
              </h4>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
              80:20 Polarized
            </span>
          </div>

          {/* D3 Donut Chart & Legend */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center my-auto">
            {/* Donut SVG (5 cols) */}
            <div className="sm:col-span-6 flex items-center justify-center relative min-h-[190px]">
              <svg ref={intensityChartRef} className="w-[190px] h-[190px] overflow-visible" />
            </div>

            {/* Intensity Zones Breakdown Legend (7 cols) */}
            <div className="sm:col-span-6 space-y-1.5 text-xs">
              {intensityData.map((z) => (
                <div
                  key={z.zone}
                  onMouseEnter={() => setHoveredZone(z)}
                  onMouseLeave={() => setHoveredZone(null)}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    hoveredZone?.zone === z.zone
                      ? 'bg-slate-800/90 border-white/30 scale-[1.02]'
                      : 'bg-slate-900/40 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: z.color }}
                    />
                    <div className="leading-tight">
                      <div className="font-bold text-white text-[11px]">
                        Z{z.zone} {z.nameKo.split(' ')[0]}
                      </div>
                      <div className="text-[9px] text-slate-400">{z.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-white font-athletic text-xs">
                      {z.percentage}%
                    </span>
                    <div className="text-[9px] text-slate-400">{z.distanceKm}km</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Polarized Coaching Feedback Footer */}
          <div className="mt-3 p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold text-white">80:20 코칭 평가: </span>
              <span className="text-slate-300">{polarizedRatio.feedback}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
