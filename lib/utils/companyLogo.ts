/**
 * Company logo utilities with hybrid approach:
 * 1. Static local assets (highest quality)
 * 2. Google Favicon API (automatic fallback)
 * 3. Letter fallback (handled by component)
 */

/** Map company names to static asset filenames */
const STATIC_LOGO_MAP: Record<string, string> = {
  spacex: "spacex.png",
  anthropic: "anthropic.png",
  waymo: "waymo.png",
  databricks: "databricks.png",
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
  epirus: "epirus.com",
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
  // Sports/Entertainment
  fanatics: "fanatics.com",
  fanaticsholdings: "fanatics.com",
  // Fintech
  mercurytechnologies: "mercury.com",
  // AI
  thinkingmachineslab: "thinkingmachines.ai",
};

/**
 * Set of company names (normalized) that have dark logos and need a white background.
 */
export const DARK_LOGO_COMPANIES = new Set<string>(["fanatics"]);

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
 * Get Google Favicon API URL for a domain.
 * Returns the highest resolution available (128px).
 */
export function getGoogleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

/**
 * Resolve company logo URL using fallback chain.
 * Returns: static asset URL, Google Favicon URL, or null.
 */
export function getCompanyLogoUrl(
  companyName: string,
  website?: string
): string | null {
  // 1. Try static asset first
  const staticUrl = getStaticCompanyLogoUrl(companyName);
  if (staticUrl) return staticUrl;

  // 2. Try domain map lookup by company name (preferred over website field)
  const mappedDomain = getCompanyDomain(companyName);
  if (mappedDomain) return getGoogleFaviconUrl(mappedDomain);

  // 3. Fallback to Google Favicon API with website URL
  if (website) {
    const domain = extractDomainFromUrl(website);
    if (domain) return getGoogleFaviconUrl(domain);
  }

  return null;
}

const logoCache = new Map<string, string | null>();

/**
 * Verify that a logo URL is accessible.
 */
async function verifyLogoExists(logoUrl: string): Promise<boolean> {
  if (!logoUrl) return false;
  try {
    const res = await fetch(logoUrl, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch company logo URL with verification and caching.
 * Tries static asset first, then Google Favicon API with website or domain map.
 */
export async function fetchCompanyLogo(
  companyName: string,
  website?: string
): Promise<string | null> {
  const cacheKey = `${companyName.toLowerCase()}:${website ?? ""}`;

  if (logoCache.has(cacheKey)) {
    return logoCache.get(cacheKey) ?? null;
  }

  // 1. Try static asset first
  const staticUrl = getStaticCompanyLogoUrl(companyName);
  if (staticUrl) {
    const exists = await verifyLogoExists(staticUrl);
    if (exists) {
      logoCache.set(cacheKey, staticUrl);
      return staticUrl;
    }
  }

  // 2. Try domain map lookup by company name (preferred over website field)
  const mappedDomain = getCompanyDomain(companyName);
  if (mappedDomain) {
    const faviconUrl = getGoogleFaviconUrl(mappedDomain);
    logoCache.set(cacheKey, faviconUrl);
    return faviconUrl;
  }

  // 3. Fallback to Google Favicon API with website URL
  if (website) {
    const domain = extractDomainFromUrl(website);
    if (domain) {
      const faviconUrl = getGoogleFaviconUrl(domain);
      // Google Favicon API always returns something (even a default icon)
      // so we trust it without verification
      logoCache.set(cacheKey, faviconUrl);
      return faviconUrl;
    }
  }

  logoCache.set(cacheKey, null);
  return null;
}
