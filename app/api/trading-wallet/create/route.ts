import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { isValidEthereumAddress } from "@/lib/trading-wallet/privy-server";
import { DEFAULT_TRADING_CHAIN_ID } from "@/lib/trading-wallet/constants";

export async function POST(request: Request) {
  try {
    // Get session
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check database
    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();

    // Get user from database
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { tradingWallet: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user already has a trading wallet
    if (user.tradingWallet) {
      return NextResponse.json({
        id: user.tradingWallet.id,
        address: user.tradingWallet.address,
        chainId: user.tradingWallet.chainId,
        status: user.tradingWallet.status,
        balance: "0",
        balanceUsd: "0",
      });
    }

    // Get embedded wallet address from request body
    // The client passes the address of their Privy embedded wallet
    const body = await request.json().catch(() => ({}));
    const { walletAddress } = body;

    if (!walletAddress || !isValidEthereumAddress(walletAddress)) {
      return NextResponse.json(
        {
          error: "Invalid wallet address",
          message: "Please provide a valid Ethereum wallet address.",
        },
        { status: 400 }
      );
    }

    // Create trading wallet record in database
    const tradingWallet = await db.tradingWallet.create({
      data: {
        userId: user.id,
        privyWalletId: walletAddress, // Using address as ID for embedded wallets
        address: walletAddress,
        chainId: DEFAULT_TRADING_CHAIN_ID,
        status: "ACTIVE",
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "TRADING_WALLET_CREATED",
        details: JSON.stringify({
          tradingWalletId: tradingWallet.id,
          address: tradingWallet.address,
          chainId: tradingWallet.chainId,
        }),
        entityType: "TradingWallet",
        entityId: tradingWallet.id,
        logHash: `tw-create-${tradingWallet.id}-${Date.now()}`,
      },
    });

    return NextResponse.json({
      id: tradingWallet.id,
      address: tradingWallet.address,
      chainId: tradingWallet.chainId,
      status: tradingWallet.status,
      balance: "0",
      balanceUsd: "0",
    });
  } catch (error) {
    console.error("[Trading Wallet] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create trading wallet" },
      { status: 500 }
    );
  }
}
