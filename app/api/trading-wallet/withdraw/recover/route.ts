import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { createPublicClient, http } from "viem";
import { polygon } from "viem/chains";

// Minimum age in milliseconds for a withdrawal to be considered "stuck"
const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/trading-wallet/withdraw/recover
 * Recovers stuck withdrawals by checking on-chain status
 * and updating the database accordingly
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

    // Get user's trading wallet with potentially stuck withdrawals
    // Include PROCESSING (stuck mid-execution) and REJECTED (may have been incorrectly marked)
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        tradingWallet: {
          include: {
            withdrawals: {
              where: {
                status: { in: ["PROCESSING", "REJECTED"] },
                txHash: { not: null },
              },
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
    const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MS);

    // Filter withdrawals that need checking:
    // - PROCESSING status older than threshold (stuck)
    // - REJECTED status with txHash (may need correction)
    const withdrawalsToCheck = tradingWallet.withdrawals.filter((w) => {
      if (w.status === "REJECTED") {
        // Always check rejected withdrawals with txHash - they may have succeeded
        return true;
      }
      // For PROCESSING, only check if older than threshold
      return w.executedAt && w.executedAt < stuckThreshold;
    });

    if (withdrawalsToCheck.length === 0) {
      return NextResponse.json({
        recovered: 0,
        message: "No withdrawals need recovery",
      });
    }

    // Create public client for checking on-chain status
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon.drpc.org"),
    });

    const recoveredWithdrawals = [];

    for (const withdrawal of withdrawalsToCheck) {
      if (!withdrawal.txHash) continue;

      try {
        // Check transaction receipt on-chain
        const receipt = await publicClient.getTransactionReceipt({
          hash: withdrawal.txHash as `0x${string}`,
        });

        if (receipt) {
          // Transaction was mined - update status based on success/failure
          const finalStatus = receipt.status === "success" ? "COMPLETED" : "REJECTED";

          // Skip if status is already correct
          if (withdrawal.status === finalStatus) continue;

          await db.withdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: finalStatus,
              executedAt: withdrawal.executedAt ?? new Date(),
              ...(finalStatus === "REJECTED" && {
                rejectionReason: "Transaction failed on-chain",
              }),
            },
          });

          // Create audit log
          await db.auditLog.create({
            data: {
              userId: user.id,
              action: "TRADING_WALLET_WITHDRAWAL_RECOVERED",
              details: JSON.stringify({
                withdrawalId: withdrawal.id,
                txHash: withdrawal.txHash,
                previousStatus: withdrawal.status,
                newStatus: finalStatus,
                blockNumber: receipt.blockNumber.toString(),
              }),
              entityType: "Withdrawal",
              entityId: withdrawal.id,
              logHash: `withdrawal-recover-${withdrawal.id}-${Date.now()}`,
            },
          });

          recoveredWithdrawals.push({
            id: withdrawal.id,
            txHash: withdrawal.txHash,
            previousStatus: withdrawal.status,
            newStatus: finalStatus,
          });
        }
        // If no receipt, the transaction is still pending or was dropped
        // We don't update it in that case
      } catch (error) {
        // Transaction not found - might have been dropped
        // Log but don't mark as failed yet (could still be pending)
        console.error(
          `[Withdrawal Recovery] Error checking tx ${withdrawal.txHash}:`,
          error
        );
      }
    }

    return NextResponse.json({
      recovered: recoveredWithdrawals.length,
      withdrawals: recoveredWithdrawals,
      message:
        recoveredWithdrawals.length > 0
          ? `Recovered ${recoveredWithdrawals.length} stuck withdrawal(s)`
          : "No withdrawals could be recovered",
    });
  } catch (error) {
    console.error("[Trading Wallet] Withdrawal recovery error:", error);
    return NextResponse.json(
      { error: "Failed to recover withdrawals" },
      { status: 500 }
    );
  }
}
