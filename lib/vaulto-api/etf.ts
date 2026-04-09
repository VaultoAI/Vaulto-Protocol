/**
 * Vaulto-API ETF Client
 *
 * Client for interacting with the Vaulto-API ETF trading endpoints.
 */

import { getVaultoApiUrl } from "./config";

// ============================================
// TYPES
// ============================================

export interface QuoteResponse {
  symbol: string;
  askPrice: number;
  bidPrice: number;
  midPrice: number;
  spread: number;
  spreadPercent: number;
  fractionable: boolean;
  marketStatus: {
    isOpen: boolean;
    nextOpen: string | null;
    nextClose: string | null;
  };
  timestamp: string;
}

export interface PlaceOrderParams {
  tradingWalletId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  notionalUsd?: number;
  qty?: number;
  limitPrice?: number;
}

export interface EtfOrder {
  id: string;
  alpacaOrderId: string | null;
  symbol: string;
  side: string;
  type: string;
  status: string;
  statusMessage: string | null;
  notionalUsd: number | null;
  qty: number | null;
  limitPrice: number | null;
  filledQty: number;
  filledAvgPrice: number | null;
  createdAt: string;
  submittedAt: string | null;
  filledAt: string | null;
}

export interface PlaceOrderResponse {
  success: boolean;
  order?: EtfOrder;
  error?: string;
}

export interface EtfPosition {
  id: string;
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number | null;
  costBasis: number;
  marketValue: number | null;
  unrealizedPl: number | null;
  lastSyncedAt: string | null;
}

export interface PositionsResponse {
  positions: EtfPosition[];
  totals: {
    costBasis: number;
    marketValue: number;
    unrealizedPl: number;
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getBaseUrl(): string {
  return getVaultoApiUrl();
}

function getHeaders(apiKey: string, userId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  };
  if (userId) {
    headers['x-user-id'] = userId;
  }
  return headers;
}

async function handleResponse<T>(response: Response, url: string): Promise<T> {
  let data: unknown;
  const contentType = response.headers.get('content-type');

  try {
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error(`[Vaulto API] Non-JSON response from ${url}:`, {
        status: response.status,
        contentType,
        body: text.slice(0, 500),
      });
      throw new Error(`Unexpected response format: ${response.status} ${contentType}`);
    }
  } catch (parseError) {
    if (parseError instanceof Error && parseError.message.startsWith('Unexpected response')) {
      throw parseError;
    }
    console.error(`[Vaulto API] Failed to parse response from ${url}:`, parseError);
    throw new Error(`Failed to parse API response: ${response.status}`);
  }

  if (!response.ok) {
    const errorData = data as { error?: string; message?: string };
    const errorMsg = errorData?.error || errorData?.message || `Request failed: ${response.status}`;
    console.error(`[Vaulto API] Error response from ${url}:`, {
      status: response.status,
      error: errorMsg,
      data,
    });
    throw new Error(errorMsg);
  }

  return data as T;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Fetch quote for an ETF symbol
 */
export async function fetchEtfQuote(symbol: string, apiKey: string): Promise<QuoteResponse> {
  const url = `${getBaseUrl()}/api/etf/quote?symbol=${encodeURIComponent(symbol)}`;

  console.log(`[Vaulto API] Fetching quote: ${url}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(apiKey),
  });

  return handleResponse<QuoteResponse>(response, url);
}

/**
 * Place an ETF order
 */
export async function placeEtfOrder(
  params: PlaceOrderParams,
  apiKey: string,
  userId: string
): Promise<PlaceOrderResponse> {
  const url = `${getBaseUrl()}/api/etf/order`;

  console.log(`[Vaulto API] Placing order: ${url}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(apiKey, userId),
    body: JSON.stringify(params),
  });

  return handleResponse<PlaceOrderResponse>(response, url);
}

/**
 * Fetch user's ETF positions
 */
export async function fetchEtfPositions(
  apiKey: string,
  userId: string
): Promise<PositionsResponse> {
  const url = `${getBaseUrl()}/api/etf/positions`;

  console.log(`[Vaulto API] Fetching positions: ${url}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(apiKey, userId),
  });

  return handleResponse<PositionsResponse>(response, url);
}

/**
 * Fetch an order by ID
 */
export async function fetchEtfOrder(
  orderId: string,
  apiKey: string,
  userId: string
): Promise<EtfOrder> {
  const url = `${getBaseUrl()}/api/etf/order/${encodeURIComponent(orderId)}`;

  console.log(`[Vaulto API] Fetching order: ${url}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(apiKey, userId),
  });

  return handleResponse<EtfOrder>(response, url);
}

/**
 * Cancel an order
 */
export async function cancelEtfOrder(
  orderId: string,
  apiKey: string,
  userId: string
): Promise<{ success: boolean }> {
  const url = `${getBaseUrl()}/api/etf/order/${encodeURIComponent(orderId)}`;

  console.log(`[Vaulto API] Cancelling order: ${url}`);
  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(apiKey, userId),
  });

  return handleResponse<{ success: boolean }>(response, url);
}
