"use client";

import { useRouter, useSearchParams } from "next/navigation";

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

  const handleViewModeChange = (mode: ViewMode) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (mode !== "grid") {
      params.set("view", mode);
    } else {
      params.delete("view");
    }
    router.push(`/explore${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <div className="pt-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
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
