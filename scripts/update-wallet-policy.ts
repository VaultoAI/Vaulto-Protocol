/**
 * Update Wallet Policy
 *
 * Updates an existing wallet to use a new policy.
 *
 * Usage: npx tsx scripts/update-wallet-policy.ts
 */

import * as dotenv from "dotenv";
import { PrivyClient } from "@privy-io/node";

dotenv.config({ path: ".env.local" });

const WALLET_ID = "m9ld2yozw656y99cpsqz0lsq";
const NEW_POLICY_ID = "lnhatsy2h93eg9iovsm8w28a";
const SIGNER_ID = "akgl7j6e9s6ks93rnoye5c5w";

async function main() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    console.error("Missing NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET");
    process.exit(1);
  }

  console.log("Creating Privy client...");
  const privy = new PrivyClient({ appId, appSecret });

  console.log("Current wallet ID:", WALLET_ID);
  console.log("New policy ID:", NEW_POLICY_ID);
  console.log("Signer ID:", SIGNER_ID);

  try {
    // Get current wallet state
    console.log("\nFetching current wallet state...");
    const currentWallet = await privy.wallets().get(WALLET_ID);
    console.log("Current policies:", currentWallet.policy_ids);
    console.log("Current signers:", currentWallet.additional_signers);

    // Update wallet with new policy - need to provide authorization context
    console.log("\nUpdating wallet policy...");
    const authPrivateKey = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY;
    if (!authPrivateKey) {
      throw new Error("Missing PRIVY_AUTHORIZATION_PRIVATE_KEY");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (privy.wallets().update as any)(WALLET_ID, {
      policy_ids: [NEW_POLICY_ID],
      additional_signers: [
        {
          signer_id: SIGNER_ID,
        },
      ],
      authorization_context: {
        authorization_private_keys: [authPrivateKey],
      },
    });

    // Verify update
    console.log("\nVerifying update...");
    const updatedWallet = await privy.wallets().get(WALLET_ID);
    console.log("Updated policies:", updatedWallet.policy_ids);
    console.log("Updated signers:", updatedWallet.additional_signers);

    console.log("\n✅ Wallet policy updated successfully!");

  } catch (error) {
    console.error("Failed to update wallet:", error);
    process.exit(1);
  }
}

main();
