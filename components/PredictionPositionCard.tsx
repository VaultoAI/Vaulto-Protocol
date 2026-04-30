"use client";

import { useState, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { usePredictionTrading } from "@/hooks/usePredictionTrading";
import { IPO_MARKET_END_DATES, COMPANY_SLUG_MAP } from "@/lib/polymarket/implied-valuations";

interface PredictionPositionCardProps {
  eventSlug: string;
  onCloseAndWithdraw?: (positionId: string) => void;
}

export function PredictionPositionCard({ eventSlug, onCloseAndWithdraw }: PredictionPositionCardProps) {
  const { authenticated } = usePrivy();
  const { getPositionForEvent, sell, isSelling, isLoadingPositions } = usePredictionTrading({
    fetchPositions: true,
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  const [sellResult, setSellResult] = useState<{
    success: boolean;
    proceeds: number;
    sharesSold: number;
    exitPrice?: number;
  } | null>(null);

  // Check if market has expired - find the slug from company name or eventSlug
  const marketExpired = useMemo(() => {
    const slug = eventSlug.toLowerCase();

    // First try direct lookup (e.g., "databricks")
    let endDateStr = IPO_MARKET_END_DATES[slug];

    // If not found, try to extract company name from full slug (e.g., "databricks-ipo-closing-market-cap" -> "databricks")
    if (!endDateStr) {
      // Try common patterns: "company-ipo-...", "company-market-cap-..."
      const companyMatch = slug.match(/^([a-z-]+?)(?:-ipo|-market-cap|-fdv)/);
      if (companyMatch) {
        const companySlug = companyMatch[1].replace(/-/g, "-"); // Keep hyphens for multi-word companies
        endDateStr = IPO_MARKET_END_DATES[companySlug];
      }
    }

    // Also check reverse mapping from COMPANY_SLUG_MAP
    if (!endDateStr) {
      const companyEntries = Object.entries(COMPANY_SLUG_MAP);
      for (const [, companySlug] of companyEntries) {
        if (slug.startsWith(companySlug)) {
          endDateStr = IPO_MARKET_END_DATES[companySlug];
          if (endDateStr) break;
        }
      }
    }

    if (!endDateStr) return false;

    const endDate = new Date(endDateStr);
    const now = new Date();
    return now > endDate;
  }, [eventSlug]);

  const position = getPositionForEvent(eventSlug);

  // Don't show anything if not authenticated, still loading, or no position
  if (!authenticated || isLoadingPositions || !position || position.shares <= 0) {
    return null;
  }

  // Use pre-calculated values from API
  const marketValue = position.marketValue;
  const costBasis = position.costBasis;
  const unrealizedPnl = position.unrealizedPnl;
  const unrealizedPnlPercent = position.unrealizedPnlPercent;
  const isPositive = unrealizedPnl >= 0;
  const isLong = position.side === "LONG";

  const estimatedProceeds = marketValue;
  const sharesToSell = position.shares;

  const handleSell = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      setSellError(null);
      return;
    }

    setSellError(null);
    try {
      const result = await sell(position.id, {
        percentage: 100,
        totalShares: position.shares,
        // Pass position metadata for database logging
        eventId: position.eventId,
        eventName: position.eventName,
        company: position.company,
        side: position.side,
        costBasis: position.costBasis,
        avgEntryPrice: position.entryPrice,
      });

      // Show success confirmation
      setSellResult({
        success: true,
        proceeds: result.proceeds || estimatedProceeds,
        sharesSold: result.sharesSold || sharesToSell,
        exitPrice: result.exitPrice,
      });

      setShowConfirm(false);

      // Auto-clear success after 4 seconds
      setTimeout(() => setSellResult(null), 4000);
    } catch (error) {
      console.error("Failed to sell:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to sell position";
      setSellError(errorMessage);
      setShowConfirm(false);
    }
  };

  return (
    <div className="w-full rounded-xl border border-border bg-card-bg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Your Position</h3>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isLong
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
              : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
          }`}
        >
          {position.side}
        </span>
      </div>

      {/* Main value display */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-2xl font-bold text-foreground">${marketValue.toFixed(2)}</p>
        <span
          className={`text-sm font-medium ${isPositive ? "text-green" : "text-red"}`}
        >
          {isPositive ? "+" : ""}${unrealizedPnl.toFixed(2)} ({isPositive ? "+" : ""}
          {unrealizedPnlPercent.toFixed(1)}%)
        </span>
      </div>

      {/* Position details - 2x2 grid */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
        <div>
          <p className="text-xs text-muted mb-0.5">Shares</p>
          <p className="text-sm font-medium text-foreground">{position.shares.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted mb-0.5">Entry Price</p>
          <p className="text-sm font-medium text-foreground">${position.entryPrice.toFixed(3)}</p>
        </div>
        <div>
          <p className="text-xs text-muted mb-0.5">Current Price</p>
          <p className="text-sm font-medium text-foreground">${position.currentPrice.toFixed(3)}</p>
        </div>
        <div>
          <p className="text-xs text-muted mb-0.5">Cost Basis</p>
          <p className="text-sm font-medium text-foreground">${costBasis.toFixed(2)}</p>
        </div>
      </div>

      {/* Sell controls */}
      <div className="mt-3 pt-3 border-t border-border space-y-3">
        {/* Market expired warning */}
        {marketExpired && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">Market Resolved</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              This prediction market has ended. Positions are settled automatically based on the outcome.
            </p>
          </div>
        )}

        {/* Sell button */}
        <button
          onClick={handleSell}
          disabled={isSelling || marketExpired}
          className={`w-full rounded-xl py-2.5 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            showConfirm
              ? "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
              : "bg-red text-white hover:bg-red/90"
          }`}
        >
          {marketExpired
            ? "Market Closed"
            : isSelling
            ? "Selling..."
            : showConfirm
            ? "Confirm Sell"
            : "Sell"}
        </button>

        {/* Error message */}
        {sellError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{sellError}</p>
          </div>
        )}

        {/* Close & Withdraw button (if handler provided) */}
        {onCloseAndWithdraw && !marketExpired && (
          <button
            onClick={() => onCloseAndWithdraw(position.id)}
            disabled={isSelling}
            className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Close & Withdraw
          </button>
        )}
      </div>

      {/* Success confirmation modal */}
      {sellResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card-bg border border-border rounded-xl max-w-sm w-full p-6 space-y-4">
            {/* Success icon */}
            <div className="flex flex-col items-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Position Sold</h3>
            </div>

            {/* Details */}
            <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shares Sold</span>
                <span className="font-medium text-foreground">
                  {sellResult.sharesSold.toFixed(2)}
                </span>
              </div>
              {sellResult.exitPrice && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exit Price</span>
                  <span className="font-medium text-foreground">
                    ${sellResult.exitPrice.toFixed(3)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground">Proceeds</span>
                <span className="font-semibold text-green-500">
                  ${sellResult.proceeds.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setSellResult(null)}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
