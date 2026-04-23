/**
 * Implied Valuation Data Fetching Utilities
 * Fetches historical and current implied valuations from Vaulto API
 */

import { unstable_cache } from "next/cache";

/** Band breakdown for display */
export interface BandBreakdown {
  label: string;
  midpoint: number;
  probability: number;
  contribution: number;
  isNoIpo: boolean;
}

/** Single history data point */
export interface ImpliedValuationHistoryPoint {
  timestamp: string;
  value: number;
  noIpoProbability?: number | null;
}

/** Metadata for frontend decision making */
export interface ImpliedValuationMetadata {
  marketAgeHours: number;
  oldestDatapoint: string | null;
  sufficientDataForRange: boolean;
}

/** Response from /api/implied-valuations/:companySlug/history */
export interface ImpliedValuationHistoryResponse {
  companySlug: string;
  companyName: string;
  currentValuation: number | null;
  history: ImpliedValuationHistoryPoint[];
  range: string;
  dataPoints: number;
  category: string;
  metadata?: ImpliedValuationMetadata;
  totalVolume?: number | null;
}

/** Response from /api/implied-valuations/:companySlug */
export interface ImpliedValuationResponse {
  companySlug: string;
  companyName: string;
  impliedValuationUsd: number;
  noIpoProbability: number | null;
  bandBreakdown: BandBreakdown[];
  totalVolume: number | null;
  eventSlug: string;
  timestamp: string;
  category: string;
  marketType: string;
}

/** Company summary from /api/implied-valuations */
export interface ImpliedValuationSummary {
  companySlug: string;
  companyName: string;
  impliedValuationUsd: number;
  noIpoProbability: number | null;
  totalVolume: number | null;
  timestamp: string;
  category: string;
}

/** Response from /api/implied-valuations */
export interface AllImpliedValuationsResponse {
  companies: ImpliedValuationSummary[];
  count: number;
  timestamp: string;
}

export type TimeRange = "1D" | "1W" | "1M" | "3M" | "ALL";

const IMPLIED_VALUATIONS_API_URL =
  process.env.NEXT_PUBLIC_IMPLIED_VALUATIONS_API_URL ||
  process.env.NEXT_PUBLIC_VAULTO_API_URL ||
  "https://api.vaulto.ai";

/**
 * Fetch implied valuation history for a company
 */
async function fetchImpliedValuationHistoryUncached(
  companySlug: string,
  range: TimeRange = "ALL"
): Promise<ImpliedValuationHistoryResponse | null> {
  try {
    const apiKey = process.env.VAULTO_API_TOKEN;
    if (!apiKey) {
      console.error("Missing VAULTO_API_TOKEN environment variable");
      return null;
    }

    const url = `${IMPLIED_VALUATIONS_API_URL}/api/implied-valuations/${companySlug}/history?range=${range}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      next: { revalidate: 300 }, // 5 minutes
    });

    if (!res.ok) {
      console.error(`Implied valuations API error: ${res.status} ${res.statusText}`);
      return null;
    }

    return (await res.json()) as ImpliedValuationHistoryResponse;
  } catch (error) {
    console.error("Failed to fetch implied valuation history:", error);
    return null;
  }
}

/**
 * Cached fetch for implied valuation history (5 min cache)
 */
export async function getImpliedValuationHistory(
  companySlug: string,
  range: TimeRange = "ALL"
): Promise<ImpliedValuationHistoryResponse | null> {
  return unstable_cache(
    () => fetchImpliedValuationHistoryUncached(companySlug, range),
    [`implied-valuation-history-${companySlug}-${range}`],
    { revalidate: 300 }
  )();
}

/**
 * Fetch current implied valuation for a company
 */
async function fetchImpliedValuationUncached(
  companySlug: string
): Promise<ImpliedValuationResponse | null> {
  try {
    const apiKey = process.env.VAULTO_API_TOKEN;
    if (!apiKey) {
      console.error("Missing VAULTO_API_TOKEN environment variable");
      return null;
    }

    const url = `${IMPLIED_VALUATIONS_API_URL}/api/implied-valuations/${companySlug}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      next: { revalidate: 300 }, // 5 minutes
    });

    if (!res.ok) {
      console.error(`Implied valuations API error: ${res.status} ${res.statusText}`);
      return null;
    }

    return (await res.json()) as ImpliedValuationResponse;
  } catch (error) {
    console.error("Failed to fetch implied valuation:", error);
    return null;
  }
}

