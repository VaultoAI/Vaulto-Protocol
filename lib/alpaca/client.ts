/**
 * Alpaca API Client
 *
 * Core client for interacting with Alpaca Markets API.
 * Supports both live and paper trading, with mock mode for development.
 */

import {
  getTradingApiUrl,
  ALPACA_DATA_API_URL,
  shouldUseMock,
  isValidEtfSymbol,
  ORDER_LIMITS,
  TIME_IN_FORCE,
  type EtfSymbol,
} from "./constants";
import type {
  AlpacaQuote,
  AlpacaOrder,
  AlpacaPosition,
  AlpacaAccount,
  PlaceOrderRequest,
  PlaceOrderResponse,
  EtfQuoteResponse,
  EtfPosition,
  MarketStatus,
} from "./types";
import { getMarketStatus } from "./market-hours";

// ============================================
// CONFIGURATION
// ============================================

function getCredentials(): { apiKey: string; secretKey: string } | null {
  const apiKey = process.env.ALPACA_API_KEY_ID;
  const secretKey = process.env.ALPACA_API_SECRET_KEY;

  if (!apiKey || !secretKey) {
    return null;
  }

  return { apiKey, secretKey };
}

function getHeaders(): Record<string, string> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error("Missing Alpaca API credentials");
  }

  return {
    "APCA-API-KEY-ID": creds.apiKey,
    "APCA-API-SECRET-KEY": creds.secretKey,
    "Content-Type": "application/json",
  };
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_QUOTES: Record<EtfSymbol, AlpacaQuote> = {
  RVI: {
    symbol: "RVI",
    askPrice: 25.05,
    askSize: 1000,
    bidPrice: 24.95,
    bidSize: 1000,
    timestamp: new Date().toISOString(),
  },
  VCX: {
    symbol: "VCX",
    askPrice: 30.10,
    askSize: 500,
    bidPrice: 29.90,
    bidSize: 500,
    timestamp: new Date().toISOString(),
  },
};

let mockOrderCounter = 0;
const mockOrders: Map<string, AlpacaOrder> = new Map();
const mockPositions: Map<string, AlpacaPosition> = new Map();

function generateMockOrder(request: PlaceOrderRequest): AlpacaOrder {
  mockOrderCounter++;
  const orderId = `mock-order-${mockOrderCounter}`;
  const clientOrderId = request.clientOrderId || `client-${orderId}`;
  const now = new Date().toISOString();

  // Simulate immediate fill for market orders
  const isFilled = request.type === "MARKET";
  const quote = MOCK_QUOTES[request.symbol];
  const fillPrice = request.side === "BUY" ? quote.askPrice : quote.bidPrice;
  const qty = request.qty || (request.notional ? request.notional / fillPrice : 0);

  const order: AlpacaOrder = {
    id: orderId,
    client_order_id: clientOrderId,
    created_at: now,
    updated_at: now,
    submitted_at: now,
    filled_at: isFilled ? now : null,
    expired_at: null,
    canceled_at: null,
    failed_at: null,
    replaced_at: null,
    replaced_by: null,
    replaces: null,
    asset_id: `asset-${request.symbol}`,
    symbol: request.symbol,
    asset_class: "us_equity",
    notional: request.notional?.toString() || null,
    qty: request.qty?.toString() || null,
    filled_qty: isFilled ? qty.toString() : "0",
    filled_avg_price: isFilled ? fillPrice.toString() : null,
    order_class: "simple",
    order_type: request.type.toLowerCase(),
    type: request.type.toLowerCase(),
    side: request.side.toLowerCase(),
    time_in_force: request.timeInForce || TIME_IN_FORCE.DAY,
    limit_price: request.limitPrice?.toString() || null,
    stop_price: null,
    status: isFilled ? "filled" : "new",
    extended_hours: false,
    legs: null,
    trail_percent: null,
    trail_price: null,
    hwm: null,
  };

  mockOrders.set(orderId, order);

  // Update mock position if filled
  if (isFilled) {
    updateMockPosition(request.symbol, request.side, qty, fillPrice);
  }

  return order;
}

