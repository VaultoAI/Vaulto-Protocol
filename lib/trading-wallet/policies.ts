/**
 * Trading Wallet Policy Configuration
 * Defines withdrawal limits, MFA requirements, and contract allowlists
 */

import { WITHDRAWAL_LIMITS, USDC_ADDRESSES, CHAIN_IDS, PUSD_ADDRESS } from "./constants";

export type UserTier = "STANDARD" | "VERIFIED" | "INSTITUTIONAL";

export interface WithdrawalPolicy {
  dailyLimit: number;
  mfaThreshold: number;
  singleTxLimit: number;
}

/**
 * Get withdrawal policy for a user tier
 */
export function getWithdrawalPolicy(tier: UserTier): WithdrawalPolicy {
  const limits = WITHDRAWAL_LIMITS[tier];
  return {
    dailyLimit: limits.daily,
    mfaThreshold: limits.mfaThreshold,
    singleTxLimit: limits.singleTx,
  };
}

/**
 * Check if a withdrawal amount requires MFA
 */
export function requiresMfa(amount: number, tier: UserTier): boolean {
  const policy = getWithdrawalPolicy(tier);
  return amount >= policy.mfaThreshold;
}

/**
 * Check if a withdrawal amount exceeds single transaction limit
 */
export function exceedsSingleTxLimit(amount: number, tier: UserTier): boolean {
  const policy = getWithdrawalPolicy(tier);
  return amount > policy.singleTxLimit;
}

/**
 * Calculate remaining daily withdrawal limit
 */
export function getRemainingDailyLimit(
  tier: UserTier,
  withdrawnToday: number
): number {
  const policy = getWithdrawalPolicy(tier);
  return Math.max(0, policy.dailyLimit - withdrawnToday);
}

/**
 * Validate withdrawal amount against all limits
 */
export function validateWithdrawalAmount(
  amount: number,
  tier: UserTier,
  withdrawnToday: number = 0
): {
  valid: boolean;
  error?: string;
  requiresMfa: boolean;
} {
  const policy = getWithdrawalPolicy(tier);

  // Check single transaction limit
  if (amount > policy.singleTxLimit) {
    return {
      valid: false,
      error: `Amount exceeds single transaction limit of $${policy.singleTxLimit.toLocaleString()}`,
      requiresMfa: false,
    };
  }

  // Check daily limit
  const remainingDaily = getRemainingDailyLimit(tier, withdrawnToday);
  if (amount > remainingDaily) {
    return {
      valid: false,
      error: `Amount exceeds remaining daily limit of $${remainingDaily.toLocaleString()}`,
      requiresMfa: false,
    };
  }

  // Check if MFA required
  const needsMfa = requiresMfa(amount, tier);

  return {
    valid: true,
    requiresMfa: needsMfa,
  };
}

/**
 * Allowlisted contract addresses for trading operations
 */
export const ALLOWLISTED_CONTRACTS = {
  // Stable tokens. USDC.e retained for residual-balance handling on legacy
  // wallets; new flow holds only USDC native on EOA and pUSD on Safe.
  tokens: [
    USDC_ADDRESSES.POLYGON_NATIVE,
    USDC_ADDRESSES.POLYGON_BRIDGED,
    PUSD_ADDRESS,
  ],
  // Add trading protocol contracts here as they're integrated
  trading: [] as string[],
} as const;

/**
 * Check if a contract address is allowlisted
 */
export function isContractAllowlisted(address: string): boolean {
  const normalizedAddress = address.toLowerCase();

  return (
    ALLOWLISTED_CONTRACTS.tokens.some(
      (addr) => addr.toLowerCase() === normalizedAddress
    ) ||
    ALLOWLISTED_CONTRACTS.trading.some(
      (addr) => addr.toLowerCase() === normalizedAddress
    )
  );
}

/**
 * Get USDC contract address for a chain
 */
export function getUsdcAddress(chainId: number): string | null {
  switch (chainId) {
    case CHAIN_IDS.POLYGON:
      return USDC_ADDRESSES.POLYGON_NATIVE;
    case CHAIN_IDS.ETHEREUM:
      return USDC_ADDRESSES.ETHEREUM;
    default:
      return null;
  }
}
