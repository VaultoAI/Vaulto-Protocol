/**
 * Privy Server Client for Trading Wallet Operations
 * Handles server-side wallet creation, policy management, and delegated transactions
 */

import { PrivyClient } from "@privy-io/node";

// Lazy initialization of Privy client
let _privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!_privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error(
        "Missing Privy configuration: NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET are required"
      );
    }

    _privyClient = new PrivyClient({ appId, appSecret });
  }
  return _privyClient;
}

export interface TradingWalletInfo {
  address: string;
  privyWalletId: string;
  chainId: number;
}

/**
 * Verify a Privy access token
 */
export async function verifyPrivyToken(
  accessToken: string
): Promise<{ userId: string } | null> {
  const client = getPrivyClient();

  try {
    const verifiedClaims = await client.utils().auth().verifyAccessToken(accessToken);
    return { userId: verifiedClaims.user_id };
  } catch (error) {
    console.error("[Privy Server] Token verification failed:", error);
    return null;
  }
}

/**
 * Validate an Ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Check if Privy server is properly configured
 */
export function isPrivyServerConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET
  );
}

export interface PrivyUserWithWallet {
  userId: string;
  email: string;
  embeddedWalletAddress: string;
}

/**
 * Verify a Privy access token and get user info with embedded wallet address
 */
export async function verifyPrivyTokenAndGetUserWithWallet(
  accessToken: string
): Promise<PrivyUserWithWallet | null> {
  const client = getPrivyClient();

  try {
    // Verify the token first
    const verifiedClaims = await client.utils().auth().verifyAccessToken(accessToken);
    const userId = verifiedClaims.user_id;

    // Get full user details
    const user = await client.users().get({ id_token: userId });

    // Extract email from linked accounts
    const emailAccount = user.linked_accounts.find(
      (account) => account.type === "email"
    );
    if (!emailAccount || !("address" in emailAccount)) {
      console.error("[Privy Server] User has no email linked:", userId);
      return null;
    }
    const email = emailAccount.address as string;

    // Extract embedded wallet address
    const embeddedWallet = user.linked_accounts.find(
      (account) => account.type === "wallet" && "wallet_client_type" in account && account.wallet_client_type === "privy"
    );
    if (!embeddedWallet || !("address" in embeddedWallet)) {
      console.error("[Privy Server] User has no embedded wallet:", userId);
      return null;
    }
    const embeddedWalletAddress = embeddedWallet.address as string;

    return {
      userId,
      email,
      embeddedWalletAddress,
    };
  } catch (error) {
    console.error("[Privy Server] Token verification or user fetch failed:", error);
    return null;
  }
}
