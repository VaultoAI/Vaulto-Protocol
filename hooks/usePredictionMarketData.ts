"use client";

import { useQuery } from "@tanstack/react-query";
import type { ValuationResponse } from "@/lib/polymarket/valuation-types";

/**
 * Fetch prediction market valuation data from the API.
 */
async function fetchPredictionMarketData(
  eventSlug: string
): Promise<ValuationResponse> {
  const res = await fetch(`/api/trading/valuation/${encodeURIComponent(eventSlug)}`);

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch prediction market data");
  }

  return res.json();
}

interface UsePredictionMarketDataOptions {
  /** Whether to enable the query */
  enabled?: boolean;
  /** Polling interval in milliseconds (default: 60000 = 1 minute) */
  pollingInterval?: number;
}

/**
 * Hook for fetching prediction market valuation data.
 *
 * Returns pricing info including:
 * - longCost / shortCost: Cost per $1 of exposure
 * - slippage: Bid-ask spread data
 * - bands: Individual band pricing and volume
 * - totalVolume: Total market volume
 * - endDate: When the market resolves
 *
 * @param eventSlug - Polymarket event slug (e.g., "spacex-ipo-closing-market-cap")
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = usePredictionMarketData(
 *   "spacex-ipo-closing-market-cap"
 * );
 *
 * if (data) {
 *   console.log(`Long cost: $${data.valuation.longCost.toFixed(2)}`);
 *   console.log(`Short cost: $${data.valuation.shortCost.toFixed(2)}`);
 *   console.log(`Total volume: $${data.totalVolume}`);
 * }
 * ```
 */
export function usePredictionMarketData(
  eventSlug: string | null,
  options: UsePredictionMarketDataOptions = {}
) {
  const { enabled = true, pollingInterval = 60000 } = options;

  return useQuery({
    queryKey: ["prediction-market-data", eventSlug],
    queryFn: () => fetchPredictionMarketData(eventSlug!),
    enabled: enabled && !!eventSlug,
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchInterval: enabled ? pollingInterval : false,
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Format volume for display (e.g., "$1.2M", "$500K")
 */
export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(1)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(0)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

/**
 * Format cost per dollar for display (e.g., "$0.65")
 */
export function formatCostPerDollar(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

/**
 * Format spread percentage for display (e.g., "2.3%")
 */
export function formatSpreadPercent(percent: number): string {
  return `${percent.toFixed(1)}%`;
}
