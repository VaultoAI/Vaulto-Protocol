"use client";

import { useState, useEffect } from "react";
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
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Sync Privy theme with app theme to prevent backdrop blur flickering
  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    };

    updateTheme(); // Initial check

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Create dynamic config with synced theme
  const dynamicConfig = {
    ...privyConfig,
    appearance: { ...privyConfig.appearance, theme },
  };

  return (
    <SessionProvider>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
        config={dynamicConfig}
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </PrivyProvider>
    </SessionProvider>
  );
}
