"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  usePrestockHistory,
  usePrestockPrice,
  formatPrestockPrice,
  type PrestockTimeRange,
  type PrestockPricePoint,
} from "@/hooks/usePrestockPrice";
import { formatValuation } from "@/lib/vaulto/companies";

export interface LiveHoverData {
  price: number;
  timestamp: number;
}

export interface LiveChartData {
  startValue: number;
  endValue: number;
  changeAmount: number;
  changePercent: number;
  isPositive: boolean;
  range: PrestockTimeRange;
  marketCap: number | null;
}

type ChartType = "funding" | "market" | "live";

interface LivePriceChartProps {
  tokenAddress: string;
  companyName: string;
  onHover?: (data: LiveHoverData | null) => void;
  onDataChange?: (data: LiveChartData | null) => void;
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
  hasMarketData?: boolean;
}

/**
 * Live price chart for prestock tokens.
 * Displays real-time price data from Birdeye via the backend API.
 */
export function LivePriceChart({
  tokenAddress,
  companyName,
  onHover,
  onDataChange,
  chartType,
  onChartTypeChange,
  hasMarketData,
}: LivePriceChartProps) {
  const [activeRange, setActiveRange] = useState<PrestockTimeRange>("1D");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch price history
  const {
    data: historyResponse,
    isLoading,
    error,
  } = usePrestockHistory(tokenAddress, { range: activeRange });

  // Fetch current price data (includes marketCap)
  const { data: priceData } = usePrestockPrice(tokenAddress);
  const marketCap = priceData?.data?.marketCap ?? null;

  const history = historyResponse?.data?.history ?? [];
  const currentPrice = historyResponse?.data?.currentPrice ?? null;

  // Notify parent of data changes
  useEffect(() => {
    if (history.length >= 2) {
      const startValue = history[0].price;
      const endValue = history[history.length - 1].price;
      const changeAmount = endValue - startValue;
      const changePercent = startValue > 0 ? (changeAmount / startValue) * 100 : 0;

      onDataChange?.({
        startValue,
        endValue,
        changeAmount,
        changePercent,
        isPositive: changeAmount >= 0,
        range: activeRange,
        marketCap,
      });
    } else {
      onDataChange?.(null);
    }
  }, [history, activeRange, onDataChange, marketCap]);

  const width = 900;
  const height = 340;
  const padding = { top: 30, right: 20, bottom: 40, left: 20 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Calculate points
  const { points, min, max } = useMemo(() => {
    if (history.length < 2) return { points: [], min: 0, max: 0 };
    const values = history.map((h) => h.price);
    const mn = Math.min(...values);
    const mx = Math.max(...values);
    const range = mx - mn || 1;

    const pts = history.map((h, i) => ({
      x: padding.left + (i / (history.length - 1)) * innerWidth,
      y: padding.top + innerHeight - ((h.price - mn) / range) * innerHeight,
      timestamp: h.timestamp,
      value: h.price,
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
  const isPositive = history.length >= 2 ? history[history.length - 1].price >= history[0].price : true;
  // Price chart is always purple
  const color = "#a855f7";

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
      onHover?.({ price: points[closest].value, timestamp: points[closest].timestamp });
    },
    [points, width, onHover]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
    onHover?.(null);
  }, [onHover]);

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;

  const timeRanges: PrestockTimeRange[] = ["1H", "4H", "1D", "1W", "1M", "ALL"];

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full">
        <div className="w-full h-[340px] flex items-center justify-center rounded-lg bg-muted/10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin" />
            <p className="text-muted text-sm">Loading price data...</p>
          </div>
        </div>
        {/* Time range selector skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3 border-t border-border pt-3">
          <div className="flex items-center gap-1 flex-wrap">
            {timeRanges.map((range) => (
              <button
                key={range}
                onClick={() => setActiveRange(range)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  activeRange === range
                    ? "text-accent bg-accent/10"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          {onChartTypeChange && (
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
            </div>
          )}
        </div>
      </div>
    );
  }

  // Error or no data state
  if (error || history.length < 2) {
    return (
      <div className="w-full">
        <div className="w-full h-[340px] flex items-center justify-center rounded-lg bg-muted/10">
          <p className="text-muted text-sm">
            {error ? "Unable to load price data" : "Insufficient price data for chart"}
          </p>
        </div>
        {/* Time range selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3 border-t border-border pt-3">
          <div className="flex items-center gap-1 flex-wrap">
            {timeRanges.map((range) => (
              <button
                key={range}
                onClick={() => setActiveRange(range)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  activeRange === range
                    ? "text-accent bg-accent/10"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          {onChartTypeChange && (
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
            </div>
          )}
        </div>
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
            <linearGradient id="live-chart-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.08} />
              <stop offset="100%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          {/* Gradient fill */}
          {gradientPath && (
            <path d={gradientPath} fill="url(#live-chart-gradient)" />
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
        </svg>
      </div>

      {/* Time range selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3 border-t border-border pt-3">
        <div className="flex items-center gap-1 flex-wrap">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                activeRange === range
                  ? "text-accent bg-accent/10"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        {onChartTypeChange && (
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
          </div>
        )}
      </div>

      {/* Live price summary */}
      <div className="mt-6 p-4 rounded-xl bg-badge-bg/50 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted mb-1">Current Price</p>
            <p className="text-2xl font-semibold text-foreground">
              {currentPrice !== null ? formatPrestockPrice(currentPrice) : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted mb-1">{activeRange} Change</p>
            <p className={`text-2xl font-semibold ${isPositive ? "text-green" : "text-red"}`}>
              {history.length >= 2
                ? `${isPositive ? "+" : ""}${(
                    ((history[history.length - 1].price - history[0].price) / history[0].price) *
                    100
                  ).toFixed(2)}%`
                : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
