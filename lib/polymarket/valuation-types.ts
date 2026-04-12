/**
 * TypeScript types for the Vaulto-API /api/trading/valuation endpoint response
 */

/** Bid/Ask prices for a specific band */
export interface BandBidAsk {
  bandIndex: number;
  bid: number;
  ask: number;
}

/** Slippage information for a direction (LONG or SHORT) */
export interface SlippageInfo {
  /** Cost at ASK prices (what you pay to buy) */
  buyCost: number;
  /** Value at BID prices (what you receive when selling) */
  sellValue: number;
  /** Absolute spread (buyCost - sellValue) */
  spread: number;
  /** Percentage spread */
  spreadPercent: number;
}

/** Band pricing and volume data */
export interface BandData {
  bandIndex: number;
  label: string;
  midpoint: number;
  price: number;
  volume: number;
  tokenId: string;
}

/** Event metadata */
export interface EventInfo {
  slug: string;
  name: string;
  numBands: number;
}

/** Valuation breakdown for a band */
export interface BandBreakdown {
  bandIndex: number;
  label: string;
  midpoint: number;
  price: number;
  longPayoff: number;
  shortPayoff: number;
  longCostContrib: number;
  shortCostContrib: number;
}

/** Main valuation data */
export interface Valuation {
  /** Total cost to acquire $1 of LONG exposure */
  longCost: number;
  /** Total cost to acquire $1 of SHORT exposure */
  shortCost: number;
  /** Best possible return for LONG position */
  bestLongReturn: number;
  /** Worst possible return for LONG position */
  worstLongReturn: number;
  /** Best possible return for SHORT position */
  bestShortReturn: number;
  /** Worst possible return for SHORT position */
  worstShortReturn: number;
}

/** Slippage data for both directions */
export interface SlippageData {
  long: SlippageInfo;
  short: SlippageInfo;
  bandPrices: BandBidAsk[];
}

/** User settings for floor payoffs */
export interface TradingSettings {
  /** Floor payoff for LONG positions (0-1) */
  floorL: number;
  /** Floor payoff for SHORT positions (0-1) */
  floorS: number;
}

/** Full response from /api/trading/valuation endpoint */
export interface ValuationResponse {
  event: EventInfo;
  bands: BandData[];
  valuation: Valuation;
  slippage: SlippageData;
  breakdown: BandBreakdown[];
  settings: TradingSettings;
  totalVolume: number;
  endDate: string;
  timestamp: string;
}
