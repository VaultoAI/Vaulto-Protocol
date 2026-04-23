import { NextRequest, NextResponse } from "next/server";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { getUsdcBalance, formatUsdcAmount } from "@/lib/trading-wallet/execute-withdrawal";
import { getUserEmail } from "@/lib/trading-wallet/get-user-email";

export async function GET(request: NextRequest) {
  try {
    const email = await getUserEmail(request);
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();

    const user = await db.user.findUnique({
      where: { email },
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
