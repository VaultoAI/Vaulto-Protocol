"use client";

import Image from "next/image";
import { useEffect, useState, useRef, useCallback } from "react";
import { CurrentUserStats, WaitlistLeaderboard, PointsCounter } from "./waitlist";
import { TickProvider, useLeaderboard } from "@/hooks/waitlist";

// Company logos for floating background - positioned on edges to avoid content overlap
const FLOATING_LOGOS = [
  // Left edge (staggered vertically with ~20% gaps)
  { domain: "spacex.com", name: "SpaceX", size: 64, top: "5%", left: "3%", delay: "0s" },
  { domain: "openai.com", name: "OpenAI", size: 52, top: "28%", left: "6%", delay: "1s" },
  { domain: "databricks.com", name: "Databricks", size: 48, top: "52%", left: "4%", delay: "2s" },
  { domain: "figma.com", name: "Figma", size: 56, top: "78%", left: "7%", delay: "0.8s", hideOnMobile: true },
  // Right edge (staggered vertically with ~20% gaps)
  { domain: "stripe.com", name: "Stripe", size: 48, top: "8%", right: "4%", delay: "0.5s" },
  { domain: "anthropic.com", name: "Anthropic", size: 72, top: "32%", right: "3%", delay: "1.5s" },
  { domain: "discord.com", name: "Discord", size: 44, top: "58%", right: "5%", delay: "0.3s" },
  { domain: "notion.so", name: "Notion", size: 50, top: "82%", right: "4%", delay: "1.3s", hideOnMobile: true },
  // Top corners (spread horizontally)
  { domain: "scale.com", name: "Scale AI", size: 40, top: "3%", left: "22%", delay: "0.2s", hideOnMobile: true },
  { domain: "neuralink.com", name: "Neuralink", size: 44, top: "6%", right: "20%", delay: "0.7s" },
  // Bottom corners (spread horizontally)
  { domain: "perplexity.ai", name: "Perplexity", size: 46, top: "88%", left: "25%", delay: "1.2s", hideOnMobile: true },
  { domain: "anduril.com", name: "Anduril", size: 58, top: "90%", right: "22%", delay: "1.8s", hideOnMobile: true },
];

