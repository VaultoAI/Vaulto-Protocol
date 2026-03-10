"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CurrentUserStats, WaitlistLeaderboard } from "./waitlist";
import { TickProvider } from "@/hooks/waitlist";

// Company logos for floating background - positioned on edges to avoid content overlap
const FLOATING_LOGOS = [
  // Left edge (staggered vertically with ~20% gaps)
  { domain: "spacex.com", name: "SpaceX", size: 64, top: "5%", left: "3%", delay: "0s" },
  { domain: "openai.com", name: "OpenAI", size: 52, top: "28%", left: "6%", delay: "1s" },
  { domain: "databricks.com", name: "Databricks", size: 48, top: "52%", left: "4%", delay: "2s" },
  { domain: "figma.com", name: "Figma", size: 56, top: "78%", left: "7%", delay: "0.8s" },
  // Right edge (staggered vertically with ~20% gaps)
  { domain: "stripe.com", name: "Stripe", size: 48, top: "8%", right: "4%", delay: "0.5s" },
  { domain: "anthropic.com", name: "Anthropic", size: 72, top: "32%", right: "3%", delay: "1.5s" },
  { domain: "discord.com", name: "Discord", size: 44, top: "58%", right: "5%", delay: "0.3s" },
  { domain: "notion.so", name: "Notion", size: 50, top: "82%", right: "4%", delay: "1.3s" },
  // Top corners (spread horizontally)
  { domain: "scale.com", name: "Scale AI", size: 40, top: "3%", left: "22%", delay: "0.2s" },
  { domain: "neuralink.com", name: "Neuralink", size: 44, top: "6%", right: "20%", delay: "0.7s" },
  // Bottom corners (spread horizontally)
  { domain: "perplexity.ai", name: "Perplexity", size: 46, top: "88%", left: "25%", delay: "1.2s" },
  { domain: "anduril.com", name: "Anduril", size: 58, top: "90%", right: "22%", delay: "1.8s" },
];

interface WaitlistSuccessProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  userData?: {
    createdAt: string;
    bonusPoints: number;
    hasSharedToX: boolean;
  } | null;
}

export function WaitlistSuccess({ user, userData }: WaitlistSuccessProps) {
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
          <div
            key={logo.domain}
            className="group absolute animate-float-logo"
            style={{
              top: logo.top,
              left: logo.left,
              right: logo.right,
              animationDelay: logo.delay,
              animationDuration: `${8 + (index % 4) * 2}s`,
            }}
          >
            <div className="relative flex flex-col items-center">
              <img
                src={`https://www.google.com/s2/favicons?domain=${logo.domain}&sz=128`}
                alt={logo.name}
                className="rounded-full object-contain opacity-[0.06] transition-opacity duration-300 group-hover:opacity-80 dark:opacity-[0.04] sm:opacity-[0.15] sm:dark:opacity-[0.12]"
                style={{ width: logo.size, height: logo.size }}
              />
              <span className="pointer-events-none absolute -bottom-6 whitespace-nowrap text-xs font-bold text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {logo.name}
              </span>
            </div>
          </div>
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
        </h1>

        <p className="animate-fade-in-up animation-delay-300 mb-8 max-w-md text-center text-[var(--muted)]">
          We&apos;ll notify{" "}
          <span className="text-[var(--foreground)]">{user.email}</span> when
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
      </div>
    </div>
  );
}
