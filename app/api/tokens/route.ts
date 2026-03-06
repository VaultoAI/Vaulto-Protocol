import { NextResponse } from "next/server";
import { getPools, fetchPoolsWithTokens } from "@/lib/pools";
import {
  buildTokenRegistryFromPools,
  buildPoolForPairMap,
  pairKey,
} from "@/lib/tokens";
import { getDemoTokens } from "@/lib/vaulto/companies";

/** GET /api/tokens - returns token registry, pool-for-pair map, pool list, and demo tokens for swap/LP. */
export async function GET() {
  try {
    const pools = getPools();
    const poolIds = pools.map((p) => p.address);
    const [poolsWithTokens, demoTokens] = await Promise.all([
      fetchPoolsWithTokens(poolIds),
      getDemoTokens(),
    ]);

    const tokens = buildTokenRegistryFromPools(poolsWithTokens);
    const poolsForPair = buildPoolForPairMap(pools, poolsWithTokens);

    const poolList = pools.map((p) => {
      const tokensInPool = p.pool.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
      const key = tokensInPool.length >= 2 ? pairKey(tokensInPool[0], tokensInPool[1]) : "";
      const info = poolsForPair[key];
      return {
        pool: p.pool,
        address: p.address,
        feeTier: info?.feeTier ?? 3000,
      };
    });

    return NextResponse.json(
      { tokens, poolsForPair, poolList, demoTokens },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load tokens" },
      { status: 500 }
    );
  }
}
