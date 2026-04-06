"use client";

import { useQuery } from "@tanstack/react-query";

export type PrestockTimeRange = "1H" | "4H" | "1D" | "1W" | "1M" | "ALL";

export interface PrestockPricePoint {
  timestamp: number;
  price: number;
}

export interface PrestockPriceResponse {
  success: boolean;
  data: {
    address: string;
    company: string;
    price: number;
    priceChange24h: number;
    timestamp: number;
  };
}

export interface PrestockHistoryResponse {
  success: boolean;
  data: {
    address: string;
    company: string;
    range: string;
    history: PrestockPricePoint[];
    currentPrice: number | null;
    dataPoints: number;
  };
  timestamp: string;
}

async function fetchPrestockPrice(address: string): Promise<PrestockPriceResponse> {
  const res = await fetch(`/api/prestock/${address}`);

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch prestock price");
  }

  return res.json();
}

async function fetchPrestockHistory(
  address: string,
  range: PrestockTimeRange
): Promise<PrestockHistoryResponse> {
  const res = await fetch(`/api/prestock/${address}/history?range=${range}`);

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch prestock history");
  }

  return res.json();
}

interface UsePrestockPriceOptions {
  /** Whether to enable the query */
  enabled?: boolean;
  /** Polling interval in milliseconds for current price (default: 30000 = 30s) */
  pollingInterval?: number;
}

/**
 * Hook for fetching current prestock token price.
 *
 * @param address - Token mint address
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = usePrestockPrice(
 *   "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh"
 * );
 *
 * if (data) {
 *   console.log(`Price: $${data.data.price}`);
 *   console.log(`24h change: ${data.data.priceChange24h}%`);
 * }
 * ```
 */
export function usePrestockPrice(
  address: string | null,
  options: UsePrestockPriceOptions = {}
) {
  const { enabled = true, pollingInterval = 30000 } = options;

  return useQuery({
    queryKey: ["prestock-price", address],
    queryFn: () => fetchPrestockPrice(address!),
    enabled: enabled && !!address,
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchInterval: enabled ? pollingInterval : false,
    retry: 2,
    retryDelay: 1000,
  });
}

interface UsePrestockHistoryOptions {
  /** Whether to enable the query */
  enabled?: boolean;
  /** Time range for history data */
  range?: PrestockTimeRange;
}

/**
 * Hook for fetching prestock token price history.
 *
 * @param address - Token mint address
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = usePrestockHistory(
 *   "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
 *   { range: "1D" }
 * );
 *
 * if (data) {
 *   console.log(`Points: ${data.data.dataPoints}`);
 *   data.data.history.forEach(point => {
 *     console.log(`${point.timestamp}: $${point.price}`);
 *   });
 * }
 * ```
 */
export function usePrestockHistory(
  address: string | null,
  options: UsePrestockHistoryOptions = {}
) {
  const { enabled = true, range = "1D" } = options;

  return useQuery({
    queryKey: ["prestock-history", address, range],
    queryFn: () => fetchPrestockHistory(address!, range),
    enabled: enabled && !!address,
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Format a prestock price for display
 */
export function formatPrestockPrice(price: number): string {
  // For very small prices (< $0.01), show more decimals
  if (price < 0.01) {
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });
  }

  // For small prices (< $1), show 4 decimals
  if (price < 1) {
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  }

  // For normal prices, show 2 decimals
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format price change percentage for display
 */
export function formatPriceChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}
