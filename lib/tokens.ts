import { getPools } from "@/lib/pools";
import type { PoolWithTokens } from "@/lib/pools";

export type TokenInfo = { address: string; decimals: number };

/** Key for pool-by-pair map: sorted symbols joined. */
export function pairKey(symbolA: string, symbolB: string): string {
  const a = symbolA.trim();
  const b = symbolB.trim();
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * Build symbol → { address, decimals } from subgraph pool token data.
 * Uses token0 and token1 from each pool; later pools overwrite same symbol.
 */
export function buildTokenRegistryFromPools(
  pools: PoolWithTokens[]
): Record<string, TokenInfo> {
  const registry: Record<string, TokenInfo> = {};
  for (const pool of pools) {
    if (pool.token0?.id && pool.token0?.symbol != null) {
      registry[pool.token0.symbol] = {
        address: pool.token0.id,
        decimals: parseInt(pool.token0.decimals, 10) || 18,
      };
    }
    if (pool.token1?.id && pool.token1?.symbol != null) {
      registry[pool.token1.symbol] = {
        address: pool.token1.id,
        decimals: parseInt(pool.token1.decimals, 10) || 18,
      };
    }
  }
  return registry;
}

export type PoolForPair = { poolAddress: string; feeTier: number };

/**
 * Build pair key → { poolAddress, feeTier } from CSV pool list and subgraph pool data.
 * Matches by pool address; fee tier is in basis points (e.g. 3000 = 0.3%).
 */
export function buildPoolForPairMap(
  csvPools: { pool: string; address: string }[],
  poolsWithTokens: PoolWithTokens[]
): Record<string, PoolForPair> {
  const byAddress = new Map(
    poolsWithTokens.map((p) => [p.id.toLowerCase(), p])
  );
  const result: Record<string, PoolForPair> = {};
  const feeBps = (fee: string) => parseInt(fee, 10) || 3000;

  for (const { pool, address } of csvPools) {
    const tokens = pool.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
    if (tokens.length >= 2) {
      const key = pairKey(tokens[0], tokens[1]);
      const pt = byAddress.get(address.toLowerCase());
      if (pt) {
        result[key] = {
          poolAddress: address,
          feeTier: feeBps(pt.feeTier),
        };
      }
    }
  }
  return result;
}

/** Get token info by symbol from a pre-built registry. */
export function getTokenBySymbol(
  registry: Record<string, TokenInfo>,
  symbol: string
): TokenInfo | null {
  return registry[symbol] ?? null;
}

/** Get token address by symbol. */
export function getTokenAddress(
  registry: Record<string, TokenInfo>,
  symbol: string
): string | null {
  return registry[symbol]?.address ?? null;
}

/** Get pool address and fee tier for a token pair (symbols). */
export function getPoolForPair(
  poolForPairMap: Record<string, PoolForPair>,
  symbolA: string,
  symbolB: string
): PoolForPair | null {
  return poolForPairMap[pairKey(symbolA, symbolB)] ?? null;
}