function updateMockPosition(
  symbol: EtfSymbol,
  side: string,
  qty: number,
  price: number
): void {
  const existing = mockPositions.get(symbol);

  if (side === "BUY") {
    if (existing) {
      const newQty = parseFloat(existing.qty) + qty;
      const newCostBasis =
        parseFloat(existing.cost_basis) + qty * price;
      const avgPrice = newCostBasis / newQty;

      existing.qty = newQty.toString();
      existing.qty_available = newQty.toString();
      existing.cost_basis = newCostBasis.toString();
      existing.avg_entry_price = avgPrice.toString();
      existing.market_value = (newQty * price).toString();
    } else {
      mockPositions.set(symbol, {
        asset_id: `asset-${symbol}`,
        symbol,
        exchange: "NASDAQ",
        asset_class: "us_equity",
        asset_marginable: true,
        avg_entry_price: price.toString(),
        qty: qty.toString(),
        qty_available: qty.toString(),
        side: "long",
        market_value: (qty * price).toString(),
        cost_basis: (qty * price).toString(),
        unrealized_pl: "0",
        unrealized_plpc: "0",
        unrealized_intraday_pl: "0",
        unrealized_intraday_plpc: "0",
        current_price: price.toString(),
        lastday_price: price.toString(),
        change_today: "0",
      });
    }
  } else if (side === "SELL" && existing) {
    const newQty = parseFloat(existing.qty) - qty;
    if (newQty <= 0) {
      mockPositions.delete(symbol);
    } else {
      existing.qty = newQty.toString();
      existing.qty_available = newQty.toString();
      existing.market_value = (newQty * price).toString();
    }
  }
}

// ============================================
// API METHODS
// ============================================

/**
 * Fetch real-time quote for an ETF
 */
