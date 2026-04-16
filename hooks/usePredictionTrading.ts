"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSignMessage } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";

// ============================================
// TYPES
// ============================================

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

export interface BuyPositionParams {
  eventId: string;
  side: "LONG" | "SHORT";
  amount: number;
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

export interface SellPositionParams {
  positionId: string;
  shares?: number;
}

export interface SellPositionResponse {
  success: boolean;
  proceeds?: number;
  error?: string;
}

// ============================================
// API FUNCTIONS
// ============================================

async function fetchPositions(): Promise<PositionsResponse> {
  const res = await fetch("/api/trading/positions");

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch positions");
  }

  return res.json();
}

interface BuyPositionWithSignatureParams extends BuyPositionParams {
  nonce: string;
  signature: string;
}

async function buyPosition(params: BuyPositionWithSignatureParams): Promise<BuyPositionResponse> {
  const { nonce, signature, ...tradeParams } = params;

  const res = await fetch("/api/trading/buy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-wallet-nonce": nonce,
      "x-wallet-signature": signature,
    },
    body: JSON.stringify(tradeParams),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to place trade");
  }

  return data;
}

interface SellPositionWithSignatureParams extends SellPositionParams {
  nonce: string;
  signature: string;
}

async function sellPosition(params: SellPositionWithSignatureParams): Promise<SellPositionResponse> {
  const { nonce, signature, ...sellParams } = params;

  const res = await fetch("/api/trading/sell", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-wallet-nonce": nonce,
      "x-wallet-signature": signature,
    },
    body: JSON.stringify(sellParams),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to sell position");
  }

  return data;
}

// ============================================
// CREDENTIAL SETUP API FUNCTIONS
// ============================================

async function checkCredentialsStatus(): Promise<{ hasCredentials: boolean }> {
  const res = await fetch("/api/trading/credentials-status");

  if (!res.ok) {
    // If check fails, assume no credentials
    return { hasCredentials: false };
  }

  return res.json();
}

async function setupWallet(privyToken: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("/api/trading/setup-wallet", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-privy-token": privyToken,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to setup wallet");
  }

  return data;
}

async function deriveCredentials(privyToken: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("/api/trading/derive-credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-privy-token": privyToken,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to derive credentials");
  }

  return data;
}

// ============================================
// HOOK
// ============================================

interface UsePredictionTradingOptions {
  /** Whether to fetch positions */
  fetchPositions?: boolean;
}

/**
 * Hook for prediction market trading operations.
 *
 * Provides:
 * - Position fetching with auto-refresh
 * - Buy Long/Short mutation
 * - Sell position mutation
 *
 * All trades are routed through Vaulto API which handles
 * Polymarket complexity. Zero wallet signatures required per trade.
 *
 * @example
 * ```tsx
 * const {
 *   positions,
 *   isLoadingPositions,
 *   buyLong,
 *   buyShort,
 *   sell,
 * } = usePredictionTrading();
 *
 * // Buy a long position
 * const handleBuyLong = async () => {
 *   try {
 *     const result = await buyLong("spacex-ipo", 100);
 *     console.log("Position opened:", result.positionId);
 *   } catch (error) {
 *     console.error("Trade failed:", error);
 *   }
 * };
 * ```
 */
