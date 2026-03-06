import { unstable_cache } from "next/cache";

export const EULER_MAINNET_SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-mainnet/latest/gn";

/** Single vault row for UI / lookup */
export type EulerVaultRow = {
  evault: string;
  asset: string;
  symbol: string;
  supplyApy: number;
  borrowApy: number;
  /** Total supplied assets (raw amount; use decimals for display) */
  totalSupply: string;
  /** Total borrowed assets (raw amount; use decimals for display) */
  totalBorrows: string;
  decimals: number;
};

/** Raw state from subgraph (APY may be string or number; ray 1e27 or decimal) */
interface EulerVaultState {
  supplyApy?: string | number | null;
  borrowApy?: string | number | null;
  totalAssets?: string | null;
  totalShares?: string | null;
  totalBorrows?: string | null;
}

interface EulerVaultEntity {
  id?: string;
  evault: string;
  asset: string;
  symbol: string;
  decimals?: number | null;
  state?: EulerVaultState | null;
}

interface EulerVaultsResponse {
  data?: { eulerVaults?: EulerVaultEntity[] };
  errors?: unknown[];
}

const EULER_VAULTS_QUERY = `
  query EulerVaults {
    eulerVaults {
      id
      evault
      asset
      symbol
      decimals
      state {
        supplyApy
        borrowApy
        totalAssets
        totalShares
        totalBorrows
      }
    }
  }
`;

/** Format raw total supply (wei/smallest unit) to readable string with optional compact suffix. */
export function formatTotalSupply(raw: string, decimals: number): string {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n === 0) return "—";
  const value = n / 10 ** decimals;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

/** Normalize APY from subgraph (may be ray 1e27 or decimal) to percent number (e.g. 5.25). */
function normalizeApy(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") return 0;
  const n = typeof raw === "string" ? parseFloat(raw) : raw;
  if (!Number.isFinite(n)) return 0;
  if (n > 1e20) return n / 1e25;
  return n;
}

async function fetchEulerVaultsUncached(): Promise<EulerVaultRow[]> {
  try {
    const res = await fetch(EULER_MAINNET_SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: EULER_VAULTS_QUERY }),
      next: { revalidate: 60 },
    });
    const json = (await res.json()) as EulerVaultsResponse;
    const list = json?.data?.eulerVaults ?? [];
    if (json?.errors?.length) return [];
    return list
      .filter((v) => v?.evault && v?.asset)
      .map((v) => {
        const totalAssets = v.state?.totalAssets ?? v.state?.totalShares ?? "0";
        const decimals = typeof v.decimals === "number" ? v.decimals : 18;
        const totalBorrows = v.state?.totalBorrows ?? "0";
        return {
          evault: v.evault,
          asset: (v.asset ?? "").toLowerCase(),
          symbol: v.symbol ?? "",
          supplyApy: normalizeApy(v.state?.supplyApy),
          borrowApy: normalizeApy(v.state?.borrowApy),
          totalSupply: String(totalAssets),
          totalBorrows: String(totalBorrows),
          decimals,
        };
      });
  } catch {
    return [];
  }
}

/** Cached for 60s to limit subgraph rate and improve latency. */
export async function getEulerVaults(): Promise<EulerVaultRow[]> {
  return unstable_cache(
    fetchEulerVaultsUncached,
    ["euler-vaults"],
    { revalidate: 60 }
  )();
}

/** Euler vault (evault) addresses for Borrow & Lend assets. Look up metrics by these. */
export const EULER_VAULT_ADDRESSES: Record<string, string> = {
  SPYon: "0x5344b18BdCEE6A2DcC5f0627b5f06751dB2e5A8e",
  TSLAon: "0xAD31be884B0A20237077820318a74a02A449095C",
  QQQon: "0x4Fab48EDdA433E240F1c2A2E85Ee5cF38d4A6180",
};

/**
 * Return a map of evault address (lowercase) -> vault row for the given vault addresses.
 * Use EULER_VAULT_ADDRESSES[symbol] for SPYon, TSLAon, QQQon to get true per-vault metrics.
 */
export async function getEulerLendingByEvaults(
  evaultAddresses: string[]
): Promise<Map<string, EulerVaultRow>> {
  const vaults = await getEulerVaults();
  const set = new Set(evaultAddresses.map((a) => a.toLowerCase()));
  const map = new Map<string, EulerVaultRow>();
  for (const v of vaults) {
    const key = (v.evault ?? "").toLowerCase();
    if (set.has(key)) map.set(key, v);
  }
  return map;
}

/**
 * Return a map of asset address (lowercase) -> vault row for the given asset addresses.
 * Prefer getEulerLendingByEvaults with EULER_VAULT_ADDRESSES for SPYon/TSLAon/QQQon.
 */
export async function getEulerLendingByAssets(
  assetAddresses: string[]
): Promise<Map<string, EulerVaultRow>> {
  const vaults = await getEulerVaults();
  const set = new Set(assetAddresses.map((a) => a.toLowerCase()));
  const map = new Map<string, EulerVaultRow>();
  for (const v of vaults) {
    if (set.has(v.asset)) map.set(v.asset, v);
  }
  return map;
}

/** Protocol-level aggregates: vault count and totals per symbol (human-readable units). */
export type EulerProtocolMetrics = {
  vaultCount: number;
  totalSupplyBySymbol: Record<string, number>;
  totalBorrowsBySymbol: Record<string, number>;
};

async function computeEulerProtocolMetricsUncached(): Promise<EulerProtocolMetrics> {
  const vaults = await getEulerVaults();
  const totalSupplyBySymbol: Record<string, number> = {};
  const totalBorrowsBySymbol: Record<string, number> = {};
  for (const v of vaults) {
    const supply = parseFloat(v.totalSupply) / 10 ** v.decimals;
    const borrows = parseFloat(v.totalBorrows) / 10 ** v.decimals;
    const sym = v.symbol || "UNKNOWN";
    totalSupplyBySymbol[sym] = (totalSupplyBySymbol[sym] ?? 0) + supply;
    totalBorrowsBySymbol[sym] = (totalBorrowsBySymbol[sym] ?? 0) + borrows;
  }
  return {
    vaultCount: vaults.length,
    totalSupplyBySymbol,
    totalBorrowsBySymbol,
  };
}

/** Cached protocol-level metrics (60s). Aggregates vault totals by symbol. */
export async function getEulerProtocolMetrics(): Promise<EulerProtocolMetrics> {
  return unstable_cache(
    computeEulerProtocolMetricsUncached,
    ["euler-protocol-metrics"],
    { revalidate: 60 }
  )();
}
