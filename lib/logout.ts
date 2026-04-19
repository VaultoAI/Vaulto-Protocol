import { signOut as nextAuthSignOut } from "next-auth/react";
import type { QueryClient } from "@tanstack/react-query";

/**
 * localStorage keys that should be cleared on logout
 * Add any keys that contain user-specific data
 */
const USER_STORAGE_KEYS = [
  "vaulto-trading-wallet",
  "vaulto-user-profile",
  "vaulto-credentials",
];

/**
 * Clear all user-related localStorage items
 */
function clearUserStorage(): void {
  if (typeof window === "undefined") return;

  USER_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[logout] Failed to clear localStorage key: ${key}`, e);
    }
  });

  // Clear any items with common user-related prefixes
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
    console.warn("[logout] Failed to clear prefixed localStorage items", e);
  }
}

/**
 * Clear React Query cache to prevent stale user data
 */
function clearQueryCache(queryClient: QueryClient | null): void {
  if (!queryClient) return;

  try {
    // Clear all queries to ensure no stale user data persists
    queryClient.clear();
    console.log("[logout] React Query cache cleared");
  } catch (e) {
    console.warn("[logout] Failed to clear React Query cache", e);
  }
}

/**
 * Clear NextAuth session
 * Uses redirect: false to prevent automatic navigation
 */
async function clearNextAuthSession(): Promise<void> {
  try {
    await nextAuthSignOut({ redirect: false });
    console.log("[logout] NextAuth session cleared");
  } catch (e) {
    console.warn("[logout] Failed to clear NextAuth session", e);
  }
}

export interface LogoutOptions {
  /** Privy logout function from usePrivy hook */
  privyLogout: () => Promise<void>;
  /** React Query client for cache clearing */
  queryClient?: QueryClient | null;
  /** Callback to run after logout completes */
  onLogoutComplete?: () => void;
}

/**
 * Comprehensive logout that clears all auth state:
 * 1. Privy auth session
 * 2. NextAuth JWT session
 * 3. React Query cache
 * 4. User-related localStorage
 */
export async function performLogout(options: LogoutOptions): Promise<void> {
  const { privyLogout, queryClient, onLogoutComplete } = options;

  console.log("[logout] Starting comprehensive logout...");

  // Clear caches and storage first (these are synchronous/fast)
  clearQueryCache(queryClient ?? null);
  clearUserStorage();

  // Clear both auth systems in parallel
  await Promise.all([
    privyLogout().catch((e) => {
      console.warn("[logout] Privy logout error:", e);
    }),
    clearNextAuthSession(),
  ]);

  console.log("[logout] Comprehensive logout complete");

  // Call completion callback
  onLogoutComplete?.();
}
