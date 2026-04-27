"use client";

import { useQuery } from "@tanstack/react-query";

interface HistoryPoint {
  timestamp: string;
  value: number;
}

interface ImpliedValuationHistoryResponse {
  history: HistoryPoint[];
}

async function fetchImpliedValuationHistory(
  slug: string
): Promise<ImpliedValuationHistoryResponse> {
  const res = await fetch(
    `/api/implied-valuations/${encodeURIComponent(slug)}/history?range=ALL`
  );

  if (!res.ok) {
    throw new Error("Failed to fetch implied valuation history");
  }

  return res.json();
}

/**
 * Convert IPO history data to sparkline format (array of values)
 */
export function historyToSparkline(
  history: { value: number }[],
  numPoints: number = 48
): number[] | null {
  if (!history || history.length < 2) return null;

  const values = history.map((h) => h.value);

  // If we have exactly the number of points we need, return them directly
  if (values.length === numPoints) return values;

  // If we have fewer points, interpolate
  if (values.length < numPoints) {
    const result: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const scaledT = t * (values.length - 1);
      const idx = Math.floor(scaledT);
      const frac = scaledT - idx;
      const v0 = values[idx];
      const v1 = values[Math.min(idx + 1, values.length - 1)];
      result.push(v0 + (v1 - v0) * frac);
    }
    return result;
  }

  // If we have more points, sample evenly
  const result: number[] = [];
  for (let i = 0; i < numPoints; i++) {
    const idx = Math.round((i / (numPoints - 1)) * (values.length - 1));
    result.push(values[idx]);
  }
  return result;
}

interface UseImpliedValuationHistoryOptions {
  /** Number of points to include in sparkline (default: 48) */
  numPoints?: number;
  /** Whether to enable fetching */
  enabled?: boolean;
}

/**
 * Hook for fetching and caching implied valuation history data.
 * Uses React Query with long cache times to prevent refetching on navigation.
 *
 * @param slug - The implied valuation slug (e.g., "openai-ipo")
 * @param options - Configuration options
 */
export function useImpliedValuationHistory(
  slug: string | null,
  options: UseImpliedValuationHistoryOptions = {}
) {
  const { numPoints = 48, enabled = true } = options;

  const query = useQuery({
    queryKey: ["implied-valuation-history", slug],
    queryFn: () => fetchImpliedValuationHistory(slug!),
    enabled: enabled && !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
    retry: 2,
    retryDelay: 1000,
  });

  // Compute derived data
  const history = query.data?.history ?? null;
  const sparkline = history ? historyToSparkline(history, numPoints) : null;
  const currentValuation =
    history && history.length > 0 ? history[history.length - 1].value : null;

  return {
    ...query,
    history,
    sparkline,
    currentValuation,
  };
}
