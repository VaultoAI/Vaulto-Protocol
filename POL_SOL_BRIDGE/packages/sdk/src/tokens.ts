/**
 * Token Registry for PreStock Bridge
 *
 * Contains token addresses for both Solana (SPL) and Polygon (ERC-20) chains.
 * Solana addresses are fixed (existing SPL tokens).
 * Polygon addresses should be updated after deployment.
 */

export interface PreStockToken {
  /** Company identifier (lowercase, no spaces) */
  id: string;
  /** Display name */
  name: string;
  /** Token symbol (e.g., "vSPACEX") */
  symbol: string;
  /** Solana SPL token mint address */
  solanaMint: string;
  /** Polygon ERC-20 contract address (set after deployment) */
  polygonAddress: string | null;
  /** Token decimals (8 for both chains) */
  decimals: 8;
}

/**
 * All PreStock tokens available for bridging
 */
export const PRESTOCK_TOKENS: Record<string, PreStockToken> = {
  spacex: {
    id: "spacex",
    name: "Vaulted Prestock SpaceX",
    symbol: "vSPACEX",
    solanaMint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    polygonAddress: null, // TODO: Update after deployment
    decimals: 8,
  },
  anthropic: {
    id: "anthropic",
    name: "Vaulted Prestock Anthropic",
    symbol: "vANTHROPIC",
    solanaMint: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw",
    polygonAddress: null,
    decimals: 8,
  },
  openai: {
    id: "openai",
    name: "Vaulted Prestock OpenAI",
    symbol: "vOPENAI",
    solanaMint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
    polygonAddress: null,
    decimals: 8,
  },
  anduril: {
    id: "anduril",
    name: "Vaulted Prestock Anduril",
    symbol: "vANDURIL",
    solanaMint: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB",
    polygonAddress: null,
    decimals: 8,
  },
  kalshi: {
    id: "kalshi",
    name: "Vaulted Prestock Kalshi",
    symbol: "vKALSHI",
    solanaMint: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua",
    polygonAddress: null,
    decimals: 8,
  },
  polymarket: {
    id: "polymarket",
    name: "Vaulted Prestock Polymarket",
    symbol: "vPOLYMARKET",
    solanaMint: "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP",
    polygonAddress: null,
    decimals: 8,
  },
  xai: {
    id: "xai",
    name: "Vaulted Prestock xAI",
    symbol: "vXAI",
    solanaMint: "PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx",
    polygonAddress: null,
    decimals: 8,
  },
} as const;

/**
 * Get token by ID
 */
export function getToken(id: string): PreStockToken | undefined {
  return PRESTOCK_TOKENS[id.toLowerCase()];
}

/**
 * Get token by Solana mint address
 */
export function getTokenBySolanaMint(mint: string): PreStockToken | undefined {
  return Object.values(PRESTOCK_TOKENS).find((t) => t.solanaMint === mint);
}

/**
 * Get token by Polygon address
 */
export function getTokenByPolygonAddress(
  address: string
): PreStockToken | undefined {
  const normalizedAddress = address.toLowerCase();
  return Object.values(PRESTOCK_TOKENS).find(
    (t) => t.polygonAddress?.toLowerCase() === normalizedAddress
  );
}

/**
 * Get all token IDs
 */
export function getAllTokenIds(): string[] {
  return Object.keys(PRESTOCK_TOKENS);
}

/**
 * Get all tokens as array
 */
export function getAllTokens(): PreStockToken[] {
  return Object.values(PRESTOCK_TOKENS);
}

/**
 * Chain identifiers
 */
export const CHAINS = {
  SOLANA: "Solana",
  POLYGON: "Polygon",
} as const;

export type ChainName = (typeof CHAINS)[keyof typeof CHAINS];
