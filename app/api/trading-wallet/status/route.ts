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

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.tradingWallet) {
      return NextResponse.json(
        { error: "Trading wallet not found" },
        { status: 404 }
      );
    }

    const tradingWallet = user.tradingWallet;

    // Fetch on-chain balance
    let balance = "0";
    let balanceUsd = "0";

    if (tradingWallet.status === "ACTIVE") {
      try {
        const balanceBigInt = await getUsdcBalance(
          tradingWallet.address as `0x${string}`,
          tradingWallet.chainId
        );
        balance = formatUsdcAmount(balanceBigInt);
        // USDC is 1:1 with USD
        balanceUsd = balance;
      } catch (error) {
        console.error("[Trading Wallet] Failed to fetch balance:", error);
        // Return cached or zero balance on error
      }
    }

    return NextResponse.json({
      id: tradingWallet.id,
      address: tradingWallet.address,
      chainId: tradingWallet.chainId,
      status: tradingWallet.status,
      balance,
      balanceUsd,
      hasServerSigner: tradingWallet.hasServerSigner,
      safeAddress: tradingWallet.safeAddress,
    });
  } catch (error) {
    console.error("[Trading Wallet] Status error:", error);
    return NextResponse.json(
      { error: "Failed to get trading wallet status" },
      { status: 500 }
    );
  }
}
