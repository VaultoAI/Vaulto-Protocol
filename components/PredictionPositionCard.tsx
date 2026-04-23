"use client";

import { usePrivy } from "@privy-io/react-auth";
import { usePredictionTrading } from "@/hooks/usePredictionTrading";

interface PredictionPositionCardProps {
  eventSlug: string;
}

/**
 * Displays the user's current prediction market position.
 * Shows shares, market value, entry price, and unrealized P&L.
 * Styled to match EtfPositionCard.
 */
export function PredictionPositionCard({ eventSlug }: PredictionPositionCardProps) {
  const { authenticated } = usePrivy();
  const { getPositionForEvent, sell, isSelling, isLoadingPositions } = usePredictionTrading({
    fetchPositions: true,
  });

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

      {/* Sell button */}
      <div className="mt-3 pt-3 border-t border-border">
        <button
          onClick={() => sell(position.id)}
          disabled={isSelling}
          className="w-full rounded-xl bg-red py-2.5 text-sm font-bold text-white hover:bg-red/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSelling ? "Selling..." : "Sell Position"}
        </button>
      </div>
    </div>
  );
}
