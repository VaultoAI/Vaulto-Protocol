"use client";

import { useState, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { WagmiProvider } from "@privy-io/wagmi";
import { SessionProvider, signOut as nextAuthSignOut } from "next-auth/react";
import { wagmiConfig } from "@/lib/wagmi";
import { privyConfig, smartWalletConfig } from "@/lib/privy";
import { MobileAuthGate } from "./MobileAuthGate";

/**
 * Component that listens for auth state changes and clears cache on logout.
 * This ensures stale user data doesn't persist across sessions.
 */
function AuthStateListener({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const queryClient = useQueryClient();
  const wasAuthenticated = useRef<boolean | null>(null);

  // Set returning employee flag for Vaulto employees when they sign in
  useEffect(() => {
    if (!ready || !authenticated || !user) return;

    // Check if user has Vaulto email via Privy
    const email = user.email?.address || user.google?.email;
    if (email?.endsWith("@vaulto.ai")) {
      localStorage.setItem("vaulto-employee-returning", "true");
    }
  }, [ready, authenticated, user]);

  useEffect(() => {
    // Only react after Privy is ready and we have a previous state to compare
    if (!ready) return;

    // If user just logged out (was authenticated, now isn't)
    if (wasAuthenticated.current === true && authenticated === false) {
      console.log("[AuthStateListener] User logged out, clearing caches...");

      // Clear React Query cache
      queryClient.clear();

      // Clear NextAuth session
      nextAuthSignOut({ redirect: false }).catch((e) => {
        console.warn("[AuthStateListener] Failed to clear NextAuth session:", e);
      });

      // Clear any user-related localStorage
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("vaulto-") || key.startsWith("privy-"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => {
          // Preserve the returning employee flag so Vaulto employees see MobileSignIn
          if (key !== "vaulto-employee-returning") {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.warn("[AuthStateListener] Failed to clear localStorage:", e);
      }
    }

    // Update the ref for next comparison
    wasAuthenticated.current = authenticated;
  }, [ready, authenticated, queryClient]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
        config={privyConfig}
      >
        <SmartWalletsProvider config={smartWalletConfig}>
          <QueryClientProvider client={queryClient}>
            <WagmiProvider config={wagmiConfig}>
              <AuthStateListener>
                <MobileAuthGate>{children}</MobileAuthGate>
              </AuthStateListener>
            </WagmiProvider>
          </QueryClientProvider>
        </SmartWalletsProvider>
      </PrivyProvider>
    </SessionProvider>
  );
}
