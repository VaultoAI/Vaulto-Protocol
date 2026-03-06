"use client";

import { useAccount, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSwapConfig } from "@/hooks/useSwapConfig";
import { getUserPositions, type PositionInfo } from "@/lib/lp/positions";
import { formatTokenAmount, formatCompactBigInt } from "@/lib/format";
import { TokenLogo } from "@/components/TokenLogo";
import type { TokenInfo } from "@/hooks/useSwapConfig";

function addressToSymbol(
  address: string | unknown,
  tokens: Record<string, { address: string }>
): string {
  const addr = typeof address === "string" ? address : String(address ?? "");
  const lower = addr.toLowerCase();
  for (const [symbol, info] of Object.entries(tokens)) {
    const infoAddr = typeof info.address === "string" ? info.address : String(info.address ?? "");
    if (infoAddr.toLowerCase() === lower) return symbol;
  }
  return addr ? `${addr.slice(0, 6)}…` : "—";
}

function PositionsList({
  positions,
  tokenRegistry,
}: {
  positions: PositionInfo[];
  tokenRegistry: Record<string, TokenInfo>;
}) {
  if (positions.length === 0) {
    return (
      <p className="py-6 text-center text-muted text-sm">
        No positions yet. Add liquidity from a pool above or from{" "}
        <Link href="/earn/add" className="underline hover:no-underline">
          Add liquidity
        </Link>
        .
      </p>
    );
  }
  return (
    <>
      <div className="grid grid-cols-[1fr_auto_auto_1fr_auto] gap-4 items-center py-3 px-4 border-b border-border text-sm text-muted font-medium">
        <span>Pool</span>
        <span>Fee</span>
        <span>Liquidity</span>
        <span>Unclaimed</span>
        <span className="w-24" aria-hidden />
      </div>
      <ul className="divide-y divide-border">
        {positions.map((pos) => {
          const sym0 = addressToSymbol(pos.token0, tokenRegistry);
          const sym1 = addressToSymbol(pos.token1, tokenRegistry);
          const poolLabel = `${sym0} / ${sym1}`;
          const dec0 = tokenRegistry[sym0]?.decimals ?? 18;
          const dec1 = tokenRegistry[sym1]?.decimals ?? 18;
          const feePct = `${(pos.fee / 10000).toFixed(2)}%`;
          const unclaimed0 = formatTokenAmount(pos.tokensOwed0, dec0);
          const unclaimed1 = formatTokenAmount(pos.tokensOwed1, dec1);
          const hasFees = pos.tokensOwed0 > BigInt(0) || pos.tokensOwed1 > BigInt(0);
          const unclaimedLabel = hasFees ? `${unclaimed0} ${sym0}, ${unclaimed1} ${sym1}` : "—";
          return (
            <li
              key={pos.tokenId.toString()}
              className="grid grid-cols-[1fr_auto_auto_1fr_auto] gap-4 items-center py-3 px-4 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex -space-x-1 shrink-0">
                  <TokenLogo symbol={sym0} size={24} className="ring-2 ring-background" />
                  <TokenLogo symbol={sym1} size={24} className="ring-2 ring-background" />
                </div>
                <span className="font-medium truncate">{poolLabel}</span>
              </div>
              <span className="text-muted">{feePct}</span>
              <span className="text-muted">{formatCompactBigInt(pos.liquidity)}</span>
              <span className="text-muted truncate">{unclaimedLabel}</span>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/earn/position/${pos.tokenId}`}
                  className="rounded border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted/50"
                >
                  Manage
                </Link>
                <Link
                  href={`https://app.uniswap.org/explore/pools/ethereum?position=${pos.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted/50"
                >
                  Uniswap
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function MyPositions() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: config } = useSwapConfig();
  const tokenRegistry = config?.tokens ?? {};

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["lp-positions", address],
    queryFn: async () => {
      if (!publicClient || !address) return [];
      return getUserPositions(publicClient, address);
    },
    enabled: Boolean(publicClient && address),
  });

  if (!isConnected) {
    return (
      <div className="mt-8 rounded-lg border border-border bg-background p-6">
        <h2 className="text-lg font-medium">My positions</h2>
        <p className="mt-2 text-sm text-muted">Connect your wallet to see and manage your liquidity positions.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-lg border border-border bg-background overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-lg font-medium">My positions</h2>
        <Link
          href="/earn/add"
          className="rounded border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
        >
          Add liquidity
        </Link>
      </div>
      {isLoading ? (
        <p className="py-6 text-center text-muted text-sm">Loading positions…</p>
      ) : (
        <PositionsList positions={positions} tokenRegistry={tokenRegistry} />
      )}
    </div>
  );
}
