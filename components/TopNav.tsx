"use client";

import Link from "next/link";
import Image from "next/image";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { ConnectWalletWithBalance } from "@/components/ConnectWalletWithBalance";

/**
 * Horizontal top navigation bar.
 * Logo left, theme switch + connect wallet right.
 */
export function TopNav() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
        {/* Left: Logo + Theme Toggle */}
        <div className="flex items-center gap-3">
          <Link href="/explore" className="flex items-center shrink-0">
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
          <ThemeSwitch />
        </div>

        {/* Right: Wallet */}
        <ConnectWalletWithBalance />
      </div>
    </header>
  );
}
