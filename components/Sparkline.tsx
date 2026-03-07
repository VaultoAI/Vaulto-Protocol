"use client";

import type { PrivateCompany, FundingRound } from "@/lib/vaulto/companies";

/** Props for Sparkline component */
export interface SparklineProps {
  company: PrivateCompany;
  width?: number;
  height?: number;
  strokeWidth?: number;
  color?: string;
}

/** Props for MultiSparkline component */
export interface MultiSparklineProps {
  companies: PrivateCompany[];
  width?: number;
  height?: number;
  strokeWidth?: number;
}

/** Data point for sparkline rendering */
interface DataPoint {
  date: Date;
  value: number;
}

/** Muted color palette for multi-company sparklines */
const COLOR_PALETTE = [
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f59e0b", // amber-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#f97316", // orange-500
];

/** Default styling values */
const DEFAULTS = {
  width: 300,
  height: 48,
  strokeWidth: 1.25,
  padding: 2,
  color: "#6366f1", // indigo-500
};

/** Extract and process valuation data points from funding history */
function extractDataPoints(fundingHistory: FundingRound[]): DataPoint[] {
  return fundingHistory
    .filter((round): round is FundingRound & { postMoneyValuationUsd: number } =>
      round.postMoneyValuationUsd !== undefined && round.postMoneyValuationUsd !== null
    )
    .map((round) => ({
      date: new Date(round.date),
      value: round.postMoneyValuationUsd,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Calculate min and max values from data points */
function getMinMax(points: DataPoint[]): { min: number; max: number } {
  if (points.length === 0) return { min: 0, max: 0 };
  const values = points.map((p) => p.value);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/** Calculate min and max across multiple company data sets */
function getSharedMinMax(allPoints: DataPoint[][]): { min: number; max: number } {
  const allValues = allPoints.flat().map((p) => p.value);
  if (allValues.length === 0) return { min: 0, max: 0 };
  return {
    min: Math.min(...allValues),
    max: Math.max(...allValues),
  };
}

/** Convert data points to SVG polyline coordinates */
function pointsToPolyline(
  points: DataPoint[],
  width: number,
  height: number,
  padding: number,
  minVal: number,
  maxVal: number
): string {
  if (points.length === 0) return "";

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  // Single point: center it
  if (points.length === 1) {
    const x = padding + innerWidth / 2;
    const y = padding + innerHeight / 2;
    return `${x},${y}`;
  }

  // Same valuation for all points: horizontal line
  const valueRange = maxVal - minVal;

  // Get time range
  const minTime = points[0].date.getTime();
  const maxTime = points[points.length - 1].date.getTime();
  const timeRange = maxTime - minTime;

  return points
    .map((point) => {
      // X position based on date
      let x: number;
      if (timeRange === 0) {
        // Same date for all: distribute evenly (vertical stack scenario)
        const index = points.indexOf(point);
        x = padding + (innerWidth * index) / (points.length - 1);
      } else {
        const timeOffset = point.date.getTime() - minTime;
        x = padding + (timeOffset / timeRange) * innerWidth;
      }

      // Y position based on value (inverted: higher value = lower y)
      let y: number;
      if (valueRange === 0) {
        // Same valuation: horizontal line in center
        y = padding + innerHeight / 2;
      } else {
        const valueOffset = point.value - minVal;
        y = padding + innerHeight - (valueOffset / valueRange) * innerHeight;
      }

      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

/** Sparkline for a single company (y-scale: self min-max) */
export function Sparkline({
  company,
  width = DEFAULTS.width,
  height = DEFAULTS.height,
  strokeWidth = DEFAULTS.strokeWidth,
  color = DEFAULTS.color,
}: SparklineProps) {
  const points = extractDataPoints(company.fundingHistory);

  // No data: return null
  if (points.length === 0) return null;

  const { min, max } = getMinMax(points);
  const polylinePoints = pointsToPolyline(
    points,
    width,
    height,
    DEFAULTS.padding,
    min,
    max
  );

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polyline
        points={polylinePoints}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** MultiSparkline for multiple companies (y-scale: shared across all) */
export function MultiSparkline({
  companies,
  width = DEFAULTS.width,
  height = DEFAULTS.height,
  strokeWidth = DEFAULTS.strokeWidth,
}: MultiSparklineProps) {
  // Extract data points for all companies
  const allPoints = companies.map((company) =>
    extractDataPoints(company.fundingHistory)
  );

  // Filter out companies with no data
  const validCompanies = companies.filter(
    (_, index) => allPoints[index].length > 0
  );
  const validPoints = allPoints.filter((points) => points.length > 0);

  // No data for any company: return null
  if (validPoints.length === 0) return null;

  // Calculate shared min/max for consistent scaling
  const { min, max } = getSharedMinMax(validPoints);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {validPoints.map((points, index) => {
        const polylinePoints = pointsToPolyline(
          points,
          width,
          height,
          DEFAULTS.padding,
          min,
          max
        );
        const color = COLOR_PALETTE[index % COLOR_PALETTE.length];

        return (
          <polyline
            key={validCompanies[index]?.id ?? index}
            points={polylinePoints}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );
      })}
    </svg>
  );
}