export function usePredictionTrading(options: UsePredictionTradingOptions = {}) {
  const { fetchPositions: shouldFetchPositions = true } = options;
  const queryClient = useQueryClient();
  const { signMessageAsync } = useSignMessage();
  const { getAccessToken } = usePrivy();

  // Track credential setup state
  const [isSettingUpCredentials, setIsSettingUpCredentials] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const credentialsSetupAttemptedRef = useRef(false);

  // Generate nonce and sign a trade message
  const signTrade = async (action: string, params: object): Promise<{ nonce: string; signature: string }> => {
    const nonce = Date.now().toString();
    const message = `Vaulto Trade Authorization\n\nAction: ${action}\nParams: ${JSON.stringify(params)}\nNonce: ${nonce}`;

    const signature = await signMessageAsync({ message });
    return { nonce, signature };
  };

  // Ensure credentials are set up before trading
  const ensureCredentials = useCallback(async (): Promise<boolean> => {
    // Check if credentials exist
    const status = await checkCredentialsStatus();

    if (status.hasCredentials) {
      return true;
    }

    // Credentials don't exist, need to set them up
    setIsSettingUpCredentials(true);
    setCredentialsError(null);

    try {
      // Get Privy access token
      const privyToken = await getAccessToken();
      if (!privyToken) {
        throw new Error("Failed to get authentication token. Please try logging in again.");
      }

      console.log("[usePredictionTrading] Setting up trading credentials...");

      // Step 1: Setup wallet on Vaulto API
      await setupWallet(privyToken);
      console.log("[usePredictionTrading] Wallet setup complete");

      // Step 2: Derive Polymarket credentials
      await deriveCredentials(privyToken);
      console.log("[usePredictionTrading] Credentials derived successfully");

      credentialsSetupAttemptedRef.current = true;
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to setup trading credentials";
      console.error("[usePredictionTrading] Credential setup failed:", errorMsg);
      setCredentialsError(errorMsg);
      return false;
    } finally {
      setIsSettingUpCredentials(false);
    }
  }, [getAccessToken]);

  // Positions query
  const {
    data: positionsData,
    isLoading: isLoadingPositions,
    error: positionsError,
    refetch: refetchPositions,
  } = useQuery({
    queryKey: ["prediction-positions"],
    queryFn: fetchPositions,
    enabled: shouldFetchPositions,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // 1 minute
  });

  // Buy position mutation (internal - requires pre-signed params)
  const buyMutation = useMutation({
    mutationFn: buyPosition,
    onSuccess: () => {
      // Invalidate positions and balance after successful trade
      queryClient.invalidateQueries({ queryKey: ["prediction-positions"] });
      queryClient.invalidateQueries({ queryKey: ["trading-wallet-balance"] });
      queryClient.invalidateQueries({ queryKey: ["on-chain-transactions"] });
    },
  });

  // Sell position mutation (internal - requires pre-signed params)
  const sellMutation = useMutation({
    mutationFn: sellPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prediction-positions"] });
      queryClient.invalidateQueries({ queryKey: ["trading-wallet-balance"] });
      queryClient.invalidateQueries({ queryKey: ["on-chain-transactions"] });
    },
  });

  // Convenience functions for buying long/short (ensures credentials, then signs before executing)
  const buyLong = async (eventId: string, amount: number): Promise<BuyPositionResponse> => {
    // Ensure credentials are set up before trading
    const credentialsReady = await ensureCredentials();
    if (!credentialsReady) {
      throw new Error(credentialsError || "Trading credentials not configured. Please try again.");
    }

    const params = { eventId, side: "LONG" as const, amount };
    const { nonce, signature } = await signTrade("BUY", params);
    return buyMutation.mutateAsync({ ...params, nonce, signature });
  };

  const buyShort = async (eventId: string, amount: number): Promise<BuyPositionResponse> => {
    // Ensure credentials are set up before trading
    const credentialsReady = await ensureCredentials();
    if (!credentialsReady) {
      throw new Error(credentialsError || "Trading credentials not configured. Please try again.");
    }

    const params = { eventId, side: "SHORT" as const, amount };
    const { nonce, signature } = await signTrade("BUY", params);
    return buyMutation.mutateAsync({ ...params, nonce, signature });
  };

  // Sell helper (ensures credentials, then signs before executing)
  const sell = async (positionId: string, shares?: number): Promise<SellPositionResponse> => {
    // Ensure credentials are set up before trading
    const credentialsReady = await ensureCredentials();
    if (!credentialsReady) {
      throw new Error(credentialsError || "Trading credentials not configured. Please try again.");
    }

    const params = { positionId, shares };
    const { nonce, signature } = await signTrade("SELL", params);
    return sellMutation.mutateAsync({ ...params, nonce, signature });
  };

  // Helper to get position for a specific event
  const getPositionForEvent = (eventId: string, side?: "LONG" | "SHORT"): PredictionPosition | null => {
    if (!positionsData?.positions) return null;
    return (
      positionsData.positions.find(
        (p) => p.eventId === eventId && (side === undefined || p.side === side)
      ) || null
    );
  };

  // Helper to check if user has a position in an event
  const hasPosition = (eventId: string, side?: "LONG" | "SHORT"): boolean => {
    const position = getPositionForEvent(eventId, side);
    return position !== null && position.shares > 0;
  };

  return {
    // Positions data
    positions: positionsData?.positions || [],
    positionsTotals: positionsData?.totals || null,
    isLoadingPositions,
    positionsError,
    refetchPositions,

    // Credential setup state
    isSettingUpCredentials,
    credentialsError,
    ensureCredentials,

    // Trading functions
    buyLong,
    buyShort,
    buy: async (params: BuyPositionParams) => {
      // Ensure credentials are set up before trading
      const credentialsReady = await ensureCredentials();
      if (!credentialsReady) {
        throw new Error(credentialsError || "Trading credentials not configured. Please try again.");
      }

      const { nonce, signature } = await signTrade("BUY", params);
      return buyMutation.mutateAsync({ ...params, nonce, signature });
    },
    isBuying: buyMutation.isPending || isSettingUpCredentials,
    buyError: buyMutation.error,
    buyMutation,

    sell,
    isSelling: sellMutation.isPending || isSettingUpCredentials,
    sellError: sellMutation.error,
    sellMutation,

    // Helpers
    getPositionForEvent,
    hasPosition,
  };
}
