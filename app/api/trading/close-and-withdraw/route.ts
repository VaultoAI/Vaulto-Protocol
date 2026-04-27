import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { sellPosition, fetchPositions } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";
import { getUsdcBalance, formatUsdcAmount, parseUsdcAmount } from "@/lib/trading-wallet/execute-withdrawal";
import {
  executeUsdcTransfer,
  waitForTransaction,
  isServerSigningConfigured,
} from "@/lib/trading-wallet/server-wallet";

const LOG_PREFIX = "[Close & Withdraw]";

/**
 * POST /api/trading/close-and-withdraw
 *
 * Closes a prediction market position (100% sell) and optionally withdraws proceeds.
 * This is a multi-step operation:
 * 1. Sell the position at 100%
 * 2. Wait for position to be fully closed
 * 3. If withdrawToAddress provided, initiate withdrawal
 */
export async function POST(request: NextRequest) {
  try {
    console.log(`${LOG_PREFIX} Starting close-and-withdraw request`);

    // Verify authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check Vaulto API configuration
    if (!isVaultoApiConfigured()) {
      return NextResponse.json(
        { error: "Trading not configured" },
        { status: 500 }
      );
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;
    const db = getDb();

    // Get user and trading wallet
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { tradingWallet: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.tradingWallet || user.tradingWallet.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Trading wallet not active" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { positionId, withdrawToAddress } = body;

    // Validate positionId
    if (!positionId || typeof positionId !== "string") {
      return NextResponse.json(
        { error: "Invalid positionId" },
        { status: 400 }
      );
    }

    // Validate withdrawToAddress if provided
    if (withdrawToAddress && !/^0x[a-fA-F0-9]{40}$/.test(withdrawToAddress)) {
      return NextResponse.json(
        { error: "Invalid withdrawal address" },
        { status: 400 }
      );
    }

    // Extract auth headers
    const privyToken = request.headers.get("x-privy-token");
    if (!privyToken) {
      return NextResponse.json(
        { error: "Authentication required. Include x-privy-token header." },
        { status: 400 }
      );
    }

    const apiKey = getVaultoApiToken();
    const userId = user.tradingWallet.address;

    console.log(`${LOG_PREFIX} Closing position ${positionId}`);

    // Step 1: Sell the position at 100%
    const sellResult = await sellPosition(
      { positionId, percentage: 100 },
      apiKey,
      userId,
      { privyToken }
    );

    if (!sellResult.success) {
      console.error(`${LOG_PREFIX} Sell failed:`, sellResult.error);
      return NextResponse.json(
        { error: sellResult.error || "Failed to close position" },
        { status: 400 }
      );
    }

    console.log(`${LOG_PREFIX} Position closed, proceeds: ${sellResult.proceeds}`);

    // Record the sale in the database
    if (sellResult.proceeds) {
      try {
        await db.predictionMarketSale.create({
          data: {
            tradingWalletId: user.tradingWallet.id,
            positionId,
            eventId: "", // Will be populated by the caller if needed
            side: "LONG", // Default, will be updated
            sharesSold: sellResult.sharesSold ?? 0,
            percentage: 100,
            proceeds: sellResult.proceeds,
            realizedPnl: 0, // Would need cost basis to calculate
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      } catch (dbError) {
        // Log but don't fail - sale already completed
        console.error(`${LOG_PREFIX} Failed to record sale:`, dbError);
      }
    }

    // If no withdrawal address, we're done
    if (!withdrawToAddress) {
      // Fetch updated balance
      const balanceBigInt = await getUsdcBalance(
        user.tradingWallet.address as `0x${string}`,
        user.tradingWallet.chainId
      );
      const newBalance = formatUsdcAmount(balanceBigInt);

      return NextResponse.json({
        success: true,
        sellProceeds: sellResult.proceeds,
        newBalance: parseFloat(newBalance),
        message: "Position closed successfully",
      });
    }

    // Step 2: Initiate withdrawal of the proceeds
    console.log(`${LOG_PREFIX} Initiating withdrawal to ${withdrawToAddress}`);

    // Get the current balance to withdraw
    const balanceBigInt = await getUsdcBalance(
      user.tradingWallet.address as `0x${string}`,
      user.tradingWallet.chainId
    );

    if (balanceBigInt <= BigInt(0)) {
      return NextResponse.json({
        success: true,
        sellProceeds: sellResult.proceeds,
        newBalance: 0,
        message: "Position closed but no USDC available to withdraw",
      });
    }

    // Check if server signing is available
    const hasServerSigner = user.tradingWallet.hasServerSigner;
    const privyWalletId = user.tradingWallet.privyWalletId;

    if (!hasServerSigner || !isServerSigningConfigured() || !privyWalletId) {
      // Return success but indicate withdrawal needs to be done separately
      const newBalance = formatUsdcAmount(balanceBigInt);
      return NextResponse.json({
        success: true,
        sellProceeds: sellResult.proceeds,
        newBalance: parseFloat(newBalance),
        message: "Position closed. Use the withdrawal flow to transfer funds.",
        withdrawalPending: true,
      });
    }

    // Create withdrawal record
    const withdrawal = await db.withdrawal.create({
      data: {
        tradingWalletId: user.tradingWallet.id,
        toAddress: withdrawToAddress,
        tokenAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USDC on Polygon
        amount: balanceBigInt.toString(),
        amountUsd: parseFloat(formatUsdcAmount(balanceBigInt)),
        chainId: user.tradingWallet.chainId,
        status: "PROCESSING",
      },
    });

    console.log(`${LOG_PREFIX} Executing withdrawal ${withdrawal.id}`);

    try {
      // Execute the transfer using server signing
      const txResult = await executeUsdcTransfer(
        privyWalletId,
        withdrawToAddress,
        balanceBigInt,
        user.tradingWallet.chainId
      );

      if (!txResult.success || !txResult.txHash) {
        console.error(`${LOG_PREFIX} Withdrawal failed:`, txResult.error);
        await db.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: "REJECTED",
            rejectionReason: txResult.error || "Transfer failed",
          },
        });

        return NextResponse.json({
          success: true,
          sellProceeds: sellResult.proceeds,
          newBalance: parseFloat(formatUsdcAmount(balanceBigInt)),
          withdrawalId: withdrawal.id,
          withdrawalStatus: "FAILED",
          error: txResult.error || "Withdrawal transfer failed",
        });
      }

      // Update withdrawal with txHash
      await db.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          txHash: txResult.txHash,
          executedAt: new Date(),
        },
      });

      // Wait for confirmation
      console.log(`${LOG_PREFIX} Waiting for withdrawal confirmation...`);
      try {
        const receipt = await waitForTransaction(txResult.txHash, 1, 60_000);
        const finalStatus = receipt.success ? "COMPLETED" : "REJECTED";

        await db.withdrawal.update({
          where: { id: withdrawal.id },
          data: { status: finalStatus },
        });

        // Create audit log
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: "TRADING_WALLET_WITHDRAWAL_EXECUTED",
            details: JSON.stringify({
              withdrawalId: withdrawal.id,
              txHash: txResult.txHash,
              amount: balanceBigInt.toString(),
              toAddress: withdrawToAddress,
              fromPositionClose: true,
              positionId,
            }),
            entityType: "Withdrawal",
            entityId: withdrawal.id,
            logHash: `close-withdraw-${withdrawal.id}-${Date.now()}`,
          },
        });

        return NextResponse.json({
          success: true,
          sellProceeds: sellResult.proceeds,
          newBalance: 0,
          withdrawalId: withdrawal.id,
          withdrawalStatus: finalStatus,
          txHash: txResult.txHash,
          message: receipt.success
            ? "Position closed and funds withdrawn"
            : "Position closed but withdrawal failed",
        });
      } catch (confirmError) {
        console.error(`${LOG_PREFIX} Confirmation timeout:`, confirmError);
        return NextResponse.json({
          success: true,
          sellProceeds: sellResult.proceeds,
          withdrawalId: withdrawal.id,
          withdrawalStatus: "PROCESSING",
          txHash: txResult.txHash,
          message: "Position closed, withdrawal submitted - check status later",
        });
      }
    } catch (withdrawError) {
      console.error(`${LOG_PREFIX} Withdrawal error:`, withdrawError);
      await db.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: "REJECTED",
          rejectionReason:
            withdrawError instanceof Error
              ? withdrawError.message
              : "Withdrawal failed",
        },
      });

      return NextResponse.json({
        success: true,
        sellProceeds: sellResult.proceeds,
        newBalance: parseFloat(formatUsdcAmount(balanceBigInt)),
        withdrawalId: withdrawal.id,
        withdrawalStatus: "FAILED",
        error: withdrawError instanceof Error ? withdrawError.message : "Withdrawal failed",
      });
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Unhandled error:`, error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to close position",
      },
      { status: 500 }
    );
  }
}
