import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import {
  getSyncState,
  syncWalletTransactions,
  isSyncStale,
} from "@/lib/trading-wallet/transaction-sync";

/**
 * GET /api/trading-wallet/sync
 * Check sync status (for polling)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { tradingWallet: true },
    });

    if (!user?.tradingWallet) {
      return NextResponse.json(
        { error: "Trading wallet not found" },
        { status: 404 }
      );
    }

    const syncState = await getSyncState(user.tradingWallet.id);
    const isStale = isSyncStale(syncState?.lastSyncedAt ?? null);

    return NextResponse.json({
      lastSyncedAt: syncState?.lastSyncedAt?.toISOString() ?? null,
      isSyncing: syncState?.isSyncing ?? false,
      needsSync: isStale,
      transactionCount: syncState?.transactionCount ?? 0,
      syncError: syncState?.syncError ?? null,
    });
  } catch (error) {
    console.error("[Sync Status] Error:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trading-wallet/sync
 * Manually trigger sync (after deposit/withdrawal)
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { tradingWallet: true },
    });

    if (!user?.tradingWallet) {
      return NextResponse.json(
        { error: "Trading wallet not found" },
        { status: 404 }
      );
    }

    // Check if already syncing
    const currentState = await getSyncState(user.tradingWallet.id);
    if (currentState?.isSyncing) {
      return NextResponse.json({
        message: "Sync already in progress",
        isSyncing: true,
      });
    }

    // Run sync (this blocks until complete)
    const result = await syncWalletTransactions(
      user.tradingWallet.id,
      user.tradingWallet.address
    );

    if (result.error) {
      return NextResponse.json(
        {
          error: result.error,
          synced: result.synced,
          total: result.total,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Sync completed",
      synced: result.synced,
      total: result.total,
      isSyncing: false,
    });
  } catch (error) {
    console.error("[Sync Trigger] Error:", error);
    return NextResponse.json(
      { error: "Failed to trigger sync" },
      { status: 500 }
    );
  }
}
