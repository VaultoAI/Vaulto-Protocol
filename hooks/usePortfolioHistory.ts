"use client";

import { useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface HistoryPoint {
  timestamp: string;
  balance: number;
  type: "deposit" | "withdrawal" | "initial" | "current";
}

export interface Transaction {
  id: string;
  type: "deposit" | "withdrawal" | "buy" | "sell";
  amount: number;
  status: string;
  txHash: string | null;
  timestamp: string;
  address: string;
  // ETF order fields
  symbol?: string;
  qty?: number;
  filledQty?: number;
  filledAvgPrice?: number;
}

interface SyncState {
  lastSyncedAt: string | null;
  isSyncing: boolean;
  needsSync: boolean;
  transactionCount: number;
}

interface PortfolioHistoryResponse {
  history: HistoryPoint[];
  transactions: Transaction[];
  syncState?: SyncState;
}

async function fetchPortfolioHistory(): Promise<PortfolioHistoryResponse> {
  const res = await fetch("/api/trading-wallet/portfolio-history");
  if (!res.ok) {
    if (res.status === 404) {
      return { history: [], transactions: [] };
    }
    throw new Error("Failed to fetch portfolio history");
  }
  return res.json();
}

export function usePortfolioHistory(tradingWalletAddress: string | undefined) {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["portfolio-history", tradingWalletAddress],
    queryFn: fetchPortfolioHistory,
    enabled: !!tradingWalletAddress,
    staleTime: 5_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const isSyncing = data?.syncState?.isSyncing ?? false;
  const needsSync = data?.syncState?.needsSync ?? false;

  // Poll for updates while syncing
  useEffect(() => {
    if (!isSyncing || !tradingWalletAddress) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/trading-wallet/sync");
        if (res.ok) {
          const syncStatus = await res.json();
          // If sync completed, refetch portfolio data
          if (!syncStatus.isSyncing) {
            queryClient.invalidateQueries({
              queryKey: ["portfolio-history", tradingWalletAddress],
            });
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [isSyncing, tradingWalletAddress, queryClient]);

  // Extract just the balance values for MiniChart
  const chartData = useMemo(() => {
    if (!data?.history || data.history.length === 0) {
      return [0];
    }
    return data.history.map((point) => point.balance);
  }, [data?.history]);

  // Trigger manual sync (e.g., after deposit/withdrawal)
  const triggerSync = async () => {
    try {
      const res = await fetch("/api/trading-wallet/sync", { method: "POST" });
      if (res.ok) {
        // Refetch portfolio data after sync
        await refetch();
      }
    } catch (error) {
      console.error("Failed to trigger sync:", error);
    }
  };

  return {
    history: data?.history ?? [],
    transactions: data?.transactions ?? [],
    chartData,
    isLoading,
    error,
    refetch,
    // Sync state
    isSyncing,
    needsSync,
    lastSyncedAt: data?.syncState?.lastSyncedAt ?? null,
    transactionCount: data?.syncState?.transactionCount ?? 0,
    triggerSync,
  };
}
