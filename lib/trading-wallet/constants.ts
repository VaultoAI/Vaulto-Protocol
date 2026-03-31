/**
 * Trading Wallet Constants
 * USDC contract addresses and configuration for the trading wallet system
 */

// USDC Contract Addresses
export const USDC_ADDRESSES = {
  // Polygon - Native USDC (recommended)
  POLYGON_NATIVE: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" as const,
  // Polygon - USDC.e (bridged from Ethereum)
  POLYGON_BRIDGED: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const,
  // Ethereum Mainnet - Native USDC
  ETHEREUM: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
} as const;

// Chain IDs
export const CHAIN_IDS = {
  POLYGON: 137,
  ETHEREUM: 1,
} as const;

// Default trading chain
export const DEFAULT_TRADING_CHAIN_ID = CHAIN_IDS.POLYGON;

// USDC decimals (same across all chains)
export const USDC_DECIMALS = 6;

// Withdrawal Limits by Tier (in USD)
export const WITHDRAWAL_LIMITS = {
  STANDARD: {
    daily: 10_000,
    mfaThreshold: 5_000,
    singleTx: 50_000,
  },
  VERIFIED: {
    daily: 100_000,
    mfaThreshold: 25_000,
    singleTx: 500_000,
  },
  INSTITUTIONAL: {
    daily: 1_000_000,
    mfaThreshold: 100_000,
    singleTx: 5_000_000,
  },
} as const;

// Default user tier
export const DEFAULT_USER_TIER = "STANDARD" as const;

// Minimum deposit amount (in USDC, includes decimals consideration)
export const MIN_DEPOSIT_AMOUNT = 1; // $1 USDC

// Block confirmations required for deposits
export const DEPOSIT_CONFIRMATIONS = {
  POLYGON: 64, // ~2.5 minutes on Polygon
  ETHEREUM: 12, // ~2.5 minutes on Ethereum
} as const;

// ERC20 ABI for USDC operations (minimal subset needed)
export const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "decimals",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;