function FloatingLogo({
  logo,
  index,
}: {
  logo: (typeof FLOATING_LOGOS)[number];
  index: number;
}) {
  const [priceChange, setPriceChange] = useState(1.5); // Consistent initial value for SSR
  const hasMounted = useRef(false);

  useEffect(() => {
    // Set random value only after mount to avoid hydration mismatch
    if (!hasMounted.current) {
      setPriceChange(Math.random() * 3.5 - 0.5);
      hasMounted.current = true;
    }
  }, []);

  const handleMouseEnter = () => {
    // Generate new random value on each hover
    setPriceChange(Math.random() * 3.5 - 0.5);
  };

  const isPositive = priceChange >= 0;

  return (
    <div
      className={`group absolute animate-float-logo ${logo.hideOnMobile ? "hidden sm:block" : ""}`}
      style={{
        top: logo.top,
        left: logo.left,
        right: logo.right,
        animationDelay: logo.delay,
        animationDuration: `${8 + (index % 4) * 2}s`,
      }}
      onMouseEnter={handleMouseEnter}
    >
      <div className="relative flex flex-col items-center">
        <img
          src={`https://www.google.com/s2/favicons?domain=${logo.domain}&sz=128`}
          alt={logo.name}
          className="rounded-full object-contain opacity-[0.06] transition-opacity duration-300 group-hover:opacity-80 dark:opacity-[0.04] sm:opacity-[0.15] sm:dark:opacity-[0.12]"
          style={{ width: logo.size, height: logo.size }}
        />
        <div className="pointer-events-none absolute -bottom-10 flex flex-col items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="whitespace-nowrap text-xs font-bold text-white">
            {logo.name}
          </span>
          <span
            className={`text-xs font-medium ${
              isPositive ? "text-green-500" : "text-red-500"
            }`}
          >
            {isPositive ? "+" : ""}
            {priceChange.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

interface WaitlistSuccessProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  userData?: {
    createdAt: string;
    bonusPoints: number;
    hasSharedToX: boolean;
  } | null;
  pendingReferralCode?: string | null;
  /** When set, render minimal "You're on the list" with first name only (no session). */
  emailSignupFirstName?: string;
}

export function WaitlistSuccess({
  user,
  userData,
  pendingReferralCode,
  emailSignupFirstName,
}: WaitlistSuccessProps) {
  const isEmailSignupMode = !!emailSignupFirstName && !user;
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  // Process referral code from cookie (user signed up via ?ref= link)
  useEffect(() => {
    if (!pendingReferralCode) return;

    const apply = async () => {
      try {
        const res = await fetch("/api/waitlist/process-referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referralCode: pendingReferralCode }),
        });
        const data = await res.json();
        if (data.success) {
          document.cookie =
            "waitlist_ref=; path=/; max-age=0; SameSite=Lax";
        }
      } catch {
        // Keep cookie so we can retry
      }
    };
    apply();
  }, [pendingReferralCode]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-[var(--background)]">
      {/* Animated gradient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-gradient-shift absolute -inset-[100%] opacity-30">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 blur-3xl" />
        </div>
      </div>

      {/* Floating company logos */}
      <div className="fixed inset-0 overflow-hidden">
        {FLOATING_LOGOS.map((logo, index) => (
          <FloatingLogo key={logo.domain} logo={logo} index={index} />
        ))}
      </div>

      {/* Floating orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-float-1 absolute left-[10%] top-[20%] h-64 w-64 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl" />
        <div className="animate-float-2 absolute right-[15%] top-[60%] h-96 w-96 rounded-full bg-gradient-to-br from-purple-500/10 to-cyan-500/10 blur-3xl" />
        <div className="animate-float-3 absolute bottom-[20%] left-[60%] h-72 w-72 rounded-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center px-6 py-12">

        {/* Logo */}
        <div className="animate-scale-in mb-12">
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

        {/* Success message */}
        <h1 className="animate-fade-in-up animation-delay-200 mb-6 text-center text-3xl font-light text-[var(--foreground)] sm:text-4xl">
          You&apos;re on the list
          {isEmailSignupMode && emailSignupFirstName ? (
            <span className="block mt-1 text-2xl sm:text-3xl">, {emailSignupFirstName}</span>
          ) : null}
        </h1>

        {isEmailSignupMode ? (
          <>
            <p className="animate-fade-in-up animation-delay-300 mb-8 max-w-md text-center text-[var(--muted)]">
              We&apos;ll notify you when Vaulto is ready.
            </p>

            {/* Points display for email signup users */}
            {userData && (
              <TickProvider>
                <div className="animate-fade-in-up animation-delay-400 w-full">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-sm text-[var(--muted)]">Your Points</div>
                      <div className="text-3xl font-semibold text-[var(--foreground)]">
                        <PointsCounter
                          createdAt={userData.createdAt}
                          bonusPoints={userData.bonusPoints}
                        />
                      </div>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        Your points increase every second. Sign in with Google later to see your rank and share with friends.
                      </p>
                    </div>
                  </div>
                </div>
              </TickProvider>
            )}
          </>
        ) : (
          <>
            <p className="animate-fade-in-up animation-delay-300 mb-8 max-w-md text-center text-[var(--muted)]">
              We&apos;ll notify{" "}
              <span className="text-[var(--foreground)]">{user?.email}</span> when
              Vaulto is ready.
            </p>

            {/* Stats and Leaderboard */}
            {userData && (
              <TickProvider>
                <div className="animate-fade-in-up animation-delay-400 w-full space-y-6">
                  <CurrentUserStats />
                  <WaitlistLeaderboard />
                </div>
              </TickProvider>
            )}
          </>
        )}
      </div>
    </div>
  );
}
