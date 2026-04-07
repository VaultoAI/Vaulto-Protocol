"use client";

import { useQuery } from "@tanstack/react-query";

export interface EtfQuoteData {
  symbol: string;
  askPrice: number;
  bidPrice: number;
  midPrice: number;
  spread: number;
  spreadPercent: number;
  marketStatus: {
    isOpen: boolean;
    nextOpen: string | null;
    nextClose: string | null;
    currentTime: string;
  };
  timestamp: string;
  fractionable: boolean;
}

async function fetchQuote(symbol: string): Promise<EtfQuoteData> {
  const res = await fetch(`/api/etf/quote?symbol=${symbol}`);

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch quote");
  }

  return res.json();
}

interface UseEtfQuoteOptions {
  /** Whether to enable polling */
  enabled?: boolean;
  /** Polling interval in milliseconds (default: 5000) */
  pollingInterval?: number;
}

/**
 * Hook for fetching real-time ETF quotes from Alpaca.
 *
 * @param symbol - ETF symbol (RVI or VCX)
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const { data: quote, isLoading, error } = useEtfQuote("RVI", { enabled: true });
 *
 * if (quote) {
 *   console.log(`Mid price: $${quote.midPrice}`);
 *   console.log(`Market ${quote.marketStatus.isOpen ? 'open' : 'closed'}`);
 * }
 * ```
 */
export function useEtfQuote(
  symbol: string,
  options: UseEtfQuoteOptions = {}
) {
  const { enabled = true, pollingInterval = 5000 } = options;

  return useQuery({
    queryKey: ["etf-quote", symbol.toUpperCase()],
    queryFn: () => fetchQuote(symbol.toUpperCase()),
    enabled: enabled && !!symbol,
    staleTime: 2000, // Consider data stale after 2 seconds
    refetchInterval: enabled ? pollingInterval : false,
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Format a price for display
 */
export function formatQuotePrice(price: number): string {
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format the spread for display
 */
export function formatSpread(spread: number, spreadPercent: number): string {
  return `$${spread.toFixed(2)} (${spreadPercent.toFixed(2)}%)`;
}

/**
 * Format the next market open time for display
 */
export function formatNextOpen(isoString: string | null): string {
  if (!isoString) return "";

  const date = new Date(isoString);
  const now = new Date();

  // Check if it's today
  if (date.toDateString() === now.toDateString()) {
    return `today at ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    })}`;
  }

  // Check if it's tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `tomorrow at ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    })}`;
  }

  // Otherwise show full date
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
