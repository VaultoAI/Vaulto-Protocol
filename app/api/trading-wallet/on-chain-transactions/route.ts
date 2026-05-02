import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import {
  getCachedTransactions,
  getSyncState,
  syncWalletTransactions,
  triggerBackgroundSync,
  isSyncStale,
} from "@/lib/trading-wallet/transaction-sync";

interface Transaction {
  id: string;
  type: "deposit" | "withdrawal" | "buy" | "sell" | "buy_long" | "buy_short" | "sell_long" | "sell_short";
  amount: number;
  status: string;
  txHash: string | null;
  timestamp: string;
  address: string;
  asset?: string;
  // ETF order fields
  symbol?: string;
  qty?: number;
  filledQty?: number;
  filledAvgPrice?: number;
  // Prediction market fields
  eventId?: string;
  eventName?: string;
  company?: string;
  shares?: number;
  averagePrice?: number;
  actualCostBasis?: number;
}

export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
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
              },
              orderBy: { createdAt: "desc" },
            },
            predictionTrades: {
              select: {
                id: true,
                eventId: true,
                eventName: true,
                company: true,
                side: true,
                amount: true,
                shares: true,
                averagePrice: true,
                actualCostBasis: true,
                status: true,
                createdAt: true,
                filledAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: 50,
            },
            predictionSales: {
              select: {
                id: true,
                eventId: true,
                eventName: true,
                company: true,
                side: true,
                sharesSold: true,
                proceeds: true,
                costBasis: true,
                avgEntryPrice: true,
                exitPrice: true,
                usdcReturned: true,
                returnFundsTxHash: true,
                status: true,
                createdAt: true,
                completedAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: 50,
            },
            deposits: {
              select: {
                id: true,
                amount: true,
                amountUsd: true,
                txHash: true,
                fromAddress: true,
                tokenAddress: true,
                status: true,
                createdAt: true,
                confirmedAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: 100,
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
    const allTransactions: Transaction[] = [];

    // When force=1 (e.g. just after a Privy fundWallet completes), pull from
    // Alchemy synchronously so the response includes the new deposit instead of
    // waiting for the next 5-minute stale window.
    if (force) {
      await syncWalletTransactions(tradingWallet.id, tradingWallet.address, {
        walletCreatedAt: tradingWallet.createdAt,
        chainId: tradingWallet.chainId,
        syncPortfolio: false,
      });
    }

    // Read cached on-chain transactions from DB (instant). Background-sync if stale.
    const [syncState, cachedTxs] = await Promise.all([
      getSyncState(tradingWallet.id),
      getCachedTransactions(tradingWallet.id),
    ]);

    const seenTxHashes = new Set<string>();
    for (const tx of cachedTxs) {
      if (tx.amount !== null && tx.amount > 0) {
        if (tx.txHash) seenTxHashes.add(tx.txHash.toLowerCase());
        allTransactions.push({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          status: tx.status,
          txHash: tx.txHash,
          timestamp: tx.timestamp,
          address: tx.address,
          asset: tx.asset ?? undefined,
        });
      }
    }

    if (!force && isSyncStale(syncState?.lastSyncedAt ?? null) && !syncState?.isSyncing) {
      triggerBackgroundSync(tradingWallet.id, tradingWallet.address, {
        walletCreatedAt: tradingWallet.createdAt,
        chainId: tradingWallet.chainId,
        syncPortfolio: false,
      });
    }

    // Merge Deposit-table rows (created by /deposit/detect and /deposit/initiate)
    // that aren't yet reflected in CachedTransaction. This guarantees Privy
    // fundWallet deposits surface immediately, even before Alchemy indexes them.
    for (const dep of tradingWallet.deposits) {
      const hashKey = dep.txHash?.toLowerCase();
      if (hashKey && seenTxHashes.has(hashKey)) continue;

      const amount = dep.amountUsd != null ? Number(dep.amountUsd) : 0;
      if (!(amount > 0)) continue;

      const status =
        dep.status === "COMPLETED"
          ? "COMPLETED"
          : dep.status === "FAILED"
            ? "FAILED"
            : "PENDING";

      allTransactions.push({
        id: `deposit-${dep.id}`,
        type: "deposit",
        amount,
        status,
        txHash: dep.txHash ?? null,
        timestamp: (dep.confirmedAt ?? dep.createdAt).toISOString(),
        address: dep.fromAddress,
        asset: "USDC",
      });

      if (hashKey) seenTxHashes.add(hashKey);
    }

    // Add ETF orders from database
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

    // Add prediction market trades (buys) from database
    for (const trade of tradingWallet.predictionTrades) {
      const shares = trade.shares ? Number(trade.shares) : 0;
      const avgPrice = trade.averagePrice ? Number(trade.averagePrice) : 0;

      // Determine the actual cost basis:
      // 1. Use actualCostBasis from DB if available (new field)
      // 2. Otherwise calculate from shares × averagePrice
      // 3. Only fall back to intended amount if we have no share/price data
      let displayAmount: number;
      if (trade.actualCostBasis) {
        displayAmount = Number(trade.actualCostBasis);
      } else if (shares > 0 && avgPrice > 0) {
        displayAmount = shares * avgPrice;
      } else {
        // No share/price data available, use intended amount as last resort
        displayAmount = Number(trade.amount);
      }

      allTransactions.push({
        id: trade.id,
        type: trade.side === "LONG" ? "buy_long" : "buy_short",
        amount: displayAmount,
        status: trade.status,
        txHash: null,
        timestamp: (trade.filledAt ?? trade.createdAt).toISOString(),
        address: tradingWallet.address,
        eventId: trade.eventId,
        eventName: trade.eventName ?? undefined,
        company: trade.company ?? undefined,
        shares: shares > 0 ? shares : undefined,
        averagePrice: avgPrice > 0 ? avgPrice : undefined,
        actualCostBasis: displayAmount,
      });
    }

    // Add prediction market sales from database
    for (const sale of tradingWallet.predictionSales) {
      // Prefer recorded proceeds; fall back to the auto-swept USDC delivery
      // amount when proceeds wasn't captured at sell time.
      const proceedsNum = Number(sale.proceeds);
      const sweepNum = sale.usdcReturned ? Number(sale.usdcReturned) : 0;
      const amount = proceedsNum > 0 ? proceedsNum : sweepNum;

      allTransactions.push({
        id: sale.id,
        type: sale.side === "LONG" ? "sell_long" : "sell_short",
        amount,
        status: sale.status,
        txHash: sale.returnFundsTxHash ?? null,
        timestamp: (sale.completedAt ?? sale.createdAt).toISOString(),
        address: tradingWallet.address,
        eventId: sale.eventId,
        eventName: sale.eventName ?? undefined,
        company: sale.company ?? undefined,
        shares: sale.sharesSold ? Number(sale.sharesSold) : undefined,
        averagePrice: sale.exitPrice ? Number(sale.exitPrice) : undefined,
      });
    }

    // Sort by timestamp descending (newest first)
    allTransactions.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({ transactions: allTransactions });
  } catch (error) {
    console.error("[On-Chain Transactions] Error:", error);
    return NextResponse.json(
      { error: "Failed to get transactions" },
      { status: 500 }
    );
  }
}
