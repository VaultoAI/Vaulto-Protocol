import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { getUsdcBalance, formatUsdcAmount } from "@/lib/trading-wallet/execute-withdrawal";
import { filterUsdcTransactions } from "@/lib/alchemy/transactions";
import {
  getCachedTransactions,
  getSyncState,
  triggerBackgroundSync,
  triggerBackgroundPortfolioSync,
  isSyncStale,
  isBalanceStale,
  getCachedPortfolioHistory,
} from "@/lib/trading-wallet/transaction-sync";

interface HistoryPoint {
  timestamp: string;
  balance: number;
  type: "deposit" | "withdrawal" | "initial" | "current";
}

interface Transaction {
  id: string;
  type: "deposit" | "withdrawal" | "buy" | "sell";
  amount: number;
  status: string;
  txHash: string | null;
  timestamp: string;
  address: string; // fromAddress for deposits, toAddress for withdrawals
  // ETF order fields
  symbol?: string;
  qty?: number;
  filledQty?: number;
  filledAvgPrice?: number;
}

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

    // Build full transactions list for display
    const allTransactions: Transaction[] = [];

    // Add all deposits
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

    // Add all withdrawals
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

    // Add all ETF orders
    for (const order of tradingWallet.etfOrders) {
      const filledQty = order.filledQty ? Number(order.filledQty) : 0;
      const filledAvgPrice = order.filledAvgPrice ? Number(order.filledAvgPrice) : null;
      const orderValue = filledQty > 0 && filledAvgPrice
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
        txHash: null, // ETF orders don't have blockchain tx hash
        timestamp: (order.filledAt ?? order.createdAt).toISOString(),
        address: tradingWallet.address, // Use trading wallet address
        symbol: order.symbol,
        qty: order.qty ? Number(order.qty) : undefined,
        filledQty: filledQty > 0 ? filledQty : undefined,
        filledAvgPrice: filledAvgPrice ?? undefined,
      });
    }

    // Sort transactions by timestamp descending (newest first) for display
    allTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Get sync state (instant - from database)
    const syncState = await getSyncState(tradingWallet.id);

    // Check if transaction sync is needed (>5 min old or never synced)
    const transactionsStale = isSyncStale(syncState?.lastSyncedAt ?? null);
    // Check if balance cache is stale (>1 min old)
    const balanceStale = isBalanceStale(syncState?.balanceSyncedAt ?? null);

    // Try to get cached portfolio data first (instant - no RPC call)
    const cachedPortfolio = await getCachedPortfolioHistory(tradingWallet.id);

    // If we have cached portfolio data and balance is fresh, return immediately
    if (cachedPortfolio && !balanceStale) {
      // Trigger background refresh if transaction cache is stale
      if (transactionsStale && !syncState?.isSyncing) {
        triggerBackgroundSync(tradingWallet.id, tradingWallet.address, {
          walletCreatedAt: tradingWallet.createdAt,
          chainId: tradingWallet.chainId,
          syncPortfolio: true,
        });
      }

      return NextResponse.json({
        history: cachedPortfolio.history,
        transactions: allTransactions,
        syncState: {
          lastSyncedAt: syncState?.lastSyncedAt?.toISOString() ?? null,
          balanceSyncedAt: syncState?.balanceSyncedAt?.toISOString() ?? null,
          isSyncing: syncState?.isSyncing ?? false,
          needsSync: transactionsStale,
          transactionCount: syncState?.transactionCount ?? 0,
          fromCache: true,
        },
      });
    }

    // No cache or stale balance - need to compute history
    // First, get cached transactions
    const cachedTransactions = await getCachedTransactions(tradingWallet.id);

    // Build chart data
    const history: HistoryPoint[] = [];
    let runningBalance = 0;
    const usingCachedData = cachedTransactions.length > 0;

    // Trigger background sync if transactions are stale (non-blocking)
    if (transactionsStale && !syncState?.isSyncing) {
      triggerBackgroundSync(tradingWallet.id, tradingWallet.address, {
        walletCreatedAt: tradingWallet.createdAt,
        chainId: tradingWallet.chainId,
        syncPortfolio: true,
      });
    }

    // Add initial point at wallet creation
    history.push({
      timestamp: tradingWallet.createdAt.toISOString(),
      balance: 0,
      type: "initial",
    });

    if (usingCachedData) {
      // Use cached data for accurate blockchain timestamps
      // Filter to USDC transactions only for balance chart
      const usdcTxs = filterUsdcTransactions(cachedTransactions);

      // Sort by timestamp ascending for chart
      const sortedTxs = [...usdcTxs].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Build running balance from Alchemy data
      for (const tx of sortedTxs) {
        if (tx.amount !== null && tx.amount > 0) {
          if (tx.type === "deposit") {
            runningBalance += tx.amount;
          } else {
            runningBalance -= tx.amount;
          }
          runningBalance = Math.max(0, runningBalance);

          history.push({
            timestamp: tx.timestamp, // Accurate blockchain timestamp
            balance: runningBalance,
            type: tx.type,
          });
        }
      }
    } else {
      // Fallback: use database transactions
      const completedTransactions: Array<{
        timestamp: Date;
        amount: number;
        type: "deposit" | "withdrawal";
      }> = [];

      // Add completed deposits for chart
      for (const deposit of tradingWallet.deposits) {
        if (deposit.status === "COMPLETED" && deposit.confirmedAt) {
          completedTransactions.push({
            timestamp: deposit.confirmedAt,
            amount: Number(deposit.amount) / 1e6,
            type: "deposit",
          });
        }
      }

      // Add completed withdrawals for chart
      for (const withdrawal of tradingWallet.withdrawals) {
        if (withdrawal.status === "COMPLETED" && withdrawal.executedAt) {
          completedTransactions.push({
            timestamp: withdrawal.executedAt,
            amount: Number(withdrawal.amount) / 1e6,
            type: "withdrawal",
          });
        }
      }

      // Sort by timestamp ascending for chart
      completedTransactions.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      // Add points for each completed transaction
      for (const tx of completedTransactions) {
        if (tx.type === "deposit") {
          runningBalance += tx.amount;
        } else {
          runningBalance -= tx.amount;
        }
        runningBalance = Math.max(0, runningBalance);

        history.push({
          timestamp: tx.timestamp.toISOString(),
          balance: runningBalance,
          type: tx.type,
        });
      }
    }

    // Get current on-chain balance and add as final point
    let currentBalance = runningBalance;
    if (tradingWallet.status === "ACTIVE") {
      const balanceBigInt = await getUsdcBalance(
        tradingWallet.address as `0x${string}`,
        tradingWallet.chainId
      );
      currentBalance = parseFloat(formatUsdcAmount(balanceBigInt));
    }

    history.push({
      timestamp: new Date().toISOString(),
      balance: currentBalance,
      type: "current",
    });

    // Cache the computed history in background (non-blocking)
    triggerBackgroundPortfolioSync(
      tradingWallet.id,
      tradingWallet.address,
      tradingWallet.createdAt,
      tradingWallet.chainId
    );

    return NextResponse.json({
      history,
      transactions: allTransactions,
      syncState: {
        lastSyncedAt: syncState?.lastSyncedAt?.toISOString() ?? null,
        balanceSyncedAt: new Date().toISOString(),
        isSyncing: syncState?.isSyncing ?? false,
        needsSync: transactionsStale,
        transactionCount: syncState?.transactionCount ?? 0,
        fromCache: false,
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
