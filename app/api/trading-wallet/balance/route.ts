import { NextRequest, NextResponse } from "next/server";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { getUsdcBalance, formatUsdcAmount } from "@/lib/trading-wallet/execute-withdrawal";
import { getUserEmail } from "@/lib/trading-wallet/get-user-email";
import { createPublicClient, http, formatEther, formatUnits } from "viem";
import { polygon } from "viem/chains";
import { USDC_ADDRESSES, USDC_DECIMALS, ERC20_ABI } from "@/lib/trading-wallet/constants";

// Create a public client for Polygon to fetch native MATIC balance
const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon.drpc.org"),
});

/**
 * Get native MATIC balance for an address
 */
async function getMaticBalance(address: `0x${string}`): Promise<bigint> {
  try {
    return await polygonClient.getBalance({ address });
  } catch (error) {
    console.error("[Trading Wallet] Failed to get MATIC balance:", error);
    return BigInt(0);
  }
}

/**
 * Get USDC.e (bridged) balance for an address
 */
async function getUsdcBridgedBalance(address: `0x${string}`): Promise<bigint> {
  try {
    const balance = await polygonClient.readContract({
      address: USDC_ADDRESSES.POLYGON_BRIDGED as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });
    return balance as bigint;
  } catch (error) {
    console.error("[Trading Wallet] Failed to get USDC.e balance:", error);
    return BigInt(0);
  }
}

export async function GET(request: NextRequest) {
  try {
    const email = await getUserEmail(request);
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();

    const user = await db.user.findUnique({
      where: { email },
      include: { tradingWallet: true },
    });

    if (!user?.tradingWallet) {
      return NextResponse.json(
        { error: "Trading wallet not found" },
        { status: 404 }
      );
    }

    const tradingWallet = user.tradingWallet;

    if (tradingWallet.status !== "ACTIVE") {
      return NextResponse.json({
        balance: "0",
        balanceUsd: "0",
        status: tradingWallet.status,
      });
    }

    // Fetch on-chain balances in parallel
    // safeAddress is the Polymarket trading wallet (holds USDC.e)
    const polymarketAddress = tradingWallet.safeAddress;

    const balancePromises: Promise<bigint>[] = [
      getUsdcBalance(
        tradingWallet.address as `0x${string}`,
        tradingWallet.chainId
      ),
      getMaticBalance(tradingWallet.address as `0x${string}`),
    ];

    // Also fetch Safe (Polymarket) USDC.e balance if we have the address
    if (polymarketAddress) {
      balancePromises.push(
        getUsdcBridgedBalance(polymarketAddress as `0x${string}`)
      );
    }

    const balanceResults = await Promise.all(balancePromises);
    const usdcBalanceBigInt = balanceResults[0];
    const maticBalanceBigInt = balanceResults[1];
    const safeUsdceBalanceBigInt = polymarketAddress ? balanceResults[2] : BigInt(0);

    const usdcBalance = formatUsdcAmount(usdcBalanceBigInt);
    const maticBalance = formatEther(maticBalanceBigInt);
    const safeUsdceBalance = formatUnits(safeUsdceBalanceBigInt, USDC_DECIMALS);

    // Calculate if MATIC is low (less than 0.01 MATIC for gas)
    const maticLow = parseFloat(maticBalance) < 0.01;

    // Total available for trading = EOA USDC + Safe USDC.e
    const totalAvailable = (
      parseFloat(usdcBalance) + parseFloat(safeUsdceBalance)
    ).toFixed(2);

    return NextResponse.json({
      // Legacy fields for backward compatibility
      balance: usdcBalance,
      balanceUsd: usdcBalance, // USDC is 1:1 with USD
      // New structured balance fields
      usdc: {
        balance: usdcBalance,
        balanceUsd: usdcBalance,
        raw: usdcBalanceBigInt.toString(),
      },
      matic: {
        balance: maticBalance,
        raw: maticBalanceBigInt.toString(),
        low: maticLow,
      },
      // Polymarket (Safe) wallet balance
      polymarket: polymarketAddress ? {
        address: polymarketAddress,
        usdceBalance: safeUsdceBalance,
        usdceRaw: safeUsdceBalanceBigInt.toString(),
      } : null,
      // Combined trading balance
      totalAvailable,
      address: tradingWallet.address,
      chainId: tradingWallet.chainId,
    });
  } catch (error) {
    console.error("[Trading Wallet] Balance error:", error);
    return NextResponse.json(
      { error: "Failed to get balance" },
      { status: 500 }
    );
  }
}
