"use client";

import { useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { performLogout } from "@/lib/logout";

/**
 * Hook that provides a comprehensive logout function.
 * Clears Privy auth, NextAuth session, React Query cache, and localStorage.
 */
export function useLogout() {
  const { logout: privyLogout } = usePrivy();
  const queryClient = useQueryClient();

  const logout = useCallback(async () => {
    await performLogout({
      privyLogout,
      queryClient,
    });
  }, [privyLogout, queryClient]);

  return { logout };
}
