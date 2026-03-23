"use client";

import type { PrivateCompany } from "@/lib/vaulto/companies";

/**
 * Generate a deterministic pseudo-random number from a string seed.
 * Used to simulate 24H price changes for pre-IPO companies.
 */
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  // Return a value between 0 and 1
  return Math.abs(Math.sin(hash) * 10000) % 1;
}

/**
 * Extract real post-money valuation data points from a company's funding history.
 * Returns an array of { date, valuation } sorted chronologically, filtering out
 * rounds that don't have postMoneyValuationUsd.
 */
export function getValuationHistory(company: PrivateCompany): { date: string; valuation: number }[] {
  if (!company.fundingHistory || company.fundingHistory.length === 0) return [];

  return company.fundingHistory
    .filter((round) => round.postMoneyValuationUsd != null && round.postMoneyValuationUsd > 0)
    .map((round) => ({
      date: round.date,
      valuation: round.postMoneyValuationUsd as number,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Compute the real valuation change between the last two funding rounds.
 * Returns { changeAmount, changePercent, isPositive }.
 * If there's only one round, falls back to a deterministic simulated change.
 */
export function getDailyChange(company: PrivateCompany) {
  const history = getValuationHistory(company);

  if (history.length >= 2) {
    const latest = history[history.length - 1].valuation;
    const previous = history[history.length - 2].valuation;
    const diff = latest - previous;
    const percentChange = previous > 0 ? Math.abs(diff / previous) * 100 : 0;

    // Scale the valuation change to a per-share price change
    const price = company.lastFundingEstPricePerShareUsd ?? getLatestPostMoneyValuation(company) / 1_000_000_000;
    const priceChange = price * (percentChange / 100);

    return {
      changeAmount: Math.round(priceChange * 100) / 100,
      changePercent: Math.round(percentChange * 100) / 100,
      isPositive: diff >= 0,
    };
  }

  // Fallback for companies with fewer than 2 valuation data points
  const today = new Date().toISOString().split("T")[0];
  const seed = `${company.name}-${today}`;
  const rand = seededRandom(seed);
  const rand2 = seededRandom(seed + "-dir");

  const isPositive = rand2 > 0.45;
  const percentChange = 0.5 + rand * 7;
  const price = company.lastFundingEstPricePerShareUsd ?? getLatestPostMoneyValuation(company) / 1_000_000_000;
  const changeAmount = price * (percentChange / 100);

  return {
    changeAmount: Math.round(changeAmount * 100) / 100,
    changePercent: Math.round(percentChange * 100) / 100,
    isPositive,
  };
}

/**
 * Get the most recent post-money valuation from funding history.
 * Falls back to company.valuationUsd if no funding history exists.
 */
function getLatestPostMoneyValuation(company: PrivateCompany): number {
  const history = getValuationHistory(company);
  if (history.length > 0) {
    return history[history.length - 1].valuation;
  }
  return company.valuationUsd;
}

/**
 * Get current price (base price from latest funding data).
 * For companies without a price per share from the API,
 * uses the most recent post-money valuation / 1 billion.
 */
export function getCurrentPrice(company: PrivateCompany): number {
  return company.lastFundingEstPricePerShareUsd ?? getLatestPostMoneyValuation(company) / 1_000_000_000;
}

/**
 * Format price with $ and appropriate decimals.
 * Large prices (>=10,000) use compact notation to stay readable.
 */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "$0.00";
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 10_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  if (value >= 1000) {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Format market cap for display
 */
export function formatMarketCap(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "--";
  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}T`;
  }
  if (value >= 1_000_000_000) {
    const formatted = Math.round(value / 1_000_000).toLocaleString("en-US");
    return `$${formatted}`;
  }
  if (value >= 1_000_000) {
    const formatted = Math.round(value / 1_000).toLocaleString("en-US");
    return `$${formatted}`;
  }
  return `$${value.toLocaleString("en-US")}`;
}

/**
 * Extract real post-money valuation data as sparkline chart points.
 * Uses actual fundingHistory postMoneyValuationUsd values.
 * Applies Catmull-Rom spline interpolation between real data points
 * for a smooth chart curve.
 *
 * Returns null if there are fewer than 2 data points with valuation data.
 */
export function getValuationSparkline(company: PrivateCompany, numPoints: number = 48): number[] | null {
  const history = getValuationHistory(company);

  if (history.length < 2) return null;

  const anchors = history.map((h) => h.valuation);

  // If only 2 points, return them directly (line between two points)
  if (anchors.length === 2) {
    const points: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      points.push(anchors[0] + (anchors[1] - anchors[0]) * t);
    }
    return points;
  }

  // Catmull-Rom spline interpolation for smooth curves through real data points
  const anchorCount = anchors.length;
  const points: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const scaledT = t * (anchorCount - 1);
    const idx = Math.min(Math.floor(scaledT), anchorCount - 2);
    const frac = scaledT - idx;

    const p0 = anchors[Math.max(idx - 1, 0)];
    const p1 = anchors[idx];
    const p2 = anchors[Math.min(idx + 1, anchorCount - 1)];
    const p3 = anchors[Math.min(idx + 2, anchorCount - 1)];

    // Catmull-Rom formula
    const v = frac;
    const v2 = v * v;
    const v3 = v2 * v;
    const value =
      0.5 * (
        (2 * p1) +
        (-p0 + p2) * v +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * v2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * v3
      );

    points.push(value);
  }

  return points;
}

/**
 * Sort companies by valuation (descending) and return top N
 */
export function getTopCompanies(companies: PrivateCompany[], count: number = 3): PrivateCompany[] {
  return [...companies]
    .sort((a, b) => b.valuationUsd - a.valuationUsd)
    .slice(0, count);
}

/**
 * Get "Top Gainers" - companies with highest positive daily change
 */
export function getTopGainers(companies: PrivateCompany[], count: number = 3): PrivateCompany[] {
  return [...companies]
    .map((c) => ({ company: c, change: getDailyChange(c) }))
    .filter((item) => item.change.isPositive)
    .sort((a, b) => b.change.changePercent - a.change.changePercent)
    .slice(0, count)
    .map((item) => item.company);
}

/**
 * Get "Trending" - companies with highest valuation (most market activity)
 */
export function getTrending(companies: PrivateCompany[], count: number = 3): PrivateCompany[] {
  return [...companies]
    .sort((a, b) => b.valuationUsd - a.valuationUsd)
    .slice(0, count);
}

/**
 * Get "Newly Added" - simulate based on last funding date
 */
export function getNewlyAdded(companies: PrivateCompany[], count: number = 3): PrivateCompany[] {
  return [...companies]
    .sort((a, b) => new Date(b.lastFundingDate).getTime() - new Date(a.lastFundingDate).getTime())
    .slice(0, count);
}

/**
 * Industry categories for filtering
 */
export const CATEGORIES = [
  "All assets",
  "Technology",
  "AI & ML",
  "Aerospace",
  "Fintech",
  "Consumer",
  "Enterprise",
] as const;

export type Category = typeof CATEGORIES[number];

/**
 * Map company industry to our categories
 */
export function getCompanyCategory(company: PrivateCompany): Category[] {
  const industry = company.industry.toLowerCase();
  const categories: Category[] = ["All assets"];

  if (industry.includes("tech") || industry.includes("software") || industry.includes("data")) {
    categories.push("Technology");
  }
  if (industry.includes("ai") || industry.includes("artificial") || industry.includes("machine learning")) {
    categories.push("AI & ML");
  }
  if (industry.includes("aero") || industry.includes("space") || industry.includes("defense")) {
    categories.push("Aerospace");
  }
  if (industry.includes("fintech") || industry.includes("financial") || industry.includes("payment")) {
    categories.push("Fintech");
  }
  if (industry.includes("health") || industry.includes("bio") || industry.includes("medical")) {
    categories.push("Healthcare");
  }
  if (industry.includes("consumer") || industry.includes("retail") || industry.includes("commerce")) {
    categories.push("Consumer");
  }
  if (industry.includes("enterprise") || industry.includes("saas") || industry.includes("cloud")) {
    categories.push("Enterprise");
  }

  // If no specific category matched, add Technology as default
  if (categories.length === 1) {
    categories.push("Technology");
  }

  return categories;
}
