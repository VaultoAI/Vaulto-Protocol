"use client";

import { useState } from "react";
import { usePredictionTrading, CloseAndWithdrawResponse } from "@/hooks/usePredictionTrading";
import { useTradingWallet } from "@/hooks/useTradingWallet";

type ModalStep = "confirm" | "processing" | "withdrawal" | "complete" | "error";

interface ClosePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  positionId: string;
  marketValue: number;
  shares: number;
  side: "LONG" | "SHORT";
}

/**
 * Multi-step modal for closing a prediction market position and optionally withdrawing funds.
 * Flow: Confirm -> Processing -> Withdrawal Options -> Complete
 */
export function ClosePositionModal({
  isOpen,
  onClose,
  positionId,
  marketValue,
  shares,
  side,
}: ClosePositionModalProps) {
  const [step, setStep] = useState<ModalStep>("confirm");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [result, setResult] = useState<CloseAndWithdrawResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { closeAndWithdraw, isClosingAndWithdrawing } = usePredictionTrading();
  const { externalWallet, balance } = useTradingWallet();

  const handleClose = () => {
    setStep("confirm");
    setWithdrawAddress("");
    setResult(null);
    setError(null);
    onClose();
  };

  const handleCloseOnly = async () => {
    setStep("processing");
    setError(null);

    try {
      const closeResult = await closeAndWithdraw(positionId);
      setResult(closeResult);

      if (closeResult.success) {
        setStep("withdrawal");
      } else {
        setError(closeResult.error || "Failed to close position");
        setStep("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close position");
      setStep("error");
    }
  };

  const handleCloseAndWithdraw = async () => {
    if (!withdrawAddress || !/^0x[a-fA-F0-9]{40}$/.test(withdrawAddress)) {
      setError("Please enter a valid Ethereum address");
      return;
    }

    setStep("processing");
    setError(null);

    try {
      const withdrawResult = await closeAndWithdraw(positionId, withdrawAddress);
      setResult(withdrawResult);

      if (withdrawResult.success) {
        setStep("complete");
      } else {
        setError(withdrawResult.error || "Failed to withdraw");
        setStep("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to withdraw");
      setStep("error");
    }
  };

  const handleUseExternalWallet = () => {
    if (externalWallet?.address) {
      setWithdrawAddress(externalWallet.address);
    }
  };

  const handleSkipWithdrawal = () => {
    setStep("complete");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-card-bg border border-border p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {step === "confirm" && "Close Position"}
            {step === "processing" && "Processing..."}
            {step === "withdrawal" && "Withdraw Funds"}
            {step === "complete" && "Complete"}
            {step === "error" && "Error"}
          </h2>
          {step !== "processing" && (
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Step: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Position</span>
                <span className={`font-medium ${side === "LONG" ? "text-blue-500" : "text-red-500"}`}>
                  {side}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shares</span>
                <span className="font-medium text-foreground">{shares.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Proceeds</span>
                <span className="font-medium text-foreground">${marketValue.toFixed(2)}</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              This will close your entire position. Proceeds will be added to your trading wallet balance.
            </p>

            <button
              onClick={handleCloseOnly}
              className="w-full rounded-xl bg-red py-3 text-sm font-bold text-white hover:bg-red/90 transition-all"
            >
              Close Position
            </button>
          </div>
        )}

        {/* Step: Processing */}
        {step === "processing" && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <p className="text-muted-foreground">
              {isClosingAndWithdrawing ? "Processing transaction..." : "Closing position..."}
            </p>
          </div>
        )}

        {/* Step: Withdrawal */}
        {step === "withdrawal" && result && (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4">
              <div className="flex items-center gap-2 text-green-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Position Closed</span>
              </div>
              <p className="text-sm text-green-500/80 mt-1">
                Proceeds: ${result.sellProceeds?.toFixed(2) || "0.00"}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              Would you like to withdraw your funds to an external wallet?
            </p>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Withdrawal Address</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {externalWallet?.address && (
                  <button
                    onClick={handleUseExternalWallet}
                    className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground hover:bg-muted transition-all"
                  >
                    Use Wallet
                  </button>
                )}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSkipWithdrawal}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-all"
              >
                Skip
              </button>
              <button
                onClick={handleCloseAndWithdraw}
                disabled={!withdrawAddress}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Withdraw
              </button>
            </div>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Complete!</h3>
            </div>

            {result && (
              <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm">
                {result.sellProceeds !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Proceeds</span>
                    <span className="font-medium text-foreground">${result.sellProceeds.toFixed(2)}</span>
                  </div>
                )}
                {result.newBalance !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wallet Balance</span>
                    <span className="font-medium text-foreground">${result.newBalance.toFixed(2)}</span>
                  </div>
                )}
                {result.txHash && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction</span>
                    <a
                      href={`https://polygonscan.com/tx/${result.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      View on Polygonscan
                    </a>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all"
            >
              Done
            </button>
          </div>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Error</h3>
              <p className="text-sm text-muted-foreground text-center mt-2">{error}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-all"
              >
                Close
              </button>
              <button
                onClick={() => setStep("confirm")}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
