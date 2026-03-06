"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useSwapConfig, type TokenInfo } from "@/hooks/useSwapConfig";
import { getPosition } from "@/lib/lp/positions";
import { formatTokenAmount, formatCompactBigInt } from "@/lib/format";
import { TokenLogo } from "@/components/TokenLogo";

function addressToSymbol(
  address: string | unknown,
  tokens: Record<string, TokenInfo>
): string {
  const addr = typeof address === "string" ? address : String(address ?? "");
  const lower = addr.toLowerCase();
  for (const [symbol, info] of Object.entries(tokens)) {
    const infoAddr = typeof info.address === "string" ? info.address : String(info.address ?? "");
    if (infoAddr.toLowerCase() === lower) return symbol;
  }
  return addr ? `${addr.slice(0, 6)}…` : "—";
}

export default function PositionPage() {
  const params = useParams();
  const tokenId = params?.tokenId as string | undefined;
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: config } = useSwapConfig();

  const { data: position, isLoading } = useQuery({
    queryKey: ["lp-position", tokenId],
    queryFn: async () => {
      if (!publicClient || !tokenId) return null;
      return getPosition(publicClient, BigInt(tokenId));
    },
    enabled: Boolean(publicClient && tokenId),
  });

  const tokenRegistry = config?.tokens ?? {};
  const sym0 = position ? addressToSymbol(position.token0, tokenRegistry) : "";
  const sym1 = position ? addressToSymbol(position.token1, tokenRegistry) : "";
  const dec0 = sym0 ? (tokenRegistry[sym0]?.decimals ?? 18) : 18;
  const dec1 = sym1 ? (tokenRegistry[sym1]?.decimals ?? 18) : 18;

  if (!tokenId) {
    return (
      <div className="max-w-lg">
        <p className="text-muted">Invalid position.</p>
        <Link href="/earn" className="mt-4 inline-block text-sm underline">
          Back to Earn
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-medium tracking-tight">Position #{tokenId}</h1>
      <div className="mt-4">
        <Link href="/earn" className="text-sm text-muted hover:underline">
          ← Back to Earn
        </Link>
      </div>

      {!isConnected && (
        <p className="mt-6 text-muted">Connect your wallet to view this position.</p>
      )}

      {isConnected && isLoading && <p className="mt-6 text-muted">Loading…</p>}

      {isConnected && !isLoading && position && (
        <div className="mt-8 space-y-4 rounded-lg border border-border bg-background p-6">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1 shrink-0">
              <TokenLogo symbol={sym0} size={24} className="ring-2 ring-background" />
              <TokenLogo symbol={sym1} size={24} className="ring-2 ring-background" />
            </div>
            <p className="font-medium">
              {sym0} / {sym1}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Fee</dt>
            <dd>{(position.fee / 10000).toFixed(2)}%</dd>
            <dt className="text-muted">Liquidity</dt>
            <dd>{formatCompactBigInt(position.liquidity)}</dd>
            <dt className="text-muted">Tick range</dt>
            <dd>
              {position.tickLower} — {position.tickUpper}
            </dd>
            <dt className="text-muted">Fees owed ({sym0})</dt>
            <dd>
              {formatTokenAmount(position.tokensOwed0, dec0)} {sym0}
            </dd>
            <dt className="text-muted">Fees owed ({sym1})</dt>
            <dd>
              {formatTokenAmount(position.tokensOwed1, dec1)} {sym1}
            </dd>
          </dl>
          <div className="pt-4">
            <a
              href={`https://app.uniswap.org/explore/pools/ethereum?position=${tokenId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-border bg-background px-4 py-2 text-sm hover:bg-muted/50"
            >
              Manage on Uniswap
            </a>
          </div>
        </div>
      )}

      {isConnected && !isLoading && !position && (
        <p className="mt-6 text-muted">Position not found or not owned by you.</p>
      )}
    </div>
  );
}
