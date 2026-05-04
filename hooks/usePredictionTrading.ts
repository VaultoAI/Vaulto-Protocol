"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  /** With graph overlay, this is implied valuation USD at trade time. */
  entryPrice: number;
  /** With graph overlay, this is the live implied valuation USD. */
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  entryGraphValuationUsd?: number;
  currentGraphValuationUsd?: number;
  entryFairSellValueUsd?: number;
  entrySpreadCostUsd?: number;
  entryFairSellEstimated?: boolean;
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
  // Alternative field names that Vaulto API might use
  shares?: number;
  totalShares?: number;
  entryPrice?: number;
  avgPrice?: number;
  error?: string;
}

export interface SellPositionParams {
  positionId: string;
  shares?: number;
  percentage?: number;
  totalShares?: number;
  // Additional metadata for database logging
  eventId?: string;
  eventName?: string;
  company?: string;
  side?: "LONG" | "SHORT";
  costBasis?: number;
  avgEntryPrice?: number;
}

export interface SellPositionResponse {
  success: boolean;
  proceeds?: number;
  sharesSold?: number;
  percentageSold?: number;
  remainingShares?: number;
  exitPrice?: number;
  error?: string;
}

export interface CloseAndWithdrawParams {
  positionId: string;
  withdrawToAddress?: string;
}

export interface CloseAndWithdrawResponse {
  success: boolean;
  sellProceeds?: number;
  newBalance?: number;
  withdrawalId?: string;
  withdrawalStatus?: string;
  txHash?: string;
  withdrawalPending?: boolean;
  message?: string;
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

interface BuyPositionWithAuthParams extends BuyPositionParams {
  privyToken: string;
}

async function buyPosition(params: BuyPositionWithAuthParams): Promise<BuyPositionResponse> {
  const { privyToken, ...tradeParams } = params;

  const res = await fetch("/api/trading/buy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-privy-token": privyToken,
    },
    body: JSON.stringify(tradeParams),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to place trade");
  }

  return data;
}

interface SellPositionWithAuthParams extends SellPositionParams {
  privyToken: string;
}

async function sellPosition(params: SellPositionWithAuthParams): Promise<SellPositionResponse> {
  const {
    privyToken,
    positionId,
    shares,
    percentage,
    totalShares,
    eventId,
    eventName,
    company,
    side,
    costBasis,
    avgEntryPrice,
  } = params;

  const res = await fetch("/api/trading/sell", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-privy-token": privyToken,
    },
    body: JSON.stringify({
      positionId,
      shares,
      percentage,
      totalShares,
      eventId,
      eventName,
      company,
      side,
      costBasis,
      avgEntryPrice,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || "Failed to sell position") as Error & { code?: string };
    if (data.errorCode) err.code = data.errorCode;
    throw err;
  }

  return data;
}

interface CloseAndWithdrawWithAuthParams extends CloseAndWithdrawParams {
  privyToken: string;
}

async function closeAndWithdrawPosition(
  params: CloseAndWithdrawWithAuthParams
): Promise<CloseAndWithdrawResponse> {
  const { privyToken, positionId, withdrawToAddress } = params;

  const res = await fetch("/api/trading/close-and-withdraw", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-privy-token": privyToken,
    },
    body: JSON.stringify({ positionId, withdrawToAddress }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to close position");
  }

  return data;
}

// ============================================
// CREDENTIAL SETUP API FUNCTIONS
// ============================================

