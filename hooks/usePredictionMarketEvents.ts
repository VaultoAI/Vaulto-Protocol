"use client";

import { useQuery } from "@tanstack/react-query";

export interface PredictionMarketEvent {
  slug: string;
  name: string;
  company: string;
  numBands: number;
  totalVolume: number;
  endDate: string;
}

export interface PredictionMarketEventsResponse {
  events: PredictionMarketEvent[];
  timestamp: string;
}

/**
 * Fetch all prediction market events from the API.
 */
async function fetchPredictionMarketEvents(): Promise<PredictionMarketEventsResponse> {
  const res = await fetch("/api/trading/events");

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch prediction market events");
  }

  return res.json();
}

interface UsePredictionMarketEventsOptions {
  /** Whether to enable the query */
  enabled?: boolean;
}

/**
 * Hook for fetching all available prediction market events.
 *
 * Returns a list of companies with active prediction markets,
 * including their event slugs, names, and volume data.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = usePredictionMarketEvents();
 *
 * if (data) {
 *   data.events.forEach(event => {
 *     console.log(`${event.company}: ${event.name}`);
 *   });
 * }
 * ```
 */
export function usePredictionMarketEvents(
  options: UsePredictionMarketEventsOptions = {}
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["prediction-market-events"],
    queryFn: fetchPredictionMarketEvents,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Check if a company has a prediction market event.
 */
export function hasCompanyPredictionMarket(
  events: PredictionMarketEvent[] | undefined,
  companyName: string
): boolean {
  if (!events) return false;
  return events.some(
    (e) => e.company.toLowerCase() === companyName.toLowerCase()
  );
}

/**
 * Get the prediction market event for a company.
 */
export function getCompanyEvent(
  events: PredictionMarketEvent[] | undefined,
  companyName: string
): PredictionMarketEvent | undefined {
  if (!events) return undefined;
  return events.find(
    (e) => e.company.toLowerCase() === companyName.toLowerCase()
  );
}
