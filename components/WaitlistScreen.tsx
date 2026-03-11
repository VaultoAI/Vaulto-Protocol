"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { GoogleSignInButton } from "./GoogleSignInButton";

// User-agent patterns for in-app / embedded browsers (Google blocks OAuth in these)
// NOTE: CriOS (Chrome iOS), FxiOS (Firefox iOS), EdgiOS (Edge iOS), and SamsungBrowser
// are real browsers, NOT embedded WebViews. Google OAuth redirect flow works fine in them.
const EMBEDDED_BROWSER_PATTERNS =
  /WebView|wv\)|Instagram|FBAN|FBAV|Line\/|Twitter|Slack|Discord|Electron|InApp/i;

function isEmbeddedBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const inIframe = typeof window !== "undefined" && window.self !== window.top;
  return inIframe || EMBEDDED_BROWSER_PATTERNS.test(ua);
}

export function WaitlistScreen() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsEmbedded(isEmbeddedBrowser());
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
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
          setError((data.message as string) || data.error || "Something went wrong. Please try again.");
          return;
        }
        const nameParam = encodeURIComponent(trimmedFirstName);
        const createdAtParam = data.createdAt ? `&createdAt=${encodeURIComponent(data.createdAt)}` : "";
        window.location.href = `/waitlist-success?from=email&name=${nameParam}${createdAtParam}`;
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [email, firstName]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[var(--background)]">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="animate-gradient-shift absolute -inset-[100%] opacity-30">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 blur-3xl" />
        </div>
      </div>

      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="animate-float-1 absolute left-[10%] top-[20%] h-64 w-64 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl" />
        <div className="animate-float-2 absolute right-[15%] top-[60%] h-96 w-96 rounded-full bg-gradient-to-br from-purple-500/10 to-cyan-500/10 blur-3xl" />
        <div className="animate-float-3 absolute bottom-[20%] left-[60%] h-72 w-72 rounded-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px),
                           linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div className="animate-fade-in-up relative z-10 flex flex-col items-center px-6 text-center">
        {/* Logo */}
        <div className="animate-scale-in mb-8">
          {mounted && (
            <Image
              src={isDark ? "/vaulto-logo-dark.png" : "/vaulto-logo-light.png"}
              alt="Vaulto"
              width={180}
              height={48}
              priority
              className="h-12 w-auto"
            />
          )}
        </div>

        {/* Tagline */}
        <h1 className="animate-fade-in-up animation-delay-200 mb-1 text-4xl font-light tracking-tight text-[var(--foreground)] sm:text-5xl md:text-6xl">
          The Future of
        </h1>
        <h1 className="animate-fade-in-up animation-delay-300 mb-12 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl md:text-6xl">
          Private Investing
        </h1>

        {/* When embedded: email form (Google blocks OAuth). Otherwise: Google link in new tab. */}
        {isEmbedded ? (
          <form
            onSubmit={handleEmailSignup}
            className="animate-fade-in-up animation-delay-500 flex w-full max-w-sm flex-col gap-3"
          >
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
              className="group relative flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-5 py-2.5 text-sm text-[var(--foreground)] transition-all duration-300 hover:border-[var(--foreground)]/20 hover:shadow-lg hover:shadow-purple-500/10 disabled:opacity-60"
            >
              <span className="font-medium">Sign up with email</span>
              <div className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-cyan-500/0 opacity-0 blur-xl transition-opacity duration-300 group-hover:from-blue-500/20 group-hover:via-purple-500/20 group-hover:to-cyan-500/20 group-hover:opacity-100" />
            </button>
          </form>
        ) : (
          <GoogleSignInButton />
        )}

        {/* Subtle hint text */}
        <p className="animate-fade-in-up animation-delay-600 mt-6 text-sm text-[var(--muted)]">
          Join the waitlist for early access
        </p>

        {/* Subtle animated line */}
        <div className="animate-fade-in-up animation-delay-600 mt-6 h-px w-32 overflow-hidden bg-[var(--border)]">
          <div className="animate-shimmer h-full w-full bg-gradient-to-r from-transparent via-[var(--foreground)] to-transparent opacity-50" />
        </div>
      </div>

      {/* Bottom corner accent */}
      <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-1/2 translate-y-1/2 rounded-full bg-gradient-to-br from-purple-500/5 to-blue-500/5 blur-3xl" />
      <div className="absolute left-0 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-cyan-500/5 to-purple-500/5 blur-3xl" />
    </div>
  );
}
