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

    // Check if this wallet address already exists in the database
    const existingWallet = await db.tradingWallet.findUnique({
      where: { address: walletAddress },
    });

    if (existingWallet) {
      // If wallet belongs to this user, just return it
      if (existingWallet.userId === user.id) {
        console.log("[Trading Wallet] Wallet already exists for this user, returning existing");
        return NextResponse.json({
          id: existingWallet.id,
          address: existingWallet.address,
          chainId: existingWallet.chainId,
          status: existingWallet.status,
          balance: "0",
          balanceUsd: "0",
        });
      }

      // If wallet belongs to a different user, that's an error
      console.error("[Trading Wallet] Wallet address belongs to a different user:", {
        address: walletAddress,
        existingUserId: existingWallet.userId,
        requestingUserId: user.id,
      });
      return NextResponse.json(
        {
          error: "Wallet already registered",
          message: "This wallet address is already registered to another account.",
          code: "WALLET_CONFLICT",
        },
        { status: 409 }
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
    // Enhanced diagnostic logging
    console.error("[Trading Wallet] Create error:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      code: (error as { code?: string }).code,
      meta: (error as { meta?: unknown }).meta,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Check for Prisma unique constraint violation (P2002)
    const prismaCode = (error as { code?: string }).code;
    const prismaMeta = (error as { meta?: { target?: string[] } }).meta;

    if (prismaCode === "P2002") {
      const field = prismaMeta?.target?.[0];
      console.error("[Trading Wallet] Unique constraint violated on field:", field);

      return NextResponse.json(
        {
          error: "Wallet already exists",
          message: field === "userId"
            ? "You already have a trading wallet."
            : "This wallet address is already registered.",
          code: "DUPLICATE_WALLET",
        },
        { status: 409 }
      );
    }

    // Return detailed error for other cases
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to create trading wallet",
        message: errorMessage,
        code: prismaCode || "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
