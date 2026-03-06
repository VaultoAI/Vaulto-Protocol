/**
 * Demo trading for prediction markets.
 * Buy Yes = bullish (betting event will happen)
 * Buy No = bearish (betting event won't happen)
 *
 * IPO Band Trading:
 * Long = betting IPO will be ABOVE threshold (bullish)
 * Short = betting IPO will be BELOW threshold (bearish)
 */

import { recordDemoTransaction, hasSufficientBalance, getDemoBalance, getDemoState, type DemoState } from "@/lib/swap/demo-state";
import type { PredictionMarket } from "./markets";
import { getPredictionTokenSymbol } from "./markets";
import type { CompanyIPO, ValuationBand } from "./ipo-valuations";
import { getIPOBandSymbol, formatBandRange } from "./ipo-valuations";

export interface PredictionPosition {
  marketId: string;
  question: string;
  outcome: "Yes" | "No";
  shares: number;
  avgPrice: number;
  currentPrice: number;
  symbol: string;
}

/** IPO band position with Yes/No direction */
export interface IPOBandPosition {
  company: string;
  companyId?: number;
  bandRange: string; // e.g., "$500B - $750B"
  direction: "long" | "short"; // long = Yes, short = No
  shares: number;
  avgPrice: number;
  currentPrice: number;
  symbol: string;
  question: string;
}

export interface DemoPredictionTradeParams {
  market: PredictionMarket;
  outcome: "Yes" | "No";
  usdcAmount: number;
}

export interface DemoPredictionTradeResult {
  success: boolean;
  txHash: string;
  error?: string;
  shares: number;
  pricePerShare: number;
  totalCost: number;
  symbol: string;
}

