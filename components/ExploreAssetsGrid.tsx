"use client";

import type { PrivateCompany } from "@/lib/vaulto/companies";
import { AssetCard } from "@/components/AssetCard";
import { AssetListRow } from "@/components/AssetListRow";

type ViewMode = "grid" | "list";

interface ExploreAssetsGridProps {
  companies: PrivateCompany[];
  viewMode: ViewMode;
}

/**
 * Grid/List display for Explore Assets.
 */
export function ExploreAssetsGrid({ companies, viewMode }: ExploreAssetsGridProps) {
  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted text-sm">No assets found matching your criteria.</p>
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {companies.map((company) => (
          <AssetCard key={company.id} company={company} />
        ))}
      </div>
    );
  }

  return (
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
          {companies.map((company) => (
            <AssetListRow key={company.id} company={company} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
