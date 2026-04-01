"use client";

import { useState } from "react";
import { useTradingWallet } from "@/hooks/useTradingWallet";

export function CreateWalletPrompt() {
  const { createWallet, isCreatingWallet, needsCreation, embeddedWallet, walletsReady } = useTradingWallet();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  if (!needsCreation) return null;

  const handleCreate = async () => {
    setError(null);
    setIsCreating(true);

    try {
      if (!embeddedWallet?.address) {
        setError("No embedded wallet found. Please log in again.");
        return;
      }

      // Pass the embedded wallet address to the API
      const res = await fetch("/api/trading-wallet/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: embeddedWallet.address,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create wallet");
      }

      // Refresh the trading wallet state
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create wallet");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/10">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">
            Set Up Your Trading Wallet
          </h3>
          <p className="mt-1 text-sm text-muted">
            Create a gasless trading wallet on Polygon to deposit USDC and start trading.
            Your external wallet will only be used for identity.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={isCreating || !walletsReady || !embeddedWallet}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isCreating ? "Creating..." : !walletsReady ? "Loading Wallets..." : !embeddedWallet ? "Waiting for Embedded Wallet..." : "Create Trading Wallet"}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
