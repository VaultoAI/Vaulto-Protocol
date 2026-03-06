/** Subgraph pool day data (desc order: newest first) */
export interface PoolDayDataPoint {
  date: number;
  volumeUSD: string;
  feesUSD: string;
  tvlUSD?: string;
}

/** Subgraph pool hour data (desc order: newest first) */
export interface PoolHourDataPoint {
  periodStartUnix: number;
  volumeUSD: string;
  feesUSD: string;
}

/** Token from subgraph */
export interface SubgraphToken {
  id: string;
  symbol: string;
  decimals: string;
}

/** Raw pool from PoolDetails query */
export interface SubgraphPool {
  id: string;
  totalValueLockedUSD: string | null;
  feeTier?: string | null;
  token0?: SubgraphToken | null;
  token1?: SubgraphToken | null;
  poolDayData: PoolDayDataPoint[];
  poolHourData: PoolHourDataPoint[];
}

/** Derived metrics for table display */
export interface PoolMetrics {
  tvlUSD: number;
  volume24h: number;
  fees30d: number;
  apr: number;
}

/**
 * Rolling 24h volume and fees from poolHourData (guide §6).
 * Fallback: use poolDayData[0] if no hourly data.
 */
export function calculate24hMetrics(
  hourlyData: PoolHourDataPoint[],
  dayData: PoolDayDataPoint[]
): { volume24h: number; fees24h: number } {
  if (hourlyData?.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    const twentyFourHoursAgo = now - 24 * 3600;
    const currentPeriod = hourlyData.filter((h) => h.periodStartUnix >= twentyFourHoursAgo);
    const volume24h = currentPeriod.reduce((s, h) => s + parseFloat(h.volumeUSD || "0"), 0);
    const fees24h = currentPeriod.reduce((s, h) => s + parseFloat(h.feesUSD || "0"), 0);
    return { volume24h, fees24h };
  }
  if (dayData?.length > 0) {
    const d = dayData[0];
    return {
      volume24h: parseFloat(d.volumeUSD || "0"),
      fees24h: parseFloat(d.feesUSD || "0"),
    };
  }
  return { volume24h: 0, fees24h: 0 };
}

/**
 * Derive TVL, 24h volume, 30d fees, and APR from subgraph pool (guide §3.3).
 */
export function derivePoolMetrics(pool: SubgraphPool | null): PoolMetrics {
  if (!pool) {
    return { tvlUSD: 0, volume24h: 0, fees30d: 0, apr: 0 };
  }

  const tvlUSD = parseFloat(pool.totalValueLockedUSD || "0");
  const dayData = pool.poolDayData ?? [];
  const hourData = pool.poolHourData ?? [];

  const { volume24h } = calculate24hMetrics(hourData, dayData);

  const fees30d = dayData.reduce((sum, day) => sum + parseFloat(day.feesUSD || "0"), 0);

  const apr = tvlUSD > 0 ? (fees30d * 12 / tvlUSD) * 100 : 0;

  return { tvlUSD, volume24h, fees30d, apr };
}
