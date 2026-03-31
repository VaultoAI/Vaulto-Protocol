import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import {
  validateWithdrawalAmount,
  getUsdcAddress,
} from "@/lib/trading-wallet/policies";
import {
  getUsdcBalance,
  formatUsdcAmount,
  parseUsdcAmount,
} from "@/lib/trading-wallet/execute-withdrawal";
import { CHAIN_IDS } from "@/lib/trading-wallet/constants";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();
    const body = await request.json();
    const { amount, toAddress } = body;

    // Validate to address
    if (!toAddress || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      return NextResponse.json(
        { error: "Invalid destination address" },
        { status: 400 }
      );
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: "Invalid withdrawal amount" },
        { status: 400 }
      );
    }

    // Get user with trading wallet and tier
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        tradingWallet: {
          include: {
            withdrawals: {
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
                },
                status: { in: ["COMPLETED", "PROCESSING", "APPROVED"] },
              },
            },
          },
        },
        walletVerifications: {
          where: { status: "VERIFIED" },
        },
      },
    });

    if (!user?.tradingWallet) {
      return NextResponse.json(
        { error: "Trading wallet not found" },
        { status: 404 }
      );
    }

    if (user.tradingWallet.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Trading wallet is not active" },
        { status: 400 }
      );
    }

    // Check if toAddress is a verified wallet (for compliance)
    const isVerifiedDestination = user.walletVerifications.some(
      (w) => w.walletAddress.toLowerCase() === toAddress.toLowerCase()
    );

    if (!isVerifiedDestination) {
      return NextResponse.json(
        {
          error: "Destination address not verified",
          message: "You can only withdraw to wallets verified during onboarding",
        },
        { status: 400 }
      );
    }

    // Calculate today's withdrawals
    const withdrawnToday = user.tradingWallet.withdrawals.reduce(
      (sum, w) => sum + parseFloat(w.amountUsd?.toString() ?? "0"),
      0
    );

    // Validate against withdrawal limits
    const userTier = user.tier as "STANDARD" | "VERIFIED" | "INSTITUTIONAL";
    const validation = validateWithdrawalAmount(amountNum, userTier, withdrawnToday);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Check on-chain balance
    const balanceBigInt = await getUsdcBalance(
      user.tradingWallet.address as `0x${string}`,
      user.tradingWallet.chainId
    );
    const balanceNum = parseFloat(formatUsdcAmount(balanceBigInt));

    if (amountNum > balanceNum) {
      return NextResponse.json(
        { error: `Insufficient balance. Available: $${balanceNum.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Get USDC address
    const usdcAddress = getUsdcAddress(user.tradingWallet.chainId);
    if (!usdcAddress) {
      return NextResponse.json(
        { error: "Unsupported chain" },
        { status: 400 }
      );
    }

    // Create withdrawal request
    const amountBigInt = parseUsdcAmount(amount);
    const withdrawal = await db.withdrawal.create({
      data: {
        tradingWalletId: user.tradingWallet.id,
        toAddress,
        tokenAddress: usdcAddress,
        amount: amountBigInt.toString(),
        amountUsd: amountNum,
        chainId: user.tradingWallet.chainId,
        status: validation.requiresMfa ? "PENDING_APPROVAL" : "APPROVED",
        requiresMfa: validation.requiresMfa,
        approvedAt: validation.requiresMfa ? undefined : new Date(),
        approvedBy: validation.requiresMfa ? undefined : "SYSTEM_AUTO_APPROVE",
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "TRADING_WALLET_WITHDRAWAL_REQUESTED",
        details: JSON.stringify({
          withdrawalId: withdrawal.id,
          amount: amountNum,
          toAddress,
          requiresMfa: validation.requiresMfa,
        }),
        entityType: "Withdrawal",
        entityId: withdrawal.id,
        logHash: `withdrawal-request-${withdrawal.id}-${Date.now()}`,
      },
    });

    return NextResponse.json({
      id: withdrawal.id,
      status: withdrawal.status,
      requiresMfa: validation.requiresMfa,
      amount,
      toAddress,
      message: validation.requiresMfa
        ? "MFA verification required for this withdrawal"
        : "Withdrawal approved, ready to execute",
    });
  } catch (error) {
    console.error("[Trading Wallet] Withdrawal request error:", error);
    return NextResponse.json(
      { error: "Failed to request withdrawal" },
      { status: 500 }
    );
  }
}
