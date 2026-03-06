"use client";

import { useQuery } from "@tanstack/react-query";
import type { DemoToken } from "@/lib/types/token";

export type TokenInfo = { address: string; decimals: number };
export type PoolForPair = { poolAddress: string; feeTier: number };
export type PoolOption = { pool: string; address: string; feeTier: number };

export type SwapConfig = {
  tokens: Record<string, TokenInfo>;
  poolsForPair: Record<string, PoolForPair>;
  poolList: PoolOption[];
  demoTokens: DemoToken[];
};

async function fetchSwapConfig(): Promise<SwapConfig> {
  const res = await fetch("/api/tokens");
  if (!res.ok) throw new Error("Failed to load tokens");
  return res.json();
}

export function useSwapConfig() {
  return useQuery({
    queryKey: ["swap-config"],
    queryFn: fetchSwapConfig,
    staleTime: 60_000,
  });
}
