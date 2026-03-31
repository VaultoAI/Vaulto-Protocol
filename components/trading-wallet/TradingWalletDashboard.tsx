"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { CreateWalletPrompt } from "./CreateWalletPrompt";
import { Copy, Check, ExternalLink, ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";

// Lazy-load modals to reduce initial bundle
const DepositModal = dynamic(
  () => import("./DepositModal").then((mod) => mod.DepositModal),
  { ssr: false }
);
const WithdrawModal = dynamic(
  () => import("./WithdrawModal").then((mod) => mod.WithdrawModal),
  { ssr: false }
);

export function TradingWalletDashboard() {
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    tradingWallet,
    formattedBalance,
    balance,
    isLoading,
    needsCreation,
    isActive,
    refetchBalance,
    isLoadingBalance,
  } = useTradingWallet();

  const handleCopyAddress = () => {
    if (tradingWallet?.address) {
      navigator.clipboard.writeText(tradingWallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Show wallet creation prompt if needed
  if (needsCreation) {
    return <CreateWalletPrompt />;
  }

  // Loading state
  if (isLoading && !tradingWallet) {
    return (
      <div className="rounded-lg border border-border bg-background p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 bg-foreground/10 rounded" />
          <div className="h-10 w-40 bg-foreground/10 rounded" />
          <div className="h-4 w-48 bg-foreground/10 rounded" />
        </div>
      </div>
    );
  }

  if (!tradingWallet || !isActive) {
    return (
      <div className="rounded-lg border border-border bg-background p-6 text-center">
        <p className="text-muted">Trading wallet is not active</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-background">
        {/* Header */}
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Trading Wallet
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-sm text-muted">
                  {tradingWallet.address.slice(0, 10)}...
                  {tradingWallet.address.slice(-8)}
                </span>
                <button
                  onClick={handleCopyAddress}
                  className="rounded p-0.5 hover:bg-foreground/10 transition-colors"
                  aria-label="Copy address"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted" />
                  )}
                </button>
                <a
                  href={`https://polygonscan.com/address/${tradingWallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-0.5 hover:bg-foreground/10 transition-colors"
                  aria-label="View on PolygonScan"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted" />
                </a>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
              Polygon
            </span>
          </div>
        </div>

        {/* Balance */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted mb-1">Available Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">
                  ${formattedBalance}
                </span>
                <span className="text-lg text-muted">USDC</span>
              </div>
            </div>
            <button
              onClick={() => refetchBalance()}
              disabled={isLoadingBalance}
              className="rounded-full p-2 hover:bg-foreground/10 transition-colors disabled:opacity-50"
              aria-label="Refresh balance"
            >
              <RefreshCw
                className={`h-5 w-5 text-muted ${
                  isLoadingBalance ? "animate-spin" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-border px-6 py-4">
          <div className="flex gap-3">
            <button
              onClick={() => setIsDepositOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              <ArrowDownLeft className="h-4 w-4" />
              Deposit
            </button>
            <button
              onClick={() => setIsWithdrawOpen(true)}
              disabled={parseFloat(balance) <= 0}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowUpRight className="h-4 w-4" />
              Withdraw
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="border-t border-border px-6 py-4 bg-foreground/[0.02]">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-blue-500"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div className="text-sm">
              <p className="font-medium text-foreground">Gasless Trading</p>
              <p className="mt-0.5 text-muted">
                All transactions from your trading wallet are gasless on Polygon.
                You never need MATIC for gas fees.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
      <WithdrawModal isOpen={isWithdrawOpen} onClose={() => setIsWithdrawOpen(false)} />
    </>
  );
}
