#!/usr/bin/env tsx
/**
 * Supply Verification CLI
 *
 * Run: pnpm --filter @vaulto/bridge-sdk verify-supply
 */

import { SupplyMonitor, formatTokenAmount, type SupplyCheckResult } from "./supply.js";
import { getAllTokens } from "../tokens.js";

// Load environment variables
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com";

// NTT custody accounts (to be populated after NTT deployment)
// Maps: Solana token mint -> NTT custody account address
const NTT_CUSTODY_ACCOUNTS: Record<string, string> = {
  // TODO: Populate after NTT deployment
  // "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh": "CUSTODY_ACCOUNT_ADDRESS",
};

async function main(): Promise<void> {
  console.log("PreStock Bridge Supply Verification");
  console.log("===================================\n");

  const tokens = getAllTokens();
  const configuredTokens = tokens.filter(
    (t) => t.polygonAddress !== null && NTT_CUSTODY_ACCOUNTS[t.solanaMint]
  );

  if (configuredTokens.length === 0) {
    console.log("No tokens configured for supply verification.");
    console.log("\nTo configure tokens:");
    console.log("1. Deploy ERC-20 contracts to Polygon");
    console.log("2. Update PRESTOCK_TOKENS in packages/sdk/src/tokens.ts with Polygon addresses");
    console.log("3. Deploy NTT infrastructure and update NTT_CUSTODY_ACCOUNTS in this file");
    console.log("\nAvailable tokens:");
    for (const token of tokens) {
      console.log(`  - ${token.symbol} (${token.id})`);
      console.log(`    Solana: ${token.solanaMint}`);
      console.log(`    Polygon: ${token.polygonAddress ?? "Not deployed"}`);
    }
    return;
  }

  console.log(`Checking ${configuredTokens.length} token(s)...\n`);
  console.log(`Solana RPC: ${SOLANA_RPC_URL}`);
  console.log(`Polygon RPC: ${POLYGON_RPC_URL}\n`);

  const monitor = new SupplyMonitor({
    solanaRpcUrl: SOLANA_RPC_URL,
    polygonRpcUrl: POLYGON_RPC_URL,
    nttCustodyAccounts: NTT_CUSTODY_ACCOUNTS,
    onViolation: (violation) => {
      console.error("\n⚠️  SUPPLY VIOLATION DETECTED!");
      console.error(`Token: ${violation.token.symbol}`);
      console.error(`Severity: ${violation.severity.toUpperCase()}`);
      console.error(`Solana Locked: ${formatTokenAmount(violation.solanaLocked)}`);
      console.error(`Polygon Supply: ${formatTokenAmount(violation.polygonSupply)}`);
      console.error(`Difference: ${formatTokenAmount(violation.difference)}`);
    },
  });

  try {
    const results = await monitor.checkAllSupplyInvariants();
    printResults(results);

    const hasViolations = results.some((r) => !r.isValid);
    process.exit(hasViolations ? 1 : 0);
  } catch (error) {
    console.error("Supply verification failed:", error);
    process.exit(1);
  }
}

function printResults(results: SupplyCheckResult[]): void {
  console.log("Results:");
  console.log("-".repeat(80));

  for (const result of results) {
    const status = result.isValid ? "✅ VALID" : "❌ VIOLATION";
    console.log(`\n${result.token.symbol} (${result.token.id})`);
    console.log(`  Status: ${status}`);
    console.log(`  Solana Locked:  ${formatTokenAmount(result.solanaLocked)}`);
    console.log(`  Polygon Supply: ${formatTokenAmount(result.polygonSupply)}`);
    console.log(`  Difference:     ${formatTokenAmount(result.difference)}`);
  }

  console.log("\n" + "-".repeat(80));

  const valid = results.filter((r) => r.isValid).length;
  const violations = results.filter((r) => !r.isValid).length;
  console.log(`\nSummary: ${valid} valid, ${violations} violations`);
}

main().catch(console.error);
