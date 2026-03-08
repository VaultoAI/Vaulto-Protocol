import { getAddress, isAddress } from "viem";

const CHAIN_NAME_MAP: Record<number, string> = {
  1: "ethereum",
  137: "polygon",
  56: "smartchain",
  43114: "avalanche",
  250: "fantom",
  42161: "arbitrum",
  10: "optimism",
  8453: "base",
};

/** EVM token addresses (Ethereum mainnet, chainId 1) for tokens with displayed pools. */
export const EVM_TOKEN_ADDRESSES: Record<string, string> = {
  USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  SLVon: "0xf3e4872e6a4cf365888d93b6146a2baa7348f1a4",
  CRCLon: "0x3632dea96a953c11dac2f00b4a05a32cd1063fae",
  NVDAon: "0x2d1f7226bd1f780af6b9a49dcc0ae00e8df4bdee",
  TSLAon: "0xf6b1117ec07684d3958cad8beb1b302bfd21103f",
  SPYon: "0xfedc5f4a6c38211c1338aa411018dfaf26612c08",
  QQQon: "0x0e397938c1aa0680954093495b70a9f5e2249aba",
  GOOGLon: "0xba47214edd2bb43099611b208f75e4b42fdcfedc",
  BABAon: "0x41765f0fcddc276309195166c7a62ae522fa09ef",
  TLTon: "0x992651bfeb9a0dcc4457610e284ba66d86489d4d",
  AAPLon: "0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c",
  COINon: "0xf042cfa86cf1d598a75bdb55c3507a1f39f9493b",
  HOODon: "0x998f02a9e343ef6e3e6f28700d5a20f839fd74e6",
  MSFTon: "0xb812837b81a3a6b81d7cd74cfb19a7f2784555e5",
  MSTRon: "0xcabd955322dfbf94c084929ac5e9eca3feb5556f",
  NKEon: "0xd8e26fcc879b30cb0a0b543925a2b3500f074d81",
  SPGIon: "0xbc843b147db4c7e00721d76037b8b92e13afe13f",
};

/**
 * Map private token symbols to their company website domains.
 * Used with Google Favicon API for reliable logo fetching.
 */
export const PRIVATE_TOKEN_DOMAINS: Record<string, string> = {
  // Major tech companies
  vSpaceX: "spacex.com",
  vStripe: "stripe.com",
  vOpenAI: "openai.com",
  vAnthropic: "anthropic.com",
  vDataBricks: "databricks.com",
  vDatabricks: "databricks.com",
  vDiscord: "discord.com",
  // IPO market companies
  vFannieMae: "fanniemae.com",
  vFreddieMac: "freddiemac.com",
  vMegaETH: "megaeth.systems",
  // Fintech
  vCanva: "canva.com",
  vKlarna: "klarna.com",
  vChime: "chime.com",
  vPlaid: "plaid.com",
  // Productivity
  vFigma: "figma.com",
  vNotion: "notion.so",
  vAirtable: "airtable.com",
  // Consumer/Delivery
  vInstacart: "instacart.com",
  vDoorDash: "doordash.com",
  // Social/Gaming
  vReddit: "reddit.com",
  vEpicGames: "epicgames.com",
  vRoblox: "roblox.com",
  // Automotive
  vRivian: "rivian.com",
  vLucidMotors: "lucidmotors.com",
  // Defense/AI
  vAnduril: "anduril.com",
  vAndurilIndustries: "anduril.com",
  vScale: "scale.com",
  vScaleAI: "scale.com",
  // Space/Logistics
  vRelativitySpace: "relativityspace.com",
  vFlexport: "flexport.com",
  // Autonomous vehicles
  vNuro: "nuro.ai",
  vCruise: "getcruise.com",
  vWaymo: "waymo.com",
  // Other
  vZoom: "zoom.us",
  vShein: "shein.com",
  vByteDance: "tiktok.com", // bytedance.com favicon broken, use TikTok
  vRevolutionMedicines: "revmed.com",
  vNeuralink: "neuralink.com",
  vKalshi: "kalshi.com",
  vPerplexity: "perplexity.ai",
  // Sports/Entertainment
  vFanatics: "fanatics.com",
  // Fintech
  vMercury: "mercury.com",
  // AI
  vTML: "thinkingmachines.ai",
};

