"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getPredictionPositions, sellPredictionShares, calculatePositionValue } from "@/lib/polymarket/demo-trading";
import type { PredictionMarket } from "@/lib/polymarket/markets";
import { useSortableTable, type SortableColumn } from "@/hooks/useSortableTable";
import { SortableTableHeader } from "@/components/SortableHeader";

type PositionsProps = {
  markets: PredictionMarket[];
};

export function PredictionPositions({ markets }: PositionsProps) {
  const [positions, setPositions] = useState<ReturnType<typeof getPredictionPositions>>([]);
  const [selling, setSelling] = useState<string | null>(null);

  // Refresh positions on mount and after any updates
  const refreshPositions = useCallback(() => {
    setPositions(getPredictionPositions(markets));
  }, [markets]);

  useEffect(() => {
    refreshPositions();
    // Poll for updates every 2 seconds
    const interval = setInterval(refreshPositions, 2000);
    return () => clearInterval(interval);
  }, [refreshPositions]);

  const handleSell = useCallback(async (position: typeof positions[0]) => {
    const market = markets.find(m => m.id === position.marketId);
    if (!market) return;

    setSelling(position.symbol);
    await sellPredictionShares({
      market,
      outcome: position.outcome,
      shares: position.shares,
    });
    refreshPositions();
    setSelling(null);
  }, [markets, refreshPositions]);

  type PredictionColumnKey = "position" | "outcome" | "shares" | "currentValue" | "potentialPayout";

  const columns: SortableColumn<PredictionColumnKey, typeof positions[0]>[] = useMemo(
    () => [
      { key: "position", getValue: (p) => p.question },
      { key: "outcome", getValue: (p) => p.outcome },
      { key: "shares", getValue: (p) => p.shares },
      { key: "currentValue", getValue: (p) => calculatePositionValue(p.shares, p.currentPrice) },
      { key: "potentialPayout", getValue: (p) => p.shares },
    ],
    []
  );

  const { sortedData, sortConfig, handleSort } = useSortableTable(positions, columns);

  if (positions.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium">Your Positions</h2>

      {/* Mobile cards */}
      <div className="mt-3 flex flex-col gap-3 md:hidden">
        {positions.map((position) => {
          const currentValue = calculatePositionValue(position.shares, position.currentPrice);
          const potentialPayout = position.shares;
          return (
            <div
              key={position.symbol}
              className="rounded-md border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm line-clamp-2">{position.question}</p>
                  <p className="text-xs text-muted">{position.symbol}</p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    position.outcome === "Yes"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                  }`}
                >
                  {position.outcome}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div>
                  <dt className="text-muted">Shares</dt>
                  <dd>{position.shares.toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Current Value</dt>
                  <dd>${currentValue.toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Potential Payout</dt>
                  <dd className="text-green-600 dark:text-green-400 font-medium">
                    ${potentialPayout.toFixed(2)}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => handleSell(position)}
                  disabled={selling === position.symbol}
                  className="w-full rounded border border-red-300 bg-red-50 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/50 disabled:opacity-50"
                >
                  {selling === position.symbol ? "Selling..." : "Sell"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="mt-3 hidden overflow-x-auto border border-border rounded-md md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <SortableTableHeader
                label="Position"
                columnKey="position"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
              />
              <SortableTableHeader
                label="Outcome"
                columnKey="outcome"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted"
              />
              <SortableTableHeader
                label="Shares"
                columnKey="shares"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted"
              />
              <SortableTableHeader
                label="Current Value"
                columnKey="currentValue"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted"
              />
              <SortableTableHeader
                label="Potential Payout"
                columnKey="potentialPayout"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted"
              />
              <th className="px-4 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((position) => {
              const currentValue = calculatePositionValue(position.shares, position.currentPrice);
              const potentialPayout = position.shares;

              return (
                <tr key={position.symbol} className="border-b border-border last:border-0">
                  <td className="py-3 px-4">
                    <p className="font-medium text-sm line-clamp-1">{position.question}</p>
                    <p className="text-xs text-muted mt-0.5">{position.symbol}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        position.outcome === "Yes"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                      }`}
                    >
                      {position.outcome}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {position.shares.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    ${currentValue.toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      ${potentialPayout.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSell(position)}
                      disabled={selling === position.symbol}
                      className="inline-block rounded border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/50 disabled:opacity-50"
                    >
                      {selling === position.symbol ? "Selling..." : "Sell"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
