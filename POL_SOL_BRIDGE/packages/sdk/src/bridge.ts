/**
 * PreStock Bridge SDK
 *
 * Core bridge logic for transferring PreStock tokens between Solana and Polygon
 * using Wormhole Native Token Transfers (NTT).
 */

import {
  Wormhole,
  type Network,
  type Signer,
} from "@wormhole-foundation/sdk";
import { getToken, type PreStockToken, CHAINS, type ChainName } from "./tokens.js";

/**
 * Bridge configuration
 */
export interface BridgeConfig {
  /** Wormhole network (Mainnet, Testnet, Devnet) */
  network: Network;
  /** Solana RPC URL */
  solanaRpcUrl?: string;
  /** Polygon RPC URL */
  polygonRpcUrl?: string;
}

/**
 * Transfer quote with fees
 */
export interface TransferQuote {
  /** Token being transferred */
  token: PreStockToken;
  /** Amount in token decimals */
  amount: bigint;
  /** Source chain */
  sourceChain: ChainName;
  /** Destination chain */
  destChain: ChainName;
  /** Estimated relayer fee (in native token of source chain) */
  relayerFee: bigint;
  /** Estimated delivery time in seconds */
  estimatedDeliveryTime: number;
}

/**
 * Transfer result
 */
export interface TransferResult {
  /** Wormhole transaction ID */
  txId: string;
  /** Source chain transaction hash */
  sourceTxHash: string;
  /** VAA (Verified Action Approval) hash */
  vaaHash?: string;
  /** Status */
  status: "pending" | "completed" | "failed";
}

/**
 * PreStock Bridge SDK
 *
 * Handles cross-chain transfers of PreStock tokens between Solana and Polygon.
 *
 * @example
 * ```typescript
 * const bridge = await PreStockBridge.create({ network: "Mainnet" });
 * const quote = await bridge.getTransferQuote("spacex", 100n * 10n ** 8n, "Solana");
 * const result = await bridge.bridgeSolanaToPolygon(
 *   "spacex",
 *   100n * 10n ** 8n,
 *   solanaSigner,
 *   "0x..."
 * );
 * ```
 */
export class PreStockBridge {
  private wormhole: Wormhole<Network>;
  private config: BridgeConfig;

  private constructor(wormhole: Wormhole<Network>, config: BridgeConfig) {
    this.wormhole = wormhole;
    this.config = config;
  }

  /**
   * Create a new PreStockBridge instance
   */
  static async create(config: BridgeConfig): Promise<PreStockBridge> {
    // Import platform-specific modules dynamically
    const [solana, evm] = await Promise.all([
      import("@wormhole-foundation/sdk-solana"),
      import("@wormhole-foundation/sdk-evm"),
    ]);

    // Type assertions needed due to ESM/CJS type incompatibilities in Wormhole SDK
    // This will be properly typed when NTT routes are configured
    const wormhole = new Wormhole(config.network, [
      solana.SolanaPlatform as any,
      evm.EvmPlatform as any,
    ]);

    return new PreStockBridge(wormhole, config);
  }

  /**
   * Get a transfer quote
   *
   * @param tokenId - Token identifier (e.g., "spacex")
   * @param amount - Amount in token decimals (8 decimals)
   * @param sourceChain - Source chain ("Solana" or "Polygon")
   */
  async getTransferQuote(
    tokenId: string,
    amount: bigint,
    sourceChain: ChainName
  ): Promise<TransferQuote> {
    const token = getToken(tokenId);
    if (!token) {
      throw new Error(`Unknown token: ${tokenId}`);
    }

    const destChain = sourceChain === CHAINS.SOLANA ? CHAINS.POLYGON : CHAINS.SOLANA;

    // Get relayer fee estimate from Wormhole
    // In production, this would query the actual relayer for fees
    const relayerFee = await this.estimateRelayerFee(sourceChain);

    return {
      token,
      amount,
      sourceChain,
      destChain,
      relayerFee,
      estimatedDeliveryTime: sourceChain === CHAINS.SOLANA ? 180 : 300, // seconds
    };
  }

  /**
   * Bridge tokens from Solana to Polygon
   *
   * Locks tokens on Solana and mints equivalent tokens on Polygon.
   *
   * @param tokenId - Token identifier (e.g., "spacex")
   * @param amount - Amount in token decimals (8 decimals)
   * @param solanaSigner - Solana signer (wallet)
   * @param polygonRecipient - Recipient address on Polygon (0x...)
   */
  async bridgeSolanaToPolygon(
    _tokenId: string,
    _amount: bigint,
    _solanaSigner: Signer,
    _polygonRecipient: string
  ): Promise<TransferResult> {
    // TODO: Implement NTT route handling after deployment
    // The Wormhole SDK API for NTT routes requires configuration
    // that will be added after contracts are deployed
    throw new Error(
      "NTT bridge not yet configured. Deploy NTT contracts and configure routes first."
    );
  }

  /**
   * Bridge tokens from Polygon to Solana
   *
   * Burns tokens on Polygon and unlocks equivalent tokens on Solana.
   *
   * @param tokenId - Token identifier (e.g., "spacex")
   * @param amount - Amount in token decimals (8 decimals)
   * @param polygonSigner - Polygon signer (wallet)
   * @param solanaRecipient - Recipient address on Solana (base58)
   */
  async bridgePolygonToSolana(
    _tokenId: string,
    _amount: bigint,
    _polygonSigner: Signer,
    _solanaRecipient: string
  ): Promise<TransferResult> {
    // TODO: Implement NTT route handling after deployment
    // The Wormhole SDK API for NTT routes requires configuration
    // that will be added after contracts are deployed
    throw new Error(
      "NTT bridge not yet configured. Deploy NTT contracts and configure routes first."
    );
  }

  /**
   * Get transfer status
   *
   * @param txId - Wormhole transaction ID
   */
  async getTransferStatus(txId: string): Promise<TransferResult> {
    // In production, query Wormhole for transfer status
    // This is a placeholder implementation
    return {
      txId,
      sourceTxHash: "",
      status: "pending",
    };
  }

  /**
   * Estimate relayer fee
   */
  private async estimateRelayerFee(sourceChain: ChainName): Promise<bigint> {
    // Placeholder: In production, query the actual relayer
    // Fees are in native token (SOL or MATIC)
    if (sourceChain === CHAINS.SOLANA) {
      return BigInt(10_000_000); // 0.01 SOL (in lamports)
    } else {
      return BigInt("100000000000000000"); // 0.1 MATIC (in wei)
    }
  }
}

export default PreStockBridge;
