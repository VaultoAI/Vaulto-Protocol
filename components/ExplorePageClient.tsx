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
  // Tracks the last `q` value we wrote to the URL so the searchParams listener
  // can ignore our own echo and only adopt external pushes (e.g. header search).
  const lastPushedQRef = useRef<string>(searchParams?.get("q") || "");

  // Debounced URL update - only updates URL after user stops typing.
  // Read params from window.location to avoid re-creating this callback on every
  // URL change, which would churn the debounce timer.
  const updateUrlWithSearch = useCallback((value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value.trim()) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    lastPushedQRef.current = value;
    router.push(`/explore${params.toString() ? `?${params}` : ""}`, { scroll: false });
  }, [router]);

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

  // Adopt external `q` changes (header search push, browser back/forward).
  // Skip when the URL value matches what we last pushed ourselves — that's our
  // own echo and adopting it would race with in-flight keystrokes.
  const urlQ = searchParams?.get("q") || "";
  useEffect(() => {
    if (urlQ === lastPushedQRef.current) return;
    lastPushedQRef.current = urlQ;
    setSearchValue(urlQ);
  }, [urlQ]);

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

    // Search filter - use local searchValue for immediate filtering.
    // Score each match so that closer matches (name/symbol prefix) rank above
    // weaker ones (substring, industry). Within a score band, fall back to the
    // active sort.
    const q = searchValue.toLowerCase().trim();
    let scoreMap: Map<PrivateCompany, number> | null = null;
    if (q) {
      scoreMap = new Map();
      result = result.filter((c) => {
        const name = c.name.toLowerCase();
        const symbol = getSyntheticSymbol(c.name).toLowerCase();
        // Symbols typically start with "v" (e.g. vANTH); compare the bare form too.
        const symbolBare = symbol.startsWith("v") ? symbol.slice(1) : symbol;
        const industry = c.industry.toLowerCase();

        let score = 0;
        if (name === q || symbol === q || symbolBare === q) score = 100;
        else if (name.startsWith(q) || symbolBare.startsWith(q)) score = 80;
        else if (symbol.startsWith(q)) score = 70;
        else if (name.split(/\s+/).some((w) => w.startsWith(q))) score = 60;
        else if (name.includes(q)) score = 40;
        else if (symbol.includes(q) || symbolBare.includes(q)) score = 30;
        else if (industry.includes(q)) score = 10;

        if (score === 0) return false;
        scoreMap!.set(c, score);
        return true;
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
    const tieBreaker = (a: PrivateCompany, b: PrivateCompany) => {
      switch (sortBy) {
        case "Price: High to Low":
          return (b.lastFundingEstPricePerShareUsd ?? 0) - (a.lastFundingEstPricePerShareUsd ?? 0);
        case "Price: Low to High":
          return (a.lastFundingEstPricePerShareUsd ?? 0) - (b.lastFundingEstPricePerShareUsd ?? 0);
        case "Name: A-Z":
          return a.name.localeCompare(b.name);
        case "Most Popular":
        default:
          return b.valuationUsd - a.valuationUsd;
      }
    };

    if (scoreMap) {
      result.sort((a, b) => {
        const diff = (scoreMap!.get(b) ?? 0) - (scoreMap!.get(a) ?? 0);
        if (diff !== 0) return diff;
        return tieBreaker(a, b);
      });
    } else {
      result.sort(tieBreaker);
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
