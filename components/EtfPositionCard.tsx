"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEtfTrading } from "@/hooks/useEtfTrading";
import { formatPrice } from "@/lib/vaulto/companyUtils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface EtfPositionCardProps {
  symbol: string;
}

/**
 * Displays the user's current position for an ETF.
 * Shows quantity, market value, cost basis, and unrealized P&L.
 */
export function EtfPositionCard({ symbol }: EtfPositionCardProps) {
  const { authenticated } = usePrivy();
  const { getPositionForSymbol, isLoadingPositions } = useEtfTrading();

  const position = getPositionForSymbol(symbol);

  // Don't show anything if not authenticated, still loading, or no position
  // Only render when we have confirmed position data from DB
  if (!authenticated || isLoadingPositions || !position || position.qty <= 0) {
    return null;
  }

  const unrealizedPl = position.unrealizedPl ?? 0;
  const unrealizedPlPercent = position.unrealizedPlPercent ?? 0;
  const isPositive = unrealizedPl >= 0;
  const marketValue = position.marketValue ?? position.qty * (position.currentPrice ?? position.avgEntryPrice);

  return (
    <div className="w-full rounded-xl border border-border bg-card-bg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Your Position</h3>
        <span className="text-xs text-muted">{symbol}</span>
      </div>

      {/* Main value display */}
      <div className="mb-3">
        <p className="text-2xl font-bold text-foreground">
          {formatPrice(marketValue)}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
          )}
          <span className={`text-sm font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
            {isPositive ? "+" : ""}{formatPrice(unrealizedPl)} ({isPositive ? "+" : ""}{unrealizedPlPercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Position details */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
        <div>
          <p className="text-xs text-muted mb-0.5">Shares</p>
          <p className="text-sm font-medium text-foreground">
            {Number.isInteger(position.qty) ? position.qty : position.qty.toFixed(4)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted mb-0.5">Avg Cost</p>
          <p className="text-sm font-medium text-foreground">
            {formatPrice(position.avgEntryPrice)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted mb-0.5">Current Price</p>
          <p className="text-sm font-medium text-foreground">
            {position.currentPrice ? formatPrice(position.currentPrice) : "--"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted mb-0.5">Cost Basis</p>
          <p className="text-sm font-medium text-foreground">
            {formatPrice(position.costBasis)}
          </p>
        </div>
      </div>
    </div>
  );
}
