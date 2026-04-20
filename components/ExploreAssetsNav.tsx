"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

type ViewMode = "grid" | "list";

interface ExploreAssetsNavProps {
  filteredCount: number;
}

/**
 * Navigation section for Explore Assets header with view toggle.
 */
export function ExploreAssetsNav({
  filteredCount,
}: ExploreAssetsNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const viewParam = searchParams?.get("view");
  const viewMode: ViewMode = viewParam === "list" ? "list" : "grid";

  // Mobile search state - synced with URL
  const [searchValue, setSearchValue] = useState(searchParams?.get("q") || "");

  // Sync search value with URL changes
  useEffect(() => {
    setSearchValue(searchParams?.get("q") || "");
  }, [searchParams]);

  const handleViewModeChange = (mode: ViewMode) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (mode !== "grid") {
      params.set("view", mode);
    } else {
      params.delete("view");
    }
    router.push(`/explore${params.toString() ? `?${params}` : ""}`);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);

    // Update URL for grid filtering
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value.trim()) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    router.push(`/explore${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <div className="pt-6">
      {/* Mobile search - visible only on mobile */}
      <div className="md:hidden mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search asset name or ticker"
            value={searchValue}
            onChange={handleSearchChange}
            className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
          />
        </div>
      </div>

      {/* Section header - hidden on mobile */}
      <div className="hidden md:flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          Explore Assets
          <span className="text-xs text-muted ml-2 font-normal">({filteredCount})</span>
        </h2>
        <div className="hidden md:flex items-center gap-2">
          {/* Grid view */}
          <button
            onClick={() => handleViewModeChange("grid")}
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
            onClick={() => handleViewModeChange("list")}
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
        </div>
      </div>
    </div>
  );
}
