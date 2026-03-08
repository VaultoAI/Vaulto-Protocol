"use client";

import { useMemo } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { formatValuation, formatPricePerShare, getSyntheticSymbol } from "@/lib/vaulto/companies";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useSortableTable, type SortableColumn } from "@/hooks/useSortableTable";
import { SortableTableHeader } from "@/components/SortableHeader";

type MintTableProps = {
  companies: PrivateCompany[];
};

type ColumnKey = "company" | "valuation" | "funding" | "pricePerShare" | "token";

export function MintTable({ companies }: MintTableProps) {
  const columns: SortableColumn<ColumnKey, PrivateCompany>[] = useMemo(
    () => [
      { key: "company", getValue: (c) => c.name },
      { key: "valuation", getValue: (c) => c.valuationUsd },
      { key: "funding", getValue: (c) => c.totalFundingUsd },
      { key: "pricePerShare", getValue: (c) => c.lastFundingEstPricePerShareUsd ?? 0 },
      { key: "token", getValue: (c) => getSyntheticSymbol(c.name) },
    ],
    []
  );

  const { sortedData, sortConfig, handleSort } = useSortableTable(companies, columns);

  return (
    <>
      {/* Mobile cards */}
      <div className="mt-8 flex flex-col gap-3 md:hidden">
        {sortedData.map((company) => {
          const syntheticSymbol = getSyntheticSymbol(company.name);
          return (
            <div
              key={company.id}
              className="rounded-md border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <CompanyLogo name={company.name} website={company.website} size={40} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium whitespace-nowrap">{company.name}</p>
                    <p className="text-[10px] text-muted whitespace-nowrap">{company.industry}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-muted/50 px-2 py-0.5 text-xs font-medium">
                  {syntheticSymbol}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div>
                  <dt className="text-muted">Valuation</dt>
                  <dd>{formatValuation(company.valuationUsd)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Funding</dt>
                  <dd>{formatValuation(company.totalFundingUsd)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Price/Share</dt>
                  <dd>{formatPricePerShare(company.lastFundingEstPricePerShareUsd)}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="mt-8 hidden overflow-x-auto border border-border rounded-md md:block">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <SortableTableHeader
                label="Company"
                columnKey="company"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
              />
              <SortableTableHeader
                label="Valuation"
                columnKey="valuation"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted whitespace-nowrap"
              />
              <SortableTableHeader
                label="Funding"
                columnKey="funding"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted whitespace-nowrap"
              />
              <SortableTableHeader
                label="Price/Share"
                columnKey="pricePerShare"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted whitespace-nowrap"
              />
              <SortableTableHeader
                label="Token"
                columnKey="token"
                currentSortColumn={sortConfig.column}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort as (column: string) => void}
                className="text-muted"
              />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((company) => {
              const syntheticSymbol = getSyntheticSymbol(company.name);
              return (
                <tr
                  key={company.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <CompanyLogo name={company.name} website={company.website} size={32} />
                      <div>
                        <p className="text-xs font-medium whitespace-nowrap">{company.name}</p>
                        <p className="text-[10px] text-muted whitespace-nowrap">{company.industry}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {formatValuation(company.valuationUsd)}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {formatValuation(company.totalFundingUsd)}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {formatPricePerShare(company.lastFundingEstPricePerShareUsd)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center rounded-full bg-muted/50 px-2 py-0.5 text-xs font-medium">
                      {syntheticSymbol}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
