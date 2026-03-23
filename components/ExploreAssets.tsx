"use client";

import { useState, useMemo } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol } from "@/lib/vaulto/companies";
import { AssetCard } from "@/components/AssetCard";
import { AssetListRow } from "@/components/AssetListRow";
import { CATEGORIES, getCompanyCategory, getDailyChange } from "@/lib/vaulto/companyUtils";
import type { Category } from "@/lib/vaulto/companyUtils";

interface ExploreAssetsProps {
  companies: PrivateCompany[];
}

type SortOption = "Most Popular" | "Price: High to Low" | "Price: Low to High" | "Name: A-Z";
type ViewMode = "grid" | "list";

/**
 * Explore Assets section matching Ondo Finance design.
 * Includes search, category filters, view toggle, sort, and asset grid.
 */
export function ExploreAssets({ companies }: ExploreAssetsProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All assets");
  const [sortBy, setSortBy] = useState<SortOption>("Most Popular");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const filteredCompanies = useMemo(() => {
    let result = [...companies];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((c) => {
        const symbol = getSyntheticSymbol(c.name).toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          symbol.includes(q) ||
          c.industry.toLowerCase().includes(q)
        );
      });
    }

    // Category filter
    if (activeCategory !== "All assets") {
      result = result.filter((c) => {
        const categories = getCompanyCategory(c);
        return categories.includes(activeCategory);
      });
    }

    // Sort
    switch (sortBy) {
      case "Most Popular":
        result.sort((a, b) => b.valuationUsd - a.valuationUsd);
        break;
      case "Price: High to Low":
        result.sort((a, b) =>
          (b.lastFundingEstPricePerShareUsd ?? 0) - (a.lastFundingEstPricePerShareUsd ?? 0)
        );
        break;
      case "Price: Low to High":
        result.sort((a, b) =>
          (a.lastFundingEstPricePerShareUsd ?? 0) - (b.lastFundingEstPricePerShareUsd ?? 0)
        );
        break;
      case "Name: A-Z":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [companies, search, activeCategory, sortBy]);

  return (
    <div className="mt-12">
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          Explore Assets
          <sup className="text-[10px] text-muted ml-0.5 font-normal">*,1</sup>
        </h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green" />
            </span>
            <span className="text-green font-medium">Market Open</span>
            <span className="text-muted">(Pre-IPO)</span>
          </span>
        </div>
      </div>

      {/* Search + Filters row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative w-full lg:w-[320px] shrink-0">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search asset name or ticker"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
          />
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-1 flex-wrap flex-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-foreground text-background"
                  : "bg-transparent text-muted hover:text-foreground hover:bg-badge-bg"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* View toggle + Sort */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Grid view */}
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-md transition-colors ${
              viewMode === "grid"
                ? "text-foreground bg-badge-bg"
                : "text-muted hover:text-foreground"
            }`}
            title="Grid view"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="0" y="0" width="7" height="7" rx="1.5" />
              <rect x="9" y="0" width="7" height="7" rx="1.5" />
              <rect x="0" y="9" width="7" height="7" rx="1.5" />
              <rect x="9" y="9" width="7" height="7" rx="1.5" />
            </svg>
          </button>

          {/* List view */}
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-md transition-colors ${
              viewMode === "list"
                ? "text-foreground bg-badge-bg"
                : "text-muted hover:text-foreground"
            }`}
            title="List view"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="0" y="1" width="16" height="2" rx="1" />
              <rect x="0" y="5" width="16" height="2" rx="1" />
              <rect x="0" y="9" width="16" height="2" rx="1" />
              <rect x="0" y="13" width="16" height="2" rx="1" />
            </svg>
          </button>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-card-hover transition-colors"
            >
              {sortBy}
              <svg
                className={`h-3.5 w-3.5 text-muted transition-transform ${showSortDropdown ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSortDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSortDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border border-border bg-card-bg shadow-lg py-1">
                  {(["Most Popular", "Price: High to Low", "Price: Low to High", "Name: A-Z"] as SortOption[]).map(
                    (option) => (
                      <button
                        key={option}
                        onClick={() => {
                          setSortBy(option);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          sortBy === option
                            ? "text-foreground font-medium bg-badge-bg"
                            : "text-muted hover:text-foreground hover:bg-card-hover"
                        }`}
                      >
                        {option}
                      </button>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Assets grid or list */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCompanies.map((company) => (
            <AssetCard key={company.id} company={company} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-badge-bg/50">
                <th className="text-left py-3 px-4 text-xs font-medium text-muted uppercase tracking-wider">Asset</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted uppercase tracking-wider">Price</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted uppercase tracking-wider">Last Round</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted uppercase tracking-wider">Valuation</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted uppercase tracking-wider w-[120px]">Chart</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map((company) => (
                <AssetListRow key={company.id} company={company} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {filteredCompanies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted text-sm">No assets found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
