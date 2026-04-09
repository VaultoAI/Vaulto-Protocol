/**
 * Supply Invariant Monitoring
 *
 * Monitors that the supply invariant holds:
 * Solana Locked Tokens >= Polygon Minted Tokens
 *
 * If this invariant is violated, tokens may have been minted
 * without corresponding locks, indicating a potential exploit.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, getMint } from "@solana/spl-token";
import { createPublicClient, http, type PublicClient } from "viem";
import { polygon } from "viem/chains";
import { getAllTokens, type PreStockToken } from "../tokens.js";

/**
 * Supply check result for a single token
 */
export interface SupplyCheckResult {
  token: PreStockToken;
  /** Amount locked in NTT custody on Solana */
  solanaLocked: bigint;
  /** Total supply minted on Polygon */
  polygonSupply: bigint;
  /** Whether the invariant holds (solanaLocked >= polygonSupply) */
  isValid: boolean;
  /** Difference: solanaLocked - polygonSupply (negative = violation) */
  difference: bigint;
  /** Timestamp of the check */
  timestamp: Date;
}

/**
 * Supply violation alert
 */
export interface SupplyViolation {
  token: PreStockToken;
  solanaLocked: bigint;
  polygonSupply: bigint;
  difference: bigint;
  timestamp: Date;
  severity: "warning" | "critical";
}

/**
 * Configuration for supply monitoring
 */
export interface MonitorConfig {
  /** Solana RPC URL */
  solanaRpcUrl: string;
  /** Polygon RPC URL */
  polygonRpcUrl: string;
  /** NTT custody account addresses on Solana (token mint -> custody address) */
  nttCustodyAccounts: Record<string, string>;
  /** Callback when a violation is detected */
  onViolation?: (violation: SupplyViolation) => void;
}

/**
 * ABI for ERC-20 totalSupply call
 */
const ERC20_ABI = [
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Supply Monitor
 *
 * Continuously monitors the supply invariant across chains.
 */
export class SupplyMonitor {
  private solanaConnection: Connection;
  private polygonClient: PublicClient;
  private nttCustodyAccounts: Record<string, string>;
  private onViolation?: (violation: SupplyViolation) => void;
  private intervalId?: NodeJS.Timeout;

  constructor(config: MonitorConfig) {
    this.solanaConnection = new Connection(config.solanaRpcUrl, "confirmed");
    this.polygonClient = createPublicClient({
      chain: polygon,
      transport: http(config.polygonRpcUrl),
    });
    this.nttCustodyAccounts = config.nttCustodyAccounts;
    this.onViolation = config.onViolation;
  }

  /**
   * Check supply invariant for a single token
   */
  async checkSupplyInvariant(token: PreStockToken): Promise<SupplyCheckResult> {
    const custodyAddress = this.nttCustodyAccounts[token.solanaMint];
    if (!custodyAddress) {
      throw new Error(`No custody account configured for token: ${token.id}`);
    }
    if (!token.polygonAddress) {
      throw new Error(`No Polygon address configured for token: ${token.id}`);
    }

    // Get Solana locked amount (tokens in NTT custody)
    const custodyPubkey = new PublicKey(custodyAddress);
    const custodyAccount = await getAccount(this.solanaConnection, custodyPubkey);
    const solanaLocked = custodyAccount.amount;

    // Get Polygon total supply
    const polygonSupply = await this.polygonClient.readContract({
      address: token.polygonAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "totalSupply",
    });

    const difference = solanaLocked - polygonSupply;
    const isValid = difference >= BigInt(0);

    const result: SupplyCheckResult = {
      token,
      solanaLocked,
      polygonSupply,
      isValid,
      difference,
      timestamp: new Date(),
    };

    // Trigger violation callback if invariant is violated
    if (!isValid && this.onViolation) {
      const severity = difference < BigInt(-1000) * BigInt(10) ** BigInt(8) ? "critical" : "warning";
      this.onViolation({
        token,
        solanaLocked,
        polygonSupply,
        difference,
        timestamp: result.timestamp,
        severity,
      });
    }

    return result;
  }

  /**
   * Check supply invariant for all tokens
   */
  async checkAllSupplyInvariants(): Promise<SupplyCheckResult[]> {
    const tokens = getAllTokens().filter((t) => t.polygonAddress !== null);
    const results = await Promise.all(
      tokens.map((token) =>
        this.checkSupplyInvariant(token).catch((error) => {
          console.error(`Failed to check supply for ${token.id}:`, error);
          return null;
        })
      )
    );
    return results.filter((r): r is SupplyCheckResult => r !== null);
  }

  /**
   * Start continuous monitoring
   *
   * @param intervalMs - Check interval in milliseconds (default: 60000 = 1 minute)
   */
  startContinuousMonitoring(intervalMs: number = 60000): void {
    if (this.intervalId) {
      console.warn("Monitoring already running");
      return;
    }

    console.log(`Starting supply monitoring with ${intervalMs}ms interval`);

    // Run immediately
    this.runCheck();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.runCheck();
    }, intervalMs);
  }

  /**
   * Stop continuous monitoring
   */
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log("Supply monitoring stopped");
    }
  }

  /**
   * Run a single check cycle
   */
  private async runCheck(): Promise<void> {
    try {
      const results = await this.checkAllSupplyInvariants();

      const violations = results.filter((r) => !r.isValid);
      if (violations.length > 0) {
        console.error(`SUPPLY VIOLATIONS DETECTED: ${violations.length} tokens`);
        for (const v of violations) {
          console.error(
            `  ${v.token.symbol}: locked=${v.solanaLocked}, supply=${v.polygonSupply}, diff=${v.difference}`
          );
        }
      } else {
        console.log(`Supply check passed: ${results.length} tokens verified`);
      }
    } catch (error) {
      console.error("Supply check failed:", error);
    }
  }
}

/**
 * Format token amount for display
 *
 * @param amount - Amount in token decimals (8)
 * @param decimals - Number of decimals (default: 8)
 */
export function formatTokenAmount(amount: bigint, decimals: number = 8): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionStr = fraction.toString().padStart(decimals, "0");
  return `${whole}.${fractionStr}`;
}

export default SupplyMonitor;
