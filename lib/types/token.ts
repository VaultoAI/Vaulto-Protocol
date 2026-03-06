/** Token type discriminator */
export type TokenType = "onchain" | "demo" | "prediction";

/** Demo token representing a private company stock (simulated) */
export interface DemoToken {
  type: "demo";
  symbol: string;
  name: string;
  companyId: number;
  pricePerShareUsd: number;
  valuationUsd: number;
}

/** On-chain token (real ERC20 deployed on blockchain) */
export interface OnchainToken {
  type: "onchain";
  symbol: string;
  name: string;
  address: string;
  decimals: number;
}

/** Prediction token representing a Polymarket outcome position */
export interface PredictionToken {
  type: "prediction";
  symbol: string;           // e.g., "pOpenAI-YES"
  name: string;             // Market question
  marketId: string;
  outcome: string;          // "Yes" or "No"
  outcomeIndex: number;
  price: number;            // 0.0-1.0
  clobTokenId: string;
}

/** Unified token type for real, demo, and prediction tokens */
export type UnifiedToken = OnchainToken | DemoToken | PredictionToken;

/** Type guard to check if token is a demo token */
export function isDemoToken(token: UnifiedToken): token is DemoToken {
  return token.type === "demo";
}

/** Type guard to check if token is an on-chain token */
export function isOnchainToken(token: UnifiedToken): token is OnchainToken {
  return token.type === "onchain";
}

/** Type guard to check if token is a prediction token */
export function isPredictionToken(token: UnifiedToken): token is PredictionToken {
  return token.type === "prediction";
}

/** Check if a symbol represents a demo token */
export function isDemoSymbol(symbol: string, demoSymbols: Set<string>): boolean {
  return demoSymbols.has(symbol);
}
