/**
 * Types for the LP (Liquidity Providing) demo system
 */

export interface LPPosition {
  id: string;
  poolId: string;
  poolName: string;           // "vSpaceX / USDC"
  tokenSymbol: string;        // "vSpaceX"
  companyId: number;
  companyName: string;
  companyWebsite?: string;
  tokenAmount: number;
  usdcAmount: number;
  totalValueUsd: number;
  sharePercent: number;
  unclaimedFees: number;
  apr: number;
  createdAt: number;
}

export interface PoolInfo {
  poolId: string;
  poolName: string;
  tokenSymbol: string;
  companyId: number;
  companyName: string;
  companyWebsite?: string;
  tvlUSD: number;
  volume24h: number;
  apr: number;
  feeRate: number;           // e.g., 0.003 for 0.3%
}

export interface AddLiquidityParams {
  poolId: string;
  poolName: string;
  tokenSymbol: string;
  companyId: number;
  companyName: string;
  companyWebsite?: string;
  tokenAmount: number;
  usdcAmount: number;
  apr: number;
  poolTvl: number;
}

export interface RemoveLiquidityParams {
  positionId: string;
  percentToRemove: number;   // 0-100
  claimFees: boolean;
}

export interface LPTransaction {
  id: string;
  timestamp: number;
  type: "add_liquidity" | "remove_liquidity" | "claim_fees";
  positionId: string;
  poolName: string;
  tokenAmount: number;
  usdcAmount: number;
  feesAmount?: number;
  txHash: string;
}
