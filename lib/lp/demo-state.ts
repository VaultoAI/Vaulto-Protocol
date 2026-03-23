/**
 * Demo state management for LP (Liquidity Providing) positions.
 * Stores positions in localStorage for persistence across sessions.
 */

import type { LPPosition, LPTransaction, AddLiquidityParams, RemoveLiquidityParams } from "./types";

const LP_STATE_KEY = "vaulto_lp_state";

export interface LPState {
  positions: LPPosition[];
  transactions: LPTransaction[];
}

function generateDemoTxHash(): string {
  const randomHex = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return `0xdemo${randomHex.slice(0, 60)}`;
}

function getInitialState(): LPState {
  return {
    positions: [],
    transactions: [],
  };
}

/** Get current LP state from localStorage */
export function getLPState(): LPState {
  if (typeof window === "undefined") {
    return getInitialState();
  }
  try {
    const stored = localStorage.getItem(LP_STATE_KEY);
    if (!stored) return getInitialState();
    return JSON.parse(stored) as LPState;
  } catch {
    return getInitialState();
  }
}

/** Save LP state to localStorage */
function saveLPState(state: LPState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LP_STATE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be full or disabled
  }
}

/** Get all LP positions */
export function getLPPositions(): LPPosition[] {
  return getLPState().positions;
}

/** Get a specific LP position by ID */
export function getLPPosition(positionId: string): LPPosition | undefined {
  return getLPState().positions.find((p) => p.id === positionId);
}

/** Add liquidity to a pool */
export function addLiquidity(params: AddLiquidityParams): { position: LPPosition; transaction: LPTransaction } {
  const state = getLPState();
  const txHash = generateDemoTxHash();

  // Check if position already exists for this pool
  const existingIndex = state.positions.findIndex((p) => p.poolId === params.poolId);

  const totalValue = params.tokenAmount + params.usdcAmount;
  // Calculate share based on TVL (newValue / (TVL + newValue))
  const newTvl = params.poolTvl + totalValue;
  const sharePercent = (totalValue / newTvl) * 100;

  let position: LPPosition;

  if (existingIndex >= 0) {
    // Update existing position
    const existing = state.positions[existingIndex];
    const newTokenAmount = existing.tokenAmount + params.tokenAmount;
    const newUsdcAmount = existing.usdcAmount + params.usdcAmount;
    const newTotalValue = newTokenAmount + newUsdcAmount;
    // Recalculate share based on new value
    const newSharePercent = (newTotalValue / (params.poolTvl + newTotalValue)) * 100;

    position = {
      ...existing,
      tokenAmount: newTokenAmount,
      usdcAmount: newUsdcAmount,
      totalValueUsd: newTotalValue,
      sharePercent: newSharePercent,
      apr: params.apr,
    };
    state.positions[existingIndex] = position;
  } else {
    // Create new position
    position = {
      id: crypto.randomUUID(),
      poolId: params.poolId,
      poolName: params.poolName,
      tokenSymbol: params.tokenSymbol,
      companyId: params.companyId,
      companyName: params.companyName,
      companyWebsite: params.companyWebsite,
      tokenAmount: params.tokenAmount,
      usdcAmount: params.usdcAmount,
      totalValueUsd: totalValue,
      sharePercent,
      unclaimedFees: 0,
      apr: params.apr,
      createdAt: Date.now(),
    };
    state.positions.push(position);
  }

  const transaction: LPTransaction = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: "add_liquidity",
    positionId: position.id,
    poolName: params.poolName,
    tokenAmount: params.tokenAmount,
    usdcAmount: params.usdcAmount,
    txHash,
  };

  // Keep last 50 transactions
  state.transactions = [transaction, ...state.transactions].slice(0, 50);

  saveLPState(state);
  return { position, transaction };
}

