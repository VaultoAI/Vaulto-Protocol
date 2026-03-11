"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";

// Open Google OAuth in external window/tab to avoid 403 "Disallowed user agent" from embedded browsers
const GOOGLE_SIGNIN_URL = "/api/auth/signin/google?callbackUrl=%2Fwaitlist-success";

// User-agent patterns for in-app / embedded browsers (Google blocks OAuth in these)
const EMBEDDED_BROWSER_PATTERNS =
  /WebView|wv\)|Instagram|FBAN|FBAV|Line\/|Twitter|Slack|Discord|Electron|CriOS|FxiOS|EdgiOS|InApp|SamsungBrowser\/.*Mobile/i;

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
        window.location.href = `/waitlist-success?from=email&name=${nameParam}`;
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
          <a
            href={GOOGLE_SIGNIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="animate-fade-in-up animation-delay-500 group relative flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-5 py-2.5 text-sm text-[var(--foreground)] transition-all duration-300 hover:border-[var(--foreground)]/20 hover:shadow-lg hover:shadow-purple-500/10"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-medium">Sign up with Google</span>
            <div className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-cyan-500/0 opacity-0 blur-xl transition-opacity duration-300 group-hover:from-blue-500/20 group-hover:via-purple-500/20 group-hover:to-cyan-500/20 group-hover:opacity-100" />
          </a>
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
