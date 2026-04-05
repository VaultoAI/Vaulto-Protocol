"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePrivy, useFundWallet } from "@privy-io/react-auth";
import { polygon } from "viem/chains";
import { useTradingWallet } from "@/hooks/useTradingWallet";

const DepositModal = dynamic(
  () => import("@/components/trading-wallet/DepositModal").then((mod) => mod.DepositModal),
  { ssr: false }
);
import {
  ChevronDown,
  Copy,
  ExternalLink,
  Plus,
  User,
  LogOut,
  Check,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
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
  const { image: profileImage, name: profileName } = useProfile();

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
        <div className="h-9 w-20 animate-pulse rounded-lg bg-foreground/10 sm:h-10 sm:w-24" />
      </div>
    );
  }

  // Not authenticated
  if (!authenticated) {
    return (
      <button
        onClick={login}
        type="button"
        className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black shadow-sm ring-1 ring-black/10 transition hover:bg-gray-50 active:bg-gray-100 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-gray-100 sm:px-4 sm:py-2.5"
      >
        <span className="hidden sm:inline">Connect Wallet</span>
        <span className="sm:hidden">Connect</span>
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
        className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black shadow-sm ring-1 ring-black/10 transition hover:bg-gray-50 active:bg-gray-100 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-gray-100 sm:px-4 sm:py-2.5"
      >
        {displayAddress
          ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
          : "Connected"}
      </button>
    );
  }

  // Authenticated with active trading wallet - show dropdown
  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-2 text-sm font-medium text-black shadow-sm ring-1 ring-black/10 transition hover:bg-gray-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-gray-100 sm:gap-2 sm:px-3 sm:py-2.5"
      >
        <span className={`max-w-[100px] truncate sm:max-w-none ${profileName ? "font-username" : "font-mono"}`}>
          {profileName || truncatedAddress}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-gray-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Mobile Overlay - starts below header */}
      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 top-16 z-40 bg-black/50 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="fixed inset-x-0 top-16 z-50 max-h-[calc(85vh-4rem)] overflow-y-auto border-t border-gray-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 sm:w-64 sm:rounded-xl sm:border-t-0 sm:ring-1 sm:ring-black/10 dark:sm:ring-white/10">
          {/* Wallet Info Header */}
          <div className="border-b border-gray-100 px-4 py-4 dark:border-zinc-800 sm:py-3">
            <div className="flex items-center gap-3 sm:gap-2">
              <ProfileAvatar
                image={profileImage}
                walletAddress={walletAddress ?? null}
                size={44}
                editable={false}
              />
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium font-username text-gray-900 dark:text-white sm:text-sm">
                  {profileName || generateUsername(walletAddress!)}
                </p>
                <p className="text-sm text-gray-500 font-mono truncate dark:text-gray-400 sm:text-xs">
                  {truncatedAddress}
                </p>
              </div>
            </div>
            <div className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white sm:mt-2 sm:text-lg">
              ${formattedBalance}{" "}
              <span className="text-base font-normal text-gray-500 sm:text-sm">USDC</span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2 sm:py-1">
            {/* Fund Wallet */}
            <button
              onClick={handleFundWallet}
              disabled={isFunding}
              className="flex w-full items-center gap-4 px-4 py-3.5 text-base text-gray-700 transition hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 sm:gap-3 sm:py-2.5 sm:text-sm"
            >
              <Plus className="h-5 w-5 text-green-600 sm:h-4 sm:w-4" />
              <span>{isFunding ? "Opening..." : "Fund Wallet"}</span>
            </button>

            {/* Copy Address */}
            <button
              onClick={handleCopyAddress}
              className="flex w-full items-center gap-4 px-4 py-3.5 text-base text-gray-700 transition hover:bg-gray-50 active:bg-gray-100 dark:text-gray-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 sm:gap-3 sm:py-2.5 sm:text-sm"
            >
              {copied ? (
                <Check className="h-5 w-5 text-green-600 sm:h-4 sm:w-4" />
              ) : (
                <Copy className="h-5 w-5 text-gray-500 sm:h-4 sm:w-4" />
              )}
              <span>{copied ? "Copied!" : "Copy Address"}</span>
            </button>

            {/* View on Explorer */}
            <a
              href={`https://polygonscan.com/address/${walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-4 px-4 py-3.5 text-base text-gray-700 transition hover:bg-gray-50 active:bg-gray-100 dark:text-gray-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 sm:gap-3 sm:py-2.5 sm:text-sm"
            >
              <ExternalLink className="h-5 w-5 text-gray-500 sm:h-4 sm:w-4" />
              <span>View on PolygonScan</span>
            </a>

            {/* Divider */}
            <div className="my-2 border-t border-gray-100 dark:border-zinc-800 sm:my-1" />

            {/* Profile */}
            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-4 px-4 py-3.5 text-base text-gray-700 transition hover:bg-gray-50 active:bg-gray-100 dark:text-gray-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 sm:gap-3 sm:py-2.5 sm:text-sm"
            >
              <User className="h-5 w-5 text-gray-500 sm:h-4 sm:w-4" />
              <span>Account</span>
            </Link>

            {/* Divider */}
            <div className="my-2 border-t border-gray-100 dark:border-zinc-800 sm:my-1" />

            {/* Disconnect */}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-4 px-4 py-3.5 text-base text-red-600 transition hover:bg-red-50 active:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/20 dark:active:bg-red-900/30 sm:gap-3 sm:py-2.5 sm:text-sm"
            >
              <LogOut className="h-5 w-5 sm:h-4 sm:w-4" />
              <span>Disconnect</span>
            </button>
          </div>

          {/* Mobile Bottom Padding */}
          <div className="h-4 sm:hidden" />
        </div>
      )}
    </div>
  );
}
