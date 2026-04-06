"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ============================================
// TYPES
// ============================================

export interface EtfPosition {
  id: string;
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number | null;
  costBasis: number;
  marketValue: number | null;
  unrealizedPl: number | null;
  unrealizedPlPercent: number | null;
  lastSyncedAt: string | null;
}

export interface EtfPositionsResponse {
  positions: EtfPosition[];
  totals: {
    costBasis: number;
    marketValue: number;
    unrealizedPl: number;
    unrealizedPlPercent: number;
  };
}

export interface EtfOrder {
  id: string;
  alpacaOrderId: string | null;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
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

export interface PlaceOrderParams {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  notionalUsd?: number;
  qty?: number;
  limitPrice?: number;
}

export interface PlaceOrderResponse {
  success: boolean;
  order: EtfOrder;
}

// ============================================
// API FUNCTIONS
// ============================================

async function fetchPositions(): Promise<EtfPositionsResponse> {
  const res = await fetch("/api/alpaca/positions");

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch positions");
  }

  return res.json();
}

async function placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResponse> {
  const res = await fetch("/api/alpaca/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to place order");
  }

  return data;
}

async function fetchOrder(orderId: string): Promise<EtfOrder> {
  const res = await fetch(`/api/alpaca/order/${orderId}`);

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch order");
  }

  return res.json();
}

async function cancelOrder(orderId: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/alpaca/order/${orderId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to cancel order");
  }

  return res.json();
}

// ============================================
// HOOK
// ============================================

interface UseEtfTradingOptions {
  /** Whether to fetch positions */
  fetchPositions?: boolean;
}

/**
 * Hook for ETF trading operations.
 *
 * Provides:
 * - Position fetching with auto-refresh
 * - Order placement mutation
 * - Order status fetching
 * - Order cancellation mutation
 *
 * @example
 * ```tsx
 * const {
 *   positions,
 *   isLoadingPositions,
 *   placeOrderMutation,
 *   getPositionForSymbol,
 * } = useEtfTrading();
 *
 * // Get position for a symbol
 * const rviPosition = getPositionForSymbol("RVI");
 *
 * // Place an order
 * const handleBuy = async () => {
 *   try {
 *     const result = await placeOrderMutation.mutateAsync({
 *       symbol: "RVI",
 *       side: "BUY",
 *       type: "MARKET",
 *       notionalUsd: 100,
 *     });
 *     console.log("Order placed:", result.order);
 *   } catch (error) {
 *     console.error("Order failed:", error);
 *   }
 * };
 * ```
 */
export function useEtfTrading(options: UseEtfTradingOptions = {}) {
  const { fetchPositions: shouldFetchPositions = true } = options;
  const queryClient = useQueryClient();

  // Positions query
  const {
    data: positionsData,
    isLoading: isLoadingPositions,
    error: positionsError,
    refetch: refetchPositions,
  } = useQuery({
    queryKey: ["etf-positions"],
    queryFn: fetchPositions,
    enabled: shouldFetchPositions,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // 1 minute
  });

  // Place order mutation
  const placeOrderMutation = useMutation({
    mutationFn: placeOrder,
    onSuccess: () => {
      // Invalidate positions and balance after successful order
      queryClient.invalidateQueries({ queryKey: ["etf-positions"] });
      queryClient.invalidateQueries({ queryKey: ["trading-wallet-balance"] });
    },
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["etf-positions"] });
    },
  });

  // Helper to get position for a specific symbol
  const getPositionForSymbol = (symbol: string): EtfPosition | null => {
    if (!positionsData?.positions) return null;
    return (
      positionsData.positions.find(
        (p) => p.symbol.toUpperCase() === symbol.toUpperCase()
      ) || null
    );
  };

  // Helper to check if user has a position in a symbol
  const hasPosition = (symbol: string): boolean => {
    const position = getPositionForSymbol(symbol);
    return position !== null && position.qty > 0;
  };

  return {
    // Positions data
    positions: positionsData?.positions || [],
    positionsTotals: positionsData?.totals || null,
    isLoadingPositions,
    positionsError,
    refetchPositions,

    // Order mutations
    placeOrder: placeOrderMutation.mutateAsync,
    isPlacingOrder: placeOrderMutation.isPending,
    placeOrderError: placeOrderMutation.error,
    placeOrderMutation,

    cancelOrder: cancelOrderMutation.mutateAsync,
    isCancelingOrder: cancelOrderMutation.isPending,
    cancelOrderMutation,

    // Helpers
    getPositionForSymbol,
    hasPosition,

    // Order fetching
    fetchOrder,
  };
}
