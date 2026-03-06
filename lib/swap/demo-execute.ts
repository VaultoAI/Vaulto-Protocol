/**
 * Simulated swap execution for private stock demo mode.
 * Simulates blockchain transaction with delay and updates localStorage balances.
 */

import { recordDemoTransaction, hasSufficientBalance } from "./demo-state";
import type { DemoQuoteResult } from "./demo-quote";

export interface DemoSwapParams {
  quote: DemoQuoteResult;
}

export interface DemoSwapResult {
  success: boolean;
  txHash: string;
  error?: string;
  amountIn: number;
  amountOut: number;
  tokenIn: string;
  tokenOut: string;
}

/** Simulate network delay (1-2 seconds) */
function simulateNetworkDelay(): Promise<void> {
  const delay = 1000 + Math.random() * 1000;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Execute a simulated demo swap.
 * - Checks balance
 * - Simulates network delay
 * - Updates localStorage balances
 * - Returns fake transaction hash
 */
export async function executeDemoSwap(
  params: DemoSwapParams
): Promise<DemoSwapResult> {
  const { quote } = params;
  const { tokenIn, tokenOut, amountIn, amountOut } = quote;

  // Check sufficient balance
  if (!hasSufficientBalance(tokenIn, amountIn)) {
    return {
      success: false,
      txHash: "",
      error: `Insufficient ${tokenIn} balance`,
      amountIn,
      amountOut,
      tokenIn,
      tokenOut,
    };
  }

  // Simulate network delay
  await simulateNetworkDelay();

  // Record transaction and update balances
  const tx = recordDemoTransaction({
    type: "swap",
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
  });

  return {
    success: true,
    txHash: tx.txHash,
    amountIn,
    amountOut,
    tokenIn,
    tokenOut,
  };
}

/**
 * Simulate a demo lend operation.
 */
export async function executeDemoLend(params: {
  token: string;
  amount: number;
}): Promise<DemoSwapResult> {
  const { token, amount } = params;

  if (!hasSufficientBalance(token, amount)) {
    return {
      success: false,
      txHash: "",
      error: `Insufficient ${token} balance`,
      amountIn: amount,
      amountOut: amount,
      tokenIn: token,
      tokenOut: `l${token}`, // Lending receipt token
    };
  }

  await simulateNetworkDelay();

  const tx = recordDemoTransaction({
    type: "lend",
    tokenIn: token,
    tokenOut: `l${token}`,
    amountIn: amount,
    amountOut: amount,
  });

  return {
    success: true,
    txHash: tx.txHash,
    amountIn: amount,
    amountOut: amount,
    tokenIn: token,
    tokenOut: `l${token}`,
  };
}

/**
 * Simulate a demo borrow operation.
 */
export async function executeDemoBorrow(params: {
  collateralToken: string;
  collateralAmount: number;
  borrowToken: string;
  borrowAmount: number;
}): Promise<DemoSwapResult> {
  const { collateralToken, collateralAmount, borrowToken, borrowAmount } = params;

  if (!hasSufficientBalance(collateralToken, collateralAmount)) {
    return {
      success: false,
      txHash: "",
      error: `Insufficient ${collateralToken} balance for collateral`,
      amountIn: collateralAmount,
      amountOut: borrowAmount,
      tokenIn: collateralToken,
      tokenOut: borrowToken,
    };
  }

  await simulateNetworkDelay();

  const tx = recordDemoTransaction({
    type: "borrow",
    tokenIn: collateralToken,
    tokenOut: borrowToken,
    amountIn: collateralAmount,
    amountOut: borrowAmount,
  });

  return {
    success: true,
    txHash: tx.txHash,
    amountIn: collateralAmount,
    amountOut: borrowAmount,
    tokenIn: collateralToken,
    tokenOut: borrowToken,
  };
}
