"use client";

import { useState, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { usePredictionTrading } from "@/hooks/usePredictionTrading";
import { IPO_MARKET_END_DATES, COMPANY_SLUG_MAP } from "@/lib/polymarket/implied-valuations";
import { formatValuationPrecise } from "@/lib/polymarket/ipo-valuations";

interface PredictionPositionCardProps {
  eventSlug: string;
  onCloseAndWithdraw?: (positionId: string) => void;
}

function friendlySellError(code: string | undefined, fallback: string): string {
  switch (code) {
    case "NO_LIQUIDITY":
      return "No buyers available right now. Try again in a moment, or accept higher slippage.";
    case "INSUFFICIENT_BALANCE":
      return "Trading wallet doesn't have enough balance — open Polymarket once to refresh approvals, then retry.";
    default:
      return fallback;
  }
}

// The frontend /api/trading/sell route returns errorCode in the body; some
// callers (the hook) only surface the message, so as a fallback we sniff for
// the code in the message text.
function extractErrorCode(message: string): string | undefined {
  if (/no liquidity/i.test(message)) return "NO_LIQUIDITY";
  if (/balance|allowance/i.test(message)) return "INSUFFICIENT_BALANCE";
  return undefined;
}

export function PredictionPositionCard({ eventSlug, onCloseAndWithdraw }: PredictionPositionCardProps) {
  const { authenticated } = usePrivy();
  const { getPositionForEvent, getPositionsForEvent, sell, isSelling, isLoadingPositions } = usePredictionTrading({
    fetchPositions: true,
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  const [sellResult, setSellResult] = useState<{
    success: boolean;
    proceeds: number;
    sharesSold: number;
    exitPrice?: number;
    partialFill?: boolean;
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
      // A single event (e.g. SpaceX IPO closing market cap) often has the user
      // holding multiple outcome bands at once. The aggregated `position` shows
      // their combined exposure but only carries the first band's id, so calling
      // sell once would leave the other bands open. Sell every band that has
      // shares so "Sell" really means "exit this event".
      const bands = getPositionsForEvent(eventSlug, position.side).filter(
        (b) => b.shares > 0
      );

      const results = await Promise.all(
        bands.map((band) =>
          sell(band.id, {
            percentage: 100,
            totalShares: band.shares,
            eventId: band.eventId,
            eventName: band.eventName,
            company: band.company,
            side: band.side,
            costBasis: band.costBasis,
            avgEntryPrice: band.entryPrice,
          })
        )
      );

      const totalProceeds = results.reduce((sum, r) => sum + (r.proceeds || 0), 0);
      const totalSharesSold = results.reduce((sum, r) => sum + (r.sharesSold || 0), 0);
      const weightedExitPrice =
        totalSharesSold > 0
          ? results.reduce(
              (sum, r) => sum + (r.exitPrice || 0) * (r.sharesSold || 0),
              0
            ) / totalSharesSold
          : undefined;

      // Any band that partially filled flags the whole sell as partial — the
      // user still has shares left and we want to surface that to them.
      const anyPartial = results.some((r) => (r as { partialFill?: boolean }).partialFill);

      // Show success confirmation
      setSellResult({
        success: true,
        proceeds: totalProceeds || estimatedProceeds,
        sharesSold: totalSharesSold || sharesToSell,
        exitPrice: weightedExitPrice,
        partialFill: anyPartial,
      });

      setShowConfirm(false);

      // Auto-clear success after 4 seconds (longer for partial fills so the
      // user has time to read the explanation).
      setTimeout(() => setSellResult(null), anyPartial ? 8000 : 4000);
    } catch (error) {
      console.error("Failed to sell:", error);
      const rawMessage = error instanceof Error ? error.message : "Failed to sell position";
      const code = (error as { code?: string } | null)?.code
        ?? extractErrorCode(rawMessage);
      const friendly = friendlySellError(code, rawMessage);
      setSellError(friendly);
      setShowConfirm(false);
    }
  };

  if (sellResult) {
    return (
      <div className="w-full rounded-xl border border-border bg-card-bg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Your Position</h3>
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            Sold
          </span>
        </div>
        <p className="text-sm text-foreground">
          Sold {sellResult.sharesSold.toFixed(2)} shares for{" "}
          <span className="font-semibold text-green-600 dark:text-green-400">
            ${sellResult.proceeds.toFixed(2)}
          </span>
        </p>
        {sellResult.exitPrice !== undefined && (
          <p className="mt-1 text-xs text-muted">
            Exit price ${sellResult.exitPrice.toFixed(3)}
          </p>
        )}
        {sellResult.partialFill && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Partial fill — only some shares could be sold at the available price. The remaining shares are still in your position.
          </p>
        )}
      </div>
    );
  }

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

      {/* Position details — entry/current valuation match the chart. Shares
          and CLOB price are intentionally hidden; they're CLOB-internal. */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
        <div>
          <p className="text-xs text-muted mb-0.5">Entry Valuation</p>
          <p className="text-sm font-medium text-foreground">
            {position.entryGraphValuationUsd
              ? formatValuationPrecise(position.entryGraphValuationUsd)
              : formatValuationPrecise(position.entryPrice)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted mb-0.5">Current Valuation</p>
          <p className="text-sm font-medium text-foreground">
            {position.currentGraphValuationUsd
              ? formatValuationPrecise(position.currentGraphValuationUsd)
              : formatValuationPrecise(position.currentPrice)}
          </p>
        </div>
      </div>
      {position.entryFairSellEstimated && (
        <p className="mt-2 text-[11px] text-muted">
          Entry fair-sell value estimated for legacy positions. Future P&amp;L is accurate.
        </p>
      )}

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

    </div>
  );
}
