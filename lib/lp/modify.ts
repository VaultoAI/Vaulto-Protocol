import type { Address } from "viem";
import { UNISWAP_ADDRESSES } from "@/lib/uniswap/constants";
import { NONFUNGIBLE_POSITION_MANAGER_ABI } from "@/lib/uniswap/abis";

const DEFAULT_DEADLINE_SECONDS = 20 * 60;
const DEFAULT_SLIPPAGE_BPS = 50;

function applySlippage(amount: bigint, slippageBps: number): bigint {
  if (slippageBps >= 10000) return BigInt(0);
  return (amount * BigInt(10000 - slippageBps)) / BigInt(10000);
}

export type IncreaseLiquidityParams = {
  tokenId: bigint;
  amount0Desired: bigint;
  amount1Desired: bigint;
  slippageBps?: number;
  deadlineSeconds?: number;
};

export function buildIncreaseLiquidityParams(
  params: IncreaseLiquidityParams
): {
  address: Address;
  abi: typeof NONFUNGIBLE_POSITION_MANAGER_ABI;
  functionName: "increaseLiquidity";
  args: [
    {
      tokenId: bigint;
      amount0Desired: bigint;
      amount1Desired: bigint;
      amount0Min: bigint;
      amount1Min: bigint;
      deadline: bigint;
    }
  ];
} {
  const deadline =
    BigInt(Math.floor(Date.now() / 1000) + (params.deadlineSeconds ?? DEFAULT_DEADLINE_SECONDS));
  const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  return {
    address: UNISWAP_ADDRESSES.NonfungiblePositionManager,
    abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
    functionName: "increaseLiquidity",
    args: [
      {
        tokenId: params.tokenId,
        amount0Desired: params.amount0Desired,
        amount1Desired: params.amount1Desired,
        amount0Min: applySlippage(params.amount0Desired, slippageBps),
        amount1Min: applySlippage(params.amount1Desired, slippageBps),
        deadline,
      },
    ],
  };
}

export type DecreaseLiquidityParams = {
  tokenId: bigint;
  liquidity: bigint;
  amount0Min?: bigint;
  amount1Min?: bigint;
  deadlineSeconds?: number;
};

export function buildDecreaseLiquidityParams(
  params: DecreaseLiquidityParams
): {
  address: Address;
  abi: typeof NONFUNGIBLE_POSITION_MANAGER_ABI;
  functionName: "decreaseLiquidity";
  args: [
    {
      tokenId: bigint;
      liquidity: bigint;
      amount0Min: bigint;
      amount1Min: bigint;
      deadline: bigint;
    }
  ];
} {
  const deadline =
    BigInt(Math.floor(Date.now() / 1000) + (params.deadlineSeconds ?? DEFAULT_DEADLINE_SECONDS));
  return {
    address: UNISWAP_ADDRESSES.NonfungiblePositionManager,
    abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
    functionName: "decreaseLiquidity",
    args: [
      {
        tokenId: params.tokenId,
        liquidity: params.liquidity,
        amount0Min: params.amount0Min ?? BigInt(0),
        amount1Min: params.amount1Min ?? BigInt(0),
        deadline,
      },
    ],
  };
}

export type CollectParams = {
  tokenId: bigint;
  recipient: Address;
  amount0Max?: bigint;
  amount1Max?: bigint;
};

/** Max uint128 for collecting all owed tokens. */
const MAX_U128 = BigInt("0xffffffffffffffffffffffffffffffff");

export function buildCollectParams(params: CollectParams): {
  address: Address;
  abi: typeof NONFUNGIBLE_POSITION_MANAGER_ABI;
  functionName: "collect";
  args: [
    {
      tokenId: bigint;
      recipient: Address;
      amount0Max: bigint;
      amount1Max: bigint;
    }
  ];
} {
  return {
    address: UNISWAP_ADDRESSES.NonfungiblePositionManager,
    abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
    functionName: "collect",
    args: [
      {
        tokenId: params.tokenId,
        recipient: params.recipient,
        amount0Max: params.amount0Max ?? MAX_U128,
        amount1Max: params.amount1Max ?? MAX_U128,
      },
    ],
  };
}
