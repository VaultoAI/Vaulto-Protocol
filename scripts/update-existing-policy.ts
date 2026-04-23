/**
 * Update Existing Policy to Allow Signing
 *
 * Updates the existing trading policy to allow all operations.
 *
 * Usage: npx tsx scripts/update-existing-policy.ts
 */

import * as dotenv from "dotenv";
import { PrivyClient } from "@privy-io/node";

dotenv.config({ path: ".env.local" });

const EXISTING_POLICY_ID = "jfjtvzmlbkjhqzhbftbsk460";

async function main() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    console.error("Missing NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET");
    process.exit(1);
  }

  console.log("Creating Privy client...");
  const privy = new PrivyClient({ appId, appSecret });

  console.log("Policy ID:", EXISTING_POLICY_ID);

  try {
    // Get current policy state
    console.log("\nFetching current policy state...");
    const currentPolicy = await privy.policies().get(EXISTING_POLICY_ID);
    console.log("Current policy name:", currentPolicy.name);
    console.log("Current rules:", JSON.stringify(currentPolicy.rules, null, 2));

    // Update policy to allow all operations
    console.log("\nUpdating policy to allow all operations...");
    const updated = await privy.policies().update(EXISTING_POLICY_ID, {
      name: "Vaulto Trading Policy - All Operations",
      rules: [
        {
          name: "Allow all wallet operations",
          method: "*",
          action: "ALLOW",
          conditions: [],
        },
      ],
    });

    console.log("\n✅ Policy updated successfully!");
    console.log("New policy name:", updated.name);
    console.log("New rules:", JSON.stringify(updated.rules, null, 2));

  } catch (error) {
    console.error("Failed to update policy:", error);
    process.exit(1);
  }
}

main();
