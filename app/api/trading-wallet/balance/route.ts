import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { getUsdcBalance, formatUsdcAmount } from "@/lib/trading-wallet/execute-withdrawal";

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

    const tradingWallet = user.tradingWallet;

    if (tradingWallet.status !== "ACTIVE") {
      return NextResponse.json({
        balance: "0",
        balanceUsd: "0",
        status: tradingWallet.status,
      });
    }

    // Fetch on-chain USDC balance
    const balanceBigInt = await getUsdcBalance(
      tradingWallet.address as `0x${string}`,
      tradingWallet.chainId
    );

    const balance = formatUsdcAmount(balanceBigInt);

    return NextResponse.json({
      balance,
      balanceUsd: balance, // USDC is 1:1 with USD
      address: tradingWallet.address,
      chainId: tradingWallet.chainId,
    });
  } catch (error) {
    console.error("[Trading Wallet] Balance error:", error);
    return NextResponse.json(
      { error: "Failed to get balance" },
      { status: 500 }
    );
  }
}
