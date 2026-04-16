/**
 * Vaulto-API Prediction Market Trading Client
 *
 * Client for interacting with the Vaulto-API prediction market trading endpoints.
 * Routes all trades through Vaulto API which handles Polymarket complexity:
 * - L2 credentials
 * - Order signing
 * - Band distribution
 * - Position tracking
 */

import { getVaultoApiUrl } from "./config";

// ============================================
// TYPES
// ============================================

export interface BuyPositionParams {
  eventId: string;
  side: "LONG" | "SHORT";
  amount: number; // USD amount
}

export interface BuyPositionOrder {
  bandId: string;
  price: number;
  size: number;
  status: "MATCHED" | "PARTIAL" | "PENDING" | "FAILED";
}

export interface BuyPositionResponse {
  success: boolean;
  positionId?: string;
  orders?: BuyPositionOrder[];
  totalCost?: number;
  averagePrice?: number;
  error?: string;
}

export interface PredictionPosition {
  id: string;
  eventId: string;
  eventName?: string;
  company?: string;
  side: "LONG" | "SHORT";
  shares: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  createdAt: string;
}

export interface PositionsResponse {
  positions: PredictionPosition[];
  totals: {
    totalValue: number;
    totalCost: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
  };
}

export interface SellPositionParams {
  positionId: string;
  shares?: number; // Optional: sell specific amount, otherwise sell all
}

export interface SellPositionResponse {
  success: boolean;
  proceeds?: number;
  error?: string;
}

// Credential setup types
export interface SetupWalletResponse {
  success: boolean;
  walletId?: string;
  walletAddress?: string;
  error?: string;
}

export interface DeriveCredentialsResponse {
  success: boolean;
  error?: string;
}

export interface CredentialsStatusResponse {
  hasCredentials: boolean;
  error?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getBaseUrl(): string {
  return getVaultoApiUrl();
}

interface WalletSignature {
  nonce: string;
  signature: string;
}

function getHeaders(apiKey: string, userId?: string, walletSignature?: WalletSignature): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };
  if (userId) {
    headers["x-user-id"] = userId;
  }
  if (walletSignature) {
    headers["x-wallet-nonce"] = walletSignature.nonce;
    headers["x-wallet-signature"] = walletSignature.signature;
  }
  return headers;
}

function getAuthHeaders(apiKey: string, privyAuthToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "Authorization": `Bearer ${privyAuthToken}`,
  };
}

async function handleResponse<T>(response: Response, url: string): Promise<T> {
  let data: unknown;
  const contentType = response.headers.get("content-type");

  try {
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error(`[Vaulto Trading API] Non-JSON response from ${url}:`, {
        status: response.status,
        contentType,
        body: text.slice(0, 500),
      });
      throw new Error(`Unexpected response format: ${response.status} ${contentType}`);
    }
  } catch (parseError) {
    if (parseError instanceof Error && parseError.message.startsWith("Unexpected response")) {
      throw parseError;
    }
    console.error(`[Vaulto Trading API] Failed to parse response from ${url}:`, parseError);
    throw new Error(`Failed to parse API response: ${response.status}`);
  }

  if (!response.ok) {
    const errorData = data as { error?: string; message?: string };
    const errorMsg = errorData?.error || errorData?.message || `Request failed: ${response.status}`;
    console.error(`[Vaulto Trading API] Error response from ${url}:`, {
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
 * Buy a prediction market position (LONG or SHORT)
 *
 * Routes through Vaulto API which handles all Polymarket complexity.
 * Supports either Privy auth token or wallet signature for authorization.
 */
export async function buyPosition(
  params: BuyPositionParams,
  apiKey: string,
  userId: string,
  auth?: { privyToken?: string; walletSignature?: WalletSignature }
): Promise<BuyPositionResponse> {
  const url = `${getBaseUrl()}/api/trading/buy`;

  console.log(`[Vaulto Trading API] Buying position:`, {
    eventId: params.eventId,
    side: params.side,
    amount: params.amount,
  });

  // Use Privy auth if available, otherwise fall back to wallet signature
  const headers = auth?.privyToken
    ? getAuthHeaders(apiKey, auth.privyToken)
    : getHeaders(apiKey, userId, auth?.walletSignature);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  return handleResponse<BuyPositionResponse>(response, url);
}

/**
 * Fetch user's prediction market positions
 */
export async function fetchPositions(
  apiKey: string,
  userId: string
): Promise<PositionsResponse> {
  const url = `${getBaseUrl()}/api/trading/positions`;

  console.log(`[Vaulto Trading API] Fetching positions for user`);
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(apiKey, userId),
  });

  return handleResponse<PositionsResponse>(response, url);
}

/**
 * Sell a prediction market position
 * Supports either Privy auth token or wallet signature for authorization.
 */
export async function sellPosition(
  params: SellPositionParams,
  apiKey: string,
  userId: string,
  auth?: { privyToken?: string; walletSignature?: WalletSignature }
): Promise<SellPositionResponse> {
  const url = `${getBaseUrl()}/api/trading/sell`;

  console.log(`[Vaulto Trading API] Selling position:`, {
    positionId: params.positionId,
    shares: params.shares,
  });

  // Use Privy auth if available, otherwise fall back to wallet signature
  const headers = auth?.privyToken
    ? getAuthHeaders(apiKey, auth.privyToken)
    : getHeaders(apiKey, userId, auth?.walletSignature);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  return handleResponse<SellPositionResponse>(response, url);
}

/**
 * Fetch a specific position by ID
 */
export async function fetchPosition(
  positionId: string,
  apiKey: string,
  userId: string
): Promise<PredictionPosition> {
  const url = `${getBaseUrl()}/api/trading/positions/${encodeURIComponent(positionId)}`;

  console.log(`[Vaulto Trading API] Fetching position: ${positionId}`);
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(apiKey, userId),
  });

  return handleResponse<PredictionPosition>(response, url);
}

// ============================================
// CREDENTIAL SETUP FUNCTIONS
// ============================================

/**
 * Setup/sync Privy wallet on Vaulto API
 * This registers the user's Privy embedded wallet for trading.
 */
export async function setupWallet(
  apiKey: string,
  privyAuthToken: string
): Promise<SetupWalletResponse> {
  const url = `${getBaseUrl()}/api/trading/setup-wallet`;

  console.log(`[Vaulto Trading API] Setting up wallet`);

  const response = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(apiKey, privyAuthToken),
  });

  return handleResponse<SetupWalletResponse>(response, url);
}

/**
 * Derive Polymarket API credentials from wallet signature
 * This creates the trading credentials needed for Polymarket trades.
 */
export async function deriveCredentials(
  apiKey: string,
  privyAuthToken: string
): Promise<DeriveCredentialsResponse> {
  const url = `${getBaseUrl()}/api/trading/derive-credentials`;

  console.log(`[Vaulto Trading API] Deriving credentials`);

  const response = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(apiKey, privyAuthToken),
  });

  return handleResponse<DeriveCredentialsResponse>(response, url);
}

/**
 * Check if user has trading credentials configured
 */
export async function checkCredentialsStatus(
  apiKey: string,
  userId: string
): Promise<CredentialsStatusResponse> {
  const url = `${getBaseUrl()}/api/trading/credentials-status?userId=${encodeURIComponent(userId)}`;

  console.log(`[Vaulto Trading API] Checking credentials status`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
  });

  return handleResponse<CredentialsStatusResponse>(response, url);
}
