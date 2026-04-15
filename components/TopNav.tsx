"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { WalletDropdown } from "@/components/WalletDropdown";
import { SearchDropdown } from "@/components/SearchDropdown";

/**
 * Horizontal top navigation bar.
 * Logo left, search bar center, market status + theme switch + connect wallet right.
 */
export function TopNav() {
  const pathname = usePathname();

  const isExplorePage = pathname === "/explore";

  return (
    <header className={`border-b border-border bg-background ${isExplorePage ? "sticky top-0 z-50" : ""}`}>
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
        {/* Left: Logo + Search bar */}
        <div className="flex items-center gap-4">
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

          {/* Search bar with dropdown - categories mode on explore, companies mode elsewhere */}
          <div className="hidden sm:block">
            <SearchDropdown mode={pathname === "/explore" ? "categories" : "companies"} />
          </div>
        </div>

        {/* Right: Market Status + Wallet */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden md:inline-flex items-center gap-1.5 text-sm text-muted">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green" />
            </span>
            <span className="text-green font-medium">Market Open</span>
          </span>
          <WalletDropdown />
        </div>
      </div>
    </header>
  );
}
