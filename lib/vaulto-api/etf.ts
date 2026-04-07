/**
 * Vaulto-API ETF Client
 *
 * Client for interacting with the Vaulto-API ETF trading endpoints.
 */

const VAULTO_API_URL = process.env.VAULTO_API_URL || process.env.NEXT_PUBLIC_VAULTO_API_URL;

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
  if (!VAULTO_API_URL) {
    throw new Error('VAULTO_API_URL not configured');
  }
  return VAULTO_API_URL;
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

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed: ${response.status}`;
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

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(apiKey),
  });

  return handleResponse<QuoteResponse>(response);
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

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(apiKey, userId),
    body: JSON.stringify(params),
  });

  return handleResponse<PlaceOrderResponse>(response);
}

/**
 * Fetch user's ETF positions
 */
export async function fetchEtfPositions(
  apiKey: string,
  userId: string
): Promise<PositionsResponse> {
  const url = `${getBaseUrl()}/api/etf/positions`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(apiKey, userId),
  });

  return handleResponse<PositionsResponse>(response);
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

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(apiKey, userId),
  });

  return handleResponse<EtfOrder>(response);
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

  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(apiKey, userId),
  });

  return handleResponse<{ success: boolean }>(response);
}
