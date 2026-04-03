/**
 * Company logo utilities with hybrid approach:
 * 1. Static local assets (highest quality)
 * 2. Logo proxy API (Google Favicon via server-side proxy to avoid CORS)
 * 3. Letter fallback (handled by component via onError)
 */

/** Map company names to static asset filenames */
const STATIC_LOGO_MAP: Record<string, string> = {
  spacex: "spacex.png",
  anthropic: "anthropic.png",
  waymo: "waymo.png",
  databricks: "databricks.png",
  bytedance: "bytedance.svg",
  safesuperintelligence: "ssi.jpg",
  ssi: "ssi.jpg",
};

/**
 * Map company names (normalized) to their website domains.
 * Used as fallback when website field is missing or incorrect.
 */
const COMPANY_DOMAIN_MAP: Record<string, string> = {
  // Tech
  spacex: "spacex.com",
  stripe: "stripe.com",
  openai: "openai.com",
  anthropic: "anthropic.com",
  databricks: "databricks.com",
  discord: "discord.com",
  bytedance: "tiktok.com", // bytedance.com favicon broken, use TikTok (their flagship product)
  // Fintech
  canva: "canva.com",
  klarna: "klarna.com",
  chime: "chime.com",
  plaid: "plaid.com",
  ramp: "ramp.com",
  tether: "tether.to",
  revolut: "revolut.com",
  kraken: "kraken.com",
  // Productivity
  figma: "figma.com",
  notion: "notion.so",
  airtable: "airtable.com",
  // Consumer/Delivery
  instacart: "instacart.com",
  doordash: "doordash.com",
  // Social/Gaming
  reddit: "reddit.com",
  epicgames: "epicgames.com",
  roblox: "roblox.com",
  // Automotive
  rivian: "rivian.com",
  lucidmotors: "lucidmotors.com",
  // Defense/AI
  andurilindustries: "anduril.com",
  anduril: "anduril.com",
  scaleai: "scale.com",
  scale: "scale.com",
  shieldai: "shield.ai",
  epirus: "epirusinc.com",
  // Robotics
  figureai: "figure.ai",
  figure: "figure.ai",
  // Space/Logistics
  relativityspace: "relativityspace.com",
  flexport: "flexport.com",
  // Autonomous vehicles
  nuro: "nuro.ai",
  cruise: "getcruise.com",
  waymo: "waymo.com",
  // Other
  zoom: "zoom.us",
  shein: "shein.com",
  revolutionmedicines: "revmed.com",
  neuralink: "neuralink.com",
  kalshi: "kalshi.com",
  perplexity: "perplexity.ai",
  fanniemae: "fanniemae.com",
  freddiemac: "freddiemac.com",
  megaeth: "megaeth.systems",
  whoop: "whoop.com",
  // Prediction markets
  polymarket: "polymarket.com",
  // Sports/Entertainment
  fanatics: "fanatics.com",
  fanaticsholdings: "fanaticsinc.com",
  // Fintech
  mercurytechnologies: "mercury.com",
  mercury: "mercury.com",
  // AI
  thinkingmachineslab: "thinkingmachines.ai",
  // AI Safety
  safesuperintelligence: "ssi.inc",
  ssi: "ssi.inc",
};

/**
 * Set of company names (normalized) that have dark logos.
 * These logos are inverted in dark mode (black -> white).
 */
export const DARK_LOGO_COMPANIES = new Set<string>(["fanatics", "fanaticsholdings"]);

/**
 * Extract domain from a website URL.
 * Handles URLs with or without protocol prefix.
 * Returns null if URL is invalid.
 */
export function extractDomainFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    // Add protocol if missing
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    return new URL(normalizedUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Get static company logo URL if available.
 * Checks STATIC_LOGO_MAP by normalized company name.
 */
export function getStaticCompanyLogoUrl(companyName: string): string | null {
  const normalized = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const filename = STATIC_LOGO_MAP[normalized];
  return filename ? `/companies/${filename}` : null;
}

/**
 * Get domain for a company by name.
 * Uses COMPANY_DOMAIN_MAP lookup with normalized name.
 */
export function getCompanyDomain(companyName: string): string | null {
  const normalized = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return COMPANY_DOMAIN_MAP[normalized] ?? null;
}

/**
 * Get proxied favicon URL for a domain.
 * Uses our API route to avoid CORS issues.
 * Returns the proxied URL which will be cached for 7 days.
 */
export function getProxiedFaviconUrl(domain: string): string {
  return `/api/logo?domain=${encodeURIComponent(domain)}`;
}

/**
 * Legacy: Get Google Favicon API URL directly (causes CORS issues).
 * Use getProxiedFaviconUrl instead for client-side usage.
 */
export function getGoogleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

/**
 * Resolve company logo URL using fallback chain.
 * Returns: static asset URL, proxied favicon URL, or null.
 *
 * Priority:
 * 1. Static local assets (highest quality)
 * 2. Company's actual website URL (most accurate)
 * 3. Domain map fallback (for known companies without good website field)
 *
 * This is a synchronous function - validation happens via <img onError>.
 */
export function getCompanyLogoUrl(
  companyName: string,
  website?: string
): string | null {
  // 1. Try static asset first
  const staticUrl = getStaticCompanyLogoUrl(companyName);
  if (staticUrl) return staticUrl;

  // 2. Try the company's actual website URL first (most accurate source)
  if (website) {
    const domain = extractDomainFromUrl(website);
    if (domain) return getProxiedFaviconUrl(domain);
  }

  // 3. Fallback to domain map lookup by company name
  const mappedDomain = getCompanyDomain(companyName);
  if (mappedDomain) return getProxiedFaviconUrl(mappedDomain);

  return null;
}

/**
 * Fetch company logo URL.
 * Now synchronous since we use proxy API and rely on <img onError> for validation.
 *
 * This function is kept for backwards compatibility with useCompanyLogo hook.
 */
export async function fetchCompanyLogo(
  companyName: string,
  website?: string
): Promise<string | null> {
  // Simply return the resolved URL - validation happens via <img onError>
  return getCompanyLogoUrl(companyName, website);
}
