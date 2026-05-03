"use client";

import { useRef, useCallback, useMemo } from "react";
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
  /** Disable all hover interactions (mouse and touch) */
  disableHover?: boolean;
  /** Disable the left-to-right reveal animation on mount */
  disableAnimation?: boolean;
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
  disableHover = false,
  disableAnimation = false,
}: MiniChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Compute chart data - all hooks must be called before any early returns
  const chartData = useMemo(() => {
    if (!data || data.length < 2) return null;

    const padding = { top: 8, right: 0, bottom: 4, left: 4 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Use real timestamps for x-positioning when history is provided so the
    // chart is time-proportional (a cluster of snapshots taken seconds apart
    // doesn't dominate the visual width). Fall back to even index spacing
    // when history is missing or invalid (preserves data-only callers like
    // AssetCard / AssetListRow / WalletDropdown).
    const timestamps =
      history && history.length === data.length
        ? history.map((h) => {
            const t = Date.parse(h.timestamp);
            return Number.isFinite(t) ? t : NaN;
          })
        : null;
    const useTime =
      timestamps !== null &&
      timestamps.every((t) => Number.isFinite(t)) &&
      timestamps[timestamps.length - 1] > timestamps[0];
    const tMin = useTime && timestamps ? timestamps[0] : 0;
    const tSpan =
      useTime && timestamps
        ? timestamps[timestamps.length - 1] - timestamps[0]
        : 1;

    const points = data.map((value, i) => ({
      x:
        padding.left +
        (useTime && timestamps
          ? ((timestamps[i] - tMin) / tSpan) * innerWidth
          : (i / (data.length - 1)) * innerWidth),
      y: padding.top + innerHeight - ((value - min) / range) * innerHeight,
      value,
      timestamp: history?.[i]?.timestamp ?? "",
      index: i,
    }));

    // Monotone cubic interpolation (Fritsch–Carlson). Catmull-Rom with
    // non-uniform x spacing produced loops/cusps at points where a small
    // x-gap sat next to a large one; monotone cubic guarantees the curve
    // never overshoots or reverses direction between samples.
    const n = points.length;
    const dx: number[] = new Array(n - 1);
    const slope: number[] = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      dx[i] = points[i + 1].x - points[i].x || 1e-6;
      slope[i] = (points[i + 1].y - points[i].y) / dx[i];
    }

    const tangent: number[] = new Array(n);
    tangent[0] = slope[0];
    tangent[n - 1] = slope[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (slope[i - 1] * slope[i] <= 0) {
        tangent[i] = 0;
      } else {
        const w1 = 2 * dx[i] + dx[i - 1];
        const w2 = dx[i] + 2 * dx[i - 1];
        tangent[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
      }
    }

    let linePath = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 0; i < n - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cp1x = curr.x + dx[i] / 3;
      const cp1y = curr.y + (tangent[i] * dx[i]) / 3;
      const cp2x = next.x - dx[i] / 3;
      const cp2y = next.y - (tangent[i + 1] * dx[i]) / 3;
      linePath += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
    }

    const gradientPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(2)} ${height} Z`;

    return { points, linePath, gradientPath, padding };
  }, [data, history, width, height]);

  // Generate deterministic IDs based on data fingerprint to avoid hydration mismatches
  const dataFingerprint = useMemo(() => {
    if (!data || data.length < 2) return "empty";
    // Create a simple fingerprint from first, last, and length
    const first = Math.round(data[0] * 100);
    const last = Math.round(data[data.length - 1] * 100);
    return `${data.length}-${first}-${last}`;
  }, [data]);

  const gradientId = `chart-grad-${isPositive ? "g" : "r"}-${dataFingerprint}`;
  const clipId = `chart-clip-${dataFingerprint}`;
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

  // Early return after all hooks
  if (!chartData) return null;

  const { points, linePath, gradientPath, padding } = chartData;
  const hoverPoint = !disableHover && hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`block ${disableHover ? "cursor-default" : "cursor-crosshair"}`}
      style={{ touchAction: disableTouch || disableHover ? "auto" : "none" }}
      {...(disableHover ? {} : handlers)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
        {!disableAnimation && (
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
        )}
      </defs>
      <g clipPath={disableAnimation ? undefined : `url(#${clipId})`}>
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
