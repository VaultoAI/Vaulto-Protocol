"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import type { IndexHistoryPoint } from "@/lib/vaulto/indexes";

export interface IndexHoverData {
  price: number;
  date: string;
}

interface IndexPriceChartProps {
  history: IndexHistoryPoint[];
  onHover?: (data: IndexHoverData | null) => void;
}

type TimeRange = "1W" | "1M" | "3M" | "ALL";

const RANGE_LIMITS: Record<TimeRange, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "ALL": 365,
};

/**
 * Price chart for index historical data.
 * Shows OHLCV data with time range selection.
 */
export function IndexPriceChart({ history, onHover }: IndexPriceChartProps) {
  const [activeRange, setActiveRange] = useState<TimeRange>("1M");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Filter history based on active range
  const { filteredHistory, effectiveRange } = useMemo(() => {
    const limit = RANGE_LIMITS[activeRange];

    // History is ordered oldest to newest, so take the last N items
    if (history.length <= limit) {
      return { filteredHistory: history, effectiveRange: activeRange };
    }

    const filtered = history.slice(-limit);
    return { filteredHistory: filtered, effectiveRange: activeRange };
  }, [history, activeRange]);

  const width = 900;
  const height = 340;
  const padding = { top: 30, right: 20, bottom: 40, left: 20 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Calculate points
  const { points, min, max } = useMemo(() => {
    if (filteredHistory.length < 2) return { points: [], min: 0, max: 0 };

    const values = filteredHistory.map((h) => h.price);
    const mn = Math.min(...values);
    const mx = Math.max(...values);
    const range = mx - mn || 1;

    const pts = filteredHistory.map((h, i) => ({
      x: padding.left + (i / (filteredHistory.length - 1)) * innerWidth,
      y: padding.top + innerHeight - ((h.price - mn) / range) * innerHeight,
      date: h.date,
      price: h.price,
      open: h.open,
      high: h.high,
      low: h.low,
      volume: h.volume,
    }));
    return { points: pts, min: mn, max: mx };
  }, [filteredHistory, innerWidth, innerHeight]);

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
  const isPositive = filteredHistory.length >= 2
    ? filteredHistory[filteredHistory.length - 1].price >= filteredHistory[0].price
    : true;
  const color = isPositive ? "#22c55e" : "#ef4444";

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
      onHover?.({ price: points[closest].price, date: points[closest].date });
    },
    [points, width, onHover]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
    onHover?.(null);
  }, [onHover]);

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;

  const timeRanges: TimeRange[] = ["1W", "1M", "3M", "ALL"];

  // Show placeholder if no history data
  if (history.length < 2) {
    return (
      <div className="w-full h-[340px] flex items-center justify-center rounded-lg bg-muted/10">
        <p className="text-muted text-sm">Price history data unavailable</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Chart */}
      <div className="w-full relative overflow-visible">
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
            <linearGradient id="index-chart-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.08} />
              <stop offset="100%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          {/* Gradient fill */}
          {gradientPath && (
            <path d={gradientPath} fill="url(#index-chart-gradient)" />
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

          {/* Data point dots (small) */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 0 : 2}
              fill={color}
              opacity={0.4}
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
              onClick={() => setActiveRange(range)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                isSelected
                  ? "text-green bg-green/10"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {range}
            </button>
          );
        })}
      </div>
    </div>
  );
}
