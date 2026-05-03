/**
 * Privy Server Client for Trading Wallet Operations
 * Handles server-side wallet creation, policy management, and delegated transactions
 */

import { PrivyClient } from "@privy-io/node";

// Re-export server wallet functions for convenience
export { isServerSigningConfigured } from "./server-wallet";

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

    // Get full user details (use _get with user ID for server-side queries)
    const user = await client.users()._get(userId);

    // Pick the email from whichever account was authenticated MOST RECENTLY,
    // not by hard-coded type priority. Fixes a bug where a Privy user with
    // multiple linked accounts (e.g. an old `email` link to address A and a
    // newer `google_oauth` to address B) would always resolve to A even when
    // the user just signed in via Google as B.
    type EmailCandidate = { email: string; verifiedAt: number };
    const candidates: EmailCandidate[] = [];
    for (const account of user.linked_accounts) {
      const verifiedAt =
        ("latest_verified_at" in account && typeof account.latest_verified_at === "number"
          ? account.latest_verified_at
          : null) ??
        ("verified_at" in account && typeof account.verified_at === "number"
          ? account.verified_at
          : 0);
      if (account.type === "email" && "address" in account && typeof account.address === "string") {
        candidates.push({ email: account.address, verifiedAt });
      } else if (
        (account.type === "google_oauth" || account.type === "apple_oauth") &&
        "email" in account &&
        typeof (account as { email?: unknown }).email === "string" &&
        (account as { email: string }).email
      ) {
        candidates.push({ email: (account as { email: string }).email, verifiedAt });
      }
    }
    candidates.sort((a, b) => b.verifiedAt - a.verifiedAt);

    let email: string;
    if (candidates.length > 0) {
      email = candidates[0].email;
    } else {
      const externalWallet = user.linked_accounts.find(
        (account) =>
          account.type === "wallet" &&
          "wallet_client_type" in account &&
          account.wallet_client_type !== "privy" &&
          "address" in account
      );
      if (externalWallet && "address" in externalWallet) {
        const walletAddr = (externalWallet.address as string).toLowerCase();
        email = `${walletAddr}@wallet.vaulto.app`;
      } else {
        const userIdSuffix = userId.replace("did:privy:", "");
        email = `${userIdSuffix}@privy.vaulto.app`;
      }
    }

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
