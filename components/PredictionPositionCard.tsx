"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { usePredictionTrading } from "@/hooks/usePredictionTrading";

interface PredictionPositionCardProps {
  eventSlug: string;
  onCloseAndWithdraw?: (positionId: string) => void;
}

const SELL_PERCENTAGES = [25, 50, 75, 100] as const;

/**
 * Displays the user's current prediction market position.
 * Shows shares, market value, entry price, and unrealized P&L.
 * Supports partial sells via percentage selector (25%, 50%, 75%, 100%).
 */
export function PredictionPositionCard({ eventSlug, onCloseAndWithdraw }: PredictionPositionCardProps) {
  const { authenticated } = usePrivy();
  const { getPositionForEvent, sellPercentage, isSelling, isLoadingPositions } = usePredictionTrading({
    fetchPositions: true,
  });

  const [selectedPercentage, setSelectedPercentage] = useState<number>(100);
  const [showConfirm, setShowConfirm] = useState(false);

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

  // Calculate estimated proceeds for selected percentage
  const estimatedProceeds = (marketValue * selectedPercentage) / 100;
  const sharesToSell = (position.shares * selectedPercentage) / 100;

  const handleSell = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    try {
      await sellPercentage(position.id, selectedPercentage);
      setShowConfirm(false);
      setSelectedPercentage(100);
    } catch (error) {
      console.error("Failed to sell:", error);
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
        {/* Percentage selector */}
        <div className="flex gap-2">
          {SELL_PERCENTAGES.map((pct) => (
            <button
              key={pct}
              onClick={() => {
                setSelectedPercentage(pct);
                setShowConfirm(false);
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                selectedPercentage === pct
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Estimated proceeds */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Sell {sharesToSell.toFixed(2)} shares
          </span>
          <span className="font-medium text-foreground">
            ≈ ${estimatedProceeds.toFixed(2)}
          </span>
        </div>

        {/* Sell button */}
        <button
          onClick={handleSell}
          disabled={isSelling}
          className={`w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            showConfirm
              ? "bg-red-600 hover:bg-red-700"
              : "bg-red hover:bg-red/90"
          }`}
        >
          {isSelling
            ? "Selling..."
            : showConfirm
            ? `Confirm Sell ${selectedPercentage}%`
            : `Sell ${selectedPercentage}%`}
        </button>

        {/* Close & Withdraw button (if handler provided) */}
        {onCloseAndWithdraw && selectedPercentage === 100 && (
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
