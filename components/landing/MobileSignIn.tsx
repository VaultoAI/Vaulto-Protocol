"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { signIn, signOut, getSession } from "next-auth/react";

type BridgeState = "idle" | "signing-in" | "error";

export function MobileSignIn() {
  const { login, ready, authenticated, getAccessToken } = usePrivy();
  const [state, setState] = useState<BridgeState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Once we've attempted the NextAuth bridge for the *current* Privy auth
  // session, don't try again. Reset only when Privy goes back to
  // unauthenticated. This breaks the previous infinite-retry loop where a
  // failed signIn would re-trigger the effect on every render.
  const bridgeAttemptedRef = useRef(false);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated) {
      bridgeAttemptedRef.current = false;
      if (state !== "idle") setState("idle");
      return;
    }

    if (bridgeAttemptedRef.current) return;
    bridgeAttemptedRef.current = true;

    void (async () => {
      setState("signing-in");
      setErrorMessage(null);
      try {
        const privyToken = await getAccessToken();
        if (!privyToken) {
          console.error("[MobileSignIn] Failed to get Privy access token");
          setErrorMessage("Couldn't read sign-in token. Please try again.");
          setState("error");
          return;
        }

        // If a stale NextAuth session exists from a different identity (e.g.
        // a prior Google-OAuth waitlist sign-up), wipe it before bridging so
        // the new Privy identity wins cleanly.
        const existing = await getSession();
        if (existing?.user?.email) {
          await signOut({ redirect: false });
        }

        const result = await signIn("privy", {
          privyToken,
          redirect: false,
        });

        if (!result?.ok) {
          console.error("[MobileSignIn] NextAuth sign-in failed:", result?.error);
          setErrorMessage("Sign-in failed. Please try again.");
          setState("error");
          return;
        }

        // Pick destination based on actual session, not on any localStorage
        // flag (which used to wrongly mark non-employees as employees).
        const fresh = await getSession();
        const dest = fresh?.user?.isVaultoEmployee ? "/explore" : "/waitlist-success";
        window.location.href = dest;
      } catch (error) {
        console.error("[MobileSignIn] Bridge to NextAuth failed:", error);
        setErrorMessage("Something went wrong. Please try again.");
        setState("error");
      }
    })();
  }, [ready, authenticated, getAccessToken, state]);

  const handleClick = () => {
    if (!ready) return;
    if (state === "signing-in") return;
    if (state === "error") {
      // Allow user to retry from a clean slate.
      bridgeAttemptedRef.current = false;
      setState("idle");
      setErrorMessage(null);
    }
    if (!authenticated) {
      login();
    }
  };

  const buttonLabel =
    state === "signing-in"
      ? "Signing in..."
      : state === "error"
        ? "Try again"
        : "Sign in with Privy";

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
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

      <div
        className="relative z-10 px-6"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        {errorMessage && (
          <p className="mb-3 text-center text-sm text-red-500" role="alert">
            {errorMessage}
          </p>
        )}
        <button
          onClick={handleClick}
          disabled={!ready || state === "signing-in"}
          className="w-full rounded-xl bg-black py-4 text-base font-medium text-white transition-opacity disabled:opacity-50"
        >
          {buttonLabel}
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
