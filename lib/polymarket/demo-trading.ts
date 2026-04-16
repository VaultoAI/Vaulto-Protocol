/**
 * @deprecated This file is deprecated. Use the real trading integration instead:
 * - hooks/usePredictionTrading.ts - Trading hook for components
 * - lib/vaulto-api/trading.ts - Vaulto API trading client
 * - app/api/trading/buy/route.ts - Buy endpoint
 * - app/api/trading/positions/route.ts - Positions endpoint
 * - app/api/trading/sell/route.ts - Sell endpoint
 *
 * The real trading routes through Vaulto API which handles Polymarket complexity.
 * Zero wallet signatures required per trade.
 *
 * ===== LEGACY CODE BELOW - DO NOT USE FOR NEW FEATURES =====
 *
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

// ============================================================================
// Overall IPO Trading (Long/Short across all bands)
// ============================================================================

export interface OverallIPOTradeParams {
  ipo: CompanyIPO;
  direction: "long" | "short";
  usdcAmount: number;
}

export interface OverallIPOTradeResult {
  success: boolean;
  txHash: string;
  error?: string;
  totalShares: number;
  totalCost: number;
  direction: "long" | "short";
  bandAllocations: Array<{
    band: ValuationBand;
    shares: number;
    usdcAmount: number;
  }>;
}

/**
 * Buy an overall Long or Short position on an IPO.
 *
 * Long: Bullish on IPO valuation - buy slightly more Yes contracts on bands
 *       ABOVE the expected valuation, slightly less on bands below.
 * Short: Bearish on IPO valuation - buy slightly more No contracts on bands
 *        BELOW the expected valuation, slightly less on bands above.
 *
 * Weighting: Bands closer to expected value get more weight, with a tilt
 * based on direction (long = favor higher bands, short = favor lower bands).
 */
export async function buyOverallIPOPosition(
  params: OverallIPOTradeParams
): Promise<OverallIPOTradeResult> {
  const { ipo, direction, usdcAmount } = params;

  // Check USDC balance
  if (!hasSufficientBalance("USDC", usdcAmount)) {
    return {
      success: false,
      txHash: "",
      error: "Insufficient USDC balance",
      totalShares: 0,
      totalCost: usdcAmount,
      direction,
      bandAllocations: [],
    };
  }

  const bands = ipo.bands;
  const expectedValue = ipo.expectedIPOValue;

  // Calculate weights for each band based on direction
  // Higher weight = more allocation
  const bandWeights: Array<{ band: ValuationBand; weight: number }> = bands.map((band) => {
    const midpoint = ((band.lowThreshold ?? 0) + (band.highThreshold ?? Infinity)) / 2;
    const isAboveExpected = midpoint > expectedValue;

    // Base weight from probability (bands with higher probability get more weight)
    let weight = band.probability;

    // Direction tilt:
    // Long = favor bands above expected (multiply weight by 1.5 for above, 0.7 for below)
    // Short = favor bands below expected (multiply weight by 1.5 for below, 0.7 for above)
    if (direction === "long") {
      weight *= isAboveExpected ? 1.5 : 0.7;
    } else {
      weight *= isAboveExpected ? 0.7 : 1.5;
    }

    return { band, weight };
  });

  // Normalize weights so they sum to 1
  const totalWeight = bandWeights.reduce((sum, bw) => sum + bw.weight, 0);
  const normalizedWeights = bandWeights.map((bw) => ({
    ...bw,
    weight: bw.weight / totalWeight,
  }));

  // Allocate USDC to each band based on normalized weights
  const bandAllocations: OverallIPOTradeResult["bandAllocations"] = [];
  let totalShares = 0;

  for (const { band, weight } of normalizedWeights) {
    const bandUsdcAmount = usdcAmount * weight;

    // For Long: buy Yes (probability price)
    // For Short: buy No (1 - probability price)
    const pricePerShare = direction === "long" ? band.probability : 1 - band.probability;
    const shares = bandUsdcAmount / pricePerShare;

    totalShares += shares;
    bandAllocations.push({
      band,
      shares,
      usdcAmount: bandUsdcAmount,
    });

    // Record each band's transaction
    const symbol = getIPOBandSymbol(ipo.company, band, direction);
    recordDemoTransaction({
      type: "swap",
      tokenIn: "USDC",
      tokenOut: symbol,
      amountIn: bandUsdcAmount,
      amountOut: shares,
    });
  }

  await simulateNetworkDelay();

  return {
    success: true,
    txHash: `0x${Math.random().toString(16).slice(2, 18)}`,
    totalShares,
    totalCost: usdcAmount,
    direction,
    bandAllocations,
  };
}

// ============================================================================
// Prediction Market Trading (Company-level Long/Short)
// ============================================================================

export interface PredictionMarketTradeParams {
  company: string;
  eventSlug: string;
  direction: "long" | "short";
  usdcAmount: number;
}

export interface PredictionMarketTradeResult {
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
 * Buy a prediction market position (Long or Short) on a company's IPO.
 *
 * This is a simplified version that creates a single position symbol
 * rather than distributing across bands. Uses a mock price based on
 * typical market pricing.
 */
export async function buyPredictionMarketPosition(
  params: PredictionMarketTradeParams
): Promise<PredictionMarketTradeResult> {
  const { company, eventSlug, direction, usdcAmount } = params;

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

  // For prediction markets, typical prices range from 0.40 to 0.70
  // Long positions tend to be priced around 0.55-0.65
  // Short positions are the inverse: 1 - long price
  const baseLongPrice = 0.55 + Math.random() * 0.1; // 0.55-0.65
  const pricePerShare = direction === "long" ? baseLongPrice : 1 - baseLongPrice;

  // Calculate shares: amount / price
  const shares = usdcAmount / pricePerShare;

  // Create a clean symbol for the position
  const shortName = company.replace(/[^a-zA-Z]/g, "").slice(0, 8).toUpperCase();
  const dirPrefix = direction === "long" ? "L" : "S";
  const symbol = `pm${shortName}-${dirPrefix}`;

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
