/**
 * Utility to get user email from either NextAuth session or Privy token
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { verifyPrivyToken } from "./privy-server";
import { PrivyClient } from "@privy-io/node";

// Lazy initialization of Privy client
let _privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!_privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("Missing Privy configuration");
    }
    _privyClient = new PrivyClient({ appId, appSecret });
  }
  return _privyClient;
}

/**
 * Get user email from either NextAuth session or Privy token
 * @param request - The NextRequest object (optional, needed for Privy auth)
 * @returns The user's email or null if not authenticated
 */
export async function getUserEmail(request?: NextRequest): Promise<string | null> {
  // Try NextAuth session first
  const session = await auth();
  if (session?.user?.email) {
    return session.user.email;
  }

  // Try Privy token if request is provided
  if (request) {
    const privyToken = request.headers.get("x-privy-token");
    if (privyToken) {
      const verifiedUser = await verifyPrivyToken(privyToken);
      if (verifiedUser) {
        // Get user details from Privy to extract email
        const privy = getPrivyClient();
        const privyUser = await privy.users()._get(verifiedUser.userId);

        // Check for direct email account
        const emailAccount = privyUser.linked_accounts.find(
          (account) => account.type === "email" && "address" in account
        );
        if (emailAccount && "address" in emailAccount) {
          return emailAccount.address as string;
        }

        // Check for Google OAuth
        const googleAccount = privyUser.linked_accounts.find(
          (account) => account.type === "google_oauth" && "email" in account
        );
        if (googleAccount && "email" in googleAccount) {
          return (googleAccount as { email: string }).email;
        }

        // Check for Apple OAuth
        const appleAccount = privyUser.linked_accounts.find(
          (account) => account.type === "apple_oauth" && "email" in account
        );
        if (appleAccount && "email" in appleAccount) {
          return (appleAccount as { email: string }).email;
        }
      }
    }
  }

  return null;
}
