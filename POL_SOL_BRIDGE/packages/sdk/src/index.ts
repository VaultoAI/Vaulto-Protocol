/**
 * @vaulto/bridge-sdk
 *
 * TypeScript SDK for PreStock Token Bridge (Solana ↔ Polygon)
 * using Wormhole Native Token Transfers (NTT)
 */

// Core bridge functionality
export { PreStockBridge, type BridgeConfig, type TransferQuote, type TransferResult } from "./bridge.js";

// Token registry
export {
  PRESTOCK_TOKENS,
  CHAINS,
  type PreStockToken,
  type ChainName,
  getToken,
  getTokenBySolanaMint,
  getTokenByPolygonAddress,
  getAllTokenIds,
  getAllTokens,
} from "./tokens.js";

// Supply monitoring
export {
  SupplyMonitor,
  formatTokenAmount,
  type SupplyCheckResult,
  type SupplyViolation,
  type MonitorConfig,
} from "./monitoring/supply.js";
