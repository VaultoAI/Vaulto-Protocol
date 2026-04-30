/**
 * IPO Valuation Band Trading
 *
 * Fetches real IPO market cap events from Polymarket and displays
 * valuation ranges for trading.
 *
 * Long = betting IPO will land in this range or higher
 * Short = betting IPO will land below this range
 */

import { getPrivateCompanies, type PrivateCompany } from "@/lib/vaulto/companies";

/** A single valuation band with range and probability */
export interface ValuationBand {
  lowThreshold: number; // Lower bound of range (e.g., 500B)
  highThreshold: number | null; // Upper bound (null for "or greater" bands)
  probability: number; // 0.0-1.0 (probability of landing in this range)
  marketId: string; // Polymarket market ID
  slug: string; // Polymarket slug for URL
  question: string; // Original market question
  isLessThan?: boolean; // True for "less than X" bands
  isGreaterThan?: boolean; // True for "X or greater" bands
}

/** Company IPO data with valuation bands */
export interface CompanyIPO {
  company: string; // Company name
  companyId?: number; // Vaulto company ID (if matched)
  website?: string; // Company website for logo
  currentValuation?: number; // From Vaulto API (if matched)
  bands: ValuationBand[]; // Sorted by threshold
  expectedIPOValue: number; // Calculated from band probabilities
  eventSlug: string; // Polymarket event slug
  noIPOProbability?: number; // Probability company won't IPO
  noIPOMarket?: { slug: string; question: string }; // "Will not IPO" market
}

/** Known IPO market cap events on Polymarket */
const IPO_EVENTS = [
  { eventId: "307967", company: "SpaceX", slug: "spacex-ipo-closing-market-cap", website: "https://www.spacex.com" },
  { eventId: "48292", company: "OpenAI", slug: "openai-ipo-closing-market-cap", website: "https://openai.com" },
  { eventId: "197776", company: "Anthropic", slug: "anthropic-ipo-closing-market-cap-119", website: "https://www.anthropic.com" },
  { eventId: "145689", company: "Perplexity", slug: "perplexity-ipo-closing-market-cap", website: "https://www.perplexity.ai" },
  { eventId: "48298", company: "Stripe", slug: "stripe-ipo-closing-market-cap", website: "https://stripe.com" },
  { eventId: "48297", company: "Databricks", slug: "databricks-ipo-closing-market-cap", website: "https://www.databricks.com" },
  { eventId: "48299", company: "Discord", slug: "discord-ipo-closing-market-cap", website: "https://discord.com" },
  { eventId: "48295", company: "Fannie Mae", slug: "fannie-mae-ipo-closing-market-cap", website: "https://www.fanniemae.com" },
  { eventId: "48296", company: "Freddie Mac", slug: "freddie-mac-ipo-closing-market-cap", website: "https://www.freddiemac.com" },
  { eventId: "28999", company: "MegaETH", slug: "megaeth-market-cap-fdv-one-day-after-launch", website: "https://megaeth.systems" },
  { eventId: "85457", company: "Kraken", slug: "kraken-ipo-closing-market-cap-above", website: "https://www.kraken.com" },
  { eventId: "199553", company: "Clear Street", slug: "clear-street-group-ipo-closing-market-cap", website: "https://clearstreet.io" },
  { eventId: "164439", company: "Strava", slug: "strava-ipo-closing-market-cap", website: "https://www.strava.com" },
];

interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  markets: PolymarketMarket[];
}

interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  outcomePrices: string; // JSON string: '["0.52","0.48"]'
  active: boolean;
  closed: boolean;
}

/**
 * Fetch an event from Polymarket API
 */
