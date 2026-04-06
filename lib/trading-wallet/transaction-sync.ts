/**
 * Transaction Sync Service
 * Caches on-chain transactions from Alchemy to the database for faster page loads.
 * Syncs in the background and serves cached data immediately.
 */

import { getDb } from "@/lib/onboarding/db";
import {
  fetchWalletTransactions,
  type OnChainTransaction,
} from "@/lib/alchemy/transactions";

const SYNC_STALE_MS = 5 * 60 * 1000; // 5 minutes

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
 */
export async function syncWalletTransactions(
  walletId: string,
  walletAddress: string
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
 */
export function triggerBackgroundSync(walletId: string, walletAddress: string): void {
  // Run sync in background - don't await
  syncWalletTransactions(walletId, walletAddress).catch((error) => {
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
