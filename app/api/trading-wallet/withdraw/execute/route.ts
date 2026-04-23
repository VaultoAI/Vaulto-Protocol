import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { getWithdrawalTxData } from "@/lib/trading-wallet/execute-withdrawal";
import { createPublicClient, http } from "viem";
import { polygon } from "viem/chains";
import {
  executeUsdcTransfer,
  waitForTransaction,
  isServerSigningConfigured,
} from "@/lib/trading-wallet/server-wallet";

export async function POST(request: Request) {
  const LOG_PREFIX = "[Withdraw Execute]";

  try {
    console.log(`${LOG_PREFIX} Starting withdrawal execute request`);

    const session = await auth();
    if (!session?.user?.email) {
      console.log(`${LOG_PREFIX} Unauthorized - no session`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log(`${LOG_PREFIX} User authenticated: ${session.user.email}`);

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();
    const body = await request.json();
    const { withdrawalId, txHash } = body;

    console.log(`${LOG_PREFIX} Request body:`, { withdrawalId, txHash: txHash ? `${txHash.slice(0, 10)}...` : null });

    if (!withdrawalId) {
      console.log(`${LOG_PREFIX} Missing withdrawalId`);
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
      console.log(`${LOG_PREFIX} Trading wallet not found for user`);
      return NextResponse.json(
        { error: "Trading wallet not found" },
        { status: 404 }
      );
    }

    const withdrawal = user.tradingWallet.withdrawals[0];
    if (!withdrawal) {
      console.log(`${LOG_PREFIX} Withdrawal not found: ${withdrawalId}`);
      return NextResponse.json(
        { error: "Withdrawal not found" },
        { status: 404 }
      );
    }

    console.log(`${LOG_PREFIX} Found withdrawal:`, {
      id: withdrawal.id,
      status: withdrawal.status,
      amount: withdrawal.amount.toString(),
      toAddress: withdrawal.toAddress,
      existingTxHash: withdrawal.txHash,
    });

    // Check withdrawal status
    if (withdrawal.status === "COMPLETED") {
      console.log(`${LOG_PREFIX} Withdrawal already completed`);
      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        txHash: withdrawal.txHash,
        message: "Withdrawal already completed",
      });
    }

    if (withdrawal.status === "REJECTED") {
      console.log(`${LOG_PREFIX} Withdrawal was rejected`);
      return NextResponse.json(
        { error: "Withdrawal was rejected" },
        { status: 400 }
      );
    }

    if (withdrawal.status === "PENDING_APPROVAL") {
      // Check if MFA is required and not completed
      if (withdrawal.requiresMfa && !withdrawal.mfaCompletedAt) {
        console.log(`${LOG_PREFIX} MFA required but not completed`);
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
      console.log(`${LOG_PREFIX} Processing txHash confirmation`);

      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        console.log(`${LOG_PREFIX} Invalid txHash format`);
        return NextResponse.json(
          { error: "Invalid transaction hash" },
          { status: 400 }
        );
      }

      // First update to PROCESSING
      console.log(`${LOG_PREFIX} Updating status to PROCESSING`);
      await db.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          txHash,
          status: "PROCESSING",
          executedAt: new Date(),
        },
      });

      // Wait for transaction confirmation on Polygon
      console.log(`${LOG_PREFIX} Creating public client for Polygon`);
      const publicClient = createPublicClient({
        chain: polygon,
        transport: http(),
      });

      console.log(`${LOG_PREFIX} Waiting for transaction receipt...`);
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash as `0x${string}`,
          confirmations: 1,
          timeout: 60_000, // 60 second timeout
        });

        console.log(`${LOG_PREFIX} Receipt received:`, {
          status: receipt.status,
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
        });

        // Update status based on result
        const finalStatus = receipt.status === "success" ? "COMPLETED" : "REJECTED";
        console.log(`${LOG_PREFIX} Final status: ${finalStatus}`);

        await db.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: finalStatus,
            executedAt: new Date(),
          },
        });
        console.log(`${LOG_PREFIX} Database updated to ${finalStatus}`);

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
        console.log(`${LOG_PREFIX} Audit log created`);

        const response = {
          success: receipt.status === "success",
          status: finalStatus,
          txHash,
          message:
            finalStatus === "COMPLETED"
              ? "Withdrawal completed successfully"
              : "Transaction failed on-chain",
        };
        console.log(`${LOG_PREFIX} Returning response:`, response);
        return NextResponse.json(response);
      } catch (receiptError) {
        console.error(`${LOG_PREFIX} Error waiting for receipt:`, receiptError);
        // Update to failed state
        await db.withdrawal.update({
          where: { id: withdrawalId },
          data: { status: "REJECTED" },
        });
        return NextResponse.json(
          {
            error: "Transaction confirmation failed",
            details: receiptError instanceof Error ? receiptError.message : "Unknown error",
            txHash,
          },
          { status: 500 }
        );
      }
    }

    // No txHash - either sign server-side or return transaction data for client to sign
    console.log(`${LOG_PREFIX} No txHash - checking signing method`);
    console.log(`${LOG_PREFIX} Raw withdrawal.amount:`, withdrawal.amount);
    console.log(`${LOG_PREFIX} withdrawal.amount.toString():`, withdrawal.amount.toString());
    console.log(`${LOG_PREFIX} Type of withdrawal.amount:`, typeof withdrawal.amount);

    // Parse the amount - it's stored in raw units (e.g., 1000000 for 1 USDC)
    const amountStr = withdrawal.amount.toString().split(".")[0];
    const amountBigInt = BigInt(amountStr);
    console.log(`${LOG_PREFIX} Amount string after split: ${amountStr}`);
    console.log(`${LOG_PREFIX} Amount as BigInt: ${amountBigInt}`);
    console.log(`${LOG_PREFIX} Amount in USDC: ${Number(amountBigInt) / 1_000_000}`);

    // Check if this wallet has server signing enabled
    const hasServerSigner = user.tradingWallet.hasServerSigner;
    const privyWalletId = user.tradingWallet.privyWalletId;

    if (hasServerSigner && isServerSigningConfigured() && privyWalletId) {
      // Server-side signing path
      console.log(`${LOG_PREFIX} Using server-side signing`);
      console.log(`${LOG_PREFIX} Wallet ID: ${privyWalletId}`);

      // Update status to processing before signing
      await db.withdrawal.update({
        where: { id: withdrawalId },
        data: { status: "PROCESSING" },
      });

      try {
        // Execute the transfer using server signing
        const txResult = await executeUsdcTransfer(
          privyWalletId,
          withdrawal.toAddress,
          amountBigInt,
          withdrawal.chainId
        );

        if (!txResult.success || !txResult.txHash) {
          console.error(`${LOG_PREFIX} Server signing failed:`, txResult.error);
          await db.withdrawal.update({
            where: { id: withdrawalId },
            data: {
              status: "REJECTED",
              rejectionReason: txResult.error || "Server signing failed",
            },
          });
          return NextResponse.json(
            { error: txResult.error || "Server signing failed" },
            { status: 500 }
          );
        }

        console.log(`${LOG_PREFIX} Transaction submitted: ${txResult.txHash}`);

        // Update withdrawal with txHash
        await db.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            txHash: txResult.txHash,
            executedAt: new Date(),
          },
        });

        // Wait for transaction confirmation
        console.log(`${LOG_PREFIX} Waiting for transaction confirmation...`);
        try {
          const receipt = await waitForTransaction(txResult.txHash, 1, 60_000);
          const finalStatus = receipt.success ? "COMPLETED" : "REJECTED";

          console.log(`${LOG_PREFIX} Transaction ${finalStatus}: ${txResult.txHash}`);

          await db.withdrawal.update({
            where: { id: withdrawalId },
            data: { status: finalStatus },
          });

          // Create audit log
          await db.auditLog.create({
            data: {
              userId: user.id,
              action: "TRADING_WALLET_WITHDRAWAL_EXECUTED",
              details: JSON.stringify({
                withdrawalId,
                txHash: txResult.txHash,
                amount: withdrawal.amount.toString(),
                toAddress: withdrawal.toAddress,
                finalStatus,
                signingMethod: "server",
              }),
              entityType: "Withdrawal",
              entityId: withdrawalId,
              logHash: `withdrawal-execute-${withdrawalId}-${Date.now()}`,
            },
          });

          return NextResponse.json({
            success: receipt.success,
            status: finalStatus === "COMPLETED" ? "SUBMITTED" : "FAILED",
            txHash: txResult.txHash,
            message: receipt.success
              ? "Withdrawal submitted and confirmed"
              : "Transaction failed on-chain",
          });
        } catch (confirmError) {
          console.error(`${LOG_PREFIX} Confirmation error:`, confirmError);
          // Transaction was submitted but confirmation timed out
          // The client should poll for status
          return NextResponse.json({
            success: true,
            status: "SUBMITTED",
            txHash: txResult.txHash,
            message: "Withdrawal submitted, awaiting confirmation",
          });
        }
      } catch (signingError) {
        console.error(`${LOG_PREFIX} Server signing error:`, signingError);
        await db.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: "REJECTED",
            rejectionReason:
              signingError instanceof Error
                ? signingError.message
                : "Server signing failed",
          },
        });
        return NextResponse.json(
          {
            error: "Server signing failed",
            details:
              signingError instanceof Error
                ? signingError.message
                : "Unknown error",
          },
          { status: 500 }
        );
      }
    }

    // Client-side signing path (legacy)
    console.log(`${LOG_PREFIX} Using client-side signing (legacy)`);

    const txData = getWithdrawalTxData(
      withdrawal.toAddress as `0x${string}`,
      amountBigInt,
      withdrawal.chainId
    );
    console.log(`${LOG_PREFIX} Generated txData:`, txData);

    // Update status to processing
    await db.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: "PROCESSING",
      },
    });
    console.log(`${LOG_PREFIX} Updated status to PROCESSING`);

    const response = {
      success: true,
      status: "READY_TO_SIGN",
      txData,
      withdrawalId,
      message: "Sign this transaction to complete the withdrawal",
    };
    console.log(`${LOG_PREFIX} Returning READY_TO_SIGN response`);
    return NextResponse.json(response);
  } catch (error) {
    console.error(`${LOG_PREFIX} Unhandled error:`, error);
    console.error(`${LOG_PREFIX} Error stack:`, error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      {
        error: "Failed to execute withdrawal",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
