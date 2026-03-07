"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getIPOBandPositions,
  sellIPOBandPosition,
  calculatePositionValue,
  type IPOBandPosition,
} from "@/lib/polymarket/demo-trading";
import type { CompanyIPO } from "@/lib/polymarket/ipo-valuations";
import { useSortableTable, type SortableColumn } from "@/hooks/useSortableTable";
import { SortableTableHeader } from "@/components/SortableHeader";

type PositionsProps = {
  ipos: CompanyIPO[];
};

export function IPOBandPositions({ ipos }: PositionsProps) {
  const [positions, setPositions] = useState<IPOBandPosition[]>([]);
  const [selling, setSelling] = useState<string | null>(null);

  // Refresh positions on mount and after any updates
  const refreshPositions = useCallback(() => {
    setPositions(getIPOBandPositions(ipos));
  }, [ipos]);

  useEffect(() => {
    refreshPositions();
    // Poll for updates every 2 seconds
    const interval = setInterval(refreshPositions, 2000);
    return () => clearInterval(interval);
  }, [refreshPositions]);

  const handleSell = useCallback(async (position: IPOBandPosition) => {
    const ipo = ipos.find((i) => i.company === position.company);
    if (!ipo) return;

    // Find the band by matching the question
    const band = ipo.bands.find((b) => b.question === position.question);
    if (!band) return;

    setSelling(position.symbol);
    await sellIPOBandPosition({
      ipo,
      band,
      direction: position.direction,
      shares: position.shares,
    });
    refreshPositions();
    setSelling(null);
  }, [ipos, refreshPositions]);

  type IPOColumnKey = "position" | "outcome" | "range" | "shares" | "currentValue" | "potentialPayout";

  const columns: SortableColumn<IPOColumnKey, IPOBandPosition>[] = useMemo(
    () => [
      { key: "position", getValue: (p) => p.company },
      { key: "outcome", getValue: (p) => p.direction },
      { key: "range", getValue: (p) => p.bandRange },
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
      <h2 className="text-lg font-medium">Your IPO Positions</h2>

      {/* Mobile cards */}
      <div className="mt-3 flex flex-col gap-3 md:hidden">
        {positions.map((position) => {
          const currentValue = calculatePositionValue(position.shares, position.currentPrice);
          const potentialPayout = position.shares;
          const isYes = position.direction === "long";
          return (
            <div
              key={position.symbol}
              className="rounded-md border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{position.company} IPO</p>
                  <p className="text-xs text-muted">{position.symbol}</p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    isYes
                      ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                  }`}
                >
                  {isYes ? "Yes" : "No"}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div>
                  <dt className="text-muted">Range</dt>
                  <dd>{position.bandRange}</dd>
                </div>
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
                  <dd>
                    <span className={isYes ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                      ${potentialPayout.toFixed(2)}
                    </span>
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
                label="Range"
                columnKey="range"
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
              const isYes = position.direction === "long";

              return (
                <tr key={position.symbol} className="border-b border-border last:border-0">
                  <td className="py-3 px-4">
                    <p className="font-medium text-sm">{position.company} IPO</p>
                    <p className="text-xs text-muted mt-0.5">{position.symbol}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        isYes
                          ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                      }`}
                    >
                      {isYes ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {position.bandRange}
                  </td>
                  <td className="py-3 px-4 text-muted">{position.shares.toFixed(2)}</td>
                  <td className="py-3 px-4 text-muted">${currentValue.toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <span className={`font-medium ${
                      isYes ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}>
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
