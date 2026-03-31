import { unstable_cache } from "next/cache";
import type { NewsArticle, CompanyNewsResponse, CompanyNewsParams } from "./types";

const NEWSAPI_URL = "https://newsapi.org/v2/everything";

// Reputable financial and business news domains
const TRUSTED_DOMAINS = [
  "reuters.com",
  "bloomberg.com",
  "wsj.com",
  "ft.com",
  "cnbc.com",
  "techcrunch.com",
  "theverge.com",
  "wired.com",
  "fortune.com",
  "businessinsider.com",
  "forbes.com",
  "nytimes.com",
  "theguardian.com",
  "bbc.com",
  "apnews.com",
];

/** Raw article from NewsAPI */
interface NewsAPIArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

/** Raw response from NewsAPI */
interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

/**
 * Format a date string as relative time (e.g., "2h ago", "3d ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Generate a unique ID for an article
 */
function generateArticleId(article: NewsAPIArticle): string {
  const hash = article.url.split("").reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);
  return Math.abs(hash).toString(36);
}

/**
 * Build a search query that includes company name, CEO, and key products
 * Uses OR to broaden results while keeping them relevant
 */
function buildSearchQuery(params: CompanyNewsParams): string {
  const terms: string[] = [];

  // Always include company name (exact match)
  terms.push(`"${params.company}"`);

  // Add CEO name if provided (helps catch leadership news)
  if (params.ceo) {
    terms.push(`"${params.ceo}"`);
  }

  // Add top product names (limit to 2 to avoid overly broad queries)
  if (params.products && params.products.length > 0) {
    const topProducts = params.products.slice(0, 2);
    topProducts.forEach((product) => {
      // Only add if product name is specific enough (more than 3 chars)
      if (product.length > 3) {
        terms.push(`"${product}"`);
      }
    });
  }

  // Join with OR for broader matching
  return terms.join(" OR ");
}

/**
 * Fetch company news from NewsAPI (uncached)
 */
async function fetchCompanyNewsUncached(
  params: CompanyNewsParams
): Promise<CompanyNewsResponse> {
  const { company, limit = 6 } = params;
  const apiKey = process.env.NEWSAPI_KEY;

  if (!apiKey) {
    console.error("NEWSAPI_KEY environment variable not set");
    return {
      articles: [],
      meta: { company, totalResults: 0, fetchedAt: new Date().toISOString() },
    };
  }

  try {
    const url = new URL(NEWSAPI_URL);
    const searchQuery = buildSearchQuery(params);
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("language", "en");
    url.searchParams.set("sortBy", "publishedAt");
    // Request more than needed to filter by domain
    url.searchParams.set("pageSize", String(Math.min(limit * 3, 100)));
    url.searchParams.set("domains", TRUSTED_DOMAINS.join(","));
    url.searchParams.set("apiKey", apiKey);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      console.error(`NewsAPI error: ${res.status} ${res.statusText}`);
      return {
        articles: [],
        meta: { company, totalResults: 0, fetchedAt: new Date().toISOString() },
      };
    }

    const data: NewsAPIResponse = await res.json();

    if (data.status !== "ok") {
      console.error("NewsAPI returned non-ok status:", data);
      return {
        articles: [],
        meta: { company, totalResults: 0, fetchedAt: new Date().toISOString() },
      };
    }

    // Filter and limit articles
    const articles: NewsArticle[] = data.articles
      .filter((a) => a.title && a.title !== "[Removed]")
      .slice(0, limit)
      .map((a) => ({
        id: generateArticleId(a),
        title: a.title,
        description: a.description || "",
        source: { name: a.source.name, id: a.source.id },
        author: a.author,
        url: a.url,
        imageUrl: a.urlToImage,
        publishedAt: a.publishedAt,
      }));

    return {
      articles,
      meta: {
        company,
        totalResults: data.totalResults,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Failed to fetch company news:", error);
    return {
      articles: [],
      meta: { company, totalResults: 0, fetchedAt: new Date().toISOString() },
    };
  }
}

/**
 * Get company news with caching (5-minute TTL)
 */
export async function getCompanyNews(
  params: CompanyNewsParams
): Promise<CompanyNewsResponse> {
  const { company, ceo, products, limit = 6 } = params;

  // Create cache key from all params
  const cacheKey = [
    `company-news`,
    company.toLowerCase(),
    ceo?.toLowerCase() || "",
    (products || []).join("-").toLowerCase(),
    String(limit),
  ].join("-");

  const cachedFetch = unstable_cache(
    () => fetchCompanyNewsUncached(params),
    [cacheKey],
    { revalidate: 300 }
  );

  return cachedFetch();
}
