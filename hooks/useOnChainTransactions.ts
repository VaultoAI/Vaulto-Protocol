"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface OnChainTransaction {
  id: string;
  type: "deposit" | "withdrawal" | "buy" | "sell" | "buy_long" | "buy_short" | "sell_long" | "sell_short";
  amount: number;
  status: string;
  txHash: string | null;
  timestamp: string;
  address: string;
  asset?: string;
  // ETF order fields
  symbol?: string;
  qty?: number;
  filledQty?: number;
  filledAvgPrice?: number;
  // Prediction market fields
  eventId?: string;
  eventName?: string;
  company?: string;
  shares?: number;
  averagePrice?: number;
  actualCostBasis?: number;
}

interface OnChainTransactionsResponse {
  transactions: OnChainTransaction[];
}

async function fetchOnChainTransactions(force = false): Promise<OnChainTransactionsResponse> {
  const url = force
    ? "/api/trading-wallet/on-chain-transactions?force=1"
    : "/api/trading-wallet/on-chain-transactions";
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      return { transactions: [] };
    }
    throw new Error("Failed to fetch on-chain transactions");
  }
  return res.json();
}

export function useOnChainTransactions(tradingWalletAddress: string | undefined) {
  const queryClient = useQueryClient();
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["on-chain-transactions", tradingWalletAddress],
    queryFn: () => fetchOnChainTransactions(false),
    enabled: !!tradingWalletAddress,
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });

  const forceSync = useCallback(async () => {
    const result = await fetchOnChainTransactions(true);
    queryClient.setQueryData(
      ["on-chain-transactions", tradingWalletAddress],
      result
    );
    return result;
  }, [queryClient, tradingWalletAddress]);

  return {
    transactions: data?.transactions ?? [],
    isLoading,
    error,
    refetch,
    forceSync,
  };
}
