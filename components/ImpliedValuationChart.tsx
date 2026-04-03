"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  type ImpliedValuationHistoryResponse,
  type TimeRange,
  formatImpliedValuation,
  formatProbability,
} from "@/lib/polymarket/implied-valuations";

export interface ImpliedHoverData {
  valuation: number;
  timestamp: string;
  noIpoProbability?: number | null;
}

export interface ImpliedChartData {
  startValue: number;
  endValue: number;
  range: TimeRange;
  changeAmount: number;
  changePercent: number;
  isPositive: boolean;
}

interface ImpliedValuationChartProps {
  companySlug: string;
  companyName: string;
  initialData?: ImpliedValuationHistoryResponse | null;
  onHover?: (data: ImpliedHoverData | null) => void;
  onRangeChange?: (range: TimeRange) => void;
  onDataChange?: (data: ImpliedChartData | null) => void;
}

/**
 * Interactive implied valuation chart matching Robinhood design.
 * Displays market-implied valuations from Polymarket prediction markets.
 * Blue line on dark-transparent background with hover tooltip.
 */
export function ImpliedValuationChart({
  companySlug,
  companyName,
  initialData,
  onHover,
  onRangeChange,
  onDataChange,
}: ImpliedValuationChartProps) {
  const [data, setData] = useState<ImpliedValuationHistoryResponse | null>(initialData ?? null);
  const [activeRange, setActiveRange] = useState<TimeRange>("ALL");
  const [loading, setLoading] = useState(!initialData);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hasUserChangedRange, setHasUserChangedRange] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch data when range changes
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/implied-valuations/${companySlug}/history?range=${activeRange}`
        );
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error("Failed to fetch implied valuation history:", error);
      } finally {
        setLoading(false);
      }
    }

    // Fetch if: no initial data, user has changed range, or range is not ALL
    if (!initialData || hasUserChangedRange || activeRange !== "ALL") {
      fetchData();
    }
  }, [companySlug, activeRange, initialData, hasUserChangedRange]);

  const history = useMemo(() => data?.history ?? [], [data]);

  // Current valuation from history (ensures consistency with line chart's last point)
  const currentValuation = useMemo(() => {
    if (history.length > 0) {
      return history[history.length - 1].value;
    }
    return data?.currentValuation ?? 0;
  }, [history, data?.currentValuation]);

  // Calculate and notify parent of chart data changes
  useEffect(() => {
    if (history.length >= 2 && onDataChange) {
      const startValue = history[0].value;
      const endValue = history[history.length - 1].value;
      const changeAmount = endValue - startValue;
      const changePercent = startValue > 0 ? (changeAmount / startValue) * 100 : 0;
      const isPositive = changeAmount >= 0;

      onDataChange({
        startValue,
        endValue,
        range: activeRange,
        changeAmount,
        changePercent,
        isPositive,
      });
    } else if (onDataChange) {
      onDataChange(null);
    }
  }, [history, activeRange, onDataChange]);

  const width = 900;
  const height = 340;
  const padding = { top: 20, right: 20, bottom: 40, left: 20 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Calculate points
  const { points, min, max } = useMemo(() => {
    if (history.length < 2) return { points: [], min: 0, max: 0 };
    const values = history.map((h) => h.value);
    const mn = Math.min(...values);
    const mx = Math.max(...values);
    const range = mx - mn || 1;

    const pts = history.map((h, i) => ({
      x: padding.left + (i / (history.length - 1)) * innerWidth,
      y: padding.top + innerHeight - ((h.value - mn) / range) * innerHeight,
      timestamp: h.timestamp,
      value: h.value,
      noIpoProbability: h.noIpoProbability,
    }));
    return { points: pts, min: mn, max: mx };
  }, [history, innerWidth, innerHeight]);

  // Build smooth path
  const linePath = useMemo(() => {
    if (points.length < 2) return "";
    let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const prev = points[Math.max(i - 1, 0)];
      const afterNext = points[Math.min(i + 2, points.length - 1)];
      const tension = 0.3;
      const cp1x = curr.x + (next.x - prev.x) * tension;
      const cp1y = curr.y + (next.y - prev.y) * tension;
      const cp2x = next.x - (afterNext.x - curr.x) * tension;
      const cp2y = next.y - (afterNext.y - curr.y) * tension;
      path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
    }
    return path;
  }, [points]);

  const gradientPath = useMemo(() => {
    if (!linePath || points.length < 2) return "";
    return `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(2)} ${height} Z`;
  }, [linePath, points, height]);

  // Determine overall trend
  const isPositive = history.length >= 2 ? history[history.length - 1].value >= history[0].value : true;
  // Use blue for market implied (distinguishes from funding history green)
  const color = isPositive ? "#3b82f6" : "#ef4444";

  // Handle mouse hover
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || points.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * width;

      // Find closest point
      let closest = 0;
      let closestDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const dist = Math.abs(points[i].x - mouseX);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      }
      setHoverIndex(closest);
      onHover?.({
        valuation: points[closest].value,
        timestamp: points[closest].timestamp,
        noIpoProbability: points[closest].noIpoProbability,
      });
    },
    [points, width, onHover]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
    onHover?.(null);
  }, [onHover]);

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;

  const timeRanges: TimeRange[] = ["1D", "1W", "1M", "3M", "ALL"];

  const handleRangeChange = (range: TimeRange) => {
    setHasUserChangedRange(true);
    setActiveRange(range);
    onRangeChange?.(range);
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className="w-full h-[340px] flex items-center justify-center rounded-lg bg-muted/10">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Loading market data...</p>
        </div>
      </div>
    );
  }

  // Insufficient data state
  if (history.length < 2) {
    return (
      <div className="w-full h-[340px] flex items-center justify-center rounded-lg bg-muted/10">
        <div className="text-center px-4">
          <p className="text-muted text-sm mb-2">Building history...</p>
          <p className="text-muted/60 text-xs">
            Market implied valuations are updated every 5 minutes.
            <br />
            Check back soon for historical data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Chart */}
      <div className="w-full relative overflow-hidden">
        <svg
          ref={svgRef}
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          fill="none"
          className="block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="implied-chart-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.08} />
              <stop offset="100%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          {/* Gradient fill */}
          {gradientPath && (
            <path d={gradientPath} fill="url(#implied-chart-gradient)" />
          )}

          {/* Line */}
          <path
            d={linePath}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Hover vertical line + dot */}
          {hoverPoint && (
            <>
              <line
                x1={hoverPoint.x}
                y1={padding.top}
                x2={hoverPoint.x}
                y2={height - padding.bottom}
                stroke="var(--muted)"
                strokeWidth={0.5}
                strokeDasharray="4 2"
                opacity={0.5}
              />
              <circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r={4}
                fill={color}
                stroke="var(--background)"
                strokeWidth={2}
              />
            </>
          )}

          {/* Data point dots (small) - show fewer for dense data */}
          {points.length <= 50 &&
            points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={hoverIndex === i ? 0 : 2}
                fill={color}
                opacity={0.6}
              />
            ))}
        </svg>
      </div>

      {/* Time range selector */}
      <div className="flex items-center gap-1 mt-3 border-t border-border pt-3">
        {timeRanges.map((range) => {
          const isSelected = activeRange === range;
          return (
            <button
              key={range}
              onClick={() => handleRangeChange(range)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                isSelected
                  ? "text-blue-500 bg-blue-500/10"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {range}
            </button>
          );
        })}
        {loading && (
          <div className="ml-2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Current implied valuation summary */}
      <div className="mt-6 p-4 rounded-lg bg-muted/5 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted mb-1">Market Implied Valuation</p>
            <p className="text-2xl font-semibold text-foreground">
              {formatImpliedValuation(currentValuation)}
            </p>
          </div>
          {history[history.length - 1]?.noIpoProbability != null && (
            <div className="text-right">
              <p className="text-sm text-muted mb-1">No IPO Probability</p>
              <p className="text-lg font-medium text-blue-500">
                {formatProbability(history[history.length - 1].noIpoProbability ?? null)}
              </p>
            </div>
          )}
        </div>
        <p className="text-xs text-muted/60 mt-3">
          Updated every 5 minutes from Polymarket prediction market data
        </p>
      </div>
    </div>
  );
}
