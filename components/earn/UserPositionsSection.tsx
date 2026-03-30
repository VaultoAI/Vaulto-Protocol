"use client";

import { useState } from "react";
import { TokenLogo } from "@/components/TokenLogo";
import { formatUSD, formatPercent } from "@/lib/format";
import type { LPPosition } from "@/lib/lp/types";
import type { StockPool } from "@/components/EarnPoolsTable";

type UserPositionsSectionProps = {
  positions: LPPosition[];
  pools: StockPool[];
  onAddLiquidity: () => void;
  onRemoveLiquidity: (position: LPPosition) => void;
  onClaimFees: (positionId: string) => void;
};

export function UserPositionsSection({
  positions,
  pools,
  onAddLiquidity,
  onRemoveLiquidity,
  onClaimFees,
}: UserPositionsSectionProps) {
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleClaimFees = async (positionId: string) => {
    setClaimingId(positionId);
    // Simulate transaction delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    onClaimFees(positionId);
    setClaimingId(null);
  };

  // Find pool info for each position to get company details
  const getPoolForPosition = (position: LPPosition) => {
    return pools.find((p) => p.company.id === position.companyId);
  };

  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-medium">Your Positions</h2>
          <button
            type="button"
            onClick={onAddLiquidity}
            className="rounded border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
          >
            + Add Liquidity
          </button>
        </div>
        <div className="p-8 text-center">
          <p className="text-muted">No positions yet. Add liquidity to earn fees.</p>
          <button
            type="button"
            onClick={onAddLiquidity}
            className="mt-4 rounded border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Add Your First Position
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-lg font-medium">Your Positions</h2>
        <button
          type="button"
          onClick={onAddLiquidity}
          className="rounded border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
        >
          + Add Liquidity
        </button>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 p-4 md:hidden">
        {positions.map((position) => {
          const pool = getPoolForPosition(position);
          return (
            <div
              key={position.id}
              className="rounded-md border border-border bg-background p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1 shrink-0">
                    <TokenLogo
                      symbol={position.tokenSymbol}
                      companyName={position.companyName}
                      companyWebsite={position.companyWebsite}
                      size={28}
                      className="ring-2 ring-background"
                    />
                    <TokenLogo symbol="USDC" size={28} className="ring-2 ring-background" />
                  </div>
                  <span className="font-medium">{position.poolName}</span>
                </div>
                <span className="text-green-500 font-medium">
                  {formatPercent(position.apr)}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted">Liquidity</dt>
                  <dd className="font-medium">{formatUSD(position.totalValueUsd)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Pool Share</dt>
                  <dd>{position.sharePercent.toFixed(4)}%</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted">Unclaimed Fees</dt>
                  <dd className="text-green-500 font-medium">{formatUSD(position.unclaimedFees)}</dd>
                </div>
              </dl>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => pool && onAddLiquidity()}
                  className="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveLiquidity(position)}
                  className="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => handleClaimFees(position.id)}
                  disabled={position.unclaimedFees <= 0 || claimingId === position.id}
                  className="flex-1 rounded border border-green-500 text-green-500 px-3 py-1.5 text-sm hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {claimingId === position.id ? "Claiming..." : "Claim"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="py-3 px-4 font-medium text-muted">Pool</th>
              <th className="py-3 px-4 font-medium text-muted text-right">Liquidity</th>
              <th className="py-3 px-4 font-medium text-muted text-right">Share</th>
              <th className="py-3 px-4 font-medium text-muted text-right">Unclaimed Fees</th>
              <th className="py-3 px-4 font-medium text-muted text-right">APR</th>
              <th className="py-3 px-4 font-medium text-muted text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const pool = getPoolForPosition(position);
              return (
                <tr
                  key={position.id}
                  className="border-b border-border last:border-0 hover:bg-muted/10"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <div className="flex -space-x-1 shrink-0">
                        <TokenLogo
                          symbol={position.tokenSymbol}
                          companyName={position.companyName}
                          companyWebsite={position.companyWebsite}
                          size={24}
                          className="ring-2 ring-background"
                        />
                        <TokenLogo symbol="USDC" size={24} className="ring-2 ring-background" />
                      </div>
                      <span>{position.poolName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatUSD(position.totalValueUsd)}
                  </td>
                  <td className="py-3 px-4 text-right text-muted">
                    {position.sharePercent.toFixed(4)}%
                  </td>
                  <td className="py-3 px-4 text-right text-green-500 font-medium">
                    {formatUSD(position.unclaimedFees)}
                  </td>
                  <td className="py-3 px-4 text-right text-green-500 font-medium">
                    {formatPercent(position.apr)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => pool && onAddLiquidity()}
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-muted/50"
                        title="Add liquidity"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveLiquidity(position)}
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-muted/50"
                        title="Remove liquidity"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClaimFees(position.id)}
                        disabled={position.unclaimedFees <= 0 || claimingId === position.id}
                        className="rounded border border-green-500 text-green-500 px-2 py-1 text-xs hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Claim fees"
                      >
                        {claimingId === position.id ? "..." : "Claim"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