/**
 * Cached fetch for current implied valuation (5 min cache)
 */
export async function getImpliedValuation(
  companySlug: string
): Promise<ImpliedValuationResponse | null> {
  return unstable_cache(
    () => fetchImpliedValuationUncached(companySlug),
    [`implied-valuation-${companySlug}`],
    { revalidate: 300 }
  )();
}

/**
 * Fetch all companies' implied valuations
 */
async function fetchAllImpliedValuationsUncached(): Promise<AllImpliedValuationsResponse | null> {
  try {
    const apiKey = process.env.VAULTO_API_TOKEN;
    if (!apiKey) {
      console.error("Missing VAULTO_API_TOKEN environment variable");
      return null;
    }

    const url = `${IMPLIED_VALUATIONS_API_URL}/api/implied-valuations`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      next: { revalidate: 300 }, // 5 minutes
    });

    if (!res.ok) {
      console.error(`Implied valuations API error: ${res.status} ${res.statusText}`);
      return null;
    }

    return (await res.json()) as AllImpliedValuationsResponse;
  } catch (error) {
    console.error("Failed to fetch all implied valuations:", error);
    return null;
  }
}

/**
 * Cached fetch for all implied valuations (5 min cache)
 */
export async function getAllImpliedValuations(): Promise<AllImpliedValuationsResponse | null> {
  return unstable_cache(
    fetchAllImpliedValuationsUncached,
    ["all-implied-valuations"],
    { revalidate: 300 }
  )();
}

/**
 * Format implied valuation for display
 */
