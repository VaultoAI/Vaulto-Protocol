import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { createPublicClient, http } from "viem";
import { polygon, mainnet } from "viem/chains";
import { CHAIN_IDS, DEPOSIT_CONFIRMATIONS } from "@/lib/trading-wallet/constants";

// Create public clients
const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon.drpc.org"),
});

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ?? "https://eth.llamarpc.com"),
});

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
    const { txHash, depositId } = body;

    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json(
        { error: "Invalid transaction hash" },
        { status: 400 }
      );
    }

    // Get user's trading wallet
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { tradingWallet: true },
    });

    if (!user?.tradingWallet) {
      return NextResponse.json(
        { error: "Trading wallet not found" },
        { status: 404 }
      );
    }

    // Find the pending deposit if depositId is provided
    let deposit;
    if (depositId) {
      deposit = await db.deposit.findFirst({
        where: {
          id: depositId,
          tradingWalletId: user.tradingWallet.id,
          status: "PENDING",
        },
      });
    } else {
      // Find the most recent pending deposit
      deposit = await db.deposit.findFirst({
        where: {
          tradingWalletId: user.tradingWallet.id,
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!deposit) {
      return NextResponse.json(
        { error: "No pending deposit found" },
        { status: 404 }
      );
    }

    // Get the appropriate client
    const client = deposit.chainId === CHAIN_IDS.ETHEREUM ? mainnetClient : polygonClient;

    // Verify transaction exists
    let txReceipt;
    try {
      txReceipt = await client.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });
    } catch {
      // Transaction not yet mined or doesn't exist
      // Update deposit with tx hash anyway
      await db.deposit.update({
        where: { id: deposit.id },
        data: {
          txHash,
          status: "CONFIRMING",
        },
      });

      return NextResponse.json({
        success: true,
        status: "CONFIRMING",
        message: "Transaction submitted, waiting for confirmations",
        confirmations: 0,
        required: deposit.requiredConfirmations,
      });
    }

    if (!txReceipt) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Get current block number for confirmations
    const currentBlock = await client.getBlockNumber();
    const confirmations = Number(currentBlock - txReceipt.blockNumber);
    const required = deposit.chainId === CHAIN_IDS.ETHEREUM
      ? DEPOSIT_CONFIRMATIONS.ETHEREUM
      : DEPOSIT_CONFIRMATIONS.POLYGON;

    // Check if transaction was successful
    if (txReceipt.status !== "success") {
      await db.deposit.update({
        where: { id: deposit.id },
        data: {
          txHash,
          status: "FAILED",
        },
      });

      return NextResponse.json(
        { error: "Transaction failed" },
        { status: 400 }
      );
    }

    // Update deposit status
    const newStatus = confirmations >= required ? "COMPLETED" : "CONFIRMING";
    await db.deposit.update({
      where: { id: deposit.id },
      data: {
        txHash,
        fromAddress: txReceipt.from,
        status: newStatus,
        confirmations,
        confirmedAt: newStatus === "COMPLETED" ? new Date() : undefined,
      },
    });

    // Create audit log for completed deposit
    if (newStatus === "COMPLETED") {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "TRADING_WALLET_DEPOSIT_CONFIRMED",
          details: JSON.stringify({
            depositId: deposit.id,
            txHash,
            amount: deposit.amount.toString(),
            chainId: deposit.chainId,
          }),
          entityType: "Deposit",
          entityId: deposit.id,
          logHash: `deposit-confirm-${deposit.id}-${Date.now()}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      confirmations,
      required,
      message: newStatus === "COMPLETED"
        ? "Deposit confirmed successfully"
        : `Waiting for confirmations (${confirmations}/${required})`,
    });
  } catch (error) {
    console.error("[Trading Wallet] Deposit confirm error:", error);
    return NextResponse.json(
      { error: "Failed to confirm deposit" },
      { status: 500 }
    );
  }
}
