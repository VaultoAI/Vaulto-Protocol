import { unstable_cache } from "next/cache";

/** Market category for filtering */
export type MarketCategory = "IPO" | "M&A" | "Valuation" | "Corporate";

/** Raw market data from Polymarket Gamma API */
export interface PolymarketRaw {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  outcomes: string;          // JSON string: '["Yes","No"]'
  outcomePrices: string;     // JSON string: '["0.52","0.48"]'
  volume: string;
  liquidity: string;
  endDate: string;
  active: boolean;
  closed: boolean;
  clobTokenIds?: string;     // JSON string of token IDs
}

/** Processed prediction market for UI */
export interface PredictionMarket {
  id: string;
  question: string;
  slug: string;
  category: MarketCategory;
  outcomes: string[];
  outcomePrices: number[];
  volume: number;
  liquidity: number;
  endDate: string;
  clobTokenIds: string[];
}

/** Aggregated metrics for summary cards */
export interface PredictionMarketMetrics {
  marketCount: number;
  totalVolume: number;
  totalLiquidity: number;
}

const GAMMA_API_URL = "https://gamma-api.polymarket.com/markets";

/** Keywords to filter for IPO and private company launch events */
const IPO_KEYWORDS = [
  "IPO",
  "go public",
  "public offering",
  "market cap",
  "launch",
  "valuation",
  "FDV",
];

/** Private company names to include */
const PRIVATE_COMPANY_KEYWORDS = [
  "OpenAI",
  "SpaceX",
  "Stripe",
  "Anthropic",
  "xAI",
  "Databricks",
  "Canva",
  "Discord",
  "Figma",
  "Klarna",
  "Revolut",
  "MegaETH",
  "Monad",
  "Berachain",
];

/** Combined filter keywords */
const FILTER_KEYWORDS = [...IPO_KEYWORDS, ...PRIVATE_COMPANY_KEYWORDS];

/** Categorize a market based on its question text */
export function categorizeMarket(question: string): MarketCategory {
  const q = question.toLowerCase();
  if (q.includes("ipo") || q.includes("go public") || q.includes("public offering")) {
    return "IPO";
  }
  if (q.includes("launch") || q.includes("fdv") || q.includes("market cap")) {
    return "Valuation";
  }
  if (q.includes("acquisition") || q.includes("acquire") || q.includes("merger") || q.includes("buy")) {
    return "M&A";
  }
  if (q.includes("valuation") || q.includes("worth") || q.includes("billion") || q.includes("trillion")) {
    return "Valuation";
  }
  return "Corporate";
}

/** Check if market is IPO-related for private companies */
export function isIPOMarket(question: string): boolean {
  const q = question.toLowerCase();
  // Check for IPO keywords
  const hasIPOKeyword = IPO_KEYWORDS.some(k => q.includes(k.toLowerCase()));
  // Check for private company mention
  const hasPrivateCompany = PRIVATE_COMPANY_KEYWORDS.some(k => q.includes(k.toLowerCase()));
  return hasIPOKeyword && hasPrivateCompany;
}

/** Format volume/liquidity with compact notation */
export function formatVolume(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/** Format price (0.0-1.0) as percentage */
export function formatPriceAsPercent(price: number): string {
  return `${(price * 100).toFixed(0)}%`;
}

/** Format end date for display */
export function formatEndDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

/** Check if market question matches filter keywords */
function matchesKeywords(question: string): boolean {
  const q = question.toLowerCase();
  return FILTER_KEYWORDS.some((keyword) => q.includes(keyword.toLowerCase()));
}

/** Parse JSON string safely */
function parseJsonString<T>(str: string | undefined | null, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/** Fetch markets from Polymarket Gamma API (uncached) */
async function fetchMarketsUncached(): Promise<PredictionMarket[]> {
  try {
    const url = new URL(GAMMA_API_URL);
    url.searchParams.set("closed", "false");
    url.searchParams.set("limit", "100");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      console.error(`Polymarket API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const raw: PolymarketRaw[] = await res.json();

    // Filter and process markets
    const filtered = raw
      .filter((m) => m.active && !m.closed && matchesKeywords(m.question))
      .map((m): PredictionMarket => ({
        id: m.id,
        question: m.question,
        slug: m.slug,
        category: categorizeMarket(m.question),
        outcomes: parseJsonString<string[]>(m.outcomes, ["Yes", "No"]),
        outcomePrices: parseJsonString<string[]>(m.outcomePrices, ["0.5", "0.5"]).map(Number),
        volume: parseFloat(m.volume) || 0,
        liquidity: parseFloat(m.liquidity) || 0,
        endDate: m.endDate,
        clobTokenIds: parseJsonString<string[]>(m.clobTokenIds, []),
      }))
      .sort((a, b) => b.volume - a.volume); // Sort by volume desc

    return filtered;
  } catch (error) {
    console.error("Failed to fetch Polymarket markets:", error);
    return [];
  }
}

/** Cached fetch for prediction markets (5 min cache) */
export async function getPredictionMarkets(): Promise<PredictionMarket[]> {
  return unstable_cache(
    fetchMarketsUncached,
    ["polymarket-prediction-markets"],
    { revalidate: 300 }
  )();
}

/** Compute aggregated metrics from market data */
export async function getPredictionMarketMetrics(): Promise<PredictionMarketMetrics> {
  const markets = await getPredictionMarkets();
  return {
    marketCount: markets.length,
    totalVolume: markets.reduce((sum, m) => sum + m.volume, 0),
    totalLiquidity: markets.reduce((sum, m) => sum + m.liquidity, 0),
  };
}

/** Get Polymarket URL for a market */
export function getPolymarketUrl(slug: string): string {
  return `https://polymarket.com/event/${slug}`;
}

/** Get only IPO-related markets for private companies */
export async function getIPOPredictionMarkets(): Promise<PredictionMarket[]> {
  const markets = await getPredictionMarkets();
  // Return all markets that match IPO criteria, or all if none match
  const ipoMarkets = markets.filter(m => isIPOMarket(m.question));
  return ipoMarkets.length > 0 ? ipoMarkets : markets;
}

/** Generate prediction token symbol from market */
export function getPredictionTokenSymbol(market: PredictionMarket, outcome: "Yes" | "No"): string {
  // Extract company/project name from question
  const question = market.question;
  let name = "PRED";

  for (const company of PRIVATE_COMPANY_KEYWORDS) {
    if (question.toLowerCase().includes(company.toLowerCase())) {
      name = company.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
      break;
    }
  }

  return `p${name}-${outcome.toUpperCase()}`;
}
