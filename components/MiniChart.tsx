"use client";

import { useId, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useChartInteraction } from "@/hooks/useChartInteraction";

export interface MiniChartHoverData {
  value: number;
  timestamp: string;
  index: number;
}

interface HistoryPoint {
  timestamp: string;
  balance: number;
}

interface MiniChartProps {
  data: number[];
  history?: HistoryPoint[];
  width?: number;
  height?: number;
  isPositive: boolean;
  strokeWidth?: number;
  showGradient?: boolean;
  onHover?: (data: MiniChartHoverData | null) => void;
  /** Disable touch interactions for mobile scroll performance */
  disableTouch?: boolean;
}

/**
 * Mini line chart matching Ondo Finance style.
 * Uses smooth cubic bezier curves for a polished look.
 */
export function MiniChart({
  data,
  history,
  width = 280,
  height = 80,
  isPositive,
  strokeWidth = 1.5,
  showGradient = true,
  onHover,
  disableTouch = false,
}: MiniChartProps) {
  const [isMounted, setIsMounted] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const reactId = useId();

  // Only render after mount to avoid hydration mismatch with useId
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Compute chart data - all hooks must be called before any early returns
  const chartData = useMemo(() => {
    if (!data || data.length < 2) return null;

    const padding = { top: 8, right: 4, bottom: 4, left: 4 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, i) => ({
      x: padding.left + (i / (data.length - 1)) * innerWidth,
      y: padding.top + innerHeight - ((value - min) / range) * innerHeight,
      value,
      timestamp: history?.[i]?.timestamp ?? "",
      index: i,
    }));

    // Build smooth cubic bezier path
    let linePath = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const tension = 0.1;

      const prev = points[Math.max(i - 1, 0)];
      const afterNext = points[Math.min(i + 2, points.length - 1)];

      const cp1x = curr.x + (next.x - prev.x) * tension;
      const cp1y = curr.y + (next.y - prev.y) * tension;
      const cp2x = next.x - (afterNext.x - curr.x) * tension;
      const cp2y = next.y - (afterNext.y - curr.y) * tension;

      linePath += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
    }

    const gradientPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(2)} ${height} Z`;

    return { points, linePath, gradientPath, padding };
  }, [data, history, width, height]);

  const gradientId = `chart-grad-${isPositive ? "g" : "r"}-${reactId.replace(/:/g, "")}`;
  const clipId = `chart-clip-${reactId.replace(/:/g, "")}`;
  const color = isPositive ? "#3b82f6" : "#ef4444";

  // Wrap onHover to handle missing history - must be called before early returns
  const wrappedOnHover = useCallback(
    (hoverData: MiniChartHoverData | null) => {
      if (!onHover) return;
      if (hoverData && history && history[hoverData.index]) {
        onHover(hoverData);
      } else {
        onHover(null);
      }
    },
    [onHover, history]
  );

  // Unified mouse/touch interaction - must be called before early returns
  const { hoverIndex, handlers } = useChartInteraction({
    svgRef,
    points: chartData?.points ?? [],
    width,
    onHover: wrappedOnHover,
    mapPointToHoverData: (point) => ({
      value: point.value,
      timestamp: point.timestamp,
      index: point.index,
    }),
    disableTouch,
  });

  // Early returns after all hooks
  if (!chartData) return null;
  if (!isMounted) {
    return <div style={{ width: "100%", height }} />;
  }

  const { points, linePath, gradientPath, padding } = chartData;
  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block cursor-crosshair"
      style={{ touchAction: disableTouch ? "auto" : "none" }}
      {...handlers}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={width} height={height}>
            <animate
              attributeName="width"
              from="0"
              to={width}
              dur="1.2s"
              fill="freeze"
              calcMode="spline"
              keyTimes="0;1"
              keySplines="0.25 0.1 0.25 1"
            />
          </rect>
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {showGradient && (
          <path d={gradientPath} fill={`url(#${gradientId})`} />
        )}
        <path
          d={linePath}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </g>

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
    </svg>
  );
}
