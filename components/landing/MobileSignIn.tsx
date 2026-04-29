"use client";

import { useEffect } from "react";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";

export function MobileSignIn() {
  const { login, ready, authenticated } = usePrivy();

  // Redirect to explore after successful sign-in and mark as returning employee
  useEffect(() => {
    if (ready && authenticated) {
      localStorage.setItem("vaulto-employee-returning", "true");
      window.location.href = "/explore";
    }
  }, [ready, authenticated]);

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      {/* Centered icon */}
      <div className="relative z-10 flex flex-1 items-center justify-center">
        <Image
          src="/icon-192.png"
          alt="Vaulto"
          width={192}
          height={192}
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
          onClick={() => ready && login()}
          disabled={!ready}
          className="w-full rounded-xl bg-[var(--foreground)] py-4 text-base font-medium text-[var(--background)] transition-opacity disabled:opacity-50"
        >
          Sign in with Privy
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
