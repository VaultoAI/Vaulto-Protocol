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

type PrivyLinkedAccount = { type: string; [key: string]: unknown };
type PrivyUserLike = { id: string; linked_accounts: PrivyLinkedAccount[] };

/**
 * Resolve the canonical email for a Privy user.
 *
 * Picks whichever email-bearing linked account was authenticated MOST RECENTLY
 * (by `latest_verified_at`, falling back to `verified_at`). This fixes a bug
 * where a Privy user with multiple linked accounts (e.g. an old `email` link
 * to address A and a newer `google_oauth` to address B) would always resolve
 * to A even when the user just signed in via Google as B.
 *
 * Falls back to `<addr>@wallet.vaulto.app` for wallet-only logins, then to
 * `<privy-id-suffix>@privy.vaulto.app`.
 */
export function resolvePrivyEmail(user: PrivyUserLike): string {
  type EmailCandidate = { email: string; verifiedAt: number };
  const candidates: EmailCandidate[] = [];
  for (const account of user.linked_accounts) {
    const verifiedAt =
      (typeof account.latest_verified_at === "number"
        ? account.latest_verified_at
        : null) ??
      (typeof account.verified_at === "number" ? account.verified_at : 0);
    if (account.type === "email" && typeof account.address === "string") {
      candidates.push({ email: account.address, verifiedAt });
    } else if (
      (account.type === "google_oauth" || account.type === "apple_oauth") &&
      typeof account.email === "string" &&
      account.email
    ) {
      candidates.push({ email: account.email, verifiedAt });
    }
  }
  candidates.sort((a, b) => b.verifiedAt - a.verifiedAt);
  if (candidates.length > 0) return candidates[0].email;

  const externalWallet = user.linked_accounts.find(
    (account) =>
      account.type === "wallet" &&
      account.wallet_client_type !== "privy" &&
      typeof account.address === "string"
  );
  if (externalWallet && typeof externalWallet.address === "string") {
    return `${externalWallet.address.toLowerCase()}@wallet.vaulto.app`;
  }
  return `${user.id.replace("did:privy:", "")}@privy.vaulto.app`;
}

/**
 * Find the Privy embedded wallet address (chain_type ethereum) for a user.
 * Returns null if no embedded wallet is linked.
 */
export function getPrivyEmbeddedWalletAddress(
  user: PrivyUserLike
): string | null {
  const embeddedWallet = user.linked_accounts.find(
    (account) =>
      account.type === "wallet" && account.wallet_client_type === "privy"
  );
  if (!embeddedWallet || typeof embeddedWallet.address !== "string") {
    return null;
  }
  return embeddedWallet.address;
}

/**
 * Verify a Privy access token and get user info with embedded wallet address
 */
export async function verifyPrivyTokenAndGetUserWithWallet(
  accessToken: string
): Promise<PrivyUserWithWallet | null> {
  const client = getPrivyClient();

  try {
    const verifiedClaims = await client.utils().auth().verifyAccessToken(accessToken);
    const userId = verifiedClaims.user_id;

    const user = await client.users()._get(userId);
    const email = resolvePrivyEmail(user as unknown as PrivyUserLike);
    const embeddedWalletAddress = getPrivyEmbeddedWalletAddress(
      user as unknown as PrivyUserLike
    );

    if (!embeddedWalletAddress) {
      console.error("[Privy Server] User has no embedded wallet:", userId);
      return null;
    }

    return { userId, email, embeddedWalletAddress };
  } catch (error) {
    console.error("[Privy Server] Token verification or user fetch failed:", error);
    return null;
  }
}
