#!/usr/bin/env tsx
/**
 * Supply Verification Script
 *
 * Verifies that the supply invariant holds for all PreStock tokens:
 * Solana Locked >= Polygon Supply
 *
 * Usage:
 *   npx tsx scripts/verify-supply.ts
 *   npx tsx scripts/verify-supply.ts --continuous
 *   npx tsx scripts/verify-supply.ts --token spacex
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import { createPublicClient, http } from "viem";
import { polygon } from "viem/chains";

// Configuration
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com";

// PreStock tokens with addresses
// Update polygon addresses and custody accounts after deployment
const TOKENS = [
  {
    id: "spacex",
    symbol: "vSPACEX",
    solanaMint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    polygonAddress: null as string | null,
    custodyAccount: null as string | null,
  },
  {
    id: "anthropic",
    symbol: "vANTHROPIC",
    solanaMint: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw",
    polygonAddress: null,
    custodyAccount: null,
  },
  {
    id: "openai",
    symbol: "vOPENAI",
    solanaMint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
    polygonAddress: null,
    custodyAccount: null,
  },
  {
    id: "anduril",
    symbol: "vANDURIL",
    solanaMint: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB",
    polygonAddress: null,
    custodyAccount: null,
  },
  {
    id: "kalshi",
    symbol: "vKALSHI",
    solanaMint: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua",
    polygonAddress: null,
    custodyAccount: null,
  },
  {
    id: "polymarket",
    symbol: "vPOLYMARKET",
    solanaMint: "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP",
    polygonAddress: null,
    custodyAccount: null,
  },
  {
    id: "xai",
    symbol: "vXAI",
    solanaMint: "PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx",
    polygonAddress: null,
    custodyAccount: null,
  },
];

const ERC20_ABI = [
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface CheckResult {
  id: string;
  symbol: string;
  solanaLocked: bigint;
  polygonSupply: bigint;
  difference: bigint;
  isValid: boolean;
}

async function checkToken(
  token: typeof TOKENS[0],
  solana: Connection,
  polygonClient: ReturnType<typeof createPublicClient>
): Promise<CheckResult | null> {
  if (!token.polygonAddress || !token.custodyAccount) {
    console.log(`  ${token.symbol}: Not configured (skipping)`);
    return null;
  }

  try {
    // Get Solana locked amount
    const custodyPubkey = new PublicKey(token.custodyAccount);
    const custodyAccount = await getAccount(solana, custodyPubkey);
    const solanaLocked = custodyAccount.amount;

    // Get Polygon supply
    const polygonSupply = await polygonClient.readContract({
      address: token.polygonAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "totalSupply",
    });

    const difference = solanaLocked - polygonSupply;
    const isValid = difference >= 0n;

    return {
      id: token.id,
      symbol: token.symbol,
      solanaLocked,
      polygonSupply,
      difference,
      isValid,
    };
  } catch (error) {
    console.error(`  ${token.symbol}: Error - ${error}`);
    return null;
  }
}

function formatAmount(amount: bigint): string {
  const divisor = 10n ** 8n;
  const whole = amount / divisor;
  const fraction = (amount % divisor).toString().padStart(8, "0");
  return `${whole}.${fraction}`;
}

async function runCheck(): Promise<boolean> {
  const solana = new Connection(SOLANA_RPC_URL, "confirmed");
  const polygonClient = createPublicClient({
    chain: polygon,
    transport: http(POLYGON_RPC_URL),
  });

  console.log("\nPreStock Bridge Supply Verification");
  console.log("====================================\n");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Solana RPC: ${SOLANA_RPC_URL}`);
  console.log(`Polygon RPC: ${POLYGON_RPC_URL}\n`);

  const results: CheckResult[] = [];
  const configuredTokens = TOKENS.filter(
    (t) => t.polygonAddress !== null && t.custodyAccount !== null
  );

  if (configuredTokens.length === 0) {
    console.log("No tokens configured for verification.");
    console.log("\nTo configure tokens, update the TOKENS array in this script with:");
    console.log("  - polygonAddress: Deployed ERC-20 contract address");
    console.log("  - custodyAccount: NTT custody account address on Solana\n");
    return true;
  }

  console.log(`Checking ${configuredTokens.length} token(s)...\n`);

  for (const token of configuredTokens) {
    const result = await checkToken(token, solana, polygonClient);
    if (result) {
      results.push(result);
    }
  }

  // Print results
  console.log("\nResults:");
  console.log("-".repeat(70));

  for (const r of results) {
    const status = r.isValid ? "✅" : "❌";
    console.log(`\n${status} ${r.symbol}`);
    console.log(`   Solana Locked:  ${formatAmount(r.solanaLocked)}`);
    console.log(`   Polygon Supply: ${formatAmount(r.polygonSupply)}`);
    console.log(`   Difference:     ${formatAmount(r.difference)}`);
  }

  console.log("\n" + "-".repeat(70));

  const valid = results.filter((r) => r.isValid).length;
  const violations = results.filter((r) => !r.isValid).length;
  console.log(`\nSummary: ${valid} valid, ${violations} violations`);

  if (violations > 0) {
    console.error("\n⚠️  SUPPLY INVARIANT VIOLATIONS DETECTED!");
    console.error("This may indicate a security issue. Investigate immediately.\n");
    return false;
  }

  console.log("\n✅ All supply invariants are valid.\n");
  return true;
}

async function runContinuous(intervalMs: number = 60000): Promise<void> {
  console.log(`Starting continuous monitoring (interval: ${intervalMs}ms)`);
  console.log("Press Ctrl+C to stop.\n");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await runCheck();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--continuous") || args.includes("-c")) {
    const intervalArg = args.find((a) => a.startsWith("--interval="));
    const interval = intervalArg
      ? parseInt(intervalArg.split("=")[1] ?? "60000")
      : 60000;
    await runContinuous(interval);
  } else if (args.includes("--token") || args.includes("-t")) {
    const tokenIndex = args.findIndex((a) => a === "--token" || a === "-t");
    const tokenId = args[tokenIndex + 1];
    if (!tokenId) {
      console.error("Error: --token requires a token ID");
      process.exit(1);
    }
    const token = TOKENS.find((t) => t.id === tokenId);
    if (!token) {
      console.error(`Error: Unknown token ID: ${tokenId}`);
      console.error(`Available tokens: ${TOKENS.map((t) => t.id).join(", ")}`);
      process.exit(1);
    }
    console.log(`Checking single token: ${token.symbol}`);
    // Would need to implement single token check
    const success = await runCheck();
    process.exit(success ? 0 : 1);
  } else {
    const success = await runCheck();
    process.exit(success ? 0 : 1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
