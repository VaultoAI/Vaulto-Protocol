"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { signIn } from "next-auth/react";

export function MobileSignIn() {
  const { login, ready, authenticated, getAccessToken } = usePrivy();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // After Privy auth completes, bridge to NextAuth and redirect
  useEffect(() => {
    async function bridgeToNextAuth() {
      if (!ready || !authenticated || isSigningIn) return;

      setIsSigningIn(true);
      try {
        // Get the Privy access token
        const privyToken = await getAccessToken();
        if (!privyToken) {
          console.error("[MobileSignIn] Failed to get Privy access token");
          setIsSigningIn(false);
          return;
        }

        // Sign in to NextAuth with the Privy token
        const result = await signIn("privy", {
          privyToken,
          redirect: false,
        });

        if (result?.ok) {
          // Mark as returning employee and redirect
          localStorage.setItem("vaulto-employee-returning", "true");
          window.location.href = "/explore";
        } else {
          console.error("[MobileSignIn] NextAuth sign-in failed:", result?.error);
          setIsSigningIn(false);
        }
      } catch (error) {
        console.error("[MobileSignIn] Bridge to NextAuth failed:", error);
        setIsSigningIn(false);
      }
    }

    bridgeToNextAuth();
  }, [ready, authenticated, getAccessToken, isSigningIn]);

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      {/* Centered icon */}
      <div className="relative z-10 flex flex-1 items-center justify-center">
        <Image
          src="/vaulto-logo-mobile.png"
          alt="Vaulto"
          width={200}
          height={200}
          priority
          className="h-[200px] w-[200px]"
        />
      </div>

      {/* Bottom sign-in button */}
      <div
        className="relative z-10 px-6"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => ready && !isSigningIn && login()}
          disabled={!ready || isSigningIn}
          className="w-full rounded-xl bg-[var(--foreground)] py-4 text-base font-medium text-[var(--background)] transition-opacity disabled:opacity-50"
        >
          {isSigningIn ? "Signing in..." : "Sign in"}
        </button>
        <p className="mt-4 text-center text-xs text-gray-500">
          By signing in, you agree to our{" "}
          <a
            href="https://legal.vaulto.ai/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="https://legal.vaulto.ai/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
