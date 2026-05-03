import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import {
  fetchPortfolioHistory,
  triggerPortfolioSnapshot,
} from "@/lib/vaulto-api/trading";
import {
  getVaultoApiToken,
  isVaultoApiConfigured,
} from "@/lib/vaulto-api/config";

interface Transaction {
  id: string;
  type: "deposit" | "withdrawal" | "buy" | "sell";
  amount: number;
  status: string;
  txHash: string | null;
  timestamp: string;
  address: string;
  symbol?: string;
  qty?: number;
  filledQty?: number;
  filledAvgPrice?: number;
}

/**
 * GET /api/trading-wallet/portfolio-history
 *
 * Returns the user's "balance over time" chart data plus their full
 * transaction list for the activity feed.
 *
 * Heavy work — fetching balances, valuing positions, and building snapshot
 * history — lives in vaulto-api at /api/trading/portfolio/history. This
 * route is a thin proxy that joins the vaulto-api response with the local
 * Prisma transaction tables (deposits, withdrawals, ETF orders).
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
      include: {
        tradingWallet: {
          include: {
            deposits: {
              select: {
                id: true,
                amount: true,
                status: true,
                txHash: true,
                fromAddress: true,
                confirmedAt: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
            },
            withdrawals: {
              select: {
                id: true,
                amount: true,
                status: true,
                txHash: true,
                toAddress: true,
                executedAt: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
            },
            etfOrders: {
              select: {
                id: true,
                symbol: true,
                side: true,
                status: true,
                notionalUsd: true,
                qty: true,
                filledQty: true,
                filledAvgPrice: true,
                filledAt: true,
                createdAt: true,
                alpacaOrderId: true,
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!user?.tradingWallet) {
      return NextResponse.json(
        { error: "Trading wallet not found" },
        { status: 404 }
      );
    }

    const tradingWallet = user.tradingWallet;

    // Build the activity feed from local Prisma tables. This list is
    // independent of the chart history — the chart needs precomputed
    // running totals; the feed needs every individual entry.
    const allTransactions: Transaction[] = [];

    for (const deposit of tradingWallet.deposits) {
      allTransactions.push({
        id: deposit.id,
        type: "deposit",
        amount: Number(deposit.amount) / 1e6,
        status: deposit.status,
        txHash: deposit.txHash,
        timestamp: (deposit.confirmedAt ?? deposit.createdAt).toISOString(),
        address: deposit.fromAddress,
      });
    }

    for (const withdrawal of tradingWallet.withdrawals) {
      allTransactions.push({
        id: withdrawal.id,
        type: "withdrawal",
        amount: Number(withdrawal.amount) / 1e6,
        status: withdrawal.status,
        txHash: withdrawal.txHash,
        timestamp: (withdrawal.executedAt ?? withdrawal.createdAt).toISOString(),
        address: withdrawal.toAddress,
      });
    }

    for (const order of tradingWallet.etfOrders) {
      const filledQty = order.filledQty ? Number(order.filledQty) : 0;
      const filledAvgPrice = order.filledAvgPrice
        ? Number(order.filledAvgPrice)
        : null;
      const orderValue =
        filledQty > 0 && filledAvgPrice
          ? filledQty * filledAvgPrice
          : order.notionalUsd
            ? Number(order.notionalUsd)
            : order.qty && filledAvgPrice
              ? Number(order.qty) * filledAvgPrice
              : 0;

      allTransactions.push({
        id: order.id,
        type: order.side === "BUY" ? "buy" : "sell",
        amount: orderValue,
        status: order.status,
        txHash: null,
        timestamp: (order.filledAt ?? order.createdAt).toISOString(),
        address: tradingWallet.address,
        symbol: order.symbol,
        qty: order.qty ? Number(order.qty) : undefined,
        filledQty: filledQty > 0 ? filledQty : undefined,
        filledAvgPrice: filledAvgPrice ?? undefined,
      });
    }

    allTransactions.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Fetch precomputed history from vaulto-api. Falls back to an empty chart
    // if vaulto-api is unreachable so the activity feed still renders.
    let history: Array<{ timestamp: string; balance: number; type: string }> =
      [];
    let lastSnapshotAt: string | null = null;
    let fromCache = false;

    if (isVaultoApiConfigured()) {
      try {
        const apiKey = getVaultoApiToken();
        const result = await fetchPortfolioHistory(apiKey, tradingWallet.id);
        history = result.history;
        lastSnapshotAt = result.lastSnapshotAt;
        fromCache = result.fromCache;

        // If the wallet has no snapshots yet (new user), kick one off so the
        // next request has data. Fire-and-forget.
        if (history.length <= 1 && tradingWallet.status === "ACTIVE") {
          void triggerPortfolioSnapshot(apiKey, tradingWallet.id);
        }
      } catch (err) {
        console.error(
          "[Portfolio History] vaulto-api fetch failed:",
          err
        );
      }
    }

    return NextResponse.json({
      history,
      transactions: allTransactions,
      syncState: {
        lastSyncedAt: lastSnapshotAt,
        balanceSyncedAt: lastSnapshotAt,
        isSyncing: false,
        needsSync: false,
        transactionCount: allTransactions.length,
        fromCache,
      },
    });
  } catch (error) {
    console.error("[Trading Wallet] Portfolio history error:", error);
    return NextResponse.json(
      { error: "Failed to get portfolio history" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trading-wallet/portfolio-history
 *
 * Trigger an immediate portfolio snapshot for the authenticated user's wallet.
 * Used by the client to reconcile the chart's last balance with the live
 * header total when they diverge (e.g. price moves on open positions while
 * the user has the page open).
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
      include: { tradingWallet: { select: { id: true, status: true } } },
    });

    if (!user?.tradingWallet) {
      return NextResponse.json(
        { error: "Trading wallet not found" },
        { status: 404 }
      );
    }

    if (user.tradingWallet.status !== "ACTIVE") {
      return NextResponse.json({ ok: false, skipped: "inactive" });
    }

    if (!isVaultoApiConfigured()) {
      return NextResponse.json({ ok: false, skipped: "not-configured" });
    }

    const apiKey = getVaultoApiToken();
    const result = await triggerPortfolioSnapshot(apiKey, user.tradingWallet.id);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Trading Wallet] Portfolio snapshot error:", error);
    return NextResponse.json(
      { error: "Failed to trigger portfolio snapshot" },
      { status: 500 }
    );
  }
}
