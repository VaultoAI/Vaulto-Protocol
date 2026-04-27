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
  marketValue: number;
  costBasis: number;
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
  shares?: number; // Optional: sell specific share count
  percentage?: number; // Optional: sell percentage (1-100)
  totalShares?: number; // Required to calculate % from shares
}

export interface SellPositionResponse {
  success: boolean;
  proceeds?: number;
  sharesSold?: number;
  percentageSold?: number;
  remainingShares?: number;
  error?: string;
}

// Credential setup types
export interface SetupWalletResponse {
  success: boolean;
  walletId?: string;
  walletAddress?: string;
  polymarketAddress?: string; // Safe wallet address for trading
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

// Fund transfer types
export interface PrepareFundsResponse {
  success: boolean;
  ready: boolean;
  transactions?: {
    swapTxHash?: string;
    transferTxHash?: string;
  };
  balances?: {
    privyUsdcNative: string;
    privyUsdcBridged: string;
    safeUsdcBridged: string;
  };
  error?: string;
}

export interface ReturnFundsResponse {
  success: boolean;
  transactions?: {
    transferTxHash?: string;
    swapTxHash?: string;
  };
  amountReturned?: string;
  error?: string;
}

export interface WalletInfoResponse {
  success: boolean;
  eoaAddress?: string;
  safeAddress?: string;
  polymarketAddress?: string;
  safeDeployed?: boolean;
  balances?: {
    eoaUsdcNative: string;
    eoaUsdcBridged: string;
    safeUsdcBridged: string;
  };
  error?: string;
}

export interface CombinedBalanceResponse {
  success: boolean;
  available?: string;
  breakdown?: {
    eoaUsdcNative: string;
    eoaUsdcBridged: string;
    safeUsdcBridged: string;
  };
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

function getAuthHeaders(apiKey: string, privyAuthToken: string, userId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "Authorization": `Bearer ${privyAuthToken}`,
  };
  // Always include x-user-id so Vaulto API can look up credentials by wallet address
  if (userId) {
    headers["x-user-id"] = userId;
  }
  return headers;
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

  // Log successful response for debugging
  console.log(`[Vaulto Trading API] Success response from ${url}:`, JSON.stringify(data, null, 2));

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

  // Use Privy auth if available, otherwise fall back to wallet signature
  // Always include userId so Vaulto API can look up credentials by wallet address
  const headers = auth?.privyToken
    ? getAuthHeaders(apiKey, auth.privyToken, userId)
    : getHeaders(apiKey, userId, auth?.walletSignature);

  console.log(`[Vaulto Trading API] Buying position:`, {
    eventId: params.eventId,
    side: params.side,
    amount: params.amount,
    userId,
    hasPrivyToken: !!auth?.privyToken,
    headers: {
      "x-user-id": headers["x-user-id"] || "(not set)",
      "Authorization": headers["Authorization"] ? "Bearer ***" : "(not set)",
    },
  });

  // Map frontend params to Vaulto API expected params
  const apiParams = {
    eventSlug: params.eventId,      // Vaulto API expects eventSlug
    direction: params.side,          // Vaulto API expects direction (LONG/SHORT)
    amountUsdc: params.amount,       // Vaulto API expects amountUsdc
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(apiParams),
  });

  return handleResponse<BuyPositionResponse>(response, url);
}

// Raw position from Vaulto API (different field names)
interface VaultoApiPosition {
  positionId: number;
  eventSlug: string;
  eventName?: string;
  company?: string;
  direction: "LONG" | "SHORT";
  totalShares: number;
  entryPrice: number;
  currentPrice: number;
  marketValue?: number;
  value?: number; // Alternative field name
  costBasis?: number;
  totalCost?: number; // Alternative field name
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  createdAt: string;
}

interface VaultoApiPositionsResponse {
  positions: VaultoApiPosition[];
  totals: {
    totalValue: number;
    totalCost: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
  };
}

/**
 * Transform Vaulto API position format to frontend format
 */
function transformPosition(apiPosition: VaultoApiPosition): PredictionPosition {
  // Use API values if available (check multiple field names), otherwise calculate
  const costBasis = apiPosition.costBasis ?? apiPosition.totalCost ?? (apiPosition.totalShares * apiPosition.entryPrice);
  const marketValue = apiPosition.marketValue ?? apiPosition.value ?? (costBasis + apiPosition.unrealizedPnl);

  console.log("[Vaulto Trading API] Transform position:", {
    positionId: apiPosition.positionId,
    totalShares: apiPosition.totalShares,
    entryPrice: apiPosition.entryPrice,
    currentPrice: apiPosition.currentPrice,
    apiMarketValue: apiPosition.marketValue,
    apiValue: apiPosition.value,
    apiCostBasis: apiPosition.costBasis,
    apiTotalCost: apiPosition.totalCost,
    calculatedCostBasis: costBasis,
    calculatedMarketValue: marketValue,
    unrealizedPnl: apiPosition.unrealizedPnl,
  });

  return {
    id: String(apiPosition.positionId),
    eventId: apiPosition.eventSlug,
    eventName: apiPosition.eventName,
    company: apiPosition.company,
    side: apiPosition.direction,
    shares: apiPosition.totalShares,
    entryPrice: apiPosition.entryPrice,
    currentPrice: apiPosition.currentPrice,
    marketValue,
    costBasis,
    unrealizedPnl: apiPosition.unrealizedPnl,
    unrealizedPnlPercent: apiPosition.unrealizedPnlPercent,
    createdAt: apiPosition.createdAt,
  };
}

