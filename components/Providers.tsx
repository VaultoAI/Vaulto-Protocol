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
  const { ready, authenticated } = usePrivy();
  const queryClient = useQueryClient();
  const wasAuthenticated = useRef<boolean | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (wasAuthenticated.current === true && authenticated === false) {
      console.log("[AuthStateListener] User logged out, clearing caches...");

      queryClient.clear();

      nextAuthSignOut({ redirect: false }).catch((e) => {
        console.warn("[AuthStateListener] Failed to clear NextAuth session:", e);
      });

      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("vaulto-") || key.startsWith("privy-"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch (e) {
        console.warn("[AuthStateListener] Failed to clear localStorage:", e);
      }
    }

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
