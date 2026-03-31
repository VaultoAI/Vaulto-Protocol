"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { WagmiProvider } from "@privy-io/wagmi";
import { SessionProvider } from "next-auth/react";
import { wagmiConfig } from "@/lib/wagmi";
import { privyConfig, smartWalletConfig } from "@/lib/privy";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
        config={privyConfig}
      >
        <SmartWalletsProvider config={smartWalletConfig}>
          <QueryClientProvider client={queryClient}>
            <WagmiProvider config={wagmiConfig}>
              {children}
            </WagmiProvider>
          </QueryClientProvider>
        </SmartWalletsProvider>
      </PrivyProvider>
    </SessionProvider>
  );
}
