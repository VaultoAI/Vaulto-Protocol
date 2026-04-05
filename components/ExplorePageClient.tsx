"use client";

import { useState, useMemo } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol } from "@/lib/vaulto/companies";
import { getCompanyCategory } from "@/lib/vaulto/companyUtils";
import type { Category } from "@/lib/vaulto/companyUtils";
import { ExploreAssetsNav } from "@/components/ExploreAssetsNav";
import { ExploreAssetsGrid } from "@/components/ExploreAssetsGrid";
import { IndexesSection } from "@/components/IndexesSection";
import { ExploreTopSection } from "@/components/ExploreTopSection";
import type { VaultoIndex, IndexPricesMap } from "@/lib/vaulto/indexes";

type SortOption = "Most Popular" | "Price: High to Low" | "Price: Low to High" | "Name: A-Z";
type ViewMode = "grid" | "list";

interface ExplorePageClientProps {
  companies: PrivateCompany[];
  indexes: VaultoIndex[];
  indexPrices?: IndexPricesMap;
  newlyAdded?: PrivateCompany[];
}

/**
 * Client-side wrapper for Explore page that manages state
 * and renders sections in the correct order.
 */
export function ExplorePageClient({ companies, indexes, indexPrices = {}, newlyAdded }: ExplorePageClientProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All assets");
  const [sortBy, setSortBy] = useState<SortOption>("Most Popular");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Track if user is actively interacting with nav filters (mobile only behavior)
  const hasActiveNavInteraction = search.trim() !== "" || activeCategory !== "All assets";

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
    <div>
      {/* Nav at the top - mobile only */}
      <div className="md:hidden">
        <ExploreAssetsNav
          search={search}
          setSearch={setSearch}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          sortBy={sortBy}
          setSortBy={setSortBy}
          viewMode={viewMode}
          setViewMode={setViewMode}
          showSortDropdown={showSortDropdown}
          setShowSortDropdown={setShowSortDropdown}
          filteredCount={filteredCompanies.length}
        />
      </div>

      {/* Index Products section - hidden on mobile when nav has active interaction */}
      <div className={hasActiveNavInteraction ? "hidden md:block" : ""}>
        <IndexesSection indexes={indexes} companies={companies} indexPrices={indexPrices} />
      </div>

      {/* Divider - hidden on mobile */}
      <div className="hidden md:block border-b border-border" />

      {/* Top section: Gainers, Trending, Newly Added - hidden on mobile when nav has active interaction */}
      <div className={hasActiveNavInteraction ? "hidden md:block" : ""}>
        <ExploreTopSection companies={companies} newlyAdded={newlyAdded} />
      </div>

      {/* Divider - hidden on mobile */}
      <div className="hidden md:block border-b border-border" />

      {/* Nav above asset grid - desktop only */}
      <div className="hidden md:block">
        <ExploreAssetsNav
          search={search}
          setSearch={setSearch}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          sortBy={sortBy}
          setSortBy={setSortBy}
          viewMode={viewMode}
          setViewMode={setViewMode}
          showSortDropdown={showSortDropdown}
          setShowSortDropdown={setShowSortDropdown}
          filteredCount={filteredCompanies.length}
        />
      </div>

      {/* Asset grid */}
      <div className="py-6">
        <ExploreAssetsGrid companies={filteredCompanies} viewMode={viewMode} />
      </div>

      {/* Empty state for no companies at all */}
      {companies.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-card-bg px-6 py-16 text-center">
          <p className="text-muted text-sm">No companies available for minting.</p>
        </div>
      )}
    </div>
  );
}
