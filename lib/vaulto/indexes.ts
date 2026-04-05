import { unstable_cache } from "next/cache";
import type { PrivateCompany } from "./companies";
import { getCurrentPrice, getDailyChange } from "./companyUtils";

// Use the Railway API URL directly for indexes endpoint (separate from public API dashboard)
const VAULTO_DATA_API_URL = "https://vaulto-api-production.up.railway.app";

/** Individual holding within an index */
export interface IndexHolding {
  companyName: string;
  weight: number; // e.g., 0.2324 = 23.24%
  isCash?: boolean; // For "Cash & cash equivalents"
}

/** Vaulto Index product */
export interface VaultoIndex {
  id: string;
  symbol: string; // "RVI" or "VCX"
  name: string; // Full name
  description: string;
  issuer: string; // "Robinhood" or "Fundrise"
  holdings: IndexHolding[];
}

/** Real-time index price data from the API */
export interface IndexPriceData {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  timestamp: string;
}

/** Map of symbol to price data */
export type IndexPricesMap = Record<string, IndexPriceData>;

/** Available Vaulto indexes */
export const VAULTO_INDEXES: VaultoIndex[] = [
  {
    id: "rvi",
    symbol: "RVI",
    name: "Robinhood Venture Index",
    description: "A diversified index of high-growth private companies curated by Robinhood.",
    issuer: "Robinhood",
    holdings: [
      { companyName: "Databricks", weight: 0.2324 },
      { companyName: "Revolut", weight: 0.143 },
      { companyName: "Mercor", weight: 0.1423 },
      { companyName: "Airwallex", weight: 0.0711 },
      { companyName: "Boom Supersonic", weight: 0.0711 },
      { companyName: "Oura", weight: 0.0711 },
      { companyName: "Ramp", weight: 0.0711 },
      { companyName: "Cash & cash equivalents", weight: 0.1978, isCash: true },
    ],
  },
  {
    id: "vcx",
    symbol: "VCX",
    name: "Fundrise Venture Capital Index",
    description: "A concentrated portfolio of leading AI and technology private companies.",
    issuer: "Fundrise",
    holdings: [
      { companyName: "Anthropic", weight: 0.207 },
      { companyName: "Databricks", weight: 0.177 },
      { companyName: "OpenAI", weight: 0.099 },
      { companyName: "Anduril Industries", weight: 0.069 },
      { companyName: "Ramp", weight: 0.051 },
      { companyName: "SpaceX", weight: 0.05 },
      { companyName: "Epic Games", weight: 0.035 },
      { companyName: "Flock Safety", weight: 0.03 },
      { companyName: "dbt Labs", weight: 0.028 },
      { companyName: "Vanta", weight: 0.019 },
    ],
  },
];

/**
 * Calculate the weighted average price for an index based on its holdings.
 * Holdings that are not found in the companies list or are cash are excluded.
 */
export function getIndexPrice(
  index: VaultoIndex,
  companies: PrivateCompany[]
): number {
  let totalPrice = 0;
  let totalWeight = 0;

  for (const holding of index.holdings) {
    if (holding.isCash) continue;

    const company = companies.find(
      (c) => c.name.toLowerCase() === holding.companyName.toLowerCase()
    );

    if (company) {
      const price = getCurrentPrice(company);
      totalPrice += price * holding.weight;
      totalWeight += holding.weight;
    }
  }

  // Normalize to account for missing companies or cash
  return totalWeight > 0 ? totalPrice / totalWeight : 0;
}

/**
 * Calculate the weighted average daily change for an index.
 * Returns { changePercent, isPositive }
 */
export function getIndexChange(
  index: VaultoIndex,
  companies: PrivateCompany[]
): { changePercent: number; isPositive: boolean } {
  let weightedChangeSum = 0;
  let totalWeight = 0;

  for (const holding of index.holdings) {
    if (holding.isCash) continue;

    const company = companies.find(
      (c) => c.name.toLowerCase() === holding.companyName.toLowerCase()
    );

    if (company) {
      const { changePercent, isPositive } = getDailyChange(company);
      const signedChange = isPositive ? changePercent : -changePercent;
      weightedChangeSum += signedChange * holding.weight;
      totalWeight += holding.weight;
    }
  }

  const avgChange = totalWeight > 0 ? weightedChangeSum / totalWeight : 0;

  return {
    changePercent: Math.abs(avgChange),
    isPositive: avgChange >= 0,
  };
}

