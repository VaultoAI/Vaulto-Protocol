/**
 * Create Trading Policy v2 for Server Side Signing
 *
 * This policy allows:
 * 1. USDC transfers on Polygon (for withdrawals)
 * 2. Message signing (for credential derivation)
 *
 * Usage: npx tsx scripts/create-trading-policy-v2.ts
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

  console.log("Creating trading policy v2...");
  console.log("Allowed operations:");
  console.log("  - personal_sign (for credential derivation)");
  console.log("  - eth_signTypedData_v4 (for typed data signing)");
  console.log("  - eth_sendTransaction to Native USDC:", POLYGON_NATIVE_USDC);
  console.log("  - eth_sendTransaction to Bridged USDC.e:", POLYGON_BRIDGED_USDC);

  try {
    const policy = await privy.policies().create({
      name: "Vaulto Trading Policy v2 - All Operations",
      version: "1.0",
      chain_type: "ethereum",
      rules: [
        // Allow all methods with wildcard (includes signing, transactions, etc.)
        // This is needed for credential derivation which uses eth_signTypedData_v4
        {
          name: "Allow all wallet operations",
          method: "*",
          action: "ALLOW",
          conditions: [],
        },
      ],
    });

    console.log("\n✅ Policy created successfully!");
    console.log("=====================================");
    console.log("Policy ID:", policy.id);
    console.log("Policy Name:", policy.name);
    console.log("=====================================");
    console.log("\nUpdate your .env.local:");
    console.log(`PRIVY_TRADING_POLICY_ID=${policy.id}`);
    console.log("\nThen update Railway:");
    console.log(`railway variables set PRIVY_TRADING_POLICY_ID=${policy.id} PRIVY_WALLET_POLICY_ID=${policy.id}`);

  } catch (error) {
    console.error("Failed to create policy:", error);
    process.exit(1);
  }
}

main();
