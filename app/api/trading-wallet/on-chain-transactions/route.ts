import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { fetchWalletTransactions } from "@/lib/alchemy/transactions";

interface Transaction {
  id: string;
  type: "deposit" | "withdrawal" | "buy" | "sell" | "prediction_long" | "prediction_short";
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
                status: true,
                createdAt: true,
                filledAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: 50,
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

    // Fetch on-chain transactions from Alchemy
    try {
      const onChainTxs = await fetchWalletTransactions(tradingWallet.address);

      for (const tx of onChainTxs) {
        // Only include transactions with a valid amount
        if (tx.amount !== null && tx.amount > 0) {
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
    } catch (alchemyError) {
      console.error("[On-Chain Transactions] Alchemy fetch error:", alchemyError);
      // Continue without on-chain data - ETF orders will still be returned
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

    // Add prediction market trades from database
    for (const trade of tradingWallet.predictionTrades) {
      allTransactions.push({
        id: trade.id,
        type: trade.side === "LONG" ? "prediction_long" : "prediction_short",
        amount: Number(trade.amount),
        status: trade.status,
        txHash: null,
        timestamp: (trade.filledAt ?? trade.createdAt).toISOString(),
        address: tradingWallet.address,
        eventId: trade.eventId,
        eventName: trade.eventName ?? undefined,
        company: trade.company ?? undefined,
        shares: trade.shares ? Number(trade.shares) : undefined,
        averagePrice: trade.averagePrice ? Number(trade.averagePrice) : undefined,
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