/**
 * Get the top N holdings by weight (excluding cash).
 */
export function getTopHoldings(
  index: VaultoIndex,
  count: number = 5
): IndexHolding[] {
  return index.holdings
    .filter((h) => !h.isCash)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, count);
}

/**
 * Fetch real-time index prices from the Vaulto API (Alpha Vantage).
 * Returns a map of symbol -> price data.
 */
async function fetchIndexPricesUncached(): Promise<IndexPricesMap> {
  try {
    const apiKey = process.env.VAULTO_API_TOKEN;
    if (!apiKey) {
      console.error("Missing VAULTO_API_TOKEN environment variable");
      return {};
    }

    const res = await fetch(`${VAULTO_DATA_API_URL}/api/indexes`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      next: { revalidate: 60 }, // 1 minute cache
    });

    if (!res.ok) {
      console.error(`Index prices API error: ${res.status} ${res.statusText}`);
      return {};
    }

    const json = await res.json() as {
      success: boolean;
      data: IndexPriceData[];
    };

    if (!json.success || !json.data) {
      return {};
    }

    // Convert array to map
    const pricesMap: IndexPricesMap = {};
    for (const item of json.data) {
      pricesMap[item.symbol] = item;
    }

    return pricesMap;
  } catch (error) {
    console.error("Failed to fetch index prices:", error);
    return {};
  }
}

/** Cache tag for on-demand revalidation */
export const INDEX_PRICES_CACHE_TAG = "vaulto-index-prices";

/**
 * Cached fetch for index prices (1 min cache).
 */
export async function getIndexPrices(): Promise<IndexPricesMap> {
  return unstable_cache(
    fetchIndexPricesUncached,
    ["vaulto-index-prices"],
    { revalidate: 60, tags: [INDEX_PRICES_CACHE_TAG] }
  )();
}

/**
 * Get an index by its symbol (case-insensitive).
 */
export function getIndexBySymbol(symbol: string): VaultoIndex | undefined {
  return VAULTO_INDEXES.find(
    (idx) => idx.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

/** Historical price point for an index */
export interface IndexHistoryPoint {
  date: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

/**
 * Fetch historical price data for an index.
 * @param symbol - Index symbol (e.g., "RVI", "VCX")
 * @param limit - Number of days of history to fetch (default: 30)
 */
async function fetchIndexHistoryUncached(
  symbol: string,
  limit: number = 30
): Promise<IndexHistoryPoint[]> {
  try {
    const apiKey = process.env.VAULTO_API_TOKEN;
    if (!apiKey) {
      console.error("Missing VAULTO_API_TOKEN environment variable");
      return [];
    }

    const res = await fetch(
      `${VAULTO_DATA_API_URL}/api/indexes/${symbol.toUpperCase()}/history?limit=${limit}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        next: { revalidate: 300 }, // 5 minute cache
      }
    );

    if (!res.ok) {
      console.error(`Index history API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const json = (await res.json()) as {
      success: boolean;
      data: {
        symbol: string;
        history: IndexHistoryPoint[];
        count: number;
      };
    };

    if (!json.success || !json.data?.history) {
      return [];
    }

    // API returns newest first, but chart expects oldest first - reverse the array
    return json.data.history.slice().reverse();
  } catch (error) {
    console.error("Failed to fetch index history:", error);
    return [];
  }
}

/** Cache tag for index history */
export const INDEX_HISTORY_CACHE_TAG = "vaulto-index-history";

/**
 * Cached fetch for index historical data.
 */
export async function getIndexHistory(
  symbol: string,
  limit: number = 30
): Promise<IndexHistoryPoint[]> {
  return unstable_cache(
    () => fetchIndexHistoryUncached(symbol, limit),
    [`vaulto-index-history-${symbol.toLowerCase()}-${limit}`],
    { revalidate: 300, tags: [INDEX_HISTORY_CACHE_TAG] }
  )();
}
