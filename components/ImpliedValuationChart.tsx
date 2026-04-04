"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  type ImpliedValuationHistoryResponse,
  type ImpliedValuationHistoryPoint,
  type TimeRange,
  formatImpliedValuation,
  formatProbability,
  formatVolume,
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

type ChartType = "funding" | "market";

interface ImpliedValuationChartProps {
  companySlug: string;
  companyName: string;
  initialData?: ImpliedValuationHistoryResponse | null;
  onHover?: (data: ImpliedHoverData | null) => void;
  onRangeChange?: (range: TimeRange) => void;
  onDataChange?: (data: ImpliedChartData | null) => void;
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
}

// ============================================================================
// Market Age Validation Helpers
// ============================================================================

/** Minimum data points required for a meaningful chart for each range */
const MIN_POINTS_FOR_RANGE: Record<TimeRange, number> = {
  "1D": 6,
  "1W": 7,
  "1M": 10,
  "3M": 20,
  "ALL": 5,
};

/** Minimum market age (hours) required for each range to be available */
const MIN_HOURS_FOR_RANGE: Record<TimeRange, number> = {
  "1D": 4,     // Need at least 4 hours of data for 1D
  "1W": 48,    // Need at least 2 days for 1W
  "1M": 720,   // Need at least 30 days (720 hours) for 1M
  "3M": 2160,  // Need at least 90 days (2160 hours) for 3M
  "ALL": 0,    // ALL is always available
};

/**
 * Check if there's enough data points for a meaningful chart
 */
function hasMinimumDataForRange(
  history: ImpliedValuationHistoryPoint[],
  range: TimeRange
): boolean {
  return history.length >= MIN_POINTS_FOR_RANGE[range];
}

/**
 * Calculate market age in hours from history data
 */
function getMarketAgeHours(history: ImpliedValuationHistoryPoint[]): number {
  if (history.length < 2) return 0;
  const oldestTimestamp = new Date(history[0].timestamp).getTime();
  const newestTimestamp = new Date(history[history.length - 1].timestamp).getTime();
  return (newestTimestamp - oldestTimestamp) / (1000 * 60 * 60);
}

/**
 * Determine which ranges have sufficient data
 */
function getAvailableRanges(marketAgeHours: number): Record<TimeRange, boolean> {
  return {
    "1D": marketAgeHours >= MIN_HOURS_FOR_RANGE["1D"],
    "1W": marketAgeHours >= MIN_HOURS_FOR_RANGE["1W"],
    "1M": marketAgeHours >= MIN_HOURS_FOR_RANGE["1M"],
    "3M": marketAgeHours >= MIN_HOURS_FOR_RANGE["3M"],
    "ALL": true, // ALL is always available
  };
}

/**
 * Get the best available range for the current market age
 */