/** Remove liquidity from a position */
export function removeLiquidity(params: RemoveLiquidityParams): { position: LPPosition | null; transaction: LPTransaction } | null {
  const state = getLPState();
  const positionIndex = state.positions.findIndex((p) => p.id === params.positionId);

  if (positionIndex < 0) return null;

  const position = state.positions[positionIndex];
  const txHash = generateDemoTxHash();
  const removeRatio = params.percentToRemove / 100;

  const tokenAmountRemoved = position.tokenAmount * removeRatio;
  const usdcAmountRemoved = position.usdcAmount * removeRatio;
  const feesCollected = params.claimFees ? position.unclaimedFees : 0;

  let updatedPosition: LPPosition | null = null;

  if (params.percentToRemove >= 100) {
    // Remove entire position
    state.positions.splice(positionIndex, 1);
  } else {
    // Partial removal
    const newTokenAmount = position.tokenAmount - tokenAmountRemoved;
    const newUsdcAmount = position.usdcAmount - usdcAmountRemoved;
    const newTotalValue = newTokenAmount + newUsdcAmount;
    const newSharePercent = position.sharePercent * (1 - removeRatio);

    updatedPosition = {
      ...position,
      tokenAmount: newTokenAmount,
      usdcAmount: newUsdcAmount,
      totalValueUsd: newTotalValue,
      sharePercent: newSharePercent,
      unclaimedFees: params.claimFees ? 0 : position.unclaimedFees,
    };
    state.positions[positionIndex] = updatedPosition;
  }

  const transaction: LPTransaction = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: "remove_liquidity",
    positionId: params.positionId,
    poolName: position.poolName,
    tokenAmount: tokenAmountRemoved,
    usdcAmount: usdcAmountRemoved,
    feesAmount: feesCollected,
    txHash,
  };

  state.transactions = [transaction, ...state.transactions].slice(0, 50);

  saveLPState(state);
  return { position: updatedPosition, transaction };
}

/** Claim fees from a position */
export function claimFees(positionId: string): { feesClaimed: number; transaction: LPTransaction } | null {
  const state = getLPState();
  const positionIndex = state.positions.findIndex((p) => p.id === positionId);

  if (positionIndex < 0) return null;

  const position = state.positions[positionIndex];
  const feesClaimed = position.unclaimedFees;

  if (feesClaimed <= 0) return null;

  const txHash = generateDemoTxHash();

  // Reset unclaimed fees
  state.positions[positionIndex] = {
    ...position,
    unclaimedFees: 0,
  };

  const transaction: LPTransaction = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: "claim_fees",
    positionId,
    poolName: position.poolName,
    tokenAmount: 0,
    usdcAmount: 0,
    feesAmount: feesClaimed,
    txHash,
  };

  state.transactions = [transaction, ...state.transactions].slice(0, 50);

  saveLPState(state);
  return { feesClaimed, transaction };
}

/** Simulate fee accrual for demo purposes */
export function simulateFeeAccrual(): void {
  const state = getLPState();

  state.positions = state.positions.map((position) => {
    // Simulate daily fees based on APR and total value
    // Daily rate = APR / 365
    const dailyRate = position.apr / 100 / 365;
    const dailyFees = position.totalValueUsd * dailyRate;

    return {
      ...position,
      unclaimedFees: position.unclaimedFees + dailyFees,
    };
  });

  saveLPState(state);
}

/** Get LP transaction history */
export function getLPTransactions(): LPTransaction[] {
  return getLPState().transactions;
}

/** Calculate total earnings from all positions */
export function getTotalEarnings(): number {
  const positions = getLPPositions();
  return positions.reduce((sum, p) => sum + p.unclaimedFees, 0);
}

/** Calculate total liquidity across all positions */
export function getTotalLiquidity(): number {
  const positions = getLPPositions();
  return positions.reduce((sum, p) => sum + p.totalValueUsd, 0);
}

/** Reset LP state to initial values */
export function resetLPState(): void {
  saveLPState(getInitialState());
}
