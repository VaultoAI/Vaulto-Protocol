/**
 * Create Trading Policy for Server Side Signing
 *
 * This script creates a Privy policy that allows USDC transfers on Polygon.
 * The policy restricts transactions to only the USDC contract addresses.
 *
 * Usage: npx tsx scripts/create-trading-policy.ts
 */

import * as dotenv from "dotenv";
import { PrivyClient } from "@privy-io/node";

// Load .env.local explicitly
dotenv.config({ path: ".env.local" });

// USDC Contract Addresses on Polygon
const POLYGON_NATIVE_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const POLYGON_BRIDGED_USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

async function main() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    console.error("Missing NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET");
    process.exit(1);
  }

  console.log("Creating Privy client...");
  const privy = new PrivyClient({ appId, appSecret });

  console.log("Creating trading policy...");
  console.log("Allowed contracts:");
  console.log("  - Native USDC:", POLYGON_NATIVE_USDC);
  console.log("  - Bridged USDC.e:", POLYGON_BRIDGED_USDC);

  try {
    const policy = await privy.policies().create({
      name: "Vaulto Trading Policy - USDC Only",
      version: "1.0",
      chain_type: "ethereum",
      rules: [
        {
          name: "Allow Native USDC transfers",
          method: "eth_sendTransaction",
          action: "ALLOW",
          conditions: [
            {
              field_source: "ethereum_transaction",
              field: "to",
              operator: "eq",
              value: POLYGON_NATIVE_USDC,
            },
          ],
        },
        {
          name: "Allow Bridged USDC.e transfers",
          method: "eth_sendTransaction",
          action: "ALLOW",
          conditions: [
            {
              field_source: "ethereum_transaction",
              field: "to",
              operator: "eq",
              value: POLYGON_BRIDGED_USDC,
            },
          ],
        },
      ],
    });

    console.log("\n✅ Policy created successfully!");
    console.log("=====================================");
    console.log("Policy ID:", policy.id);
    console.log("Policy Name:", policy.name);
    console.log("=====================================");
    console.log("\nAdd this to your .env.local:");
    console.log(`PRIVY_TRADING_POLICY_ID=${policy.id}`);

  } catch (error) {
    console.error("Failed to create policy:", error);
    process.exit(1);
  }
}

main();
