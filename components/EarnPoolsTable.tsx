"use client";

import { useMemo } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { formatValuation } from "@/lib/vaulto/companies";
import { formatUSD, formatPercent } from "@/lib/format";
import { TokenLogo } from "@/components/TokenLogo";
import { useSortableTable, type SortableColumn } from "@/hooks/useSortableTable";
import { SortableTableHeader } from "@/components/SortableHeader";

export type StockPool = {
  company: PrivateCompany;
  symbol: string;
  poolName: string;
  tvlUSD: number;
  volume24h: number;
  apr: number;
};

type EarnPoolsTableProps = {
  pools: StockPool[];
};

type ColumnKey = "pool" | "industry" | "valuation" | "tvl" | "volume" | "apr";

function PoolCell({ pool }: { pool: StockPool }) {
  const tokens = [pool.symbol, "USDC"];
  return (
    <td className="py-3 px-4">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <div className="flex -space-x-1 shrink-0">
          {tokens.map((symbol) => (
            <TokenLogo key={symbol} symbol={symbol} size={24} className="ring-2 ring-background" />
          ))}
        </div>
        <span>{pool.poolName}</span>
      </div>
    </td>
  );
}

function IndustryBadge({ industry }: { industry: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted/50 px-2 py-0.5 text-xs text-muted">
      {industry}
    </span>
  );
}

export function EarnPoolsTable({ pools }: EarnPoolsTableProps) {
  const columns: SortableColumn<ColumnKey, StockPool>[] = useMemo(
    () => [
      { key: "pool", getValue: (p) => p.poolName },
      { key: "industry", getValue: (p) => p.company.industry },
      { key: "valuation", getValue: (p) => p.company.valuationUsd },
      { key: "tvl", getValue: (p) => p.tvlUSD },
      { key: "volume", getValue: (p) => p.volume24h },
      { key: "apr", getValue: (p) => p.apr },
    ],
    []
  );

  const { sortedData, sortConfig, handleSort } = useSortableTable(pools, columns);

  return (
    <>
      {/* Mobile cards */}
      <div className="mt-8 flex flex-col gap-3 md:hidden">
        {sortedData.map((pool) => (
          <div
            key={pool.company.id}
            className="rounded-md border border-border bg-background p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex -space-x-1 shrink-0">
                  {[pool.symbol, "USDC"].map((symbol) => (
                    <TokenLogo key={symbol} symbol={symbol} size={28} className="ring-2 ring-background" />
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{pool.poolName}</p>
                  <IndustryBadge industry={pool.company.industry} />
                </div>
              </div>
              <span className="shrink-0 text-right font-medium text-green-500">
                {formatPercent(pool.apr)}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <dt className="text-muted">Valuation</dt>
                <dd>{formatValuation(pool.company.valuationUsd)}</dd>
              </div>
              <div>
                <dt className="text-muted">TVL</dt>
                <dd>{formatUSD(pool.tvlUSD)}</dd>
              </div>
              <div>
                <dt className="text-muted">Volume (24h)</dt>
                <dd>{formatUSD(pool.volume24h)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="mt-8 hidden overflow-x-auto border border-border rounded-md md:block">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <SortableTableHeader
                label="Pool"
                columnKey="pool"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
              />
              <SortableTableHeader
                label="Industry"
                columnKey="industry"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted"
              />
              <SortableTableHeader
                label="Valuation"
                columnKey="valuation"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted"
              />
              <SortableTableHeader
                label="TVL"
                columnKey="tvl"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted text-right"
              />
              <SortableTableHeader
                label="Volume (24h)"
                columnKey="volume"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted text-right"
              />
              <SortableTableHeader
                label="APR"
                columnKey="apr"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted text-right"
              />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((pool) => (
              <tr key={pool.company.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                <PoolCell pool={pool} />
                <td className="py-3 px-4">
                  <IndustryBadge industry={pool.company.industry} />
                </td>
                <td className="py-3 px-4 text-muted">
                  {formatValuation(pool.company.valuationUsd)}
                </td>
                <td className="py-3 px-4 text-muted text-right">{formatUSD(pool.tvlUSD)}</td>
                <td className="py-3 px-4 text-muted text-right">{formatUSD(pool.volume24h)}</td>
                <td className="py-3 px-4 text-right font-medium text-green-500">
                  {formatPercent(pool.apr)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
