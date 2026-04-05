import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { getWithdrawalTxData } from "@/lib/trading-wallet/execute-withdrawal";
import { createPublicClient, http } from "viem";
import { polygon } from "viem/chains";

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
    const { withdrawalId, txHash } = body;

    if (!withdrawalId) {
      return NextResponse.json(
        { error: "Withdrawal ID required" },
        { status: 400 }
      );
    }

    // Get user and withdrawal
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        tradingWallet: {
          include: {
            withdrawals: {
              where: { id: withdrawalId },
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

    const withdrawal = user.tradingWallet.withdrawals[0];
    if (!withdrawal) {
      return NextResponse.json(
        { error: "Withdrawal not found" },
        { status: 404 }
      );
    }

    // Check withdrawal status
    if (withdrawal.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        txHash: withdrawal.txHash,
        message: "Withdrawal already completed",
      });
    }

    if (withdrawal.status === "REJECTED") {
      return NextResponse.json(
        { error: "Withdrawal was rejected" },
        { status: 400 }
      );
    }

    if (withdrawal.status === "PENDING_APPROVAL") {
      // Check if MFA is required and not completed
      if (withdrawal.requiresMfa && !withdrawal.mfaCompletedAt) {
        return NextResponse.json(
          {
            error: "MFA verification required",
            requiresMfa: true,
          },
          { status: 400 }
        );
      }
    }

    // If txHash is provided, this is a confirmation of a client-signed transaction
    if (txHash) {
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return NextResponse.json(
          { error: "Invalid transaction hash" },
          { status: 400 }
        );
      }

      // First update to PROCESSING
      await db.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          txHash,
          status: "PROCESSING",
          executedAt: new Date(),
        },
      });

      // Wait for transaction confirmation on Polygon
      const publicClient = createPublicClient({
        chain: polygon,
        transport: http(),
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        confirmations: 1,
        timeout: 60_000, // 60 second timeout
      });

      // Update status based on result
      const finalStatus = receipt.status === "success" ? "COMPLETED" : "REJECTED";

      await db.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: finalStatus,
          ...(finalStatus === "COMPLETED" && { completedAt: new Date() }),
        },
      });

      // Create audit log
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "TRADING_WALLET_WITHDRAWAL_EXECUTED",
          details: JSON.stringify({
            withdrawalId,
            txHash,
            amount: withdrawal.amount.toString(),
            toAddress: withdrawal.toAddress,
            finalStatus,
          }),
          entityType: "Withdrawal",
          entityId: withdrawalId,
          logHash: `withdrawal-execute-${withdrawalId}-${Date.now()}`,
        },
      });

      return NextResponse.json({
        success: receipt.status === "success",
        status: finalStatus,
        txHash,
        message:
          finalStatus === "COMPLETED"
            ? "Withdrawal completed successfully"
            : "Transaction failed on-chain",
      });
    }

    // No txHash - return transaction data for client to sign
    const amountBigInt = BigInt(withdrawal.amount.toString().split(".")[0]);
    const txData = getWithdrawalTxData(
      withdrawal.toAddress as `0x${string}`,
      amountBigInt,
      withdrawal.chainId
    );

    // Update status to processing
    await db.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: "PROCESSING",
      },
    });

    return NextResponse.json({
      success: true,
      status: "READY_TO_SIGN",
      txData,
      withdrawalId,
      message: "Sign this transaction to complete the withdrawal",
    });
  } catch (error) {
    console.error("[Trading Wallet] Withdrawal execute error:", error);
    return NextResponse.json(
      { error: "Failed to execute withdrawal" },
      { status: 500 }
    );
  }
}