/**
 * Fetch user's prediction market positions
 */
export async function fetchPositions(
  apiKey: string,
  userId: string
): Promise<PositionsResponse> {
  const url = `${getBaseUrl()}/api/trading/positions`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(apiKey, userId),
  });

  const rawData = await handleResponse<VaultoApiPositionsResponse>(response, url);

  // Log raw API response for debugging
  console.log("[Vaulto Trading API] Raw positions response:", JSON.stringify(rawData, null, 2));

  // Transform API response to frontend format
  const transformed = {
    positions: rawData.positions.map(transformPosition),
    totals: rawData.totals,
  };

  console.log("[Vaulto Trading API] Transformed positions:", JSON.stringify(transformed, null, 2));

  return transformed;
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

  // Map frontend params to Vaulto API expected params
  // Vaulto API expects: positionId (int), percentage (1-100)
  // Priority: direct percentage > calculated from shares > 100% (sell all)
  let percentage = 100;

  if (params.percentage !== undefined) {
    // Direct percentage provided
    percentage = Math.min(100, Math.max(1, Math.round(params.percentage)));
  } else if (params.shares !== undefined && params.totalShares !== undefined && params.totalShares > 0) {
    // Calculate percentage from shares
    percentage = Math.min(100, Math.max(1, Math.round((params.shares / params.totalShares) * 100)));
  }
  // Otherwise default to 100% (sell all)

  const apiParams = {
    positionId: parseInt(params.positionId, 10) || params.positionId,
    percentage,
  };

  console.log(`[Vaulto Trading API] Selling position:`, {
    positionId: apiParams.positionId,
    percentage: apiParams.percentage,
    requestedShares: params.shares,
    requestedPercentage: params.percentage,
    totalShares: params.totalShares,
  });

  // Use Privy auth if available, otherwise fall back to wallet signature
  // Always include userId so Vaulto API can look up credentials by wallet address
  const headers = auth?.privyToken
    ? getAuthHeaders(apiKey, auth.privyToken, userId)
    : getHeaders(apiKey, userId, auth?.walletSignature);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(apiParams),
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
  privyAuthToken: string,
  walletAddress?: string
): Promise<SetupWalletResponse> {
  const url = `${getBaseUrl()}/api/trading/setup-wallet`;

  console.log(`[Vaulto Trading API] Setting up wallet`, { walletAddress });

  const response = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(apiKey, privyAuthToken, walletAddress),
  });

  return handleResponse<SetupWalletResponse>(response, url);
}

/**
 * Derive Polymarket API credentials from wallet signature
 * This creates the trading credentials needed for Polymarket trades.
 */
export async function deriveCredentials(
  apiKey: string,
  privyAuthToken: string,
  walletAddress?: string
): Promise<DeriveCredentialsResponse> {
  const url = `${getBaseUrl()}/api/trading/derive-credentials`;

  console.log(`[Vaulto Trading API] Deriving credentials`, { walletAddress });

  const response = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(apiKey, privyAuthToken, walletAddress),
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

// ============================================
// FUND TRANSFER FUNCTIONS
// ============================================

/**
 * Get wallet info including EOA, Safe addresses and balances
 */
export async function getWalletInfo(
  apiKey: string,
  privyAuthToken: string,
  walletAddress?: string
): Promise<WalletInfoResponse> {
  const url = `${getBaseUrl()}/api/trading/wallet-info`;

  console.log(`[Vaulto Trading API] Getting wallet info`);

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(apiKey, privyAuthToken, walletAddress),
  });

  return handleResponse<WalletInfoResponse>(response, url);
}

/**
 * Get combined trading balance across EOA and Safe wallets
 */
export async function getCombinedBalance(
  apiKey: string,
  privyAuthToken: string,
  walletAddress?: string
): Promise<CombinedBalanceResponse> {
  const url = `${getBaseUrl()}/api/trading/combined-balance`;

  console.log(`[Vaulto Trading API] Getting combined balance`);

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(apiKey, privyAuthToken, walletAddress),
  });

  return handleResponse<CombinedBalanceResponse>(response, url);
}

/**
 * Prepare funds for a buy order
 *
 * This will:
 * 1. Check if Safe wallet has enough USDC.e
 * 2. If not, swap USDC to USDC.e if needed
 * 3. Transfer USDC.e from EOA to Safe wallet
 */
export async function prepareFundsForBuy(
  amountUsd: number,
  apiKey: string,
  privyAuthToken: string,
  walletAddress?: string
): Promise<PrepareFundsResponse> {
  const url = `${getBaseUrl()}/api/trading/prepare-funds`;

  console.log(`[Vaulto Trading API] Preparing $${amountUsd} for buy`);

  const response = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(apiKey, privyAuthToken, walletAddress),
    body: JSON.stringify({ amountUsd }),
  });

  return handleResponse<PrepareFundsResponse>(response, url);
}

/**
 * Return funds from Safe to EOA wallet after selling
 *
 * @param swapToNative Whether to swap USDC.e back to USDC
 */
export async function returnFundsAfterSell(
  apiKey: string,
  privyAuthToken: string,
  walletAddress?: string,
  swapToNative: boolean = false
): Promise<ReturnFundsResponse> {
  const url = `${getBaseUrl()}/api/trading/return-funds`;

  console.log(`[Vaulto Trading API] Returning funds, swapToNative=${swapToNative}`);

  const response = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(apiKey, privyAuthToken, walletAddress),
    body: JSON.stringify({ swapToNative }),
  });

  return handleResponse<ReturnFundsResponse>(response, url);
}
