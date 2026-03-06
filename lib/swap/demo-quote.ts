/**
 * Simulated quote engine for private stock demo swaps.
 * Calculates exchange rates based on price per share.
 */

import type { DemoToken } from "@/lib/types/token";

export interface DemoQuoteParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  tokenInPrice: number; // Price in USD
  tokenOutPrice: number; // Price in USD
}

export interface DemoQuoteResult {
  amountOut: number;
  exchangeRate: number;
  priceImpact: number;
  isDemo: true;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
}

/** Simulated price impact based on trade size */
function calculatePriceImpact(amountInUsd: number): number {
  // Larger trades have more price impact (simulated)
  // 0.1% base + 0.01% per $10,000
  const baseImpact = 0.001;
  const sizeImpact = (amountInUsd / 10_000) * 0.0001;
  return Math.min(baseImpact + sizeImpact, 0.05); // Cap at 5%
}

/**
 * Get a simulated quote for swapping between tokens.
 * Uses price per share to calculate exchange rates.
 */
export function getDemoQuote(params: DemoQuoteParams): DemoQuoteResult {
  const { tokenIn, tokenOut, amountIn, tokenInPrice, tokenOutPrice } = params;

  // Calculate value in USD
  const valueInUsd = amountIn * tokenInPrice;

  // Calculate price impact
  const priceImpact = calculatePriceImpact(valueInUsd);

  // Calculate output amount after price impact
  const effectiveValueUsd = valueInUsd * (1 - priceImpact);
  const amountOut = effectiveValueUsd / tokenOutPrice;

  // Calculate exchange rate (how many tokenOut per tokenIn)
  const exchangeRate = tokenInPrice / tokenOutPrice;

  return {
    amountOut,
    exchangeRate,
    priceImpact,
    isDemo: true,
    tokenIn,
    tokenOut,
    amountIn,
  };
}

/**
 * Get token price for quote calculation.
 * USDC is always $1, demo tokens use their price per share.
 */
export function getTokenPriceUsd(
  symbol: string,
  demoTokens: Map<string, DemoToken>
): number {
  // USDC is always $1
  if (symbol === "USDC") {
    return 1;
  }

  // Check if it's a demo token
  const demoToken = demoTokens.get(symbol);
  if (demoToken && demoToken.pricePerShareUsd > 0) {
    return demoToken.pricePerShareUsd;
  }

  // Fallback: return 0 (invalid token)
  return 0;
}

/**
 * Format quote for display
 */
export function formatDemoQuote(quote: DemoQuoteResult): {
  amountOut: string;
  rate: string;
  impact: string;
} {
  return {
    amountOut: quote.amountOut.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }),
    rate: `1 ${quote.tokenIn} = ${quote.exchangeRate.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })} ${quote.tokenOut}`,
    impact: `${(quote.priceImpact * 100).toFixed(2)}%`,
  };
}
