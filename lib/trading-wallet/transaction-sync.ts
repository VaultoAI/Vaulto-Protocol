/**
 * Transaction Sync Service
 * Caches on-chain transactions from Alchemy to the database for faster page loads.
 * Syncs in the background and serves cached data immediately.
 */

import { createPublicClient, http, formatUnits } from "viem";
import { polygon } from "viem/chains";
import { getDb } from "@/lib/onboarding/db";
import {
  fetchWalletTransactions,
  filterUsdcTransactions,
  type OnChainTransaction,
} from "@/lib/alchemy/transactions";
import { getUsdcBalance, formatUsdcAmount } from "@/lib/trading-wallet/execute-withdrawal";
import { PUSD_ADDRESS, USDC_DECIMALS, ERC20_ABI } from "@/lib/trading-wallet/constants";
import { fetchPositions } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";

// Create a public client for Polygon
const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon.drpc.org"),
});

/**
 * Get pUSD balance for an address (Polymarket V2 collateral, 1:1 with USD).
 */
async function getPusdBalance(address: `0x${string}`): Promise<bigint> {
  try {
    const balance = await polygonClient.readContract({
      address: PUSD_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });
    return balance as bigint;
  } catch (error) {
    console.error("[Transaction Sync] Failed to get pUSD balance:", error);
    return BigInt(0);
  }
}

/**
 * Fetch position totals from Vaulto API
 * Returns null if API is not configured or fails
 */
async function fetchPositionTotals(userId: string): Promise<{ totalValue: number } | null> {
  if (!isVaultoApiConfigured()) {
    return null;
  }

  try {
    const apiKey = getVaultoApiToken();
    const result = await fetchPositions(apiKey, userId);
    return { totalValue: result.totals.totalValue };
  } catch (error) {
    console.error("[Transaction Sync] Failed to fetch positions:", error);
    return null;
  }
}

const SYNC_STALE_MS = 5 * 60 * 1000; // 5 minutes
const BALANCE_STALE_MS = 60 * 1000; // 1 minute for balance cache

interface HistoryPoint {
  timestamp: string;
  balance: number;
  type: "deposit" | "withdrawal" | "initial" | "current";
}

interface CachedPortfolioData {
  history: HistoryPoint[];
  balance: number;
}

/**
 * Check if sync is stale and needs refresh
 */
export function isSyncStale(lastSyncedAt: Date | null, maxAgeMs = SYNC_STALE_MS): boolean {
  if (!lastSyncedAt) return true;
  return Date.now() - lastSyncedAt.getTime() > maxAgeMs;
}

/**
 * Sync wallet transactions from Alchemy to the database.
 * Returns the number of new transactions synced.
 * Optionally syncs portfolio history if wallet details are provided.
 */
