/**
 * Prestock token addresses for Solana SPL tokens.
 * These tokens represent synthetic shares of private companies.
 */

export interface PrestockToken {
  address: string;
  jupiterUrl: string;
}

/**
 * Mapping of company names to their prestock token addresses.
 * Address extracted from Jupiter swap URLs.
 */
export const PRESTOCK_TOKENS: Record<string, PrestockToken> = {
  SpaceX: {
    address: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    jupiterUrl:
      "https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
  },
  Anthropic: {
    address: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw",
    jupiterUrl:
      "https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw",
  },
  OpenAI: {
    address: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
    jupiterUrl:
      "https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
  },
  Anduril: {
    address: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB",
    jupiterUrl:
      "https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB",
  },
  Kalshi: {
    address: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua",
    jupiterUrl:
      "https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua",
  },
  Polymarket: {
    address: "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP",
    jupiterUrl:
      "https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP",
  },
  xAI: {
    address: "PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx",
    jupiterUrl:
      "https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx",
  },
};

/**
 * Get prestock token info for a company by name.
 * @param companyName - The company name (case-sensitive, must match PRESTOCK_TOKENS keys)
 * @returns PrestockToken if found, null otherwise
 */
export function getPrestockToken(companyName: string): PrestockToken | null {
  return PRESTOCK_TOKENS[companyName] ?? null;
}

/**
 * Check if a company has a prestock token.
 * @param companyName - The company name
 * @returns true if the company has a prestock token
 */
export function hasPrestockToken(companyName: string): boolean {
  return companyName in PRESTOCK_TOKENS;
}

/**
 * Get the token address for a company.
 * @param companyName - The company name
 * @returns Token address if found, null otherwise
 */
export function getPrestockAddress(companyName: string): string | null {
  return PRESTOCK_TOKENS[companyName]?.address ?? null;
}

/**
 * Get all company names that have prestock tokens.
 * @returns Array of company names
 */
export function getPrestockCompanies(): string[] {
  return Object.keys(PRESTOCK_TOKENS);
}
