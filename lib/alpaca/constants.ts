/**
 * Alpaca API Constants
 *
 * Configuration for Alpaca Markets API integration.
 */

// API URLs
export const ALPACA_TRADING_API_URL = "https://api.alpaca.markets";
export const ALPACA_PAPER_TRADING_API_URL = "https://paper-api.alpaca.markets";
export const ALPACA_DATA_API_URL = "https://data.alpaca.markets";

// Supported ETF symbols
export const ETF_SYMBOLS = ["RVI", "VCX"] as const;
export type EtfSymbol = (typeof ETF_SYMBOLS)[number];

// ETF configuration - fractionable status
export const ETF_CONFIG: Record<EtfSymbol, { fractionable: boolean }> = {
  RVI: { fractionable: false },
  VCX: { fractionable: false },
} as const;

/**
 * Check if an ETF supports fractional shares
 */
export function isEtfFractionable(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase() as EtfSymbol;
  return ETF_CONFIG[upperSymbol]?.fractionable ?? false;
}

// Order limits
export const ORDER_LIMITS = {
  MIN_NOTIONAL_USD: 1, // Minimum order size in dollars
  MAX_NOTIONAL_USD: 100000, // Maximum order size in dollars
  MIN_QTY: 0.0001, // Minimum quantity (fractional shares)
  MIN_QTY_WHOLE: 1, // Minimum quantity for non-fractionable shares
} as const;

// Order types
export const ORDER_TYPES = ["MARKET", "LIMIT"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

// Order sides
export const ORDER_SIDES = ["BUY", "SELL"] as const;
export type OrderSide = (typeof ORDER_SIDES)[number];

// Time in force options
export const TIME_IN_FORCE = {
  DAY: "day", // Day order - expires at end of trading day
  GTC: "gtc", // Good til cancelled
  IOC: "ioc", // Immediate or cancel
  FOK: "fok", // Fill or kill
} as const;

export type TimeInForce = (typeof TIME_IN_FORCE)[keyof typeof TIME_IN_FORCE];

/**
 * Check if a symbol is a supported ETF
 */
export function isValidEtfSymbol(symbol: string): symbol is EtfSymbol {
  return ETF_SYMBOLS.includes(symbol.toUpperCase() as EtfSymbol);
}

/**
 * Get the trading API URL based on environment
 */
export function getTradingApiUrl(): string {
  const usePaperTrading = process.env.ALPACA_PAPER_TRADING === "true";
  return usePaperTrading ? ALPACA_PAPER_TRADING_API_URL : ALPACA_TRADING_API_URL;
}

/**
 * Check if we should use mock data instead of real Alpaca API
 */
export function shouldUseMock(): boolean {
  return process.env.USE_MOCK_PROVIDERS === "true";
}