async function ensureCredentialsAtomic(
  privyToken: string
): Promise<{ ready: boolean; error?: string }> {
  const res = await fetch("/api/trading/ensure-credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-privy-token": privyToken,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to ensure trading credentials");
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
  const { getAccessToken } = usePrivy();

  // Track credential setup state
  const [isSettingUpCredentials, setIsSettingUpCredentials] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);

  // Track fund preparation state (shown when preparing funds before buy)
  const [isPreparingFunds, setIsPreparingFunds] = useState(false);

  // Ensure credentials are set up before trading.
  // Uses atomic /api/trading/ensure-credentials which upserts the wallet and
  // derives Polymarket credentials in one server call. Idempotent and safe
  // to call before every trade.
  const ensureCredentials = useCallback(async (): Promise<boolean> => {
    setIsSettingUpCredentials(true);
    setCredentialsError(null);

    try {
      const privyToken = await getAccessToken();
      if (!privyToken) {
        throw new Error("Failed to get authentication token. Please try logging in again.");
      }

      let result = await ensureCredentialsAtomic(privyToken);
      if (!result.ready) {
        await new Promise((r) => setTimeout(r, 500));
        result = await ensureCredentialsAtomic(privyToken);
      }
      if (!result.ready) {
        throw new Error(result.error || "Trading credentials setup did not complete");
      }
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to setup trading credentials";
      console.error("[usePredictionTrading] Credential setup failed:", errorMsg, error);
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

  // Close and withdraw mutation
  const closeAndWithdrawMutation = useMutation({
    mutationFn: closeAndWithdrawPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prediction-positions"] });
      queryClient.invalidateQueries({ queryKey: ["trading-wallet-balance"] });
      queryClient.invalidateQueries({ queryKey: ["on-chain-transactions"] });
    },
  });

  // Convenience functions for buying long/short (ensures credentials, then uses Privy auth)
  const buyLong = async (eventId: string, amount: number): Promise<BuyPositionResponse> => {
    // Ensure credentials are set up before trading
    const credentialsReady = await ensureCredentials();
    if (!credentialsReady) {
      throw new Error(credentialsError || "Trading credentials not configured. Please try again.");
    }

    // Get Privy token for authentication
    const privyToken = await getAccessToken();
    if (!privyToken) {
      throw new Error("Failed to get authentication token. Please try logging in again.");
    }

    const params = { eventId, side: "LONG" as const, amount };
    return buyMutation.mutateAsync({ ...params, privyToken });
  };

  const buyShort = async (eventId: string, amount: number): Promise<BuyPositionResponse> => {
    // Ensure credentials are set up before trading
    const credentialsReady = await ensureCredentials();
    if (!credentialsReady) {
      throw new Error(credentialsError || "Trading credentials not configured. Please try again.");
    }

    // Get Privy token for authentication
    const privyToken = await getAccessToken();
    if (!privyToken) {
      throw new Error("Failed to get authentication token. Please try logging in again.");
    }

    const params = { eventId, side: "SHORT" as const, amount };
    return buyMutation.mutateAsync({ ...params, privyToken });
  };

  // Sell helper (ensures credentials, then uses Privy auth)
  // Accepts either shares (with totalShares) or percentage
  // Also accepts position metadata for database logging
  const sell = async (
    positionId: string,
    options?: {
      shares?: number;
      percentage?: number;
      totalShares?: number;
      eventId?: string;
      eventName?: string;
      company?: string;
      side?: "LONG" | "SHORT";
      costBasis?: number;
      avgEntryPrice?: number;
    }
  ): Promise<SellPositionResponse> => {
    // Ensure credentials are set up before trading
    const credentialsReady = await ensureCredentials();
    if (!credentialsReady) {
      throw new Error(credentialsError || "Trading credentials not configured. Please try again.");
    }

    // Get Privy token for authentication
    const privyToken = await getAccessToken();
    if (!privyToken) {
      throw new Error("Failed to get authentication token. Please try logging in again.");
    }

    const params = {
      positionId,
      shares: options?.shares,
      percentage: options?.percentage,
      totalShares: options?.totalShares,
      eventId: options?.eventId,
      eventName: options?.eventName,
      company: options?.company,
      side: options?.side,
      costBasis: options?.costBasis,
      avgEntryPrice: options?.avgEntryPrice,
    };
    return sellMutation.mutateAsync({ ...params, privyToken });
  };

  // Convenience method: sell by percentage (1-100)
  const sellPercentage = async (
    positionId: string,
    percentage: number
  ): Promise<SellPositionResponse> => {
    return sell(positionId, { percentage });
  };

  // Convenience method: sell all (100%)
  const sellAll = async (positionId: string): Promise<SellPositionResponse> => {
    return sell(positionId, { percentage: 100 });
  };

  // Close position and optionally withdraw to external address
  const closeAndWithdraw = async (
    positionId: string,
    withdrawToAddress?: string
  ): Promise<CloseAndWithdrawResponse> => {
    // Ensure credentials are set up before trading
    const credentialsReady = await ensureCredentials();
    if (!credentialsReady) {
      throw new Error(credentialsError || "Trading credentials not configured. Please try again.");
    }

    // Get Privy token for authentication
    const privyToken = await getAccessToken();
    if (!privyToken) {
      throw new Error("Failed to get authentication token. Please try logging in again.");
    }

    return closeAndWithdrawMutation.mutateAsync({
      positionId,
      withdrawToAddress,
      privyToken,
    });
  };

  // Helper to get ALL positions for a specific event (may have multiple bands)
  const getPositionsForEvent = (eventId: string, side?: "LONG" | "SHORT"): PredictionPosition[] => {
    if (!positionsData?.positions) return [];
    return positionsData.positions.filter(
      (p) => p.eventId === eventId && (side === undefined || p.side === side)
    );
  };

  // Helper to get aggregated position for a specific event (combines all bands)
  const getPositionForEvent = (eventId: string, side?: "LONG" | "SHORT"): PredictionPosition | null => {
    const positions = getPositionsForEvent(eventId, side);
    if (positions.length === 0) return null;
    if (positions.length === 1) return positions[0];

    // Aggregate multiple positions into one
    const totalShares = positions.reduce((sum, p) => sum + p.shares, 0);
    const totalCostBasis = positions.reduce((sum, p) => sum + p.costBasis, 0);
    const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const avgEntryPrice = totalShares > 0 ? totalCostBasis / totalShares : 0;
    const avgCurrentPrice = totalShares > 0 ? totalMarketValue / totalShares : 0;
    const unrealizedPnlPercent = totalCostBasis > 0 ? (totalUnrealizedPnl / totalCostBasis) * 100 : 0;

    // Return aggregated position using first position as base
    return {
      ...positions[0],
      shares: totalShares,
      entryPrice: avgEntryPrice,
      currentPrice: avgCurrentPrice,
      marketValue: totalMarketValue,
      costBasis: totalCostBasis,
      unrealizedPnl: totalUnrealizedPnl,
      unrealizedPnlPercent,
    };
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

      // Get Privy token for authentication
      const privyToken = await getAccessToken();
      if (!privyToken) {
        throw new Error("Failed to get authentication token. Please try logging in again.");
      }

      return buyMutation.mutateAsync({ ...params, privyToken });
    },
    isBuying: buyMutation.isPending || isSettingUpCredentials || isPreparingFunds,
    isPreparingFunds,
    buyError: buyMutation.error,
    buyMutation,

    sell,
    sellPercentage,
    sellAll,
    isSelling: sellMutation.isPending || isSettingUpCredentials,
    sellError: sellMutation.error,
    sellMutation,

    closeAndWithdraw,
    isClosingAndWithdrawing: closeAndWithdrawMutation.isPending || isSettingUpCredentials,
    closeAndWithdrawError: closeAndWithdrawMutation.error,
    closeAndWithdrawMutation,

    // Helpers
    getPositionForEvent,
    getPositionsForEvent,
    hasPosition,
  };
}
