/**
 * Alpaca API Types
 *
 * TypeScript interfaces for Alpaca Markets API responses and requests.
 */

import type { EtfSymbol, OrderSide, OrderType, TimeInForce } from "./constants";

// ============================================
// QUOTE TYPES
// ============================================

/** Real-time quote from Alpaca Market Data API */
export interface AlpacaQuote {
  symbol: string;
  askPrice: number;
  askSize: number;
  bidPrice: number;
  bidSize: number;
  timestamp: string;
}

/** Quote response with computed values */
export interface EtfQuoteResponse {
  symbol: EtfSymbol;
  askPrice: number;
  bidPrice: number;
  midPrice: number;
  spread: number;
  spreadPercent: number;
  marketStatus: MarketStatus;
  timestamp: string;
}

// ============================================
// ORDER TYPES
// ============================================

/** Alpaca order status values */
export type AlpacaOrderStatus =
  | "new"
  | "accepted"
  | "pending_new"
  | "accepted_for_bidding"
  | "partially_filled"
  | "filled"
  | "done_for_day"
  | "canceled"
  | "expired"
  | "replaced"
  | "pending_cancel"
  | "pending_replace"
  | "stopped"
  | "rejected"
  | "suspended"
  | "calculated";

/** Alpaca order object from API */
export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at: string | null;
  expired_at: string | null;
  canceled_at: string | null;
  failed_at: string | null;
  replaced_at: string | null;
  replaced_by: string | null;
  replaces: string | null;
  asset_id: string;
  symbol: string;
  asset_class: string;
  notional: string | null;
  qty: string | null;
  filled_qty: string;
  filled_avg_price: string | null;
  order_class: string;
  order_type: string;
  type: string;
  side: string;
  time_in_force: string;
  limit_price: string | null;
  stop_price: string | null;
  status: AlpacaOrderStatus;
  extended_hours: boolean;
  legs: AlpacaOrder[] | null;
  trail_percent: string | null;
  trail_price: string | null;
  hwm: string | null;
}

/** Request to place an order */
export interface PlaceOrderRequest {
  symbol: EtfSymbol;
  side: OrderSide;
  type: OrderType;
  timeInForce?: TimeInForce;
  notional?: number; // Dollar amount (for market orders)
  qty?: number; // Share quantity (for market/limit orders)
  limitPrice?: number; // Required for limit orders
  clientOrderId?: string;
}

/** Response from placing an order */
export interface PlaceOrderResponse {
  success: boolean;
  order?: AlpacaOrder;
  error?: string;
}

// ============================================
// POSITION TYPES
// ============================================

/** Alpaca position object from API */
export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  asset_marginable: boolean;
  avg_entry_price: string;
  qty: string;
  qty_available: string;
  side: string;
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl: string;
  unrealized_intraday_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

/** Simplified position for our app */
export interface EtfPosition {
  symbol: EtfSymbol;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPl: number;
  unrealizedPlPercent: number;
}

// ============================================
// ACCOUNT TYPES
// ============================================

/** Alpaca account object from API */
export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  crypto_status: string;
  currency: string;
  buying_power: string;
  regt_buying_power: string;
  daytrading_buying_power: string;
  non_marginable_buying_power: string;
  cash: string;
  accrued_fees: string;
  pending_transfer_out: string;
  pending_transfer_in: string;
  portfolio_value: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
  trade_suspended_by_user: boolean;
  multiplier: string;
  shorting_enabled: boolean;
  equity: string;
  last_equity: string;
  long_market_value: string;
  short_market_value: string;
  initial_margin: string;
  maintenance_margin: string;
  last_maintenance_margin: string;
  sma: string;
  daytrade_count: number;
}

// ============================================
// MARKET STATUS TYPES
// ============================================

/** Market clock from Alpaca API */
export interface AlpacaClock {
  timestamp: string;
  is_open: boolean;
  next_open: string;
  next_close: string;
}

/** Simplified market status for our app */
export interface MarketStatus {
  isOpen: boolean;
  nextOpen: string | null;
  nextClose: string | null;
  currentTime: string;
}

// ============================================
// ERROR TYPES
// ============================================

/** Alpaca API error response */
export interface AlpacaError {
  code: number;
  message: string;
}
