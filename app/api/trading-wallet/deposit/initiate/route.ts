import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { encodeFunctionData } from "viem";
import {
  USDC_ADDRESSES,
  CHAIN_IDS,
  MIN_DEPOSIT_AMOUNT,
  ERC20_ABI,
} from "@/lib/trading-wallet/constants";
import { parseUsdcAmount } from "@/lib/trading-wallet/execute-withdrawal";

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
    const { amount, chainId = CHAIN_IDS.POLYGON } = body;

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < MIN_DEPOSIT_AMOUNT) {
      return NextResponse.json(
        { error: `Minimum deposit is $${MIN_DEPOSIT_AMOUNT} USDC` },
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
        { error: "Trading wallet not found. Please create one first." },
        { status: 404 }
      );
    }

    if (user.tradingWallet.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Trading wallet is not active" },
        { status: 400 }
      );
    }

    // Get USDC address for the chain
    const usdcAddress =
      chainId === CHAIN_IDS.ETHEREUM
        ? USDC_ADDRESSES.ETHEREUM
        : USDC_ADDRESSES.POLYGON_NATIVE;

    // Parse amount to bigint (USDC has 6 decimals)
    const amountBigInt = parseUsdcAmount(amount);

    // Build ERC20 transfer transaction data
    const transferData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [user.tradingWallet.address as `0x${string}`, amountBigInt],
    });

    // Create pending deposit record
    const deposit = await db.deposit.create({
      data: {
        tradingWalletId: user.tradingWallet.id,
        fromAddress: "0x0000000000000000000000000000000000000000", // Will be updated on confirm
        tokenAddress: usdcAddress,
        amount: amountBigInt.toString(),
        chainId,
        status: "PENDING",
        requiredConfirmations: chainId === CHAIN_IDS.ETHEREUM ? 12 : 64,
      },
    });

    return NextResponse.json({
      depositId: deposit.id,
      tradingWalletAddress: user.tradingWallet.address,
      txData: {
        to: usdcAddress,
        data: transferData,
        value: "0",
        chainId,
      },
      amount,
      message: "Sign this transaction to deposit USDC to your trading wallet",
    });
  } catch (error) {
    console.error("[Trading Wallet] Deposit initiate error:", error);
    return NextResponse.json(
      { error: "Failed to initiate deposit" },
      { status: 500 }
    );
  }
}
