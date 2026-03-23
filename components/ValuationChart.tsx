"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { formatValuation } from "@/lib/vaulto/companies";
import { getValuationHistory } from "@/lib/vaulto/companyUtils";

interface ValuationChartProps {
  company: PrivateCompany;
}

type TimeRange = "ALL" | "5Y" | "3Y" | "1Y";

/**
 * Large interactive valuation chart matching Robinhood design.
 * Plots real postMoneyValuationUsd from funding history.
 * Green line on dark-transparent background with hover tooltip.
 */
export function ValuationChart({ company }: ValuationChartProps) {
  const allHistory = useMemo(() => getValuationHistory(company), [company]);
  const [activeRange, setActiveRange] = useState<TimeRange>("ALL");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Filter history based on active range
  const history = useMemo(() => {
    if (activeRange === "ALL") return allHistory;
    const now = new Date();
    const years = activeRange === "5Y" ? 5 : activeRange === "3Y" ? 3 : 1;
    const cutoff = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
    return allHistory.filter((h) => new Date(h.date) >= cutoff);
  }, [allHistory, activeRange]);

  const width = 900;
  const height = 340;
  const padding = { top: 20, right: 20, bottom: 20, left: 20 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Calculate points
  const { points, min, max } = useMemo(() => {
    if (history.length < 2) return { points: [], min: 0, max: 0 };
    const values = history.map((h) => h.valuation);
    const mn = Math.min(...values);
    const mx = Math.max(...values);
    const range = mx - mn || 1;

    const pts = history.map((h, i) => ({
      x: padding.left + (i / (history.length - 1)) * innerWidth,
      y: padding.top + innerHeight - ((h.valuation - mn) / range) * innerHeight,
      date: h.date,
      value: h.valuation,
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
  const isPositive = history.length >= 2 ? history[history.length - 1].valuation >= history[0].valuation : true;
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
    },
    [points, width]
  );

  const handleMouseLeave = useCallback(() => setHoverIndex(null), []);

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;

  const timeRanges: TimeRange[] = ["1Y", "3Y", "5Y", "ALL"];

  if (history.length < 2) {
    return (
      <div className="w-full h-[340px] flex items-center justify-center rounded-lg bg-muted/10">
        <p className="text-muted text-sm">Insufficient valuation data for chart</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Hover tooltip */}
      {hoverPoint && (
        <div className="mb-2 text-sm text-muted">
          <span className="font-medium text-foreground">{formatValuation(hoverPoint.value)}</span>
          <span className="ml-2">
            {new Date(hoverPoint.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="w-full relative">
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
            <linearGradient id="chart-detail-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.08} />
              <stop offset="100%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          {/* Gradient fill */}
          {gradientPath && (
            <path d={gradientPath} fill="url(#chart-detail-gradient)" />
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
              r={hoverIndex === i ? 0 : 2.5}
              fill={color}
              opacity={0.6}
            />
          ))}
        </svg>
      </div>

      {/* Time range selector */}
      <div className="flex items-center gap-1 mt-3 border-t border-border pt-3">
        {timeRanges.map((range) => (
          <button
            key={range}
            onClick={() => setActiveRange(range)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activeRange === range
                ? "text-green bg-green/10"
                : "text-muted hover:text-foreground"
            }`}
          >
            {range}
          </button>
        ))}
      </div>
    </div>
  );
}
