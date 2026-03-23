"use client";

import { useMemo } from "react";
import { TokenLogo } from "@/components/TokenLogo";
import { formatUSD, formatPercent } from "@/lib/format";
import type { StockPool } from "@/components/EarnPoolsTable";

type FeaturedPoolsProps = {
  pools: StockPool[];
  onAddLiquidity: (pool: StockPool) => void;
};

export function FeaturedPools({ pools, onAddLiquidity }: FeaturedPoolsProps) {
  // Get top 3 pools by APR
  const featuredPools = useMemo(() => {
    return [...pools].sort((a, b) => b.apr - a.apr).slice(0, 3);
  }, [pools]);

  if (featuredPools.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-muted mb-3">Top Earning Pools</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {featuredPools.map((pool) => (
          <div
            key={pool.company.id}
            className="rounded-lg border border-border bg-background p-4 hover:border-foreground/30 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex -space-x-1">
                <TokenLogo
                  symbol={pool.symbol}
                  companyName={pool.company.name}
                  companyWebsite={pool.company.website}
                  size={28}
                  className="ring-2 ring-background"
                />
                <TokenLogo symbol="USDC" size={28} className="ring-2 ring-background" />
              </div>
              <span className="text-lg font-semibold text-green-500">
                {formatPercent(pool.apr)}
              </span>
            </div>

            {/* Pool Name */}
            <p className="font-medium">{pool.poolName}</p>
            <p className="text-xs text-muted mt-0.5">{pool.company.industry}</p>

            {/* Stats */}
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted text-xs">TVL</dt>
                <dd className="font-medium">{formatUSD(pool.tvlUSD)}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Volume 24h</dt>
                <dd className="font-medium">{formatUSD(pool.volume24h)}</dd>
              </div>
            </dl>

            {/* Add Button */}
            <button
              type="button"
              onClick={() => onAddLiquidity(pool)}
              className="mt-4 w-full rounded border border-foreground bg-foreground py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              Add Liquidity
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
