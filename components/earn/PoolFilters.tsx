"use client";

import { useMemo } from "react";
import type { StockPool } from "@/components/EarnPoolsTable";

export type FilterState = {
  search: string;
  industry: string;
  minApr: number | null;
  sortBy: "tvl" | "apr" | "volume";
};

type PoolFiltersProps = {
  pools: StockPool[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
};

export function PoolFilters({
  pools,
  filters,
  onFiltersChange,
}: PoolFiltersProps) {
  // Get unique industries from pools
  const industries = useMemo(() => {
    const industrySet = new Set(pools.map((p) => p.company.industry));
    return Array.from(industrySet).sort();
  }, [pools]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value });
  };

  const handleIndustryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({ ...filters, industry: e.target.value });
  };

  const handleMinAprChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFiltersChange({
      ...filters,
      minApr: value ? parseInt(value) : null,
    });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      sortBy: e.target.value as "tvl" | "apr" | "volume",
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      search: "",
      industry: "",
      minApr: null,
      sortBy: "tvl",
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.industry ||
    filters.minApr !== null ||
    filters.sortBy !== "tvl";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      {/* Search */}
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search pools..."
          value={filters.search}
          onChange={handleSearchChange}
          className="w-full rounded-lg border border-border/50 bg-card-bg pl-10 pr-4 py-2.5 text-sm placeholder:text-muted transition-all hover:border-border focus:outline-none focus:ring-2 focus:ring-green/20 focus:border-green/50"
        />
      </div>

      {/* Industry Filter */}
      <div className="relative">
        <select
          value={filters.industry}
          onChange={handleIndustryChange}
          className="appearance-none rounded-lg border border-border/50 bg-card-bg px-4 py-2.5 pr-9 text-sm text-foreground transition-all hover:border-border focus:outline-none focus:ring-2 focus:ring-green/20 focus:border-green/50 cursor-pointer"
        >
          <option value="">All Industries</option>
          {industries.map((industry) => (
            <option key={industry} value={industry}>
              {industry}
            </option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Min APR Filter */}
      <div className="relative">
        <select
          value={filters.minApr ?? ""}
          onChange={handleMinAprChange}
          className="appearance-none rounded-lg border border-border/50 bg-card-bg px-4 py-2.5 pr-9 text-sm text-foreground transition-all hover:border-border focus:outline-none focus:ring-2 focus:ring-green/20 focus:border-green/50 cursor-pointer"
        >
          <option value="">Any APR</option>
          <option value="15">15%+ APR</option>
          <option value="20">20%+ APR</option>
          <option value="25">25%+ APR</option>
          <option value="30">30%+ APR</option>
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Sort By */}
      <div className="relative">
        <select
          value={filters.sortBy}
          onChange={handleSortChange}
          className="appearance-none rounded-lg border border-border/50 bg-card-bg px-4 py-2.5 pr-9 text-sm text-foreground transition-all hover:border-border focus:outline-none focus:ring-2 focus:ring-green/20 focus:border-green/50 cursor-pointer"
        >
          <option value="tvl">Sort by TVL</option>
          <option value="apr">Sort by APR</option>
          <option value="volume">Sort by Volume</option>
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClearFilters}
          className="text-sm text-muted hover:text-foreground whitespace-nowrap"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

/** Apply filters to a list of pools */
export function applyPoolFilters(
  pools: StockPool[],
  filters: FilterState
): StockPool[] {
  let filtered = [...pools];

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.poolName.toLowerCase().includes(searchLower) ||
        p.symbol.toLowerCase().includes(searchLower) ||
        p.company.name.toLowerCase().includes(searchLower)
    );
  }

  // Industry filter
  if (filters.industry) {
    filtered = filtered.filter((p) => p.company.industry === filters.industry);
  }

  // Min APR filter
  if (filters.minApr !== null) {
    filtered = filtered.filter((p) => p.apr >= filters.minApr!);
  }

  // Sorting
  switch (filters.sortBy) {
    case "apr":
      filtered.sort((a, b) => b.apr - a.apr);
      break;
    case "volume":
      filtered.sort((a, b) => b.volume24h - a.volume24h);
      break;
    case "tvl":
    default:
      filtered.sort((a, b) => b.tvlUSD - a.tvlUSD);
      break;
  }

  return filtered;
}