async function fetchPolymarketEvent(eventId: string): Promise<PolymarketEvent | null> {
  try {
    const res = await fetch(`https://gamma-api.polymarket.com/events/${eventId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 300 }, // 5 min cache
    });

    if (!res.ok) {
      console.error(`Polymarket event fetch error: ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error("Failed to fetch Polymarket event:", error);
    return null;
  }
}

/**
 * Parse a valuation threshold from a market question.
 * Handles formats like "$500B", "$1T", "$1.5T", "$100B", "$80B"
 */
function parseValuation(text: string): number | null {
  // Match patterns like "$500B", "$1T", "$1.5T", "$80B"
  const patterns = [
    { regex: /\$(\d+(?:\.\d+)?)\s*T/i, multiplier: 1_000_000_000_000 },
    { regex: /\$(\d+(?:\.\d+)?)\s*B/i, multiplier: 1_000_000_000 },
    { regex: /\$(\d+(?:\.\d+)?)\s*M/i, multiplier: 1_000_000 },
  ];

  for (const { regex, multiplier } of patterns) {
    const match = text.match(regex);
    if (match) {
      return parseFloat(match[1]) * multiplier;
    }
  }

  return null;
}

/**
 * Parse a market question to extract the valuation range.
 * Returns { low, high, isLessThan, isGreaterThan }
 */
function parseMarketRange(question: string): {
  low: number | null;
  high: number | null;
  isLessThan: boolean;
  isGreaterThan: boolean;
  isNoIPO: boolean;
} {
  const q = question.toLowerCase();

  // Check for "not IPO" market
  if (q.includes("not ipo") || q.includes("won't ipo")) {
    return { low: null, high: null, isLessThan: false, isGreaterThan: false, isNoIPO: true };
  }

  // Check for "less than" pattern
  if (q.includes("less than")) {
    const val = parseValuation(question);
    return { low: 0, high: val, isLessThan: true, isGreaterThan: false, isNoIPO: false };
  }

  // Check for "or greater" / "greater than" pattern
  if (q.includes("or greater") || q.includes("greater than")) {
    const val = parseValuation(question);
    return { low: val, high: null, isLessThan: false, isGreaterThan: true, isNoIPO: false };
  }

  // Check for "between X and Y" pattern
  const betweenMatch = question.match(/between\s+(\$[\d.]+[TBM])\s+and\s+(\$[\d.]+[TBM])/i);
  if (betweenMatch) {
    const low = parseValuation(betweenMatch[1]);
    const high = parseValuation(betweenMatch[2]);
    return { low, high, isLessThan: false, isGreaterThan: false, isNoIPO: false };
  }

  // Check for threshold pattern like ">$2B"
  if (q.includes(">")) {
    const val = parseValuation(question);
    return { low: val, high: null, isLessThan: false, isGreaterThan: true, isNoIPO: false };
  }

  return { low: null, high: null, isLessThan: false, isGreaterThan: false, isNoIPO: false };
}

/**
 * Convert Polymarket event to CompanyIPO
 */
function eventToCompanyIPO(
  event: PolymarketEvent,
  companyName: string,
  fallbackWebsite?: string,
  vaultoCompany?: PrivateCompany
): CompanyIPO | null {
  const bands: ValuationBand[] = [];
  let noIPOProbability: number | undefined;
  let noIPOMarket: { slug: string; question: string } | undefined;

  for (const market of event.markets) {
    if (market.closed || !market.active) continue;

    const prices = JSON.parse(market.outcomePrices) as string[];
    const yesPrice = parseFloat(prices[0]) || 0;

    const range = parseMarketRange(market.question);

    if (range.isNoIPO) {
      noIPOProbability = yesPrice;
      noIPOMarket = { slug: market.slug, question: market.question };
      continue;
    }

    if (range.low === null && range.high === null) continue;

    bands.push({
      lowThreshold: range.low ?? 0,
      highThreshold: range.high,
      probability: yesPrice,
      marketId: market.id,
      slug: market.slug,
      question: market.question,
      isLessThan: range.isLessThan,
      isGreaterThan: range.isGreaterThan,
    });
  }

  if (bands.length === 0) return null;

  // Sort bands by low threshold
  bands.sort((a, b) => (a.lowThreshold ?? 0) - (b.lowThreshold ?? 0));

  // Calculate expected value
  const expectedValue = calculateExpectedValuation(bands);

  return {
    company: companyName,
    companyId: vaultoCompany?.id,
    website: vaultoCompany?.website ?? fallbackWebsite,
    currentValuation: vaultoCompany?.valuationUsd,
    bands,
    expectedIPOValue: expectedValue,
    eventSlug: event.slug,
    noIPOProbability,
    noIPOMarket,
  };
}

/**
 * Calculate expected IPO valuation from range-based probability bands.
 *
 * For each range, we use the midpoint weighted by probability.
 * For edge cases (< X or >= X), we estimate the midpoint.
 */
export function calculateExpectedValuation(bands: ValuationBand[]): number {
  if (bands.length === 0) return 0;

  let expectedValue = 0;
  let totalProbability = 0;

  for (const band of bands) {
    let midpoint: number;

    if (band.isLessThan && band.highThreshold) {
      // "Less than X" - use 50% of threshold as midpoint
      midpoint = band.highThreshold * 0.5;
    } else if (band.isGreaterThan && band.lowThreshold) {
      // "X or greater" - use 1.25x threshold as midpoint
      midpoint = band.lowThreshold * 1.25;
    } else if (band.lowThreshold !== null && band.highThreshold !== null) {
      // Range between X and Y
      midpoint = (band.lowThreshold + band.highThreshold) / 2;
    } else {
      continue;
    }

    expectedValue += midpoint * band.probability;
    totalProbability += band.probability;
  }

  // Normalize if probabilities don't sum to 1 (they should for mutually exclusive outcomes)
  if (totalProbability > 0 && totalProbability < 0.95) {
    expectedValue = expectedValue / totalProbability;
  }

  return expectedValue;
}

/**
 * Determine trade direction for a band.
 * Since these are range markets (not threshold markets), the logic is different:
 * - High probability ranges are more likely to hit
 * - Low probability ranges are less likely to hit
 */
export function getTradeDirection(band: ValuationBand): "long" | "short" {
  // For range markets, we suggest Long (Yes) if probability is reasonable
  // and Short (No) if probability is very low
  return band.probability >= 0.10 ? "long" : "short";
}

/**
 * Get all company IPOs with valuation bands from Polymarket.
 */
export async function getCompanyIPOs(): Promise<CompanyIPO[]> {
  // Fetch Vaulto companies for matching
  let vaultoCompanies: PrivateCompany[] = [];
  try {
    vaultoCompanies = await getPrivateCompanies();
  } catch {
    // Continue without Vaulto data
  }

  const ipos: CompanyIPO[] = [];

  // Fetch all IPO events in parallel
  const eventPromises = IPO_EVENTS.map(async ({ eventId, company, slug, website }) => {
    const event = await fetchPolymarketEvent(eventId);
    if (!event) return null;

    // Match with Vaulto company
    const vaultoCompany = vaultoCompanies.find(
      (c) => c.name.toLowerCase() === company.toLowerCase()
    );

    return eventToCompanyIPO(event, company, website, vaultoCompany);
  });

  const results = await Promise.all(eventPromises);

  for (const ipo of results) {
    if (ipo && ipo.bands.length > 0) {
      ipos.push(ipo);
    }
  }

  // Sort by expected valuation descending
  return ipos.sort((a, b) => b.expectedIPOValue - a.expectedIPOValue);
}

/**
 * Format a valuation number for display (e.g., "$157B", "$1.2T")
 */
export function formatBandThreshold(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value === 0) return "$0";
  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(0)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(0)}M`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Format a valuation range for display
 */
export function formatBandRange(band: ValuationBand): string {
  if (band.isLessThan && band.highThreshold) {
    return `< ${formatBandThreshold(band.highThreshold)}`;
  }
  if (band.isGreaterThan && band.lowThreshold) {
    return `${formatBandThreshold(band.lowThreshold)}+`;
  }
  if (band.lowThreshold !== null && band.highThreshold !== null) {
    return `${formatBandThreshold(band.lowThreshold)} - ${formatBandThreshold(band.highThreshold)}`;
  }
  return "—";
}

/**
 * Format a valuation for more precision when needed
 */
export function formatValuationPrecise(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "$0";
  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${value.toLocaleString()}`;
}

