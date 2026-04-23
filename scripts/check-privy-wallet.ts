import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrivyClient } from "@privy-io/node";

async function main() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    console.error("Missing NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET");
    process.exit(1);
  }

  const privy = new PrivyClient({ appId, appSecret });

  // The user we're checking
  const privyUserId = "did:privy:cmoahep0200av0clalpal0qze";
  const walletAddress = "0x6Ecf7305aD2A0a3C991A90C4E80A4908d0bbaa40";

  console.log("Checking Privy wallet for user:", privyUserId);
  console.log("Expected wallet address:", walletAddress);
  console.log("---");

  try {
    // Get user details
    const user = await privy.users()._get(privyUserId);
    console.log("User linked accounts count:", user.linked_accounts.length);

    // Find embedded wallet
    const embeddedWallet = user.linked_accounts.find(
      (account) =>
        account.type === "wallet" &&
        "wallet_client_type" in account &&
        account.wallet_client_type === "privy" &&
        "chain_type" in account &&
        account.chain_type === "ethereum"
    );

    if (!embeddedWallet) {
      console.log("No embedded wallet found!");
      return;
    }

    console.log("\nEmbedded wallet details:");
    console.log(JSON.stringify(embeddedWallet, null, 2));

    // Get the wallet ID - could be in 'id' or 'wallet_id' field
    const walletId = "wallet_id" in embeddedWallet
      ? embeddedWallet.wallet_id
      : ("id" in embeddedWallet ? embeddedWallet.id : null);
    if (!walletId) {
      console.log("\nNo wallet_id found in embedded wallet!");
      return;
    }

    console.log("\n---");
    console.log("Wallet ID:", walletId);

    // Get wallet details directly
    console.log("\nFetching wallet details...");
    const walletDetails = await privy.wallets().get(walletId as string);
    console.log("Wallet details:", JSON.stringify(walletDetails, null, 2));

    // Check environment config
    console.log("\n---");
    console.log("Environment config:");
    console.log("  PRIVY_AUTHORIZATION_KEY_ID:", process.env.PRIVY_AUTHORIZATION_KEY_ID || "(not set)");
    console.log("  PRIVY_TRADING_POLICY_ID:", process.env.PRIVY_TRADING_POLICY_ID || "(not set)");
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);
