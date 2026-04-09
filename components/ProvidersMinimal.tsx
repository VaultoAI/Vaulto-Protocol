"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { PrivyProvider } from "@privy-io/react-auth";
import { privyConfig } from "@/lib/privy";

/**
 * Minimal providers for public pages that don't need full Web3 functionality.
 * Includes Privy for auth sync but without smart wallets/wagmi.
 */
export function ProvidersMinimal({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
        config={privyConfig}
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </PrivyProvider>
    </SessionProvider>
  );
}
