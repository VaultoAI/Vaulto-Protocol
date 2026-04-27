import { unstable_cache } from "next/cache";
import type { DemoToken } from "@/lib/types/token";

/** Individual funding round */
export interface FundingRound {
  roundNumber?: number;
  type: string;
  date: string;
  amountRaisedUsd: number | null;
  amountRaisedNote?: string | null;
  preMoneyValuationUsd?: number | null;
  postMoneyValuationUsd?: number | null;
  pricePerShareUsd?: number | null;
}

/** Product offered by a company */
export interface Product {
  name: string;
  description: string;
}

/** Private company data from the Vaulto API */
export interface PrivateCompany {
  id: number;
  name: string;
  industry: string;
  description: string;
  website: string;
  valuationUsd: number;
  valuationAsOf: string;
  totalFundingUsd: number;
  lastFundingRoundType: string;
  lastFundingDate: string;
  lastFundingEstPricePerShareUsd: number | null;
  employees: number;
  ceo: string;
  products: Product[];
  fundingHistory: FundingRound[];
  createdAt?: string; // Date when the company was added to the database
}

/** API response structure */
export interface PrivateCompaniesResponse {
  companies: PrivateCompany[];
  total: number;
}

/** Aggregated metrics for UI summary cards */
export interface PrivateCompanyMetrics {
  companyCount: number;
  totalValuation: number;
  totalFunding: number;
}

const VAULTO_API_URL = process.env.NEXT_PUBLIC_VAULTO_API_URL
  ? `${process.env.NEXT_PUBLIC_VAULTO_API_URL}/api/private-companies?limit=1000`
  : "https://api.vaulto.ai/api/private-companies?limit=1000";

/**
 * Companies to hide from the site.
 * These will be filtered out from all company listings.
 */
const HIDDEN_COMPANIES = [
  "Beast Industries",
];

/** Filter out hidden companies from the list. */
function filterHiddenCompanies(companies: PrivateCompany[]): PrivateCompany[] {
  const hiddenSet = new Set(HIDDEN_COMPANIES.map((name) => name.toLowerCase()));
  return companies.filter((c) => !hiddenSet.has(c.name.toLowerCase()));
}

/**
 * TEMPORARY OVERRIDE: Fix TML $50B round display issues.
 * Removes type and date for the round with $50B post-money valuation.
 * TODO: Remove this once the API data is corrected.
 */
function applyTMLOverride(companies: PrivateCompany[]): PrivateCompany[] {
  return companies.map((company) => {
    if (company.name === "Thinking Machines Lab" && company.fundingHistory) {
      return {
        ...company,
        fundingHistory: company.fundingHistory.map((round) => {
          // Target the $50B round (50 billion = 50_000_000_000)
          if (round.postMoneyValuationUsd === 50_000_000_000) {
            return {
              ...round,
              type: "", // Remove description/type
              date: "", // Remove date
            };
          }
          return round;
        }),
      };
    }
    return company;
  });
}

async function fetchPrivateCompaniesUncached(): Promise<PrivateCompany[]> {
  try {
    const apiKey = process.env.VAULTO_API_TOKEN;
    if (!apiKey) {
      console.error("Missing VAULTO_API_TOKEN environment variable");
      return [];
    }

    const res = await fetch(VAULTO_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      next: { revalidate: 300 }, // 5 minutes
    });

    if (!res.ok) {
      console.error(`Vaulto API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const json = (await res.json()) as PrivateCompaniesResponse;
    const companies = json.companies ?? [];
    return filterHiddenCompanies(companies);
  } catch (error) {
    console.error("Failed to fetch private companies:", error);
    return [];
  }
}

/** Cache tag for on-demand revalidation via revalidateTag("vaulto-private-companies") */
export const PRIVATE_COMPANIES_CACHE_TAG = "vaulto-private-companies";

/** Cached fetch for private companies (5 min cache). */
export async function getPrivateCompanies(): Promise<PrivateCompany[]> {
  return unstable_cache(
    fetchPrivateCompaniesUncached,
    ["vaulto-private-companies"],
    { revalidate: 300, tags: [PRIVATE_COMPANIES_CACHE_TAG] }
  )();
}

/** Compute aggregated metrics from company data. */
export async function getPrivateCompanyMetrics(): Promise<PrivateCompanyMetrics> {
  const companies = await getPrivateCompanies();
  return {
    companyCount: companies.length,
    totalValuation: companies.reduce((sum, c) => sum + (c.valuationUsd ?? 0), 0),
    totalFunding: companies.reduce((sum, c) => sum + (c.totalFundingUsd ?? 0), 0),
  };
}

/** Format large USD values with compact notation ($1.25T, $380B, $50M). */
export function formatValuation(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/** Generate URL-friendly slug from company name (e.g., "SpaceX" -> "spacex", "Anduril Industries" -> "anduril-industries"). */
export function getCompanySlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Override symbols for specific companies. */
const SYMBOL_OVERRIDES: Record<string, string> = {
  "Anduril Industries": "vAnduril",
  "Fanatics Holdings": "vFanatics",
  "Mercury Technologies": "vMercury",
  "Thinking Machines Lab": "vTML",
  "Safe Superintelligence": "vSSI",
};

/** Reverse mapping from symbol to company slug (for overrides). */
const SYMBOL_TO_SLUG: Record<string, string> = {
  vAnduril: "anduril-industries",
  vFanatics: "fanatics-holdings",
  vMercury: "mercury-technologies",
  vTML: "thinking-machines-lab",
  vSSI: "safe-superintelligence",
};

/** Convert a token symbol to company slug for URL routing. */
export function getCompanySlugFromSymbol(symbol: string): string {
  // Check for explicit override mapping first
  if (SYMBOL_TO_SLUG[symbol]) {
    return SYMBOL_TO_SLUG[symbol];
  }
  // Default: strip 'v' prefix and convert to slug format
  const name = symbol.startsWith("v") ? symbol.slice(1) : symbol;
  return name.toLowerCase();
}

/** Generate synthetic token symbol from company name (e.g., SpaceX -> vSpaceX). */
export function getSyntheticSymbol(companyName: string): string {
  // Check for explicit override first
  if (SYMBOL_OVERRIDES[companyName]) {
    return SYMBOL_OVERRIDES[companyName];
  }
  // Remove spaces and special characters, keep alphanumeric
  const clean = companyName.replace(/[^a-zA-Z0-9]/g, "");
  return `v${clean}`;
}

/** Format price per share in USD (e.g., $123.45). */
export function formatPricePerShare(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value === 0) return "—";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Convert a private company to a demo token for swap interface. */
export function privateCompanyToDemoToken(company: PrivateCompany): DemoToken {
  return {
    type: "demo",
    symbol: getSyntheticSymbol(company.name),
    name: company.name,
    companyId: company.id,
    pricePerShareUsd: company.lastFundingEstPricePerShareUsd ?? 0,
    valuationUsd: company.valuationUsd,
  };
}

/** Get all private companies as demo tokens. */
export async function getDemoTokens(): Promise<DemoToken[]> {
  const companies = await getPrivateCompanies();
  return companies
    .filter((c) => c.valuationUsd > 0) // Only include companies with valuation
    .map(privateCompanyToDemoToken);
}

/** Get a single private company by its URL slug. */
export async function getPrivateCompanyBySlug(
  slug: string
): Promise<PrivateCompany | null> {
  const companies = await getPrivateCompanies(); // Uses cached data
  return companies.find((c) => getCompanySlug(c.name) === slug) ?? null;
}
