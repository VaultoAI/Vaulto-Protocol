"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { formatValuation } from "@/lib/vaulto/companies";
import { getValuationHistory } from "@/lib/vaulto/companyUtils";

export interface HoverData {
  valuation: number;
  date: string;
}

type ChartType = "funding" | "market" | "live";

interface ValuationChartProps {
  company: PrivateCompany;
  onHover?: (data: HoverData | null) => void;
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
  hasMarketData?: boolean;
  hasLiveData?: boolean;
}

type TimeRange = "ALL" | "5Y" | "3Y" | "1Y";

/**
 * Large interactive valuation chart matching Robinhood design.
 * Plots real postMoneyValuationUsd from funding history.
 * Green line on dark-transparent background with hover tooltip.
 */
export function ValuationChart({ company, onHover, chartType, onChartTypeChange, hasMarketData, hasLiveData }: ValuationChartProps) {
  const allHistory = useMemo(() => getValuationHistory(company), [company]);
  const [activeRange, setActiveRange] = useState<TimeRange>("ALL");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Current valuation from history (ensures consistency with line chart's last point)
  const currentValuation = useMemo(() => {
    if (allHistory.length > 0) {
      return allHistory[allHistory.length - 1].valuation;
    }
    return company.valuationUsd;
  }, [allHistory, company.valuationUsd]);

  // Filter history based on active range, with fallback to larger ranges if insufficient data
  const { history, effectiveRange } = useMemo(() => {
    const filterByRange = (range: TimeRange) => {
      if (range === "ALL") return allHistory;
      const now = new Date();
      const years = range === "5Y" ? 5 : range === "3Y" ? 3 : 1;
      const cutoff = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
      return allHistory.filter((h) => new Date(h.date) >= cutoff);
    };

    // Try the active range first
    const filtered = filterByRange(activeRange);
    if (filtered.length >= 2) {
      return { history: filtered, effectiveRange: activeRange };
    }

    // Fallback to larger ranges if insufficient data
    const fallbackOrder: TimeRange[] = ["3Y", "5Y", "ALL"];
    for (const range of fallbackOrder) {
      if (range === activeRange) continue;
      const fallbackFiltered = filterByRange(range);
      if (fallbackFiltered.length >= 2) {
        return { history: fallbackFiltered, effectiveRange: range };
      }
    }

    // Return all history as last resort
    return { history: allHistory, effectiveRange: "ALL" as TimeRange };
  }, [allHistory, activeRange]);

  const width = 900;
  const height = 340;
  const padding = { top: 30, right: 20, bottom: 40, left: 20 };
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
  // Funding chart is always blue
  const color = "#3b82f6";

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
      onHover?.({ valuation: points[closest].value, date: points[closest].date });
    },
    [points, width, onHover]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
    onHover?.(null);
  }, [onHover]);

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;

  const timeRanges: TimeRange[] = ["1Y", "3Y", "5Y", "ALL"];

  // Only show error if there's truly no data at all
  if (allHistory.length < 2) {
    return (
      <div className="w-full h-[340px] flex items-center justify-center rounded-lg bg-muted/10">
        <p className="text-muted text-sm">Insufficient valuation data for chart</p>
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
            vectorEffect="non-scaling-stroke"
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3 border-t border-border pt-3">
        <div className="flex items-center gap-1 flex-wrap">
          {timeRanges.map((range) => {
            const isSelected = activeRange === range;
            const isEffective = effectiveRange === range;
            return (
              <button
                key={range}
                onClick={() => setActiveRange(range)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  isSelected && isEffective
                    ? "text-accent bg-accent/10"
                    : isSelected && !isEffective
                    ? "text-muted bg-muted/10"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {range}
              </button>
            );
          })}
        </div>
        {(hasMarketData || hasLiveData) && onChartTypeChange && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onChartTypeChange("funding")}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                chartType === "funding"
                  ? "text-accent bg-accent/10"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Funding
            </button>
            {hasMarketData && (
              <button
                onClick={() => onChartTypeChange("market")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  chartType === "market"
                    ? "text-accent bg-accent/10"
                    : "text-muted hover:text-foreground"
                }`}
              >
                IPO
              </button>
            )}
            {hasLiveData && (
              <button
                onClick={() => onChartTypeChange("live")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  chartType === "live"
                    ? "text-accent bg-accent/10"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Price
              </button>
            )}
          </div>
        )}
      </div>

      {/* Funding vs Valuation summary */}
      <div className="mt-6 p-4 rounded-xl bg-badge-bg/50 border border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-muted mb-1">Total Funding</p>
            <p className="text-2xl font-semibold text-foreground">
              {formatValuation(company.totalFundingUsd)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted mb-1">Valuation</p>
            <p className="text-2xl font-semibold text-foreground">
              {formatValuation(currentValuation)}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="relative h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.min((company.totalFundingUsd / currentValuation) * 100, 100)}%`,
              background: `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`
            }}
          />
        </div>
      </div>
    </div>
  );
}
