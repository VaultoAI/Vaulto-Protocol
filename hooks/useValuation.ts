"use client";

import { useQuery } from "@tanstack/react-query";
import type { ValuationResponse } from "@/lib/polymarket/valuation-types";

async function fetchValuation(eventSlug: string): Promise<ValuationResponse> {
  const res = await fetch(`/api/trading/valuation/${encodeURIComponent(eventSlug)}`);

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch valuation");
  }

  return res.json();
}

interface UseValuationOptions {
  /** Whether to enable fetching */
  enabled?: boolean;
  /** Polling interval in milliseconds (default: 30000 - 30 seconds) */
  pollingInterval?: number;
}

/**
 * Hook for fetching real-time Polymarket trading valuation data.
 *
 * @param eventSlug - The Polymarket event slug (e.g., "openai-ipo-closing-market-cap")
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const { data: valuation, isLoading, error } = useValuation("openai-ipo-closing-market-cap");
 *
 * if (valuation) {
 *   console.log(`Long Cost: $${valuation.valuation.longCost}`);
 *   console.log(`Spread: ${valuation.slippage.long.spreadPercent}%`);
 * }
 * ```
 */
export function useValuation(
  eventSlug: string | null,
  options: UseValuationOptions = {}
) {
  const { enabled = true, pollingInterval = 30000 } = options;

  return useQuery({
    queryKey: ["trading-valuation", eventSlug],
    queryFn: () => fetchValuation(eventSlug!),
    enabled: enabled && !!eventSlug,
    staleTime: 15000, // Consider data stale after 15 seconds
    refetchInterval: enabled && eventSlug ? pollingInterval : false,
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Format a cost value for display (e.g., 0.82 -> "$0.82/share")
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}/share`;
}

/**
 * Format spread percentage for display
 */
export function formatSpreadPercent(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

/**
 * Format floor values for display (e.g., 0.2 -> "20%")
 */
export function formatFloor(floor: number): string {
  return `${(floor * 100).toFixed(0)}%`;
}
