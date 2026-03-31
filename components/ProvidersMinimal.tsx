"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";

const queryClient = new QueryClient();

/**
 * Minimal providers for public pages that don't need Web3 functionality.
 * ~50KB instead of ~820KB for the full Web3 stack.
 */
export function ProvidersMinimal({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}
