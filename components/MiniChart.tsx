"use client";

import { useId } from "react";

interface MiniChartProps {
  data: number[];
  width?: number;
  height?: number;
  isPositive: boolean;
  strokeWidth?: number;
  showGradient?: boolean;
}

/**
 * Mini line chart matching Ondo Finance style.
 * Uses smooth cubic bezier curves for a polished look.
 */
export function MiniChart({
  data,
  width = 280,
  height = 80,
  isPositive,
  strokeWidth = 1.5,
  showGradient = true,
}: MiniChartProps) {
  const reactId = useId();
  const gradientId = `chart-grad-${isPositive ? "g" : "r"}-${reactId.replace(/:/g, "")}`;

  if (!data || data.length < 2) return null;

  const padding = { top: 6, right: 2, bottom: 2, left: 2 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => ({
    x: padding.left + (i / (data.length - 1)) * innerWidth,
    y: padding.top + innerHeight - ((value - min) / range) * innerHeight,
  }));

  // Build smooth cubic bezier path
  let linePath = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const tension = 0.3;

    // Control points for smooth curve
    const prev = points[Math.max(i - 1, 0)];
    const afterNext = points[Math.min(i + 2, points.length - 1)];

    const cp1x = curr.x + (next.x - prev.x) * tension;
    const cp1y = curr.y + (next.y - prev.y) * tension;
    const cp2x = next.x - (afterNext.x - curr.x) * tension;
    const cp2y = next.y - (afterNext.y - curr.y) * tension;

    linePath += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  // Build gradient fill path
  const gradientPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(2)} ${height} Z`;

  const color = isPositive ? "var(--chart-green)" : "var(--chart-red)";
  const clipId = `chart-clip-${reactId.replace(/:/g, "")}`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block"
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
        />
      </g>
    </svg>
  );
}
