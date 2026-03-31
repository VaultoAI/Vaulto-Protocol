"use client";

import { useState, useCallback } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { CHAIN_IDS } from "@/lib/trading-wallet/constants";
import { X, Copy, Check, ExternalLink } from "lucide-react";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DepositStep = "input" | "confirm" | "pending" | "success";

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<DepositStep>("input");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { address, chain } = useAccount();
  const {
    tradingWallet,
    initiateDeposit,
    confirmDeposit,
    isInitiatingDeposit,
    isConfirmingDeposit,
    invalidateAll,
  } = useTradingWallet();

  const {
    sendTransaction,
    data: txHash,
    isPending: isSending,
    error: sendError,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  const handleCopyAddress = useCallback(() => {
    if (tradingWallet?.address) {
      navigator.clipboard.writeText(tradingWallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [tradingWallet?.address]);

  const handleInitiateDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setError(null);
    try {
      const { txData } = await initiateDeposit(amount);

      // Send the transaction using wagmi
      sendTransaction({
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: BigInt(txData.value),
      });

      setStep("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate deposit");
    }
  };

  // Handle transaction confirmation
  const handleConfirmation = useCallback(async () => {
    if (txHash && isConfirmed) {
      try {
        await confirmDeposit(txHash);
        setStep("success");
        invalidateAll();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to confirm deposit");
      }
    }
  }, [txHash, isConfirmed, confirmDeposit, invalidateAll]);

  // Call handleConfirmation when transaction is confirmed
  if (isConfirmed && step === "pending") {
    handleConfirmation();
  }

  const handleClose = () => {
    setAmount("");
    setStep("input");
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const isPolygon = chain?.id === CHAIN_IDS.POLYGON;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Deposit USDC
          </h2>
          <button
            onClick={handleClose}
            className="rounded-full p-1 hover:bg-foreground/10 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-muted" />
          </button>
        </div>

        {step === "input" && (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Trading Wallet Address
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-foreground/5 px-3 py-2.5">
                  <span className="flex-1 text-sm text-foreground font-mono truncate">
                    {tradingWallet?.address}
                  </span>
                  <button
                    onClick={handleCopyAddress}
                    className="shrink-0 p-1 hover:bg-foreground/10 rounded transition-colors"
                    aria-label="Copy address"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  You can also send USDC directly to this address on Polygon
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Amount (USDC)
                </label>
                <div className="flex items-center rounded-lg border border-border">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 bg-transparent px-3 py-2.5 text-foreground placeholder:text-muted focus:outline-none"
                  />
                  <span className="px-3 text-sm font-medium text-muted">
                    USDC
                  </span>
                </div>
              </div>

              {!isPolygon && address && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5 text-sm text-yellow-700 dark:text-yellow-400">
                  Please switch to Polygon network to deposit
                </div>
              )}
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiateDeposit}
                disabled={
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  isInitiatingDeposit ||
                  isSending ||
                  !isPolygon
                }
                className="flex-1 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isInitiatingDeposit || isSending ? "Processing..." : "Deposit"}
              </button>
            </div>
          </>
        )}

        {step === "pending" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-foreground/20 border-t-foreground" />
            <h3 className="text-lg font-medium text-foreground">
              {isConfirming ? "Confirming Transaction" : "Transaction Pending"}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {isConfirming
                ? "Waiting for block confirmations..."
                : "Please confirm in your wallet"}
            </p>
            {txHash && (
              <a
                href={`https://polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-foreground hover:underline"
              >
                View on PolygonScan
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {sendError && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {sendError.message}
              </p>
            )}
          </div>
        )}

        {step === "success" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <h3 className="text-lg font-medium text-foreground">
              Deposit Successful
            </h3>
            <p className="mt-2 text-sm text-muted">
              ${amount} USDC has been deposited to your trading wallet
            </p>
            {txHash && (
              <a
                href={`https://polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-foreground hover:underline"
              >
                View on PolygonScan
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              onClick={handleClose}
              className="mt-6 w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
