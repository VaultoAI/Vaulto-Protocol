import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import {
  queryUsdcTransfers,
  getBlockTimestamp,
} from "@/lib/trading-wallet/deposit-detection";
import { USDC_ADDRESSES, CHAIN_IDS } from "@/lib/trading-wallet/constants";
import { triggerPortfolioSnapshot } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";

/**
 * POST /api/trading-wallet/deposit/detect
 * Detects untracked USDC deposits to the user's trading wallet
 * by querying on-chain Transfer events and comparing against existing records
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();

    // Get user's trading wallet
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        tradingWallet: {
          include: {
            deposits: {
              select: { txHash: true },
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

    if (user.tradingWallet.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Trading wallet is not active" },
        { status: 400 }
      );
    }

    const tradingWallet = user.tradingWallet;

    // Get set of existing transaction hashes to avoid duplicates
    const existingTxHashes = new Set(
      tradingWallet.deposits
        .map((d) => d.txHash?.toLowerCase())
        .filter(Boolean)
    );

    // Query on-chain transfers to this wallet address
    const transfers = await queryUsdcTransfers(
      tradingWallet.address as `0x${string}`,
      { chainId: tradingWallet.chainId }
    );

    // Filter out transfers we already have records for
    const newTransfers = transfers.filter(
      (t) => !existingTxHashes.has(t.txHash.toLowerCase())
    );

    if (newTransfers.length === 0) {
      return NextResponse.json({
        detected: 0,
        deposits: [],
        message: "No new deposits detected",
      });
    }

    // Create deposit records for new transfers
    const createdDeposits = [];

    for (const transfer of newTransfers) {
      // Get block timestamp for the transfer
      let timestamp: Date;
      try {
        const blockTimestamp = await getBlockTimestamp(transfer.blockNumber);
        timestamp = new Date(blockTimestamp * 1000);
      } catch {
        timestamp = new Date();
      }

      // Create the deposit record
      const deposit = await db.deposit.create({
        data: {
          tradingWalletId: tradingWallet.id,
          fromAddress: transfer.fromAddress,
          tokenAddress: USDC_ADDRESSES.POLYGON_NATIVE,
          amount: transfer.amount.toString(),
          amountUsd: parseFloat(transfer.amountFormatted),
          txHash: transfer.txHash,
          chainId: CHAIN_IDS.POLYGON,
          status: "COMPLETED",
          confirmations: 64,
          requiredConfirmations: 64,
          confirmedAt: timestamp,
        },
      });

      // Create audit log
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "TRADING_WALLET_DEPOSIT_DETECTED",
          details: JSON.stringify({
            depositId: deposit.id,
            txHash: transfer.txHash,
            amount: transfer.amount.toString(),
            amountFormatted: transfer.amountFormatted,
            fromAddress: transfer.fromAddress,
            chainId: CHAIN_IDS.POLYGON,
            detectedAt: new Date().toISOString(),
          }),
          entityType: "Deposit",
          entityId: deposit.id,
          logHash: `deposit-detect-${deposit.id}-${Date.now()}`,
        },
      });

      createdDeposits.push({
        id: deposit.id,
        txHash: transfer.txHash,
        amount: transfer.amountFormatted,
        fromAddress: transfer.fromAddress,
        confirmedAt: timestamp.toISOString(),
      });
    }

    // Trigger a portfolio snapshot so the balance-over-time chart picks up
    // the new deposit on the next read. Fire-and-forget — chart still works
    // if this misses, the periodic cron will catch up within 15 min.
    if (createdDeposits.length > 0 && isVaultoApiConfigured()) {
      void triggerPortfolioSnapshot(getVaultoApiToken(), tradingWallet.id, { force: true });
    }

    return NextResponse.json({
      detected: createdDeposits.length,
      deposits: createdDeposits,
      message: `Detected ${createdDeposits.length} new deposit(s)`,
    });
  } catch (error) {
    console.error("[Trading Wallet] Deposit detection error:", error);
    return NextResponse.json(
      { error: "Failed to detect deposits" },
      { status: 500 }
    );
  }
}