export async function getQuote(symbol: EtfSymbol): Promise<EtfQuoteResponse> {
  if (!isValidEtfSymbol(symbol)) {
    throw new Error(`Invalid ETF symbol: ${symbol}`);
  }

  // Get market status
  const marketStatus = await getMarketStatus();

  // Mock mode
  if (shouldUseMock()) {
    const quote = MOCK_QUOTES[symbol];
    const midPrice = (quote.askPrice + quote.bidPrice) / 2;
    const spread = quote.askPrice - quote.bidPrice;

    return {
      symbol,
      askPrice: quote.askPrice,
      bidPrice: quote.bidPrice,
      midPrice,
      spread,
      spreadPercent: (spread / midPrice) * 100,
      marketStatus,
      timestamp: new Date().toISOString(),
    };
  }

  const headers = getHeaders();

  try {
    // Use latest quote endpoint
    const response = await fetch(
      `${ALPACA_DATA_API_URL}/v2/stocks/${symbol}/quotes/latest`,
      { headers }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Quote fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const quote = data.quote;

    const askPrice = quote.ap || 0;
    const bidPrice = quote.bp || 0;
    const midPrice = (askPrice + bidPrice) / 2;
    const spread = askPrice - bidPrice;

    return {
      symbol,
      askPrice,
      bidPrice,
      midPrice,
      spread,
      spreadPercent: midPrice > 0 ? (spread / midPrice) * 100 : 0,
      marketStatus,
      timestamp: quote.t || new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[Alpaca] Failed to fetch quote for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Place an order
 */
export async function placeOrder(
  request: PlaceOrderRequest
): Promise<PlaceOrderResponse> {
  // Validate symbol
  if (!isValidEtfSymbol(request.symbol)) {
    return { success: false, error: `Invalid ETF symbol: ${request.symbol}` };
  }

  // Validate order limits
  if (request.notional !== undefined) {
    if (request.notional < ORDER_LIMITS.MIN_NOTIONAL_USD) {
      return {
        success: false,
        error: `Minimum order amount is $${ORDER_LIMITS.MIN_NOTIONAL_USD}`,
      };
    }
    if (request.notional > ORDER_LIMITS.MAX_NOTIONAL_USD) {
      return {
        success: false,
        error: `Maximum order amount is $${ORDER_LIMITS.MAX_NOTIONAL_USD.toLocaleString()}`,
      };
    }
  }

  if (request.qty !== undefined && request.qty < ORDER_LIMITS.MIN_QTY) {
    return {
      success: false,
      error: `Minimum order quantity is ${ORDER_LIMITS.MIN_QTY}`,
    };
  }

  // Validate limit orders have a price
  if (request.type === "LIMIT" && !request.limitPrice) {
    return { success: false, error: "Limit orders require a limit price" };
  }

  // Mock mode
  if (shouldUseMock()) {
    const order = generateMockOrder(request);
    return { success: true, order };
  }

  const headers = getHeaders();
  const baseUrl = getTradingApiUrl();

  try {
    // Build order payload
    const payload: Record<string, unknown> = {
      symbol: request.symbol,
      side: request.side.toLowerCase(),
      type: request.type.toLowerCase(),
      time_in_force: request.timeInForce || TIME_IN_FORCE.DAY,
    };

    // Use notional for dollar-based orders, qty for share-based
    if (request.notional !== undefined) {
      payload.notional = request.notional.toString();
    } else if (request.qty !== undefined) {
      payload.qty = request.qty.toString();
    } else {
      return { success: false, error: "Order requires notional or qty" };
    }

    if (request.limitPrice !== undefined) {
      payload.limit_price = request.limitPrice.toString();
    }

    if (request.clientOrderId) {
      payload.client_order_id = request.clientOrderId;
    }

    const response = await fetch(`${baseUrl}/v2/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || `Order placement failed: ${response.status}`,
      };
    }

    const order: AlpacaOrder = await response.json();
    return { success: true, order };
  } catch (error) {
    console.error("[Alpaca] Failed to place order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Order placement failed",
    };
  }
}

/**
 * Get order by ID
 */
export async function getOrder(orderId: string): Promise<AlpacaOrder | null> {
  // Mock mode
  if (shouldUseMock()) {
    return mockOrders.get(orderId) || null;
  }

  const headers = getHeaders();
  const baseUrl = getTradingApiUrl();

  try {
    const response = await fetch(`${baseUrl}/v2/orders/${orderId}`, {
      headers,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch order: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[Alpaca] Failed to fetch order:", error);
    throw error;
  }
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string): Promise<boolean> {
  // Mock mode
  if (shouldUseMock()) {
    const order = mockOrders.get(orderId);
    if (order && order.status === "new") {
      order.status = "canceled";
      order.canceled_at = new Date().toISOString();
      return true;
    }
    return false;
  }

  const headers = getHeaders();
  const baseUrl = getTradingApiUrl();

  try {
    const response = await fetch(`${baseUrl}/v2/orders/${orderId}`, {
      method: "DELETE",
      headers,
    });

    return response.ok || response.status === 204;
  } catch (error) {
    console.error("[Alpaca] Failed to cancel order:", error);
    return false;
  }
}

/**
 * Get all positions
 */
export async function getPositions(): Promise<EtfPosition[]> {
  // Mock mode
  if (shouldUseMock()) {
    return Array.from(mockPositions.values())
      .filter((p) => isValidEtfSymbol(p.symbol))
      .map((p) => ({
        symbol: p.symbol as EtfSymbol,
        qty: parseFloat(p.qty),
        avgEntryPrice: parseFloat(p.avg_entry_price),
        currentPrice: parseFloat(p.current_price),
        marketValue: parseFloat(p.market_value),
        costBasis: parseFloat(p.cost_basis),
        unrealizedPl: parseFloat(p.unrealized_pl),
        unrealizedPlPercent: parseFloat(p.unrealized_plpc) * 100,
      }));
  }

  const headers = getHeaders();
  const baseUrl = getTradingApiUrl();

  try {
    const response = await fetch(`${baseUrl}/v2/positions`, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch positions: ${response.status}`);
    }

    const positions: AlpacaPosition[] = await response.json();

    // Filter to only ETF positions
    return positions
      .filter((p) => isValidEtfSymbol(p.symbol))
      .map((p) => ({
        symbol: p.symbol as EtfSymbol,
        qty: parseFloat(p.qty),
        avgEntryPrice: parseFloat(p.avg_entry_price),
        currentPrice: parseFloat(p.current_price),
        marketValue: parseFloat(p.market_value),
        costBasis: parseFloat(p.cost_basis),
        unrealizedPl: parseFloat(p.unrealized_pl),
        unrealizedPlPercent: parseFloat(p.unrealized_plpc) * 100,
      }));
  } catch (error) {
    console.error("[Alpaca] Failed to fetch positions:", error);
    throw error;
  }
}

/**
 * Get position for a specific symbol
 */
export async function getPosition(symbol: EtfSymbol): Promise<EtfPosition | null> {
  if (!isValidEtfSymbol(symbol)) {
    return null;
  }

  // Mock mode
  if (shouldUseMock()) {
    const position = mockPositions.get(symbol);
    if (!position) return null;

    return {
      symbol,
      qty: parseFloat(position.qty),
      avgEntryPrice: parseFloat(position.avg_entry_price),
      currentPrice: parseFloat(position.current_price),
      marketValue: parseFloat(position.market_value),
      costBasis: parseFloat(position.cost_basis),
      unrealizedPl: parseFloat(position.unrealized_pl),
      unrealizedPlPercent: parseFloat(position.unrealized_plpc) * 100,
    };
  }

  const headers = getHeaders();
  const baseUrl = getTradingApiUrl();

  try {
    const response = await fetch(`${baseUrl}/v2/positions/${symbol}`, {
      headers,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch position: ${response.status}`);
    }

    const p: AlpacaPosition = await response.json();

    return {
      symbol: p.symbol as EtfSymbol,
      qty: parseFloat(p.qty),
      avgEntryPrice: parseFloat(p.avg_entry_price),
      currentPrice: parseFloat(p.current_price),
      marketValue: parseFloat(p.market_value),
      costBasis: parseFloat(p.cost_basis),
      unrealizedPl: parseFloat(p.unrealized_pl),
      unrealizedPlPercent: parseFloat(p.unrealized_plpc) * 100,
    };
  } catch (error) {
    console.error("[Alpaca] Failed to fetch position:", error);
    throw error;
  }
}

/**
 * Get account information
 */
export async function getAccount(): Promise<AlpacaAccount | null> {
  // Mock mode
  if (shouldUseMock()) {
    return {
      id: "mock-account",
      account_number: "MOCK123456",
      status: "ACTIVE",
      crypto_status: "ACTIVE",
      currency: "USD",
      buying_power: "100000",
      regt_buying_power: "100000",
      daytrading_buying_power: "0",
      non_marginable_buying_power: "100000",
      cash: "100000",
      accrued_fees: "0",
      pending_transfer_out: "0",
      pending_transfer_in: "0",
      portfolio_value: "100000",
      pattern_day_trader: false,
      trading_blocked: false,
      transfers_blocked: false,
      account_blocked: false,
      created_at: new Date().toISOString(),
      trade_suspended_by_user: false,
      multiplier: "1",
      shorting_enabled: false,
      equity: "100000",
      last_equity: "100000",
      long_market_value: "0",
      short_market_value: "0",
      initial_margin: "0",
      maintenance_margin: "0",
      last_maintenance_margin: "0",
      sma: "0",
      daytrade_count: 0,
    };
  }

  const headers = getHeaders();
  const baseUrl = getTradingApiUrl();

  try {
    const response = await fetch(`${baseUrl}/v2/account`, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch account: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[Alpaca] Failed to fetch account:", error);
    return null;
  }
}
