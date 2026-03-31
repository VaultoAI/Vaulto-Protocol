"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { ChevronRight } from "lucide-react";

export function ConnectWalletWithBalance() {
  const { ready, authenticated, login, logout } = usePrivy();
  const {
    tradingWallet,
    formattedBalance,
    isActive,
    externalWallet,
  } = useTradingWallet();

  // Loading state placeholder
  if (!ready) {
    return (
      <div aria-hidden className="flex items-center gap-2">
        <div className="h-10 w-24 animate-pulse rounded-lg bg-foreground/10" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-foreground/10" />
      </div>
    );
  }

  // Not authenticated
  if (!authenticated) {
    return (
      <button
        onClick={login}
        type="button"
        className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black shadow-sm ring-1 ring-black/10 transition hover:bg-gray-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-gray-100"
      >
        Connect Wallet
      </button>
    );
  }

  // Authenticated but no trading wallet yet
  if (!tradingWallet || !isActive) {
    const displayAddress = externalWallet?.address;
    return (
      <button
        onClick={logout}
        type="button"
        className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black shadow-sm ring-1 ring-black/10 transition hover:bg-gray-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-gray-100"
      >
        {displayAddress
          ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
          : "Connected"}
      </button>
    );
  }

  // Authenticated with active trading wallet
  return (
    <div className="flex items-center gap-2">
      {/* Balance Display */}
      <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-foreground/5 px-3 py-2">
        <span className="text-sm font-medium text-foreground">
          ${formattedBalance}
        </span>
        <span className="text-xs text-muted">USDC</span>
      </div>

      {/* Wallet Button - Links to /profile */}
      <Link
        href="/profile"
        className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-medium text-black shadow-sm ring-1 ring-black/10 transition hover:bg-gray-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-gray-100"
      >
        {/* Mobile: Show balance inline */}
        <span className="sm:hidden text-muted text-xs">
          ${formattedBalance}
        </span>
        <span className="hidden sm:inline font-mono">
          {tradingWallet.address.slice(0, 6)}...
          {tradingWallet.address.slice(-4)}
        </span>
        <ChevronRight className="h-4 w-4 text-gray-500" />
      </Link>
    </div>
  );
}
