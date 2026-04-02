"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useFundWallet } from "@privy-io/react-auth";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { polygon } from "viem/chains";
import {
  ChevronDown,
  Copy,
  ExternalLink,
  Plus,
  User,
  LogOut,
  Check,
} from "lucide-react";
import { GradientAvatar } from "@/components/GradientAvatar";
import { generateUsername } from "@/lib/utils/username";

export function WalletDropdown() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { fundWallet } = useFundWallet();
  const {
    tradingWallet,
    embeddedWallet,
    formattedBalance,
    isActive,
    externalWallet,
  } = useTradingWallet();

  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleCopyAddress = async () => {
    const address = tradingWallet?.address || embeddedWallet?.address;
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFundWallet = async () => {
    const address = tradingWallet?.address || embeddedWallet?.address;
    if (!address) return;

    setIsFunding(true);
    try {
      await fundWallet({
        address,
        options: {
          chain: polygon,
          asset: "USDC",
        },
      });
    } catch (error) {
      console.error("Failed to open fund wallet modal:", error);
    } finally {
      setIsFunding(false);
      setIsOpen(false);
    }
  };

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  const walletAddress = tradingWallet?.address || embeddedWallet?.address;
  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

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

  // Authenticated with active trading wallet - show dropdown
  return (
    <div className="flex items-center gap-2">
      {/* Balance Display */}
      <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-foreground/5 px-3 py-2">
        <span className="text-sm font-medium text-foreground">
          ${formattedBalance}
        </span>
        <span className="text-xs text-muted">USDC</span>
      </div>

      {/* Wallet Dropdown */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          type="button"
          className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-medium text-black shadow-sm ring-1 ring-black/10 transition hover:bg-gray-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-gray-100"
        >
          {/* Mobile: Show balance inline */}
          <span className="sm:hidden text-muted text-xs">
            ${formattedBalance}
          </span>
          <span className="hidden sm:inline font-mono">{truncatedAddress}</span>
          <ChevronDown
            className={`h-4 w-4 text-gray-500 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10">
            {/* Wallet Info Header */}
            <div className="border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <GradientAvatar address={walletAddress!} size={32} className="rounded-full" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {generateUsername(walletAddress!)}
                  </p>
                  <p className="text-xs text-gray-500 font-mono truncate dark:text-gray-400">
                    {truncatedAddress}
                  </p>
                </div>
              </div>
              <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                ${formattedBalance}{" "}
                <span className="text-sm font-normal text-gray-500">USDC</span>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              {/* Fund Wallet */}
              <button
                onClick={handleFundWallet}
                disabled={isFunding}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-zinc-800"
              >
                <Plus className="h-4 w-4 text-green-600" />
                <span>{isFunding ? "Opening..." : "Fund Wallet"}</span>
              </button>

              {/* Copy Address */}
              <button
                onClick={handleCopyAddress}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-800"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-500" />
                )}
                <span>{copied ? "Copied!" : "Copy Address"}</span>
              </button>

              {/* View on Explorer */}
              <a
                href={`https://polygonscan.com/address/${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-800"
              >
                <ExternalLink className="h-4 w-4 text-gray-500" />
                <span>View on PolygonScan</span>
              </a>

              {/* Divider */}
              <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />

              {/* Profile */}
              <Link
                href="/profile"
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-800"
              >
                <User className="h-4 w-4 text-gray-500" />
                <span>Account</span>
              </Link>

              {/* Divider */}
              <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />

              {/* Disconnect */}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <LogOut className="h-4 w-4" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
