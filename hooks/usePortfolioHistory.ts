"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

interface HistoryPoint {
  timestamp: string;
  balance: number;
  type: "deposit" | "withdrawal" | "initial" | "current";
}

export interface Transaction {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  status: string;
  txHash: string | null;
  timestamp: string;
  address: string;
}

interface PortfolioHistoryResponse {
  history: HistoryPoint[];
  transactions: Transaction[];
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
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["portfolio-history", tradingWalletAddress],
    queryFn: fetchPortfolioHistory,
    enabled: !!tradingWalletAddress,
    staleTime: 60_000, // 60 seconds
  });

  // Extract just the balance values for MiniChart
  const chartData = useMemo(() => {
    if (!data?.history || data.history.length === 0) {
      return [0];
    }
    return data.history.map((point) => point.balance);
  }, [data?.history]);

  return {
    history: data?.history ?? [],
    transactions: data?.transactions ?? [],
    chartData,
    isLoading,
    error,
    refetch,
  };
}
