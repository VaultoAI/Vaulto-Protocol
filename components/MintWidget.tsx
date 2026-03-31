"use client";

import { useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useTradingWallet } from "@/hooks/useTradingWallet";

type MintWidgetProps = {
  companyName: string;
  syntheticSymbol: string;
  valuationUsd: number;
};

type MintState = "idle" | "loading" | "success" | "error";

export function MintWidget({
  companyName,
  syntheticSymbol,
  valuationUsd,
}: MintWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [mintState, setMintState] = useState<MintState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { authenticated, login } = usePrivy();
  const { balance, formattedBalance, isActive, invalidateAll } = useTradingWallet();

  // Calculate tokens to receive (simulated 1:1 for demo)
  const tokensToReceive = parseFloat(amount) || 0;

  const handleOpenModal = useCallback(() => {
    if (!authenticated) {
      login();
      return;
    }
    setIsOpen(true);
    setAmount("");
    setMintState("idle");
    setErrorMessage(null);
  }, [authenticated, login]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setAmount("");
    setMintState("idle");
    setErrorMessage(null);
  }, []);

  const handleMint = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage("Please enter a valid amount");
      return;
    }

    if (!isActive) {
      setErrorMessage("Please set up your trading wallet first");
      return;
    }

    const amountNum = parseFloat(amount);
    const balanceNum = parseFloat(balance);

    if (amountNum > balanceNum) {
      setErrorMessage(`Insufficient balance. Available: $${formattedBalance}`);
      return;
    }

    setMintState("loading");
    setErrorMessage(null);

    // Simulate minting process using trading wallet
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate 90% success rate
    if (Math.random() > 0.1) {
      setMintState("success");
      // Refresh balance after successful mint
      invalidateAll();
    } else {
      setMintState("error");
      setErrorMessage("Transaction failed. Please try again.");
    }
  }, [amount, isActive, balance, formattedBalance, invalidateAll]);

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      // Allow only valid decimal numbers
      if (/^\d*\.?\d*$/.test(value)) {
        setAmount(value);
        setMintState("idle");
        setErrorMessage(null);
      }
    },
    []
  );

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        className="inline-block rounded border border-black ring-1 ring-border bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-black/90"
      >
        Mint
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Mint {syntheticSymbol}</h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-muted hover:text-foreground"
                aria-label="Close"
              >
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
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mt-2 text-sm text-muted">
              Mint synthetic exposure to {companyName}
            </p>

            {mintState === "success" ? (
              <div className="mt-6 rounded-md bg-green-50 dark:bg-green-900/20 p-4 text-center">
                <svg
                  className="mx-auto h-10 w-10 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <p className="mt-2 font-medium text-green-700 dark:text-green-400">
                  Mint Successful
                </p>
                <p className="mt-1 text-sm text-green-600 dark:text-green-500">
                  You received {tokensToReceive.toFixed(2)} {syntheticSymbol}
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-4 w-full rounded border border-border bg-foreground py-2 text-background font-medium hover:opacity-90"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="mt-6">
                  <label
                    htmlFor="mint-amount"
                    className="block text-sm font-medium"
                  >
                    Amount (USDC)
                  </label>
                  <input
                    id="mint-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={handleAmountChange}
                    disabled={mintState === "loading"}
                    className="mt-1 w-full rounded border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-border disabled:opacity-50"
                  />
                </div>

                {tokensToReceive > 0 && (
                  <div className="mt-4 rounded-md border border-border bg-muted/30 px-4 py-3">
                    <p className="text-sm text-muted">You will receive</p>
                    <p className="mt-1 text-lg font-medium">
                      {tokensToReceive.toFixed(2)} {syntheticSymbol}
                    </p>
                  </div>
                )}

                {errorMessage && (
                  <p
                    className="mt-4 text-sm text-red-600 dark:text-red-400"
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleMint}
                  disabled={
                    mintState === "loading" ||
                    !amount ||
                    parseFloat(amount) <= 0 ||
                    !isActive ||
                    parseFloat(amount) > parseFloat(balance)
                  }
                  className="mt-6 w-full rounded border border-foreground bg-foreground py-3 text-background font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {mintState === "loading" ? "Minting..." : "Mint"}
                </button>

                {isActive && (
                  <p className="mt-2 text-center text-xs text-muted">
                    Trading wallet balance: ${formattedBalance} USDC
                  </p>
                )}

                {!isActive && authenticated && (
                  <p className="mt-2 text-center text-xs text-muted">
                    Set up your trading wallet to mint
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
