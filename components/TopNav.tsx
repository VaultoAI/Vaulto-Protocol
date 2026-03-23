"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

const nav = [
  { href: "/mint", label: "Explore" },
  { href: "/swap", label: "Swap" },
  { href: "/earn", label: "Earn" },
  { href: "/predictions", label: "Predictions" },
] as const;

function HamburgerIcon() {
  return (
    <span className="relative block h-5 w-6">
      <span className="absolute left-0 top-0 block h-0.5 w-6 bg-current" />
      <span className="absolute left-0 top-2 block h-0.5 w-6 bg-current" />
      <span className="absolute left-0 top-4 block h-0.5 w-6 bg-current" />
    </span>
  );
}

function CloseIcon() {
  return (
    <span className="relative block h-3.5 w-3.5">
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 rotate-45 bg-current" />
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 -rotate-45 bg-current" />
    </span>
  );
}

/**
 * Horizontal top navigation bar matching Ondo Finance style.
 * Logo left, nav links center, theme switch + connect wallet right.
 */
export function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
          {/* Left: Logo */}
          <Link href="/mint" className="flex items-center shrink-0">
            <span className="relative h-7 w-[100px] dark:hidden">
              <Image
                src="/vaulto-logo-light.png"
                alt="Vaulto"
                fill
                className="object-contain object-left"
                sizes="100px"
              />
            </span>
            <span className="relative h-7 w-[100px] hidden dark:block">
              <Image
                src="/vaulto-logo-dark.png"
                alt="Vaulto"
                fill
                className="object-contain object-left"
                sizes="100px"
              />
            </span>
          </Link>

          {/* Center: Nav links (desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            {nav.map(({ href, label }) => {
              const active = pathname === href || (href === "/mint" && pathname.startsWith("/mint"));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "text-foreground bg-badge-bg"
                      : "text-muted hover:text-foreground hover:bg-badge-bg/50"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Theme + Wallet (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeSwitch />
            <ConnectWalletButton />
          </div>

          {/* Mobile: hamburger + wallet */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeSwitch />
            <ConnectWalletButton />
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-opacity hover:opacity-80"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <CloseIcon /> : <HamburgerIcon />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background px-6 py-3">
            <nav className="flex flex-col gap-1">
              {nav.map(({ href, label }) => {
                const active = pathname === href || (href === "/mint" && pathname.startsWith("/mint"));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "text-foreground bg-badge-bg"
                        : "text-muted hover:text-foreground hover:bg-badge-bg/50"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
