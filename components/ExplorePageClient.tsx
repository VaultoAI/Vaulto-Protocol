"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/lib/vaulto/companyUtils";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol } from "@/lib/vaulto/companies";
import { getCompanyCategory } from "@/lib/vaulto/companyUtils";
import type { Category } from "@/lib/vaulto/companyUtils";
import { ExploreAssetsNav } from "@/components/ExploreAssetsNav";
import { ExploreAssetsGrid } from "@/components/ExploreAssetsGrid";
import { ExploreTopSection } from "@/components/ExploreTopSection";
import { IndexesSection } from "@/components/IndexesSection";
import type { VaultoIndex, IndexPricesMap } from "@/lib/vaulto/indexes";
import type { AllImpliedValuationsResponse } from "@/lib/polymarket/implied-valuations";

type SortOption = "Most Popular" | "Price: High to Low" | "Price: Low to High" | "Name: A-Z";
type ViewMode = "grid" | "list";

const SORT_OPTIONS: SortOption[] = ["Most Popular", "Price: High to Low", "Price: Low to High", "Name: A-Z"];

interface ExplorePageClientProps {
  companies: PrivateCompany[];
  indexes: VaultoIndex[];
  indexPrices?: IndexPricesMap;
  newlyAdded?: PrivateCompany[];
  impliedValuations?: AllImpliedValuationsResponse | null;
}

/**
 * Client-side wrapper for Explore page that manages state
 * and renders sections in the correct order.
 */
export function ExplorePageClient({ companies, indexes, indexPrices = {}, newlyAdded, impliedValuations }: ExplorePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local search state for immediate filtering (no lag)
  const [searchValue, setSearchValue] = useState(searchParams?.get("q") || "");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced URL update - only updates URL after user stops typing
  const updateUrlWithSearch = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value.trim()) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    router.push(`/explore${params.toString() ? `?${params}` : ""}`, { scroll: false });
  }, [router, searchParams]);

  // Handle search change - immediate local state, debounced URL
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);

    // Clear any pending URL update
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Schedule URL update after 300ms of inactivity
    debounceTimerRef.current = setTimeout(() => {
      updateUrlWithSearch(value);
    }, 300);
  }, [updateUrlWithSearch]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Sync local state with URL when URL changes externally (e.g., browser back/forward)
  useEffect(() => {
    const urlSearch = searchParams?.get("q") || "";
    if (urlSearch !== searchValue) {
      setSearchValue(urlSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Read category from URL params, fallback to state for ExploreAssetsNav compatibility
  const categoryParam = searchParams?.get("category");
  const urlCategory = categoryParam && CATEGORIES.includes(categoryParam as Category)
    ? (categoryParam as Category)
    : "All assets";
  const [activeCategory, setActiveCategory] = useState<Category>(urlCategory);

  // Sync state with URL param changes
  useEffect(() => {
    setActiveCategory(urlCategory);
  }, [urlCategory]);

  // Read view mode and sort from URL params
  const viewParam = searchParams?.get("view");
  const viewMode: ViewMode = viewParam === "list" ? "list" : "grid";

  const sortParam = searchParams?.get("sort");
  const sortBy: SortOption = sortParam && SORT_OPTIONS.includes(sortParam as SortOption)
    ? (sortParam as SortOption)
    : "Most Popular";

  // Track if user is searching (hide top sections entirely) - use local state for immediate response
  const isSearching = searchValue.trim() !== "";

  // Track if user is actively interacting with nav controls (mobile only behavior)
  // Hide indexes/trending sections on mobile when: non-default sort selected OR list view selected
  const hasActiveNavInteraction = sortBy !== "Most Popular" || viewMode === "list";

  const filteredCompanies = useMemo(() => {
    let result = [...companies];

    // Search filter - use local searchValue for immediate filtering
    if (searchValue.trim()) {
      const q = searchValue.toLowerCase().trim();
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
  }, [companies, searchValue, activeCategory, sortBy]);

  return (
    <div>
      {/* Nav at the top - mobile only */}
      <div className="md:hidden">
        <ExploreAssetsNav
          filteredCount={filteredCompanies.length}
          searchValue={searchValue}
          onSearchChange={handleSearchChange}
        />
      </div>

      {/* Index Products section - hidden when searching, or on mobile when nav has active interaction */}
      {!isSearching && (
        <div className={hasActiveNavInteraction ? "hidden md:block" : ""}>
          <IndexesSection indexes={indexes} companies={companies} indexPrices={indexPrices} />
        </div>
      )}

      {/* Divider - hidden when searching or on mobile */}
      {!isSearching && <div className="hidden md:block border-b border-border" />}

      {/* Top section: Gainers, Trending, Newly Added - hidden when searching, or on mobile when nav has active interaction */}
      {!isSearching && (
        <div className={hasActiveNavInteraction ? "hidden md:block" : ""}>
          <ExploreTopSection companies={companies} newlyAdded={newlyAdded} impliedValuations={impliedValuations} />
        </div>
      )}

      {/* Divider - hidden when searching or on mobile */}
      {!isSearching && <div className="hidden md:block border-b border-border" />}

      {/* Nav above asset grid - desktop only */}
      <div className="hidden md:block">
        <ExploreAssetsNav
          filteredCount={filteredCompanies.length}
          searchValue={searchValue}
          onSearchChange={handleSearchChange}
        />
      </div>

      {/* Asset grid */}
      <div className="pt-5 pb-6">
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
