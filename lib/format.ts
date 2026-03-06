/** Compact USD for table (e.g. $1.2M, $450K) */
export function formatUSD(value: number): string {
  if (value === 0) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

/** APR as percentage (e.g. 12.5%) */
export function formatPercent(value: number): string {
  if (value === 0) return "—";
  return `${value.toFixed(2)}%`;
}

/** Token amount from raw (smallest units) to readable string with K/M suffix. */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  if (raw === BigInt(0)) return "0";
  const value = Number(raw) / 10 ** decimals;
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
}

/** Compact display for large bigint (e.g. Uniswap V3 liquidity). */
export function formatCompactBigInt(value: bigint): string {
  if (value === BigInt(0)) return "0";
  const n = Number(value);
  if (!Number.isFinite(n)) return value.toString();
  if (n >= 1e18) return `${(n / 1e18).toFixed(2)}B`;
  if (n >= 1e15) return `${(n / 1e15).toFixed(2)}T`;
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}K`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}`;
  return n.toLocaleString();
}
