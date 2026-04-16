"use client";

import { useQuery } from "@tanstack/react-query";

export interface OnChainTransaction {
  id: string;
  type: "deposit" | "withdrawal" | "buy" | "sell" | "prediction_long" | "prediction_short";
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
}

interface OnChainTransactionsResponse {
  transactions: OnChainTransaction[];
}

async function fetchOnChainTransactions(): Promise<OnChainTransactionsResponse> {
  const res = await fetch("/api/trading-wallet/on-chain-transactions");
  if (!res.ok) {
    if (res.status === 404) {
      return { transactions: [] };
    }
    throw new Error("Failed to fetch on-chain transactions");
  }
  return res.json();
}

export function useOnChainTransactions(tradingWalletAddress: string | undefined) {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["on-chain-transactions", tradingWalletAddress],
    queryFn: fetchOnChainTransactions,
    enabled: !!tradingWalletAddress,
    staleTime: 60_000, // 60 seconds
  });

  return {
    transactions: data?.transactions ?? [],
    isLoading,
    error,
    refetch,
  };
}
