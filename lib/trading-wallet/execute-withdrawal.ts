/**
 * Server-side Withdrawal Execution
 * Handles the actual execution of approved withdrawals
 */

import { createPublicClient, http, encodeFunctionData, formatUnits } from "viem";
import { polygon } from "viem/chains";
import {
  USDC_ADDRESSES,
  USDC_DECIMALS,
  ERC20_ABI,
  CHAIN_IDS,
} from "./constants";
import { getUsdcAddress } from "./policies";

// Create a public client for Polygon
const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon.drpc.org"),
});

export interface WithdrawalExecutionParams {
  fromAddress: string;
  toAddress: string;
  amount: bigint;
  chainId: number;
}

export interface WithdrawalExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Build ERC20 transfer transaction data
 */
export function buildTransferData(
  toAddress: `0x${string}`,
  amount: bigint
): `0x${string}` {
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [toAddress, amount],
  });
}

/**
 * Get USDC balance for an address on Polygon
 */
export async function getUsdcBalance(
  address: `0x${string}`,
  chainId: number = CHAIN_IDS.POLYGON
): Promise<bigint> {
  const usdcAddress = getUsdcAddress(chainId);
  if (!usdcAddress) {
    throw new Error(`USDC not supported on chain ${chainId}`);
  }

  try {
    const balance = await polygonClient.readContract({
      address: usdcAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    return balance as bigint;
  } catch (error) {
    console.error("[Trading Wallet] Failed to get USDC balance:", error);
    throw error;
  }
}

/**
 * Format USDC amount to human-readable string
 */
export function formatUsdcAmount(amount: bigint): string {
  return formatUnits(amount, USDC_DECIMALS);
}

/**
 * Parse USDC amount from human-readable string to bigint
 */
export function parseUsdcAmount(amount: string): bigint {
  const [whole = "0", frac = ""] = amount.split(".");
  const combined = whole + frac.slice(0, USDC_DECIMALS).padEnd(USDC_DECIMALS, "0");
  return BigInt(combined);
}

/**
 * Validate withdrawal parameters
 */
export function validateWithdrawalParams(
  params: WithdrawalExecutionParams
): { valid: boolean; error?: string } {
  // Validate addresses
  if (!/^0x[a-fA-F0-9]{40}$/.test(params.fromAddress)) {
    return { valid: false, error: "Invalid from address" };
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(params.toAddress)) {
    return { valid: false, error: "Invalid to address" };
  }

  // Validate amount
  if (params.amount <= BigInt(0)) {
    return { valid: false, error: "Amount must be greater than 0" };
  }

  // Validate chain
  const usdcAddress = getUsdcAddress(params.chainId);
  if (!usdcAddress) {
    return { valid: false, error: `Unsupported chain: ${params.chainId}` };
  }

  return { valid: true };
}

/**
 * Get withdrawal transaction data for client-side signing
 * This returns the transaction parameters that the embedded wallet will sign
 */
export function getWithdrawalTxData(
  toAddress: `0x${string}`,
  amount: bigint,
  chainId: number = CHAIN_IDS.POLYGON
): {
  to: `0x${string}`;
  data: `0x${string}`;
  chainId: number;
} {
  const usdcAddress = getUsdcAddress(chainId);
  if (!usdcAddress) {
    throw new Error(`USDC not supported on chain ${chainId}`);
  }

  return {
    to: usdcAddress as `0x${string}`,
    data: buildTransferData(toAddress, amount),
    chainId,
  };
}
