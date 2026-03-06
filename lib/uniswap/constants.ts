/** Ethereum mainnet chainId */
export const MAINNET_CHAIN_ID = 1;

/** Uniswap V3 contract addresses (Ethereum mainnet). */
export const UNISWAP_ADDRESSES = {
  /** SwapRouter02 - Uniswap V2 + V3 router */
  SwapRouter02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45" as const,
  /** QuoterV2 - quote exact input/output without executing */
  QuoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e" as const,
  /** NonfungiblePositionManager - LP positions as NFTs */
  NonfungiblePositionManager:
    "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" as const,
} as const;
