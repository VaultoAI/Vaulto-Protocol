/**
 * Implied Valuation Data Fetching Utilities
 * Fetches historical and current implied valuations from Vaulto API
 */

import { unstable_cache } from "next/cache";

// ============================================================================
// Valuation Validation Utilities
// ============================================================================

/**
 * Absolute bounds for implied valuations.
 * Values outside this range are definitely invalid.
 */
export const VALUATION_BOUNDS = {
  /** Minimum valid valuation: $1M */
  MIN: 1_000_000,
  /** Maximum valid valuation: $5T (above any realistic IPO) */
  MAX: 5_000_000_000_000,
} as const;

/**
 * IQR multiplier for outlier detection.
 * Standard box plot uses 1.5, we use 1.5 for aggressive filtering.
 */
const IQR_MULTIPLIER = 1.5;

/**
 * Check if a valuation is valid (finite and within absolute bounds).
 * This is a basic check - use filterValidHistoryPoints for outlier detection.
 */
export function isValidValuation(value: unknown): value is number {
  if (value === null || value === undefined) return false;
  if (typeof value !== "number") return false;
  if (!Number.isFinite(value)) return false;
  if (value <= 0) return false;
  if (value < VALUATION_BOUNDS.MIN || value > VALUATION_BOUNDS.MAX) return false;
  return true;
}

/**
 * Calculate quartiles (Q1, Q2/median, Q3) and IQR for an array of numbers.
 */
function calculateQuartiles(values: number[]): {
  q1: number;
  median: number;
  q3: number;
  iqr: number;
} {
  if (values.length === 0) return { q1: 0, median: 0, q3: 0, iqr: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const median =
    n % 2 !== 0 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

  const q1Index = Math.floor(n / 4);
  const q3Index = Math.floor((3 * n) / 4);

  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  return { q1, median, q3, iqr };
}

/**
 * Filter an array of history points to remove invalid and outlier valuations.
 * Uses IQR-based outlier detection (standard box plot method):
 * 1. Remove values outside absolute bounds ($1M - $5T)
 * 2. Remove statistical outliers outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR]
 */
export function filterValidHistoryPoints(
  history: ImpliedValuationHistoryPoint[],
  options?: { logWarnings?: boolean; companySlug?: string }
): ImpliedValuationHistoryPoint[] {
  if (!history || history.length === 0) return [];

  // Step 1: Filter by absolute bounds
  const boundFiltered = history.filter((point) => isValidValuation(point.value));

  if (boundFiltered.length < 4) {
    // Not enough data for IQR analysis (need at least 4 points for quartiles)
    // Apply basic mean deviation check for small datasets
    if (boundFiltered.length >= 2) {
      const values = boundFiltered.map((p) => p.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      // Remove points that deviate more than 100% from mean
      return boundFiltered.filter((p) => Math.abs(p.value - mean) / mean <= 1.0);
    }
    return boundFiltered;
  }

  // Step 2: Calculate IQR and filter outliers
  const values = boundFiltered.map((p) => p.value);
  const { q1, median, q3, iqr } = calculateQuartiles(values);

  // Use IQR method: outliers are outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR]
  const lowerBound = q1 - IQR_MULTIPLIER * iqr;
  const upperBound = q3 + IQR_MULTIPLIER * iqr;

  const filtered = boundFiltered.filter(
    (point) => point.value >= lowerBound && point.value <= upperBound
  );

  // Log warnings if filtering occurred
  if (options?.logWarnings && filtered.length !== history.length) {
    const removedCount = history.length - filtered.length;
    const outlierValues = history
      .filter((point) => {
        if (!isValidValuation(point.value)) return true;
        return point.value < lowerBound || point.value > upperBound;
      })
      .map((point) => point.value);

    console.warn(
      `[implied-valuations] Filtered ${removedCount} outliers` +
        (options.companySlug ? ` for ${options.companySlug}` : "") +
        `. IQR bounds: $${(lowerBound / 1e9).toFixed(1)}B - $${(upperBound / 1e9).toFixed(1)}B` +
        `. Removed: ${outlierValues.slice(0, 3).map((v) => `$${(v / 1e9).toFixed(1)}B`).join(", ")}` +
        (outlierValues.length > 3 ? ` +${outlierValues.length - 3} more` : "")
    );
  }

  return filtered;
}

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
  endDate?: string | null;
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
  endDate?: string | null;
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
  endDate?: string | null;
}

/** Response from /api/implied-valuations */
export interface AllImpliedValuationsResponse {
  companies: ImpliedValuationSummary[];
  count: number;
  timestamp: string;
}

export type TimeRange = "1D" | "1W" | "1M" | "3M" | "ALL";

/**
 * Map of vaulto company slug → canonical Polymarket event slug.
 * Used as a fallback path to fetch endDate directly from Polymarket when the
 * vaulto-api response is missing it.
 */
const POLYMARKET_EVENT_SLUG_MAP: Record<string, string> = {
  spacex: "spacex-ipo-closing-market-cap",
  openai: "openai-ipo-closing-market-cap",
  anthropic: "anthropic-ipo-closing-market-cap-119",
  perplexity: "perplexity-ipo-closing-market-cap",
  stripe: "stripe-ipo-closing-market-cap",
  discord: "discord-ipo-closing-market-cap",
  databricks: "databricks-ipo-closing-market-cap",
  strava: "strava-ipo-closing-market-cap",
  "fannie-mae": "fannie-mae-ipo-closing-market-cap",
  "freddie-mac": "freddie-mac-ipo-closing-market-cap",
  "clear-street-group": "clear-street-group-ipo-closing-market-cap",
  "liftoff-mobile": "liftoff-mobile-ipo-closing-market-cap",
  kraken: "kraken-ipo-closing-market-cap-above",
  megaeth: "megaeth-market-cap-fdv-one-day-after-launch",
};

export async function fetchPolymarketEndDate(
  companySlug: string
): Promise<string | null> {
  const eventSlug = POLYMARKET_EVENT_SLUG_MAP[companySlug];
  if (!eventSlug) return null;
  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/events/slug/${eventSlug}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { endDate?: string | null };
    return data.endDate ?? null;
  } catch {
    return null;
  }
}

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

    const data = (await res.json()) as ImpliedValuationHistoryResponse;

    // Filter out invalid/outlier values before returning
    const filteredHistory = filterValidHistoryPoints(data.history ?? [], {
      logWarnings: true,
      companySlug,
    });

    let endDate = data.endDate ?? null;
    if (!endDate) {
      endDate =
        (await fetchPolymarketEndDate(companySlug)) ??
        IPO_MARKET_END_DATES[companySlug] ??
        null;
    }

    return {
      ...data,
      history: filteredHistory,
      dataPoints: filteredHistory.length,
      endDate,
    };
  } catch (error) {
    console.error("Failed to fetch implied valuation history:", error);
    return null;
  }
}

