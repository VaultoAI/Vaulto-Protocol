"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { EarnPoolsTable, type StockPool } from "@/components/EarnPoolsTable";
import { UserPositionsSection } from "@/components/earn/UserPositionsSection";
import { PoolFilters, applyPoolFilters, type FilterState } from "@/components/earn/PoolFilters";
import { FeaturedPools } from "@/components/earn/FeaturedPools";
import { useLPPositions } from "@/hooks/useLPPositions";
import { formatUSD, formatPercent } from "@/lib/format";
import type { LPPosition } from "@/lib/lp/types";

// Lazy-load modals to reduce initial bundle
const AddLiquidityModal = dynamic(
  () => import("@/components/earn/AddLiquidityModal").then((mod) => mod.AddLiquidityModal),
  { ssr: false }
);
const RemoveLiquidityModal = dynamic(
  () => import("@/components/earn/RemoveLiquidityModal").then((mod) => mod.RemoveLiquidityModal),
  { ssr: false }
);

type EarnPageClientProps = {
  pools: StockPool[];
  totalTVL: number;
  totalVolume: number;
  avgAPR: number;
};

export function EarnPageClient({
  pools,
  totalTVL,
  totalVolume,
  avgAPR,
}: EarnPageClientProps) {
  const {
    positions,
    totalEarnings,
    totalLiquidity,
    addLiquidity,
    removeLiquidity,
    claimFees,
  } = useLPPositions();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<StockPool | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<LPPosition | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    industry: "",
    minApr: null,
    sortBy: "tvl",
  });

  // Apply filters to pools
  const filteredPools = useMemo(
    () => applyPoolFilters(pools, filters),
    [pools, filters]
  );

  const handleOpenAddModal = useCallback((pool?: StockPool) => {
    setSelectedPool(pool || null);
    setIsAddModalOpen(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setSelectedPool(null);
  }, []);

  const handleOpenRemoveModal = useCallback((position: LPPosition) => {
    setSelectedPosition(position);
    setIsRemoveModalOpen(true);
  }, []);

  const handleCloseRemoveModal = useCallback(() => {
    setIsRemoveModalOpen(false);
    setSelectedPosition(null);
  }, []);

  return (
    <>
      {/* Stats Dashboard */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-background p-5 text-center">
          <p className="text-sm text-muted">Total TVL</p>
          <p className="mt-1 text-xl font-semibold">{formatUSD(totalTVL)}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-5 text-center">
          <p className="text-sm text-muted">Volume (24h)</p>
          <p className="mt-1 text-xl font-semibold">{formatUSD(totalVolume)}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-5 text-center">
          <p className="text-sm text-muted">Avg APR</p>
          <p className="mt-1 text-xl font-semibold text-green-500">{formatPercent(avgAPR)}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-5 text-center">
          <p className="text-sm text-muted">Your Liquidity</p>
          <p className="mt-1 text-xl font-semibold">{formatUSD(totalLiquidity)}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-5 text-center col-span-2 sm:col-span-1">
          <p className="text-sm text-muted">Your Earnings</p>
          <p className="mt-1 text-xl font-semibold text-green-500">{formatUSD(totalEarnings)}</p>
        </div>
      </div>

      {/* User Positions Section */}
      <div className="mt-8">
        <UserPositionsSection
          positions={positions}
          pools={pools}
          onAddLiquidity={() => handleOpenAddModal()}
          onRemoveLiquidity={handleOpenRemoveModal}
          onClaimFees={claimFees}
        />
      </div>

      {/* Discover Pools Section */}
      <div className="mt-8">
        <h2 className="text-lg font-medium mb-4">Discover Pools</h2>

        {/* Featured Pools */}
        <FeaturedPools pools={pools} onAddLiquidity={handleOpenAddModal} />

        {/* Filters */}
        <div className="mb-4">
          <PoolFilters
            pools={pools}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        {/* Pool Results */}
        {filteredPools.length > 0 ? (
          <EarnPoolsTable pools={filteredPools} onAddLiquidity={handleOpenAddModal} />
        ) : (
          <div className="rounded-lg border border-border bg-background p-8 text-center">
            <p className="text-muted">No pools match your filters.</p>
            <button
              type="button"
              onClick={() => setFilters({ search: "", industry: "", minApr: null, sortBy: "tvl" })}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Add Liquidity Modal */}
      <AddLiquidityModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        pool={selectedPool}
        pools={pools}
        onAddLiquidity={addLiquidity}
      />

      {/* Remove Liquidity Modal */}
      <RemoveLiquidityModal
        isOpen={isRemoveModalOpen}
        onClose={handleCloseRemoveModal}
        position={selectedPosition}
        onRemoveLiquidity={removeLiquidity}
      />
    </>
  );
}
