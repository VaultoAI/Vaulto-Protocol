import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";

export interface TradeHistoryItem {
  id: string;
  type: "BUY" | "SELL";
  eventId: string;
  eventName?: string;
  company?: string;
  side: string;
  amount?: number;
  shares?: number;
  averagePrice?: number;
  proceeds?: number;
  realizedPnl?: number;
  percentage?: number;
  status: string;
  createdAt: string;
  completedAt?: string;
}

export interface TradeHistoryResponse {
  trades: TradeHistoryItem[];
  totals: {
    totalBuys: number;
    totalSells: number;
    totalRealizedPnl: number;
    totalVolume: number;
  };
}

/**
 * GET /api/trading/history
 *
 * Returns combined buy/sell history for prediction market trades.
 * Includes realized P&L from sales.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;
    const db = getDb();

    // Get user and trading wallet
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        tradingWallet: {
          include: {
            predictionTrades: {
              orderBy: { createdAt: "desc" },
              take: 100, // Limit to last 100 trades
            },
            predictionSales: {
              orderBy: { createdAt: "desc" },
              take: 100,
            },
          },
        },
      },
    });

    if (!user?.tradingWallet) {
      return NextResponse.json({
        trades: [],
        totals: {
          totalBuys: 0,
          totalSells: 0,
          totalRealizedPnl: 0,
          totalVolume: 0,
        },
      });
    }

    const trades: TradeHistoryItem[] = [];

    // Add buy trades
    for (const trade of user.tradingWallet.predictionTrades) {
      trades.push({
        id: trade.id,
        type: "BUY",
        eventId: trade.eventId,
        eventName: trade.eventName || undefined,
        company: trade.company || undefined,
        side: trade.side,
        amount: trade.amount ? Number(trade.amount) : undefined,
        shares: trade.shares ? Number(trade.shares) : undefined,
        averagePrice: trade.averagePrice ? Number(trade.averagePrice) : undefined,
        status: trade.status,
        createdAt: trade.createdAt.toISOString(),
        completedAt: trade.filledAt?.toISOString(),
      });
    }

    // Add sell trades
    for (const sale of user.tradingWallet.predictionSales) {
      const proceedsNum = Number(sale.proceeds);
      const sweepNum = sale.usdcReturned ? Number(sale.usdcReturned) : 0;
      const effectiveProceeds = proceedsNum > 0 ? proceedsNum : sweepNum;

      trades.push({
        id: sale.id,
        type: "SELL",
        eventId: sale.eventId,
        eventName: sale.eventName || undefined,
        side: sale.side,
        shares: Number(sale.sharesSold),
        percentage: sale.percentage,
        proceeds: effectiveProceeds,
        realizedPnl: Number(sale.realizedPnl),
        status: sale.status,
        createdAt: sale.createdAt.toISOString(),
        completedAt: sale.completedAt?.toISOString(),
      });
    }

    // Sort by createdAt descending
    trades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate totals
    const completedBuys = user.tradingWallet.predictionTrades.filter(t => t.status === "FILLED");
    const completedSales = user.tradingWallet.predictionSales.filter(s => s.status === "COMPLETED");

    const totalBuys = completedBuys.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalSells = completedSales.reduce((sum, s) => {
      const p = Number(s.proceeds || 0);
      return sum + (p > 0 ? p : Number(s.usdcReturned || 0));
    }, 0);
    const totalRealizedPnl = completedSales.reduce((sum, s) => sum + Number(s.realizedPnl || 0), 0);
    const totalVolume = totalBuys + totalSells;

    return NextResponse.json({
      trades,
      totals: {
        totalBuys,
        totalSells,
        totalRealizedPnl,
        totalVolume,
      },
    } as TradeHistoryResponse);
  } catch (error) {
    console.error("[Trading History] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch trade history" },
      { status: 500 }
    );
  }
}