/**
 * Cache version - increment to invalidate stale unfiltered data
 */
const HISTORY_CACHE_VERSION = "v3";

/**
 * Cached fetch for implied valuation history (5 min cache)
 */
export async function getImpliedValuationHistory(
  companySlug: string,
  range: TimeRange = "ALL"
): Promise<ImpliedValuationHistoryResponse | null> {
  return unstable_cache(
    () => fetchImpliedValuationHistoryUncached(companySlug, range),
    [`implied-valuation-history-${companySlug}-${range}-${HISTORY_CACHE_VERSION}`],
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

    const data = (await res.json()) as ImpliedValuationResponse;
    let endDate = data.endDate ?? null;
    if (!endDate) {
      endDate =
        (await fetchPolymarketEndDate(companySlug)) ??
        IPO_MARKET_END_DATES[companySlug] ??
        null;
    }
    return { ...data, endDate };
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
 * Fallback map of company slugs to their Polymarket IPO market resolution
 * dates. Used only when the vaulto-api response (which mirrors Polymarket's
 * authoritative `endDate`) does not include one. Values mirror Polymarket as
 * of the last manual sync; the API is the source of truth.
 */
export const IPO_MARKET_END_DATES: Record<string, string> = {
  openai: "2026-12-31",
  anthropic: "2027-12-31",
  perplexity: "2027-12-31",
  stripe: "2026-06-30",
  discord: "2026-06-30",
  databricks: "2026-06-30",
  strava: "2027-12-31",
  "fannie-mae": "2026-06-30",
  "freddie-mac": "2026-06-30",
  "clear-street-group": "2026-03-31",
  "liftoff-mobile": "2026-03-31",
  kraken: "2027-01-01",
  megaeth: "2026-07-01",
};

/**
 * Get the IPO market expiry date for a company slug
 */
export function getIPOMarketEndDate(companySlug: string): string | null {
  return IPO_MARKET_END_DATES[companySlug] ?? null;
}

/**
 * Format the IPO market expiry date for display.
 * Renders the calendar date in UTC so an ISO timestamp at midnight UTC does
 * not display as the previous day for users west of UTC.
 */
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatIPOExpiryDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  // Parse the calendar date directly from the leading YYYY-MM-DD portion of
  // the ISO string. This sidesteps timezone conversion entirely so a
  // midnight-UTC resolution date does not display as the previous day for
  // users west of UTC. The Polymarket resolution date is the calendar date.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return "—";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return "—";
  return `${MONTH_ABBR[month - 1]} ${day}, ${year}`;
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

/**
 * Resolve a company display name from an event slug like
 * "discord-ipo-closing-market-cap" or "fannie-mae-ipo-closing-market-cap".
 * Returns null if no known company prefix matches.
 */
export function getCompanyFromEventSlug(eventSlug: string | undefined | null): string | null {
  if (!eventSlug) return null;
  const slug = eventSlug.toLowerCase();
  let bestMatch: { name: string; len: number } | null = null;
  for (const [name, companySlug] of Object.entries(COMPANY_SLUG_MAP)) {
    if (slug === companySlug || slug.startsWith(`${companySlug}-`)) {
      if (!bestMatch || companySlug.length > bestMatch.len) {
        bestMatch = { name, len: companySlug.length };
      }
    }
  }
  return bestMatch?.name ?? null;
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
 * Filters out invalid values before calculating.
 */
function calculate24hChange(
  history: ImpliedValuationHistoryPoint[]
): { changePercent: number; isPositive: boolean } | null {
  if (!history || history.length < 2) return null;

  // Filter to only valid valuations
  const validHistory = filterValidHistoryPoints(history);
  if (validHistory.length < 2) return null;

  const oldest = validHistory[0].value;
  const latest = validHistory[validHistory.length - 1].value;

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
