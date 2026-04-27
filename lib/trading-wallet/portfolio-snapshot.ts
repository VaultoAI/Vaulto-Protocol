/**
 * Portfolio Snapshot Service
 * Creates point-in-time snapshots of total portfolio value for historical tracking.
 * Triggered after trades and on periodic basis.
 */

import { createPublicClient, http, formatUnits } from "viem";
import { polygon } from "viem/chains";
import { getDb } from "@/lib/onboarding/db";
import { getUsdcBalance, formatUsdcAmount } from "@/lib/trading-wallet/execute-withdrawal";
import { USDC_ADDRESSES, USDC_DECIMALS, ERC20_ABI } from "@/lib/trading-wallet/constants";
import { fetchPositions, type PredictionPosition } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";

// Create a public client for Polygon
const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon.drpc.org"),
});

/**
 * Get USDC.e (bridged) balance for an address
 */
async function getUsdcBridgedBalance(address: `0x${string}`): Promise<bigint> {
  try {
    const balance = await polygonClient.readContract({
      address: USDC_ADDRESSES.POLYGON_BRIDGED as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });
    return balance as bigint;
  } catch (error) {
    console.error("[Portfolio Snapshot] Failed to get USDC.e balance:", error);
    return BigInt(0);
  }
}

/**
 * Fetch positions from Vaulto API
 */
async function fetchPositionsData(userId: string): Promise<{
  positions: PredictionPosition[];
  totalValue: number;
} | null> {
  if (!isVaultoApiConfigured()) {
    return null;
  }

  try {
    const apiKey = getVaultoApiToken();
    const result = await fetchPositions(apiKey, userId);
    return {
      positions: result.positions,
      totalValue: result.totals.totalValue,
    };
  } catch (error) {
    console.error("[Portfolio Snapshot] Failed to fetch positions:", error);
    return null;
  }
}

export interface SnapshotResult {
  success: boolean;
  snapshotId?: string;
  totalValue?: number;
  error?: string;
}

/**
 * Create a portfolio snapshot for a trading wallet.
 * Captures EOA USDC, Safe USDC.e, and positions value at a point in time.
 */
export async function createPortfolioSnapshot(
  walletId: string,
  walletAddress: string,
  safeAddress: string | null,
  chainId: number = 137
): Promise<SnapshotResult> {
  const db = getDb();

  try {
    // 1. Fetch EOA USDC balance (native)
    const eoaBalanceBigInt = await getUsdcBalance(
      walletAddress as `0x${string}`,
      chainId
    );
    const eoaBalance = parseFloat(formatUsdcAmount(eoaBalanceBigInt));

    // 2. Fetch Safe USDC.e balance (if safeAddress exists)
    let safeBalance = 0;
    if (safeAddress) {
      const safeBalanceBigInt = await getUsdcBridgedBalance(safeAddress as `0x${string}`);
      safeBalance = parseFloat(formatUnits(safeBalanceBigInt, USDC_DECIMALS));
    }

    // 3. Fetch positions from Vaulto API
    let positionsValue = 0;
    let positionsSnapshot: PredictionPosition[] | null = null;
    const positionsData = await fetchPositionsData(walletAddress);
    if (positionsData) {
      positionsValue = positionsData.totalValue;
      positionsSnapshot = positionsData.positions;
    }

    // 4. Calculate total
    const totalValue = eoaBalance + safeBalance + positionsValue;

    // 5. Create snapshot record
    const snapshot = await db.portfolioSnapshot.create({
      data: {
        tradingWalletId: walletId,
        eoaUsdcBalance: eoaBalance,
        safeUsdceBalance: safeBalance,
        positionsValue: positionsValue,
        totalValue: totalValue,
        positionsSnapshot: positionsSnapshot ? JSON.parse(JSON.stringify(positionsSnapshot)) : null,
      },
    });

    console.log("[Portfolio Snapshot] Created snapshot:", {
      snapshotId: snapshot.id,
      walletId,
      eoaBalance,
      safeBalance,
      positionsValue,
      totalValue,
    });

    return {
      success: true,
      snapshotId: snapshot.id,
      totalValue,
    };
  } catch (error) {
    console.error("[Portfolio Snapshot] Failed to create snapshot:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Trigger a background portfolio snapshot (fire-and-forget).
 */
export function triggerBackgroundSnapshot(
  walletId: string,
  walletAddress: string,
  safeAddress: string | null,
  chainId: number = 137
): void {
  createPortfolioSnapshot(walletId, walletAddress, safeAddress, chainId).catch((error) => {
    console.error(`[Portfolio Snapshot] Background snapshot failed for ${walletId}:`, error);
  });
}

/**
 * Get recent snapshots for a wallet (for chart history).
 */
export async function getPortfolioSnapshots(
  walletId: string,
  limit: number = 100
): Promise<Array<{
  timestamp: Date;
  totalValue: number;
  eoaUsdcBalance: number;
  safeUsdceBalance: number;
  positionsValue: number;
}>> {
  const db = getDb();

  const snapshots = await db.portfolioSnapshot.findMany({
    where: { tradingWalletId: walletId },
    orderBy: { timestamp: "asc" },
    take: limit,
    select: {
      timestamp: true,
      totalValue: true,
      eoaUsdcBalance: true,
      safeUsdceBalance: true,
      positionsValue: true,
    },
  });

  return snapshots.map((s) => ({
    timestamp: s.timestamp,
    totalValue: Number(s.totalValue),
    eoaUsdcBalance: Number(s.eoaUsdcBalance),
    safeUsdceBalance: Number(s.safeUsdceBalance),
    positionsValue: Number(s.positionsValue),
  }));
}
