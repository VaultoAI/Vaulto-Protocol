"use client";

import { HeroSection } from "./landing/HeroSection";
import { FeatureSection } from "./landing/FeatureSection";
import { TokenTicker, CodeBlock, ChainDiagram } from "./landing/FeatureVisuals";
import { LandingFooter } from "./landing/LandingFooter";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { useState, useEffect, useCallback } from "react";

// User-agent patterns for in-app / embedded browsers (Google blocks OAuth in these)
const EMBEDDED_BROWSER_PATTERNS =
  /WebView|wv\)|Instagram|FBAN|FBAV|Line\/|Twitter|Slack|Discord|Electron|InApp/i;

function isEmbeddedBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const inIframe = typeof window !== "undefined" && window.self !== window.top;
  return inIframe || EMBEDDED_BROWSER_PATTERNS.test(ua);
}

export function LandingPage() {
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Force light mode on the landing page
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");

    return () => {
      // Restore dark mode on unmount if it was previously set
      if (wasDark) {
        document.documentElement.classList.add("dark");
      }
    };
  }, []);

  useEffect(() => {
    setIsEmbedded(isEmbeddedBrowser());
  }, []);

  const handleEmailSignup = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const trimmedEmail = email.trim();
      const trimmedFirstName = firstName.trim();
      if (!trimmedEmail || !trimmedFirstName) {
        setError("Please enter your email and first name.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch("/api/waitlist/email-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmedEmail,
            firstName: trimmedFirstName,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            (data.message as string) ||
              data.error ||
              "Something went wrong. Please try again."
          );
          return;
        }
        const nameParam = encodeURIComponent(trimmedFirstName);
        const createdAtParam = data.createdAt
          ? `&createdAt=${encodeURIComponent(data.createdAt)}`
          : "";
        window.location.href = `/waitlist-success?from=email&name=${nameParam}${createdAtParam}`;
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [email, firstName]
  );

  const openWaitlistModal = () => {
    setShowWaitlistModal(true);
    setError(null);
  };

  const closeWaitlistModal = () => {
    setShowWaitlistModal(false);
    setEmail("");
    setFirstName("");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Hero Section */}
      <HeroSection onJoinWaitlist={openWaitlistModal} />

      {/* Feature Section 1: Pre-IPO Synthetic Tokens */}
      <FeatureSection
        id="features"
        badge="Synthetic Tokens"
        headline="Trade Tomorrow's Giants Today"
        subheadline="Access synthetic tokens of unicorn companies before their IPO. Real-time pricing derived from prediction market data."
        theme="blue"
        features={[
          {
            title: "Polymarket-derived pricing",
            description: "Prices reflect prediction market odds",
          },
          {
            title: "Real-time valuations",
            description: "Continuously updated company valuations",
          },
          {
            title: "Major private companies",
            description: "Trade SpaceX, Anthropic, OpenAI, and more",
          },
          {
            title: "24/7 trading",
            description: "No market hours restrictions",
          },
          {
            title: "Fractional ownership",
            description: "Start trading with as little as $1",
          },
        ]}
        visual={<TokenTicker />}
      />

      {/* Feature Section 2: Price Oracle AMM */}
      <FeatureSection
        id="amm"
        badge="Price Oracle AMM"
        headline="Institutional-Grade Liquidity"
        subheadline="Uniswap V3-powered automated market maker designed for capital efficiency and deep liquidity."
        theme="blue"
        reversed
        features={[
          {
            title: "Concentrated liquidity",
            description: "Capital-efficient position management",
          },
          {
            title: "Deep liquidity pools",
            description: "Minimize slippage on large trades",
          },
          {
            title: "Transparent on-chain pricing",
            description: "All trades execute on-chain",
          },
          {
            title: "Open-source contracts",
            description: "Audited smart contracts you can verify",
          },
          {
            title: "MEV-resistant execution",
            description: "Protected from front-running attacks",
          },
        ]}
        visual={<CodeBlock />}
        link={{
          text: "View on GitHub",
          href: "https://github.com/VaultoAI/price-oracle-amm",
        }}
      />

      {/* Feature Section 3: Cross-Chain Bridge */}
      <FeatureSection
        id="bridge"
        badge="Cross-Chain Bridge"
        headline="One Token, Multiple Chains"
        subheadline="Wormhole NTT bridge for seamless cross-chain transfers between Solana and Polygon."
        theme="cyan"
        features={[
          {
            title: "Instant transfers",
            description: "Move tokens between Solana and Polygon",
          },
          {
            title: "7 supported tokens",
            description: "vSPACEX, vANTHROPIC, vOPENAI, and more",
          },
          {
            title: "Secure lock/mint mechanics",
            description: "Built-in rate limiting for safety",
          },
          {
            title: "Enterprise-grade security",
            description: "Powered by Wormhole infrastructure",
          },
        ]}
        visual={<ChainDiagram />}
      />

      {/* CTA Section */}
      <section className="relative py-24">
        <div className="absolute inset-0 overflow-hidden">
          <div className="animate-gradient-shift absolute -inset-[100%] opacity-20">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-blue-400/20 to-cyan-500/20 blur-3xl" />
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">
            Ready to Get Started?
          </h2>
          <p className="mb-8 text-lg text-[var(--muted)]">
            Join the waitlist to be among the first to trade pre-IPO synthetic
            tokens.
          </p>
          <button
            onClick={openWaitlistModal}
            className="group relative rounded-lg bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-500 px-8 py-3 text-sm font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25"
          >
            Join Waitlist
            <div className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-500 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-50" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <LandingFooter />

      {/* Waitlist Modal */}
      {showWaitlistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-2xl">
            {/* Close button */}
            <button
              onClick={closeWaitlistModal}
              className="absolute right-4 top-4 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <h3 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
              Join the Waitlist
            </h3>
            <p className="mb-6 text-sm text-[var(--muted)]">
              Get early access to trade synthetic pre-IPO tokens.
            </p>

            {isEmbedded ? (
              <form onSubmit={handleEmailSignup} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--foreground)]/30 focus:outline-none"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--foreground)]/30 focus:outline-none"
                />
                {error && (
                  <p className="text-left text-sm text-red-500" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-60"
                >
                  {submitting ? "Signing up..." : "Sign up with email"}
                </button>
              </form>
            ) : (
              <div className="flex justify-center">
                <GoogleSignInButton />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
