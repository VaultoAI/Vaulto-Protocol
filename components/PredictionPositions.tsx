"use client";

import { useMemo } from "react";
import { usePredictionTrading, type PredictionPosition } from "@/hooks/usePredictionTrading";
import { useSortableTable, type SortableColumn } from "@/hooks/useSortableTable";
import { SortableTableHeader } from "@/components/SortableHeader";

export function PredictionPositions() {
  const { positions, isLoadingPositions } = usePredictionTrading();

  type PositionColumnKey = "position" | "side" | "shares" | "currentValue" | "unrealizedPnl";

  const columns: SortableColumn<PositionColumnKey, PredictionPosition>[] = useMemo(
    () => [
      { key: "position", getValue: (p) => p.eventName || p.eventId },
      { key: "side", getValue: (p) => p.side },
      { key: "shares", getValue: (p) => p.shares },
      { key: "currentValue", getValue: (p) => p.shares * p.currentPrice },
      { key: "unrealizedPnl", getValue: (p) => p.unrealizedPnl },
    ],
    []
  );

  const { sortedData, sortConfig, handleSort } = useSortableTable(positions, columns);

  if (isLoadingPositions) {
    return (
      <div className="mt-6">
        <h2 className="text-lg font-medium">Your Positions</h2>
        <div className="mt-3 animate-pulse">
          <div className="h-16 bg-badge-bg rounded-md" />
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium">Your Positions</h2>

      {/* Mobile cards */}
      <div className="mt-3 flex flex-col gap-3 md:hidden">
        {sortedData.map((position) => {
          const currentValue = position.shares * position.currentPrice;
          const isLong = position.side === "LONG";
          const isProfitable = position.unrealizedPnl >= 0;
          return (
            <div
              key={position.id}
              className="rounded-md border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm line-clamp-2">
                    {position.eventName || position.eventId}
                  </p>
                  {position.company && (
                    <p className="text-xs text-muted">{position.company}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                    isLong
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                  }`}
                >
                  {position.side}
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
                  <dt className="text-muted">Entry Price</dt>
                  <dd>${position.entryPrice.toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-muted">P&L</dt>
                  <dd className={isProfitable ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    {isProfitable ? "+" : ""}${position.unrealizedPnl.toFixed(2)}
                    {position.unrealizedPnlPercent !== undefined && (
                      <span className="text-xs ml-1">
                        ({isProfitable ? "+" : ""}{position.unrealizedPnlPercent.toFixed(1)}%)
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
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
                label="Side"
                columnKey="side"
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
                label="P&L"
                columnKey="unrealizedPnl"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted"
              />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((position) => {
              const currentValue = position.shares * position.currentPrice;
              const isLong = position.side === "LONG";
              const isProfitable = position.unrealizedPnl >= 0;

              return (
                <tr key={position.id} className="border-b border-border last:border-0">
                  <td className="py-3 px-4">
                    <p className="font-medium text-sm line-clamp-1">
                      {position.eventName || position.eventId}
                    </p>
                    {position.company && (
                      <p className="text-xs text-muted mt-0.5">{position.company}</p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                        isLong
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                      }`}
                    >
                      {position.side}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {position.shares.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    ${currentValue.toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={isProfitable ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {isProfitable ? "+" : ""}${position.unrealizedPnl.toFixed(2)}
                      {position.unrealizedPnlPercent !== undefined && (
                        <span className="text-xs ml-1">
                          ({isProfitable ? "+" : ""}{position.unrealizedPnlPercent.toFixed(1)}%)
                        </span>
                      )}
                    </span>
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
