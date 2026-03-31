"use client";

import { useQuery } from "@tanstack/react-query";

interface ChainBalance {
  chain: string;
  nativeBalanceUsd: string;
  tokenBalanceUsd: string;
  totalUsd: string;
}

interface WalletNetWorthResponse {
  totalNetWorthUsd: string;
  chains: ChainBalance[];
}

async function fetchWalletNetWorth(
  address: string
): Promise<WalletNetWorthResponse> {
  const res = await fetch(`/api/wallet-networth?address=${address}`);
  if (!res.ok) {
    throw new Error("Failed to fetch wallet net worth");
  }
  return res.json();
}

export function useWalletNetWorth(address: string | undefined) {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["wallet-networth", address],
    queryFn: () => fetchWalletNetWorth(address!),
    enabled: !!address,
    staleTime: 60_000, // 1 minute
    refetchInterval: 120_000, // Refetch every 2 minutes
  });

  // Format the total net worth for display
  const formattedNetWorth = data?.totalNetWorthUsd
    ? parseFloat(data.totalNetWorthUsd).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null;

  return {
    totalNetWorthUsd: data?.totalNetWorthUsd ?? null,
    formattedNetWorth,
    chains: data?.chains ?? [],
    isLoading,
    error,
    refetch,
  };
}