/**
 * Generate a prediction token symbol for IPO band trading.
 */
export function getIPOBandSymbol(
  company: string,
  band: ValuationBand,
  direction: "long" | "short"
): string {
  const shortName = company.replace(/[^a-zA-Z]/g, "").slice(0, 6).toUpperCase();
  const rangeStr = formatBandRange(band).replace(/[^a-zA-Z0-9]/g, "");
  const dirPrefix = direction === "long" ? "L" : "S";
  return `ipo${shortName}-${rangeStr}-${dirPrefix}`;
}

/**
 * Get Polymarket URL for a market.
 */
export function getPolymarketUrl(slug: string): string {
  return `https://polymarket.com/event/${slug}`;
}

/**
 * Get Polymarket event URL.
 */
export function getPolymarketEventUrl(eventSlug: string): string {
  return `https://polymarket.com/event/${eventSlug}`;
}

/**
 * Map a company name to its prediction market event data.
 * Returns null if the company doesn't have a prediction market.
 */
export function getCompanyPredictionMarket(companyName: string): { eventSlug: string; company: string } | null {
  const normalizedName = companyName.toLowerCase();
  const event = IPO_EVENTS.find(
    (e) => e.company.toLowerCase() === normalizedName
  );

  if (!event) return null;

  return {
    eventSlug: event.slug,
    company: event.company,
  };
}

/**
 * Get all company names that have prediction markets.
 */
export function getCompaniesWithPredictionMarkets(): string[] {
  return IPO_EVENTS.map((e) => e.company);
}
