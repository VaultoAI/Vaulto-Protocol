import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { isValidEthereumAddress, verifyPrivyToken } from "@/lib/trading-wallet/privy-server";
import {
  createWalletForExistingUser,
  getUserWallet,
  isServerSigningConfigured,
} from "@/lib/trading-wallet/server-wallet";
import { DEFAULT_TRADING_CHAIN_ID } from "@/lib/trading-wallet/constants";
import { PrivyClient } from "@privy-io/node";

// Lazy initialization of Privy client
let _privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!_privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("Missing Privy configuration");
    }
    _privyClient = new PrivyClient({ appId, appSecret });
  }
  return _privyClient;
}

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
        hasServerSigner: user.tradingWallet.hasServerSigner,
        balance: "0",
        balanceUsd: "0",
      });
    }

    // Get request body - now supports both legacy (walletAddress) and new (privyToken) modes
    const body = await request.json().catch(() => ({}));
    const { walletAddress, privyToken } = body;

    let embeddedWalletAddress: string;
    let privyWalletId: string | null = null;
    let hasServerSigner = false;
    let policyId: string | null = null;
    let serverSignerId: string | null = null;

    // New server-side wallet creation flow
    if (privyToken) {
      console.log("[Trading Wallet] Using server-side wallet creation");

      // Verify the Privy token
      const verifiedUser = await verifyPrivyToken(privyToken);
      if (!verifiedUser) {
        return NextResponse.json(
          { error: "Invalid Privy token", code: "INVALID_TOKEN" },
          { status: 401 }
        );
      }

      const privyUserId = verifiedUser.userId;

      // Check if user already has an embedded wallet in Privy
      const existingWallet = await getUserWallet(privyUserId);

      if (existingWallet) {
        embeddedWalletAddress = existingWallet.address;
        privyWalletId = existingWallet.walletId;
        console.log("[Trading Wallet] Found existing Privy wallet:", embeddedWalletAddress);
      } else {
        // Create wallet server-side with policy
        if (!isServerSigningConfigured()) {
          return NextResponse.json(
            { error: "Server signing not configured", code: "CONFIG_ERROR" },
            { status: 500 }
          );
        }

        try {
          const newWallet = await createWalletForExistingUser(privyUserId);
          embeddedWalletAddress = newWallet.address;
          privyWalletId = newWallet.walletId;
          hasServerSigner = true;
          policyId = newWallet.policyId;
          serverSignerId = process.env.PRIVY_AUTHORIZATION_KEY_ID || null;
          console.log("[Trading Wallet] Created server wallet:", {
            address: embeddedWalletAddress,
            walletId: privyWalletId,
          });
        } catch (error) {
          console.error("[Trading Wallet] Failed to create server wallet:", error);
          return NextResponse.json(
            { error: "Failed to create wallet", code: "WALLET_CREATION_FAILED" },
            { status: 500 }
          );
        }
      }
    } else if (walletAddress) {
      // Legacy flow: client provides wallet address
      console.log("[Trading Wallet] Using legacy client-side wallet address");

      if (!isValidEthereumAddress(walletAddress)) {
        return NextResponse.json(
          {
            error: "Invalid wallet address",
            message: "Please provide a valid Ethereum wallet address.",
          },
          { status: 400 }
        );
      }

      embeddedWalletAddress = walletAddress;
      privyWalletId = walletAddress;
    } else {
      return NextResponse.json(
        {
          error: "Missing wallet information",
          message: "Please provide either a privyToken or walletAddress.",
        },
        { status: 400 }
      );
    }

    // Check if this wallet address already exists in the database
    const existingDbWallet = await db.tradingWallet.findUnique({
      where: { address: embeddedWalletAddress },
    });

    if (existingDbWallet) {
      // If wallet belongs to this user, just return it
      if (existingDbWallet.userId === user.id) {
        console.log("[Trading Wallet] Wallet already exists for this user, returning existing");
        return NextResponse.json({
          id: existingDbWallet.id,
          address: existingDbWallet.address,
          chainId: existingDbWallet.chainId,
          status: existingDbWallet.status,
          hasServerSigner: existingDbWallet.hasServerSigner,
          balance: "0",
          balanceUsd: "0",
        });
      }

      // If wallet belongs to a different user, that's an error
      console.error("[Trading Wallet] Wallet address belongs to a different user:", {
        address: embeddedWalletAddress,
        existingUserId: existingDbWallet.userId,
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
        privyWalletId: privyWalletId || embeddedWalletAddress,
        address: embeddedWalletAddress,
        chainId: DEFAULT_TRADING_CHAIN_ID,
        status: "ACTIVE",
        hasServerSigner,
        policyId,
        serverSignerId,
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
          hasServerSigner,
          policyId,
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
      hasServerSigner: tradingWallet.hasServerSigner,
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