function getBestAvailableRange(marketAgeHours: number): TimeRange {
  const ranges: TimeRange[] = ["1D", "1W", "1M", "3M", "ALL"];
  for (const range of ranges) {
    if (marketAgeHours >= MIN_HOURS_FOR_RANGE[range]) {
      return range;
    }
  }
  return "ALL";
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
  chartType,
  onChartTypeChange,
}: ImpliedValuationChartProps) {
  const [data, setData] = useState<ImpliedValuationHistoryResponse | null>(initialData ?? null);
  const [activeRange, setActiveRange] = useState<TimeRange>("ALL");
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hasUserChangedRange, setHasUserChangedRange] = useState(false);
  const [hasAutoFallback, setHasAutoFallback] = useState(false);
  // Store the full market age from initial ALL load to keep range buttons stable
  const [fullMarketAgeHours, setFullMarketAgeHours] = useState<number | null>(null);
  // Total volume from current valuation endpoint
  const [totalVolume, setTotalVolume] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch current valuation to get totalVolume
  useEffect(() => {
    async function fetchCurrentValuation() {
      try {
        const res = await fetch(`/api/implied-valuations/${companySlug}`);
        if (res.ok) {
          const json = await res.json();
          if (json.totalVolume != null) {
            setTotalVolume(json.totalVolume);
          }
        }
      } catch (err) {
        console.error("Failed to fetch current valuation:", err);
      }
    }

    fetchCurrentValuation();
  }, [companySlug]);

  // Fetch data when range changes
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/implied-valuations/${companySlug}/history?range=${activeRange}`
        );
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else if (res.status === 404) {
          setError("Market data not available for this company yet.");
        } else {
          setError("Failed to load market data.");
        }
      } catch (err) {
        console.error("Failed to fetch implied valuation history:", err);
        setError("Failed to load market data.");
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

  // Calculate market age from history for current range
  const currentMarketAgeHours = useMemo(() => {
    // Prefer metadata from API if available
    if (data?.metadata?.marketAgeHours !== undefined) {
      return data.metadata.marketAgeHours;
    }
    return getMarketAgeHours(history);
  }, [data, history]);

  // Store full market age on initial ALL load to keep range buttons stable
  useEffect(() => {
    // Only update fullMarketAgeHours when we have ALL data (initial load or ALL range selected)
    if (activeRange === "ALL" && currentMarketAgeHours > 0 && !loading) {
      setFullMarketAgeHours(currentMarketAgeHours);
    }
  }, [activeRange, currentMarketAgeHours, loading]);

  // Use stored full market age for range availability, fall back to current if not yet set
  const marketAgeHours = fullMarketAgeHours ?? currentMarketAgeHours;

  // Determine which ranges are available
  const availableRanges = useMemo(
    () => getAvailableRanges(marketAgeHours),
    [marketAgeHours]
  );

  // Check if current range has sufficient data
  const hasSufficientData = useMemo(() => {
    // Prefer metadata from API if available
    if (data?.metadata?.sufficientDataForRange !== undefined) {
      return data.metadata.sufficientDataForRange;
    }
    return hasMinimumDataForRange(history, activeRange);
  }, [data, history, activeRange]);

  // Auto-fallback to best available range when current range has insufficient data
  useEffect(() => {
    if (!loading && history.length > 0 && !hasSufficientData && !hasUserChangedRange) {
      const bestRange = getBestAvailableRange(marketAgeHours);
      if (bestRange !== activeRange) {
        setHasAutoFallback(true);
        setActiveRange(bestRange);
        onRangeChange?.(bestRange);
      }
    }
  }, [loading, history, hasSufficientData, hasUserChangedRange, marketAgeHours, activeRange, onRangeChange]);

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

  // Filter time ranges based on market age - only show ranges with sufficient data
  // Compute directly to avoid stale memoization issues
  const timeRanges: TimeRange[] = (["1D", "1W", "1M", "3M", "ALL"] as TimeRange[]).filter(range => {
    const minHours = MIN_HOURS_FOR_RANGE[range];
    return marketAgeHours >= minHours;
  });

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

  // Error state - show message and allow switching back to funding chart
  if (error && !data) {
    return (
      <div className="w-full">
        <div className="w-full h-[280px] flex items-center justify-center rounded-lg bg-muted/10">
          <div className="text-center px-4">
            <p className="text-muted text-sm mb-2">{error}</p>
            <p className="text-muted/60 text-xs">
              Market implied valuations from prediction markets are coming soon.
              <br />
              Switch to Funding view to see historical valuation data.
            </p>
          </div>
        </div>

        {/* Chart type toggle - always show so users can switch back */}
        <div className="flex items-center justify-end mt-3 border-t border-border pt-3">
          {onChartTypeChange && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onChartTypeChange("funding")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  chartType === "funding"
                    ? "text-green bg-green/10"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Funding
              </button>
              <button
                onClick={() => onChartTypeChange("market")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  chartType === "market"
                    ? "text-blue-500 bg-blue-500/10"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Valuation
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Insufficient data state (only show if no error - error state handles API failures)
  if ((!hasSufficientData || history.length < 2) && !error) {
    // Find available ranges to suggest
    const suggestedRanges = (["1D", "1W", "1M", "3M", "ALL"] as TimeRange[]).filter(
      (r) => availableRanges[r] && r !== activeRange
    );

    return (
      <div className="w-full">
        <div className="w-full h-[280px] flex items-center justify-center rounded-lg bg-muted/10">
          <div className="text-center px-4">
            <p className="text-muted text-sm mb-2">
              {history.length < 2
                ? "Building market history..."
                : `Not enough data for ${activeRange} view`}
            </p>
            <p className="text-muted/60 text-xs">
              {history.length < 2 ? (
                <>
                  Market implied valuations are updated every 5 minutes.
                  <br />
                  Check back soon for historical data.
                </>
              ) : suggestedRanges.length > 0 ? (
                <>
                  This market is relatively new ({Math.floor(marketAgeHours)} hours old).
                  <br />
                  Try a shorter time range: {suggestedRanges.join(", ")}
                </>
              ) : (
                <>
                  This market is new. More data will be available soon.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Time range selector - always show so users can switch */}
        <div className="flex items-center justify-between mt-3 border-t border-border pt-3">
          <div className="flex items-center gap-1">
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
          {onChartTypeChange && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onChartTypeChange("funding")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  chartType === "funding"
                    ? "text-green bg-green/10"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Funding
              </button>
              <button
                onClick={() => onChartTypeChange("market")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  chartType === "market"
                    ? "text-blue-500 bg-blue-500/10"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Valuation
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
      <div className="flex items-center justify-between mt-3 border-t border-border pt-3">
        <div className="flex items-center gap-1">
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
        {onChartTypeChange && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onChartTypeChange("funding")}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                chartType === "funding"
                  ? "text-green bg-green/10"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Funding
            </button>
            <button
              onClick={() => onChartTypeChange("market")}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                chartType === "market"
                  ? "text-blue-500 bg-blue-500/10"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Valuation
            </button>
          </div>
        )}
      </div>

      {/* Current implied valuation summary - Polymarket inspired */}
      <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-[#1a1f2e] dark:to-[#141824] border border-gray-200 dark:border-[#2d3548]">
        <div className="flex items-center justify-between mb-3">
          {/* Left: Logo + Valuation */}
          <div className="flex items-start gap-3">
            <a
              href={`https://polymarket.com/event/${companySlug}-ipo`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 hover:opacity-80 transition-opacity"
            >
              <img
                src="/polymarket-small.png"
                alt="Polymarket"
                className="w-8 h-8 rounded-lg object-contain"
              />
            </a>
            <div>
              <p className="text-sm text-[#8b95a8] mb-1">Implied Valuation</p>
              <p className="text-2xl font-semibold text-black dark:text-white">
                {formatImpliedValuation(currentValuation)}
              </p>
              {totalVolume != null && totalVolume > 0 && (
                <p className="text-xs text-[#8b95a8] mt-1">
                  Volume: {formatVolume(totalVolume)}
                </p>
              )}
            </div>
          </div>
          {/* Right: No IPO */}
          {history[history.length - 1]?.noIpoProbability != null && (
            <div className="text-right">
              <p className="text-sm text-[#8b95a8] mb-1">No IPO</p>
              <p className="text-2xl font-semibold text-black dark:text-white">
                {formatProbability(history[history.length - 1].noIpoProbability ?? null)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
