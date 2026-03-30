"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function NotFound() {
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[var(--background)]">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="animate-gradient-shift absolute -inset-[100%] opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-orange-500/20 to-yellow-500/20 blur-3xl" />
        </div>
      </div>

      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="animate-float-1 absolute left-[10%] top-[20%] h-64 w-64 rounded-full bg-gradient-to-br from-red-500/10 to-orange-500/10 blur-3xl" />
        <div className="animate-float-2 absolute right-[15%] top-[60%] h-96 w-96 rounded-full bg-gradient-to-br from-orange-500/10 to-yellow-500/10 blur-3xl" />
        <div className="animate-float-3 absolute bottom-[20%] left-[60%] h-72 w-72 rounded-full bg-gradient-to-br from-yellow-500/10 to-red-500/10 blur-3xl" />
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
            <Link href="/">
              <Image
                src={isDark ? "/vaulto-logo-dark.png" : "/vaulto-logo-light.png"}
                alt="Vaulto"
                width={140}
                height={38}
                priority
                className="h-10 w-auto transition-opacity hover:opacity-80"
              />
            </Link>
          )}
        </div>

        {/* 404 Display */}
        <div className="animate-fade-in-up animation-delay-200 relative mb-6">
          {/* Vault door icon */}
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-lg">
            <svg
              className="h-12 w-12 text-[var(--muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <h1 className="text-8xl font-bold tracking-tighter text-[var(--foreground)] sm:text-9xl">
            4
            <span className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
              0
            </span>
            4
          </h1>
        </div>

        {/* Message */}
        <h2 className="animate-fade-in-up animation-delay-300 mb-3 text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
          This vault is empty
        </h2>
        <p className="animate-fade-in-up animation-delay-400 mb-8 max-w-md text-[var(--muted)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved to a different location.
        </p>

        {/* Action buttons */}
        <div className="animate-fade-in-up animation-delay-500 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="group relative inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--foreground)] px-6 py-3 text-sm font-medium text-[var(--background)] transition-all duration-300 hover:opacity-90"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
            Return Home
          </Link>
          <Link
            href="/mint"
            className="group relative inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-6 py-3 text-sm font-medium text-[var(--foreground)] transition-all duration-300 hover:border-[var(--foreground)]/20 hover:bg-[var(--card-hover)]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            Explore Assets
          </Link>
        </div>

        {/* Helpful links */}
        <div className="animate-fade-in-up animation-delay-600 mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <span className="text-[var(--muted)]">Quick links:</span>
          <Link
            href="/portfolio"
            className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Portfolio
          </Link>
          <Link
            href="/swap"
            className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Swap
          </Link>
          <Link
            href="/earn"
            className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Earn
          </Link>
        </div>

        {/* Subtle animated line */}
        <div className="animate-fade-in-up animation-delay-600 mt-8 h-px w-32 overflow-hidden bg-[var(--border)]">
          <div className="animate-shimmer h-full w-full bg-gradient-to-r from-transparent via-[var(--foreground)] to-transparent opacity-50" />
        </div>
      </div>

      {/* Bottom corner accents */}
      <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-1/2 translate-y-1/2 rounded-full bg-gradient-to-br from-orange-500/5 to-red-500/5 blur-3xl" />
      <div className="absolute left-0 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-yellow-500/5 to-orange-500/5 blur-3xl" />
    </div>
  );
}