export async function syncWalletTransactions(
  walletId: string,
  walletAddress: string,
  options?: {
    walletCreatedAt?: Date;
    chainId?: number;
    syncPortfolio?: boolean;
  }
): Promise<{ synced: number; total: number; error?: string }> {
  const db = getDb();

  try {
    // Mark as syncing
    await db.walletSyncState.upsert({
      where: { tradingWalletId: walletId },
      create: {
        tradingWalletId: walletId,
        isSyncing: true,
        syncError: null,
      },
      update: {
        isSyncing: true,
        syncError: null,
      },
    });

    // Fetch from Alchemy
    const alchemyTxs = await fetchWalletTransactions(walletAddress);

    // Upsert each transaction to cache
    let syncedCount = 0;
    for (const tx of alchemyTxs) {
      if (tx.amount === null || tx.amount <= 0) continue;

      try {
        await db.cachedTransaction.upsert({
          where: {
            tradingWalletId_txHash_type: {
              tradingWalletId: walletId,
              txHash: tx.txHash,
              type: tx.type,
            },
          },
          create: {
            tradingWalletId: walletId,
            txHash: tx.txHash,
            type: tx.type,
            asset: tx.asset ?? "UNKNOWN",
            amount: Math.round(tx.amount * 1e6).toString(), // Store as raw amount (6 decimals for USDC)
            amountFormatted: tx.amount,
            fromAddress: tx.from,
            toAddress: tx.to ?? "",
            counterpartyAddress: tx.address,
            blockTimestamp: new Date(tx.timestamp),
            chainId: 137,
          },
          update: {
            // Update in case data changed (shouldn't happen for confirmed txs)
            asset: tx.asset ?? "UNKNOWN",
            amountFormatted: tx.amount,
            syncedAt: new Date(),
          },
        });
        syncedCount++;
      } catch (upsertError) {
        // Log but continue - individual tx failures shouldn't stop the sync
        console.warn(`[Transaction Sync] Failed to upsert tx ${tx.txHash}:`, upsertError);
      }
    }

    // Get total cached count
    const totalCount = await db.cachedTransaction.count({
      where: { tradingWalletId: walletId },
    });

    // Update sync state
    await db.walletSyncState.update({
      where: { tradingWalletId: walletId },
      data: {
        lastSyncedAt: new Date(),
        isSyncing: false,
        syncError: null,
        transactionCount: totalCount,
      },
    });

    console.log(
      `[Transaction Sync] Synced ${syncedCount} transactions for wallet ${walletId}, total cached: ${totalCount}`
    );

    // Sync portfolio history if wallet details provided
    if (options?.syncPortfolio && options?.walletCreatedAt) {
      await syncPortfolioHistory(
        walletId,
        walletAddress,
        options.walletCreatedAt,
        options.chainId ?? 137
      );
    }

    return { synced: syncedCount, total: totalCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Transaction Sync] Failed for wallet ${walletId}:`, error);

    // Update sync state with error
    try {
      await db.walletSyncState.upsert({
        where: { tradingWalletId: walletId },
        create: {
          tradingWalletId: walletId,
          isSyncing: false,
          syncError: errorMessage,
        },
        update: {
          isSyncing: false,
          syncError: errorMessage,
        },
      });
    } catch (updateError) {
      console.error("[Transaction Sync] Failed to update error state:", updateError);
    }

    return { synced: 0, total: 0, error: errorMessage };
  }
}

/**
 * Trigger background sync without waiting for completion.
 * Fire-and-forget async sync.
 * If wallet details are provided, also syncs portfolio history.
 */
export function triggerBackgroundSync(
  walletId: string,
  walletAddress: string,
  options?: {
    walletCreatedAt?: Date;
    chainId?: number;
    syncPortfolio?: boolean;
  }
): void {
  // Run sync in background - don't await
  syncWalletTransactions(walletId, walletAddress, options).catch((error) => {
    console.error(`[Transaction Sync] Background sync failed for ${walletId}:`, error);
  });
}

/**
 * Get cached transactions from the database.
 * Returns empty array if no cache exists.
 */
export async function getCachedTransactions(walletId: string): Promise<OnChainTransaction[]> {
  const db = getDb();

  const cached = await db.cachedTransaction.findMany({
    where: { tradingWalletId: walletId },
    orderBy: { blockTimestamp: "desc" },
  });

  return cached.map((tx) => ({
    id: `${tx.txHash}-${tx.type}`,
    txHash: tx.txHash,
    type: tx.type as "deposit" | "withdrawal",
    asset: tx.asset,
    amount: tx.amountFormatted,
    from: tx.fromAddress,
    to: tx.toAddress,
    timestamp: tx.blockTimestamp.toISOString(),
    status: "COMPLETED" as const,
    address: tx.counterpartyAddress,
  }));
}

/**
 * Get sync state for a wallet.
 */
export async function getSyncState(walletId: string) {
  const db = getDb();

  return db.walletSyncState.findUnique({
    where: { tradingWalletId: walletId },
  });
}

/**
 * Check if balance cache is stale and needs refresh
 */
export function isBalanceStale(balanceSyncedAt: Date | null, maxAgeMs = BALANCE_STALE_MS): boolean {
  if (!balanceSyncedAt) return true;
  return Date.now() - balanceSyncedAt.getTime() > maxAgeMs;
}

/**
 * Get cached portfolio history if available and fresh.
 * Returns null if no cache exists.
 */
export async function getCachedPortfolioHistory(walletId: string): Promise<CachedPortfolioData | null> {
  const db = getDb();

  const syncState = await db.walletSyncState.findUnique({
    where: { tradingWalletId: walletId },
  });

  if (!syncState?.cachedHistory || syncState.cachedBalance === null) {
    return null;
  }

  return {
    history: syncState.cachedHistory as unknown as HistoryPoint[],
    balance: syncState.cachedBalance,
  };
}

/**
 * Compute and cache portfolio history from transactions.
 * Also fetches and caches current total balance (EOA + Safe + Positions).
 */
export async function syncPortfolioHistory(
  walletId: string,
  walletAddress: string,
  walletCreatedAt: Date,
  chainId: number = 137,
  safeAddress?: string | null
): Promise<CachedPortfolioData | null> {
  const db = getDb();

  try {
    // Get cached transactions
    const cachedTransactions = await getCachedTransactions(walletId);

    // Build history array
    const history: HistoryPoint[] = [];
    let runningBalance = 0;

    // Add initial point at wallet creation
    history.push({
      timestamp: walletCreatedAt.toISOString(),
      balance: 0,
      type: "initial",
    });

    if (cachedTransactions.length > 0) {
      // Filter to USDC transactions only for balance chart
      const usdcTxs = filterUsdcTransactions(cachedTransactions);

      // Sort by timestamp ascending for chart
      const sortedTxs = [...usdcTxs].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Build running balance from cached data
      for (const tx of sortedTxs) {
        if (tx.amount !== null && tx.amount > 0) {
          if (tx.type === "deposit") {
            runningBalance += tx.amount;
          } else {
            runningBalance -= tx.amount;
          }
          runningBalance = Math.max(0, runningBalance);

          history.push({
            timestamp: tx.timestamp,
            balance: runningBalance,
            type: tx.type,
          });
        }
      }
    }

    // Fetch current balances for total calculation
    // 1. EOA USDC native
    const eoaBalanceBigInt = await getUsdcBalance(
      walletAddress as `0x${string}`,
      chainId
    );
    const eoaBalance = parseFloat(formatUsdcAmount(eoaBalanceBigInt));

    // 2. Safe pUSD balance (1:1 with USD)
    let safeBalance = 0;
    if (safeAddress) {
      const safeBalanceBigInt = await getPusdBalance(safeAddress as `0x${string}`);
      safeBalance = parseFloat(formatUnits(safeBalanceBigInt, USDC_DECIMALS));
    }

    // 3. Positions value from Vaulto API
    let positionsValue = 0;
    const positionTotals = await fetchPositionTotals(walletAddress);
    if (positionTotals) {
      positionsValue = positionTotals.totalValue;
    }

    // Total = EOA USDC + Safe pUSD + Positions market value
    const currentBalance = eoaBalance + safeBalance + positionsValue;

    console.log("[Portfolio Sync] Balance breakdown:", {
      eoaBalance,
      safeBalance,
      positionsValue,
      total: currentBalance,
    });

    // Add current balance as final point
    history.push({
      timestamp: new Date().toISOString(),
      balance: currentBalance,
      type: "current",
    });

    // Cache the computed data (cache EOA balance for stale check compatibility)
    await db.walletSyncState.upsert({
      where: { tradingWalletId: walletId },
      create: {
        tradingWalletId: walletId,
        cachedHistory: history as unknown as object,
        cachedBalance: eoaBalance, // Cache EOA balance for backwards compatibility
        balanceSyncedAt: new Date(),
      },
      update: {
        cachedHistory: history as unknown as object,
        cachedBalance: eoaBalance, // Cache EOA balance for backwards compatibility
        balanceSyncedAt: new Date(),
      },
    });

    console.log(
      `[Portfolio Sync] Cached history with ${history.length} points, total balance: ${currentBalance} for wallet ${walletId}`
    );

    return { history, balance: currentBalance };
  } catch (error) {
    console.error(`[Portfolio Sync] Failed to sync portfolio for wallet ${walletId}:`, error);
    return null;
  }
}

/**
 * Trigger background portfolio history sync without waiting.
 * Fire-and-forget async sync.
 */
export function triggerBackgroundPortfolioSync(
  walletId: string,
  walletAddress: string,
  walletCreatedAt: Date,
  chainId: number = 137,
  safeAddress?: string | null
): void {
  syncPortfolioHistory(walletId, walletAddress, walletCreatedAt, chainId, safeAddress).catch((error) => {
    console.error(`[Portfolio Sync] Background sync failed for ${walletId}:`, error);
  });
}
