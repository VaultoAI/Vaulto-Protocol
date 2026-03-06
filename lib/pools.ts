import { readFileSync } from "fs";
import path from "path";
import { getTokenDisplayName } from "@/lib/utils/tokenLogo";
import { derivePoolMetrics, type SubgraphPool } from "./pools/metrics";

export type Pool = { pool: string; address: string };

/** Pool row with metrics for the earn table */
export type PoolWithMetrics = Pool & {
  tvlUSD: number;
  volume24h: number;
  apr: number;
};

const SUBGRAPH_URL =
  "https://gateway.thegraph.com/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV";

const POOL_DETAILS_QUERY = `
  query PoolDetails($poolId: ID!) {
    pool(id: $poolId) {
      id
      totalValueLockedUSD
      feeTier
      token0 {
        id
        symbol
        decimals
      }
      token1 {
        id
        symbol
        decimals
      }
      poolDayData(orderBy: date, orderDirection: desc, first: 30) {
        date
        volumeUSD
        feesUSD
        tvlUSD
      }
      poolHourData(orderBy: periodStartUnix, orderDirection: desc, first: 49) {
        periodStartUnix
        volumeUSD
        feesUSD
      }
    }
  }
`;

/** Fetch multiple pools with token and fee info in one request (for token registry). */
const POOLS_BY_IDS_QUERY = `
  query PoolsByIds($poolIds: [ID!]!) {
    pools(where: { id_in: $poolIds }) {
      id
      feeTier
      token0 {
        id
        symbol
        decimals
      }
      token1 {
        id
        symbol
        decimals
      }
    }
  }
`;

export { formatUSD, formatPercent, formatTokenAmount, formatCompactBigInt } from "./format";

const csvPath = path.join(process.cwd(), "Pool-Address.csv");

function parsePoolCsv(): Pool[] {
  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.trim().split("\n");
  if (lines.length < 2) return [];
  const rows = lines.slice(1);
  return rows.map((line) => {
    const match = line.match(/^"([^"]+)","([^"]+)"$/);
    if (match) return { pool: match[1], address: match[2] };
    const parts = line.split(",");
    return { pool: parts[0]?.replace(/^"|"$/g, "") ?? "", address: parts[1]?.replace(/^"|"$/g, "") ?? "" };
  });
}

let cached: Pool[] | null = null;

export function getPools(): Pool[] {
  if (cached === null) cached = parsePoolCsv();
  return cached;
}

/** Symbols for borrow/lend page (tokenized stocks with pools). */
const BORROW_LEND_SYMBOLS = ["SPYon", "TSLAon", "QQQon"] as const;

/** Pools that contain SPYon, TSLAon, or QQQon for the Borrow & Lend page. */
export function getBorrowLendPools(): Pool[] {
  return getPools().filter((p) =>
    BORROW_LEND_SYMBOLS.some((s) => p.pool.includes(s))
  );
}

export function getTokenList(): string[] {
  const pools = getPools();
  const tokens = new Set<string>();
  for (const { pool } of pools) {
    const parts = pool.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
    parts.forEach((t) => tokens.add(t));
  }
  return Array.from(tokens).sort();
}

export type TokenWithName = { symbol: string; name: string };

export function getTokensWithDisplayNames(): TokenWithName[] {
  const symbols = getTokenList();
  return symbols.map((symbol) => ({
    symbol,
    name: getTokenDisplayName(symbol),
  }));
}

/** Pool with token and fee info (from subgraph, for swap/LP). */
export interface PoolWithTokens {
  id: string;
  feeTier: string;
  token0: { id: string; symbol: string; decimals: string };
  token1: { id: string; symbol: string; decimals: string };
}

/** Fetch pool details from subgraph (server-side). */
async function fetchPoolDetails(poolId: string): Promise<SubgraphPool | null> {
  const apiKey =
    process.env.NEXT_PUBLIC_THE_GRAPH_API_KEY ?? process.env.THE_GRAPH_API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: POOL_DETAILS_QUERY,
      variables: { poolId: poolId.toLowerCase() },
    }),
  });

  const json = await res.json();
  const pool = json?.data?.pool ?? null;
  return pool;
}

/** Fetch multiple pools with token and fee info (server-side). */
export async function fetchPoolsWithTokens(
  poolIds: string[]
): Promise<PoolWithTokens[]> {
  if (poolIds.length === 0) return [];
  const apiKey =
    process.env.NEXT_PUBLIC_THE_GRAPH_API_KEY ?? process.env.THE_GRAPH_API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: POOLS_BY_IDS_QUERY,
      variables: { poolIds: poolIds.map((id) => id.toLowerCase()) },
    }),
  });

  const json = await res.json();
  const pools = json?.data?.pools ?? [];
  return pools;
}

/** Pools from CSV with TVL, 24h volume, and APR from Uniswap V3 subgraph. */
export async function getPoolsWithMetrics(): Promise<PoolWithMetrics[]> {
  const pools = getPools();

  const results = await Promise.all(
    pools.map(async ({ pool, address }) => {
      const raw = await fetchPoolDetails(address);
      const metrics = derivePoolMetrics(raw);
      return {
        pool,
        address,
        tvlUSD: metrics.tvlUSD,
        volume24h: metrics.volume24h,
        apr: metrics.apr,
      };
    })
  );

  return results;
}