/**
 * Set of private token symbols that have dark logos and need a white background.
 */
export const DARK_LOGO_SYMBOLS = new Set<string>(["vFanatics"]);

/**
 * Get Google Favicon API URL for a domain (128px high resolution).
 */
function getGoogleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

/**
 * Get logo URL for a private token symbol.
 * Uses Google Favicon API which is more reliable than Clearbit.
 */
export function getPrivateTokenLogoUrl(symbol: string): string | null {
  // Check direct domain mapping first
  const domain = PRIVATE_TOKEN_DOMAINS[symbol];
  if (domain) {
    return getGoogleFaviconUrl(domain);
  }

  // Try to extract company name from symbol (vCompanyName -> companyname.com)
  if (symbol.startsWith("v") && symbol.length > 1) {
    const companyName = symbol.slice(1).toLowerCase();
    return getGoogleFaviconUrl(`${companyName}.com`);
  }

  return null;
}

/** Display names for swap/token selectors. Fall back to symbol if missing. */
export const TOKEN_DISPLAY_NAMES: Record<string, string> = {
  USDC: "USDC",
  SLVon: "Silvergate Capital",
  CRCLon: "Circle",
  NVDAon: "NVIDIA",
  TSLAon: "Tesla",
  SPYon: "SPDR S&P 500",
  QQQon: "Invesco QQQ",
  GOOGLon: "Alphabet (Google)",
  BABAon: "Alibaba",
  TLTon: "iShares 20+ Year Treasury",
  AAPLon: "Apple",
  COINon: "Coinbase",
  HOODon: "Robinhood",
  MSFTon: "Microsoft",
  MSTRon: "MicroStrategy",
  NKEon: "Nike",
  SPGIon: "S&P Global",
  vAnduril: "Anduril",
};

export function getTokenDisplayName(symbol: string): string {
  const trimmed = symbol.trim();
  return TOKEN_DISPLAY_NAMES[trimmed] ?? trimmed;
}

export function getChainName(chainId: number): string {
  return CHAIN_NAME_MAP[chainId] ?? "ethereum";
}

export function getTokenAddressBySymbol(symbol: string): string | null {
  const trimmed = symbol.trim();
  return EVM_TOKEN_ADDRESSES[trimmed] ?? null;
}

/**
 * Returns TrustWallet Assets logo URL for an EVM token.
 * Address must be valid; use getTokenAddressBySymbol for known symbols.
 */
export function getTokenLogoUrl(
  tokenAddress: string,
  chainId: number = 1
): string {
  if (!tokenAddress || !isAddress(tokenAddress)) return "";
  const checksummedAddress = getAddress(tokenAddress);
  const chainName = getChainName(chainId);
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainName}/assets/${checksummedAddress}/logo.png`;
}

const logoCache = new Map<string, string | null>();

export async function verifyLogoExists(logoUrl: string): Promise<boolean> {
  if (!logoUrl) return false;
  try {
    const res = await fetch(logoUrl, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchTrustWalletLogo(
  tokenAddress: string,
  chainId: number = 1
): Promise<string | null> {
  const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
  if (logoCache.has(cacheKey)) {
    return logoCache.get(cacheKey) ?? null;
  }
  const logoUrl = getTokenLogoUrl(tokenAddress, chainId);
  if (!logoUrl) {
    logoCache.set(cacheKey, null);
    return null;
  }
  try {
    const res = await fetch(logoUrl, { method: "HEAD" });
    if (res.ok) {
      logoCache.set(cacheKey, logoUrl);
      return logoUrl;
    }
  } catch {
    // ignore
  }
  logoCache.set(cacheKey, null);
  return null;
}
