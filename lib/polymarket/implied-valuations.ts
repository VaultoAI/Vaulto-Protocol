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

/** Response from /api/implied-valuations/:companySlug/history */
export interface ImpliedValuationHistoryResponse {
  companySlug: string;
  companyName: string;
  currentValuation: number | null;
  history: ImpliedValuationHistoryPoint[];
  range: string;
  dataPoints: number;
  category: string;
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

const VAULTO_API_URL =
  process.env.NEXT_PUBLIC_VAULTO_API_URL || "https://api.vaulto.ai";

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

    const url = `${VAULTO_API_URL}/api/implied-valuations/${companySlug}/history?range=${range}`;
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

    const url = `${VAULTO_API_URL}/api/implied-valuations/${companySlug}`;
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

    const url = `${VAULTO_API_URL}/api/implied-valuations`;
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
  "Clear Street Group": "clear-street-group",
  "Liftoff Mobile": "liftoff-mobile",
  Kraken: "kraken",
  Consensys: "consensys",
  Ledger: "ledger",
  MegaETH: "megaeth",
};

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
