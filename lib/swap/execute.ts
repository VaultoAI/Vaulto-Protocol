import type { Address } from "viem";
import { UNISWAP_ADDRESSES } from "@/lib/uniswap/constants";
import { SWAP_ROUTER_02_ABI } from "@/lib/uniswap/abis";
import { applySlippage } from "./quote";

const DEFAULT_DEADLINE_SECONDS = 20 * 60; // 20 minutes
const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%

export type ExactInputSingleParams = {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  recipient: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
  deadline?: number;
  sqrtPriceLimitX96?: bigint;
};

/**
 * Build SwapRouter02.exactInputSingle call params (for use with writeContract).
 */
export function buildExactInputSingleParams(params: {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  recipient: Address;
  amountIn: bigint;
  quotedAmountOut: bigint;
  slippageBps?: number;
  deadlineSeconds?: number;
}): {
  address: Address;
  abi: typeof SWAP_ROUTER_02_ABI;
  functionName: "exactInputSingle";
  args: [
    {
      tokenIn: Address;
      tokenOut: Address;
      fee: number;
      recipient: Address;
      deadline: bigint;
      amountIn: bigint;
      amountOutMinimum: bigint;
      sqrtPriceLimitX96: bigint;
    }
  ];
  value?: bigint;
} {
  const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  const deadlineSeconds = params.deadlineSeconds ?? DEFAULT_DEADLINE_SECONDS;
  const amountOutMinimum = applySlippage(params.quotedAmountOut, slippageBps);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

  return {
    address: UNISWAP_ADDRESSES.SwapRouter02,
    abi: SWAP_ROUTER_02_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        fee: params.fee,
        recipient: params.recipient,
        deadline,
        amountIn: params.amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
  };
}