export function formatImpliedValuation(valueUsd: number): string {
  if (!Number.isFinite(valueUsd) || valueUsd === 0) return "—";
  if (valueUsd >= 1_000_000_000_000) {
    return `$${(valueUsd / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (valueUsd >= 1_000_000_000) {
    return `$${(valueUsd / 1_000_000_000).toFixed(1)}B`;
  }
  if (valueUsd >= 1_000_000) {
    return `$${(valueUsd / 1_000_000).toFixed(1)}M`;
  }
  return `$${valueUsd.toFixed(0)}`;
}

/**
 * Format probability as percentage
 */
export function formatProbability(probability: number | null): string {
  if (probability === null || !Number.isFinite(probability)) return "—";
  return `${(probability * 100).toFixed(1)}%`;
}

/**
 * Format volume for display (e.g., $1.2M, $500K)
 */
export function formatVolume(volume: number | null | undefined): string {
  if (volume === null || volume === undefined || !Number.isFinite(volume) || volume === 0) return "—";
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(1)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

/**
 * Map of company names to their slugs for implied valuations
 */
export const COMPANY_SLUG_MAP: Record<string, string> = {
  SpaceX: "spacex",
  OpenAI: "openai",
  Anthropic: "anthropic",
  Perplexity: "perplexity",
  Stripe: "stripe",
  Discord: "discord",
  Databricks: "databricks",
  Strava: "strava",
  "Fannie Mae": "fannie-mae",
  "Freddie Mac": "freddie-mac",
  "Clear Street": "clear-street-group",
  "Liftoff Mobile": "liftoff-mobile",
  Kraken: "kraken",
  Consensys: "consensys",
  Ledger: "ledger",
  MegaETH: "megaeth",
};

/**
 * Map of company slugs to their Polymarket IPO market expiry dates
 * These are the resolution dates for the "Will X IPO by end of 2025?" markets
 */
export const IPO_MARKET_END_DATES: Record<string, string> = {
  spacex: "2026-01-01",
  openai: "2026-01-01",
  anthropic: "2026-01-01",
  perplexity: "2026-01-01",
  stripe: "2026-01-01",
  discord: "2026-01-01",
  databricks: "2026-01-01",
  strava: "2026-01-01",
  "fannie-mae": "2026-01-01",
  "freddie-mac": "2026-01-01",
  "clear-street-group": "2026-01-01",
  "liftoff-mobile": "2026-01-01",
  kraken: "2026-01-01",
  consensys: "2026-01-01",
  ledger: "2026-01-01",
  megaeth: "2026-01-01",
};

/**
 * Get the IPO market expiry date for a company slug
 */
export function getIPOMarketEndDate(companySlug: string): string | null {
  return IPO_MARKET_END_DATES[companySlug] ?? null;
}

/**
 * Format the IPO market expiry date for display
 */
export function formatIPOExpiryDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

/**
 * Get company slug for implied valuations from company name
 */
export function getImpliedValuationSlug(companyName: string): string | null {
  return COMPANY_SLUG_MAP[companyName] ?? null;
}

/**
 * Check if a company has implied valuation data available
 */
export function hasImpliedValuationData(companyName: string): boolean {
  return companyName in COMPANY_SLUG_MAP;
}

/** 24hr price change data for a company */
export interface PriceChange24h {
  companyName: string;
  changePercent: number;
  isPositive: boolean;
}

/** Map of company name to 24hr price change data */
export type PriceChangesMap = Record<string, PriceChange24h>;

/**
 * Calculate 24hr change from valuation history.
 * Uses the first and last data points from the 1D history.
 */
function calculate24hChange(
  history: ImpliedValuationHistoryPoint[]
): { changePercent: number; isPositive: boolean } | null {
  if (!history || history.length < 2) return null;

  const oldest = history[0].value;
  const latest = history[history.length - 1].value;

  if (oldest <= 0) return null;

  const changePercent = ((latest - oldest) / oldest) * 100;
  return {
    changePercent: Math.abs(Math.round(changePercent * 100) / 100),
    isPositive: changePercent >= 0,
  };
}

/**
 * Fetch 24hr price changes for all companies with implied valuation data.
 * Returns a map of company name to change data.
 */
async function fetch24hPriceChangesUncached(): Promise<PriceChangesMap> {
  const priceChanges: PriceChangesMap = {};
  const apiKey = process.env.VAULTO_API_TOKEN;

  if (!apiKey) {
    console.error("Missing VAULTO_API_TOKEN environment variable");
    return priceChanges;
  }

  // Fetch 1D history for all companies in parallel
  const companyEntries = Object.entries(COMPANY_SLUG_MAP);
  const results = await Promise.allSettled(
    companyEntries.map(async ([companyName, slug]) => {
      try {
        const url = `${IMPLIED_VALUATIONS_API_URL}/api/implied-valuations/${slug}/history?range=1D`;
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          next: { revalidate: 300 },
        });

        if (!res.ok) return null;

        const data = (await res.json()) as ImpliedValuationHistoryResponse;
        const change = calculate24hChange(data.history);

        if (change) {
          return {
            companyName,
            ...change,
          };
        }
        return null;
      } catch {
        return null;
      }
    })
  );

  // Build the map from successful results
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      priceChanges[result.value.companyName] = result.value;
    }
  }

  return priceChanges;
}

/** Cache tag for 24hr price changes */
export const PRICE_CHANGES_24H_CACHE_TAG = "price-changes-24h";

/**
 * Cached fetch for 24hr price changes (5 min cache).
 */
export async function get24hPriceChanges(): Promise<PriceChangesMap> {
  return unstable_cache(
    fetch24hPriceChangesUncached,
    ["price-changes-24h"],
    { revalidate: 300, tags: [PRICE_CHANGES_24H_CACHE_TAG] }
  )();
}
