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

  // Clear sessionStorage too — Privy uses it for some session data.
  try {
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith("vaulto-") || key.startsWith("privy-"))) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch (e) {
    console.warn("[logout] Failed to clear sessionStorage", e);
  }

  // Expire any non-HttpOnly cookies on this origin so a stale Privy/auth
  // cookie can't be picked back up by the next sign-in attempt.
  try {
    document.cookie.split(";").forEach((c) => {
      const eq = c.indexOf("=");
      const name = (eq > -1 ? c.substring(0, eq) : c).trim();
      if (!name) return;
      if (name.startsWith("privy-") || name.startsWith("authjs.") || name.startsWith("__Secure-authjs.")) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
  } catch (e) {
    console.warn("[logout] Failed to clear cookies", e);
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

  clearQueryCache(queryClient ?? null);

  // Sequence: clear NextAuth (server cookie) first, then Privy (client SDK
  // session). Doing them in parallel can let a stale Privy session bleed
  // into the next sign-in attempt before NextAuth's cookie is gone.
  await clearNextAuthSession();
  await privyLogout().catch((e) => {
    console.warn("[logout] Privy logout error:", e);
  });

  // Clear local storage / cookies AFTER both systems have signed out so we
  // don't race their own internal cleanup.
  clearUserStorage();

  console.log("[logout] Comprehensive logout complete");

  // Call completion callback
  onLogoutComplete?.();
}
