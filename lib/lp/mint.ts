import type { Address } from "viem";
import { UNISWAP_ADDRESSES } from "@/lib/uniswap/constants";
import { NONFUNGIBLE_POSITION_MANAGER_ABI } from "@/lib/uniswap/abis";

const DEFAULT_DEADLINE_SECONDS = 20 * 60;
const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%

function applySlippage(amount: bigint, slippageBps: number): bigint {
  if (slippageBps >= 10000) return BigInt(0);
  return (amount * BigInt(10000 - slippageBps)) / BigInt(10000);
}

export type MintParams = {
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  recipient: Address;
  slippageBps?: number;
  deadlineSeconds?: number;
};

/**
 * Build NPM.mint call params for use with writeContract.
 */
export function buildMintParams(params: MintParams): {
  address: Address;
  abi: typeof NONFUNGIBLE_POSITION_MANAGER_ABI;
  functionName: "mint";
  args: [
    {
      token0: Address;
      token1: Address;
      fee: number;
      tickLower: number;
      tickUpper: number;
      amount0Desired: bigint;
      amount1Desired: bigint;
      amount0Min: bigint;
      amount1Min: bigint;
      recipient: Address;
      deadline: bigint;
    }
  ];
  value?: bigint;
} {
  const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  const deadlineSeconds = params.deadlineSeconds ?? DEFAULT_DEADLINE_SECONDS;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);
  const amount0Min = applySlippage(params.amount0Desired, slippageBps);
  const amount1Min = applySlippage(params.amount1Desired, slippageBps);

  return {
    address: UNISWAP_ADDRESSES.NonfungiblePositionManager,
    abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
    functionName: "mint",
    args: [
      {
        token0: params.token0,
        token1: params.token1,
        fee: params.fee,
        tickLower: params.tickLower,
        tickUpper: params.tickUpper,
        amount0Desired: params.amount0Desired,
        amount1Desired: params.amount1Desired,
        amount0Min,
        amount1Min,
        recipient: params.recipient,
        deadline,
      },
    ],
  };
}

/**
 * Get tick spacing for a fee tier (Uniswap V3).
 */
export function getTickSpacing(fee: number): number {
  switch (fee) {
    case 500:
      return 10;
    case 3000:
      return 60;
    case 10000:
      return 200;
    default:
      return 60;
  }
}

/**
 * Full-range tick bounds for a fee tier (simplified: use min/max aligned to tick spacing).
 */
export function getFullRangeTicks(fee: number): { tickLower: number; tickUpper: number } {
  const spacing = getTickSpacing(fee);
  const minTick = -887272;
  const maxTick = 887272;
  const tickLower = Math.floor(minTick / spacing) * spacing;
  const tickUpper = Math.ceil(maxTick / spacing) * spacing;
  return { tickLower, tickUpper };
}
