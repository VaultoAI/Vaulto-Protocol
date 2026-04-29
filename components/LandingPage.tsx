"use client";

import { HeroSection } from "./landing/HeroSection";
import { FeatureSection } from "./landing/FeatureSection";
import { TokenTicker, CodeBlock, ChainDiagram } from "./landing/FeatureVisuals";
import { LandingFooter } from "./landing/LandingFooter";
import { MobileSignIn } from "./landing/MobileSignIn";
import { signInWithGoogle } from "@/app/actions/auth";
import { useState, useEffect, useCallback, useRef } from "react";

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
  const [isReturningEmployee, setIsReturningEmployee] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const googleFormRef = useRef<HTMLFormElement>(null);

  // Ensure light mode on landing page (fallback - main prevention is in layout.tsx themeScript)
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    setIsEmbedded(isEmbeddedBrowser());
    // Check if user is a returning Vaulto employee
    setIsReturningEmployee(localStorage.getItem("vaulto-employee-returning") === "true");
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

  const handleJoinWaitlist = () => {
    if (isEmbedded) {
      // Show email form modal for embedded browsers (Google OAuth doesn't work there)
      setShowWaitlistModal(true);
      setError(null);
    } else {
      // Directly trigger Google sign-in for normal browsers
      googleFormRef.current?.requestSubmit();
    }
  };

  const closeWaitlistModal = () => {
    setShowWaitlistModal(false);
    setEmail("");
    setFirstName("");
    setError(null);
  };

  return (
    <>
      {/* Mobile sign-in - only for returning Vaulto employees */}
      {isReturningEmployee && (
        <div className="sm:hidden">
          <MobileSignIn />
        </div>
      )}

      {/* Landing page - always visible on desktop, only for non-returning users on mobile */}
      <div className={`landing-page-light min-h-screen bg-[var(--background)] ${isReturningEmployee ? "hidden sm:block" : ""}`} style={{ zoom: 0.9 }}>
        {/* Hidden form for Google sign-in */}
        <form ref={googleFormRef} action={signInWithGoogle} className="hidden" />

      {/* Hero Section */}
      <HeroSection onJoinWaitlist={handleJoinWaitlist} />

      {/* Feature Section 1: Pre-IPO Synthetic Tokens */}
      <FeatureSection
        id="features"
        badge="Synthetic Tokens"
        headline="Trade Tomorrow's Giants Today"
        subheadline="Trade unicorns before they go public."
        theme="blue"
        features={[
          {
            title: "Prediction Market Pricing",
            description: "Prices derived from real-time Polymarket odds for transparent valuations",
            highlight: true,
          },
          {
            title: "Trade From $10",
            description: "Own fractional shares of SpaceX, Anthropic, and other unicorns",
            highlight: true,
          },
          { title: "24/7 trading" },
          { title: "No accreditation required" },
        ]}
        visual={<TokenTicker />}
        actionButton={{
          text: "Join Waitlist",
          onClick: handleJoinWaitlist,
        }}
      />

      {/* Feature Section 2: Price Oracle AMM */}
      <FeatureSection
        id="amm"
        badge="Price Oracle AMM"
        headline="Institutional-Grade Liquidity"
        subheadline="Deep liquidity. Minimal slippage."
        theme="blue"
        reversed
        features={[
          {
            title: "Concentrated Liquidity",
            description: "Uniswap V3-style efficiency for tighter spreads and less slippage",
            highlight: true,
          },
          {
            title: "MEV Protection",
            description: "Safeguards against sandwich attacks and front-running",
            highlight: true,
          },
          { title: "On-chain transparency" },
          { title: "Audited contracts" },
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
        subheadline="Seamless cross-chain transfers."
        theme="cyan"
        features={[
          {
            title: "Solana + Polygon",
            description: "Move your tokens seamlessly between chains in seconds with our Wormhole NTT integration",
            highlight: true,
          },
          {
            title: "Enterprise Security",
            description: "Built on Wormhole infrastructure with rate limiting and secure lock/mint mechanics",
            highlight: true,
          },
          { title: "7 tokens supported" },
        ]}
        visual={<ChainDiagram />}
        link={{
          text: "Wormhole NTT Docs",
          href: "https://wormhole.com/docs/products/token-transfers/native-token-transfers/overview/",
        }}
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
            Join the waitlist to be among the first
            <br />
            to trade pre-IPO tokens.
          </p>
          <button
            onClick={handleJoinWaitlist}
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-sm">
          <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 sm:p-6 max-h-[85vh] overflow-y-auto shadow-2xl">
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

            <form onSubmit={handleEmailSignup} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 sm:py-2.5 text-base sm:text-sm min-h-[48px] text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--foreground)]/30 focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 sm:py-2.5 text-base sm:text-sm min-h-[48px] text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--foreground)]/30 focus:outline-none"
              />
              {error && (
                <p className="text-left text-sm text-red-500" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="group relative flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-500 px-5 py-3 sm:py-2.5 min-h-[48px] text-sm font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-60"
              >
                {submitting ? "Signing up..." : "Sign up with email"}
              </button>
            </form>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
