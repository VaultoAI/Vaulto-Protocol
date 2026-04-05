import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { getUsdcBalance, formatUsdcAmount } from "@/lib/trading-wallet/execute-withdrawal";

interface HistoryPoint {
  timestamp: string;
  balance: number;
  type: "deposit" | "withdrawal" | "initial" | "current";
}

interface Transaction {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  status: string;
  txHash: string | null;
  timestamp: string;
  address: string; // fromAddress for deposits, toAddress for withdrawals
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

    // Sort transactions by timestamp descending (newest first) for display
    allTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Build chart data from completed transactions only
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
    completedTransactions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Build history with running balance
    const history: HistoryPoint[] = [];
    let runningBalance = 0;

    // Add initial point at wallet creation
    history.push({
      timestamp: tradingWallet.createdAt.toISOString(),
      balance: 0,
      type: "initial",
    });

    // Add points for each completed transaction
    for (const tx of completedTransactions) {
      if (tx.type === "deposit") {
        runningBalance += tx.amount;
      } else {
        runningBalance -= tx.amount;
      }
      // Ensure balance doesn't go negative due to rounding
      runningBalance = Math.max(0, runningBalance);

      history.push({
        timestamp: tx.timestamp.toISOString(),
        balance: runningBalance,
        type: tx.type,
      });
    }

    // Get current on-chain balance and add as final point
    if (tradingWallet.status === "ACTIVE") {
      const balanceBigInt = await getUsdcBalance(
        tradingWallet.address as `0x${string}`,
        tradingWallet.chainId
      );
      const currentBalance = parseFloat(formatUsdcAmount(balanceBigInt));

      history.push({
        timestamp: new Date().toISOString(),
        balance: currentBalance,
        type: "current",
      });
    } else {
      // Wallet not active, add current point with calculated balance
      history.push({
        timestamp: new Date().toISOString(),
        balance: runningBalance,
        type: "current",
      });
    }

    return NextResponse.json({ history, transactions: allTransactions });
  } catch (error) {
    console.error("[Trading Wallet] Portfolio history error:", error);
    return NextResponse.json(
      { error: "Failed to get portfolio history" },
      { status: 500 }
    );
  }
}