/** Simulate network delay */
function simulateNetworkDelay(): Promise<void> {
  const delay = 800 + Math.random() * 600;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Buy prediction shares (Yes or No outcome).
 * Buy Yes = betting the event WILL happen (bullish)
 * Buy No = betting the event WON'T happen (bearish)
 */
export async function buyPredictionShares(
  params: DemoPredictionTradeParams
): Promise<DemoPredictionTradeResult> {
  const { market, outcome, usdcAmount } = params;

  // Check USDC balance
  if (!hasSufficientBalance("USDC", usdcAmount)) {
    return {
      success: false,
      txHash: "",
      error: "Insufficient USDC balance",
      shares: 0,
      pricePerShare: 0,
      totalCost: usdcAmount,
      symbol: "",
    };
  }

  // Get price for outcome (Yes = index 0, No = index 1)
  const outcomeIndex = outcome === "Yes" ? 0 : 1;
  const pricePerShare = market.outcomePrices[outcomeIndex] ?? 0.5;

  // Calculate shares: amount / price
  // Prediction markets: shares pay $1 if outcome happens, so price is probability
  const shares = usdcAmount / pricePerShare;

  const symbol = getPredictionTokenSymbol(market, outcome);

  await simulateNetworkDelay();

  // Record transaction
  const tx = recordDemoTransaction({
    type: "swap",
    tokenIn: "USDC",
    tokenOut: symbol,
    amountIn: usdcAmount,
    amountOut: shares,
  });

  return {
    success: true,
    txHash: tx.txHash,
    shares,
    pricePerShare,
    totalCost: usdcAmount,
    symbol,
  };
}

/**
 * Sell prediction shares back to market.
 */
export async function sellPredictionShares(params: {
  market: PredictionMarket;
  outcome: "Yes" | "No";
  shares: number;
}): Promise<DemoPredictionTradeResult> {
  const { market, outcome, shares } = params;
  const symbol = getPredictionTokenSymbol(market, outcome);

  // Check share balance
  const shareBalance = getDemoBalance(symbol);
  if (shareBalance < shares) {
    return {
      success: false,
      txHash: "",
      error: `Insufficient ${symbol} balance`,
      shares: 0,
      pricePerShare: 0,
      totalCost: 0,
      symbol,
    };
  }

  // Get current price
  const outcomeIndex = outcome === "Yes" ? 0 : 1;
  const pricePerShare = market.outcomePrices[outcomeIndex] ?? 0.5;
  const usdcAmount = shares * pricePerShare;

  await simulateNetworkDelay();

  // Record transaction
  const tx = recordDemoTransaction({
    type: "swap",
    tokenIn: symbol,
    tokenOut: "USDC",
    amountIn: shares,
    amountOut: usdcAmount,
  });

  return {
    success: true,
    txHash: tx.txHash,
    shares,
    pricePerShare,
    totalCost: usdcAmount,
    symbol,
  };
}

/**
 * Get user's prediction positions from demo balances.
 */
export function getPredictionPositions(
  markets: PredictionMarket[]
): PredictionPosition[] {
  const positions: PredictionPosition[] = [];

  for (const market of markets) {
    for (const outcome of ["Yes", "No"] as const) {
      const symbol = getPredictionTokenSymbol(market, outcome);
      const shares = getDemoBalance(symbol);

      if (shares > 0) {
        const outcomeIndex = outcome === "Yes" ? 0 : 1;
        const currentPrice = market.outcomePrices[outcomeIndex] ?? 0.5;

        positions.push({
          marketId: market.id,
          question: market.question,
          outcome,
          shares,
          avgPrice: currentPrice, // Simplified: using current as avg
          currentPrice,
          symbol,
        });
      }
    }
  }

  return positions;
}

/**
 * Calculate potential payout if outcome resolves to true.
 * Each share pays $1 if the outcome happens.
 */
export function calculatePotentialPayout(shares: number): number {
  return shares; // $1 per share if outcome is correct
}

/**
 * Calculate current value of position.
 */
export function calculatePositionValue(shares: number, currentPrice: number): number {
  return shares * currentPrice;
}

// ============================================================================
// IPO Band Trading (Long/Short)
// ============================================================================

export interface IPOBandTradeParams {
  ipo: CompanyIPO;
  band: ValuationBand;
  direction: "long" | "short";
  usdcAmount: number;
}

export interface IPOBandTradeResult {
  success: boolean;
  txHash: string;
  error?: string;
  shares: number;
  pricePerShare: number;
  totalCost: number;
  symbol: string;
  direction: "long" | "short";
}

/**
 * Buy a Long position on an IPO valuation band.
 * Long = betting IPO will be ABOVE the threshold.
 * Price is the probability of exceeding the threshold.
 */
export async function buyLongPosition(
  params: Omit<IPOBandTradeParams, "direction">
): Promise<IPOBandTradeResult> {
  return buyIPOBandPosition({ ...params, direction: "long" });
}

/**
 * Buy a Short position on an IPO valuation band.
 * Short = betting IPO will be BELOW the threshold.
 * Price is (1 - probability of exceeding) = probability of being below.
 */
export async function buyShortPosition(
  params: Omit<IPOBandTradeParams, "direction">
): Promise<IPOBandTradeResult> {
  return buyIPOBandPosition({ ...params, direction: "short" });
}

/**
 * Buy an IPO band position (Long or Short).
 */
async function buyIPOBandPosition(
  params: IPOBandTradeParams
): Promise<IPOBandTradeResult> {
  const { ipo, band, direction, usdcAmount } = params;

  // Check USDC balance
  if (!hasSufficientBalance("USDC", usdcAmount)) {
    return {
      success: false,
      txHash: "",
      error: "Insufficient USDC balance",
      shares: 0,
      pricePerShare: 0,
      totalCost: usdcAmount,
      symbol: "",
      direction,
    };
  }

  // Long price = probability of exceeding (band.probability)
  // Short price = probability of NOT exceeding (1 - band.probability)
  const pricePerShare = direction === "long" ? band.probability : 1 - band.probability;

  // Calculate shares (price is probability, so shares = amount / price)
  const shares = usdcAmount / pricePerShare;

  const symbol = getIPOBandSymbol(ipo.company, band, direction);

  await simulateNetworkDelay();

  // Record transaction
  const tx = recordDemoTransaction({
    type: "swap",
    tokenIn: "USDC",
    tokenOut: symbol,
    amountIn: usdcAmount,
    amountOut: shares,
  });

  return {
    success: true,
    txHash: tx.txHash,
    shares,
    pricePerShare,
    totalCost: usdcAmount,
    symbol,
    direction,
  };
}

/**
 * Sell IPO band position.
 */
export async function sellIPOBandPosition(params: {
  ipo: CompanyIPO;
  band: ValuationBand;
  direction: "long" | "short";
  shares: number;
}): Promise<IPOBandTradeResult> {
  const { ipo, band, direction, shares } = params;
  const symbol = getIPOBandSymbol(ipo.company, band, direction);

  // Check share balance
  const shareBalance = getDemoBalance(symbol);
  if (shareBalance < shares) {
    return {
      success: false,
      txHash: "",
      error: `Insufficient ${symbol} balance`,
      shares: 0,
      pricePerShare: 0,
      totalCost: 0,
      symbol,
      direction,
    };
  }

  // Current price
  const pricePerShare = direction === "long" ? band.probability : 1 - band.probability;
  const usdcAmount = shares * pricePerShare;

  await simulateNetworkDelay();

  // Record transaction
  const tx = recordDemoTransaction({
    type: "swap",
    tokenIn: symbol,
    tokenOut: "USDC",
    amountIn: shares,
    amountOut: usdcAmount,
  });

  return {
    success: true,
    txHash: tx.txHash,
    shares,
    pricePerShare,
    totalCost: usdcAmount,
    symbol,
    direction,
  };
}

/**
 * Get user's IPO band positions from demo balances.
 */
export function getIPOBandPositions(ipos: CompanyIPO[]): IPOBandPosition[] {
  const positions: IPOBandPosition[] = [];
  const state = getDemoState();

  for (const ipo of ipos) {
    for (const band of ipo.bands) {
      for (const direction of ["long", "short"] as const) {
        const symbol = getIPOBandSymbol(ipo.company, band, direction);
        const shares = state.balances[symbol] ?? 0;

        if (shares > 0) {
          const currentPrice = direction === "long" ? band.probability : 1 - band.probability;

          positions.push({
            company: ipo.company,
            companyId: ipo.companyId,
            bandRange: formatBandRange(band),
            direction,
            shares,
            avgPrice: currentPrice,
            currentPrice,
            symbol,
            question: band.question,
          });
        }
      }
    }
  }

  return positions;
}
