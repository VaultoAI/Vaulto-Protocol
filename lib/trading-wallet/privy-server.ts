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
