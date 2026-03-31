"use client";

import { useState } from "react";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { polygon } from "viem/chains";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { Check, ExternalLink, AlertTriangle, Loader2 } from "lucide-react";

type WithdrawStep = "input" | "review" | "mfa" | "pending" | "success";

export function WithdrawInline() {
  const [amount, setAmount] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [step, setStep] = useState<WithdrawStep>("input");
  const [error, setError] = useState<string | null>(null);
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const {
    balance,
    requestWithdrawal,
    executeWithdrawal,
    isRequestingWithdrawal,
    isExecutingWithdrawal,
    externalWallet,
    invalidateAll,
  } = useTradingWallet();

  const { client: smartWalletClient } = useSmartWallets();

  const handleSetMax = () => {
    setAmount(balance);
  };

  const handleUseConnectedWallet = () => {
    if (externalWallet?.address) {
      setToAddress(externalWallet.address);
    }
  };

  const handleRequestWithdrawal = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!toAddress || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      setError("Please enter a valid destination address");
      return;
    }

    setError(null);
    try {
      const result = await requestWithdrawal({
        amount,
        toAddress,
      });

      setWithdrawalId(result.id);
      setRequiresMfa(result.requiresMfa);

      if (result.requiresMfa) {
        setStep("mfa");
      } else {
        setStep("review");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request withdrawal");
    }
  };

  const handleExecuteWithdrawal = async () => {
    if (!withdrawalId) return;

    setError(null);
    setStep("pending");

    try {
      const result = await executeWithdrawal(withdrawalId);

      if (result.status === "READY_TO_SIGN" && result.txData && smartWalletClient) {
        const tx = await smartWalletClient.sendTransaction({
          to: result.txData.to as `0x${string}`,
          data: result.txData.data as `0x${string}`,
          chain: polygon,
        });

        await fetch("/api/trading-wallet/withdraw/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ withdrawalId, txHash: tx }),
        });

        setTxHash(tx);
        setStep("success");
        invalidateAll();
      } else if (result.txHash) {
        setTxHash(result.txHash);
        setStep("success");
        invalidateAll();
      } else {
        throw new Error("Unexpected response from withdrawal execution");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute withdrawal");
      setStep("review");
    }
  };

  const handleReset = () => {
    setAmount("");
    setToAddress("");
    setStep("input");
    setError(null);
    setWithdrawalId(null);
    setRequiresMfa(false);
    setTxHash(null);
  };

  const isWithdrawDisabled = parseFloat(balance) <= 0;

  // Input Step
  if (step === "input") {
    return (
      <div>
        <h3 className="text-sm font-medium text-foreground mb-4">Withdraw Funds</h3>

        <div className="space-y-4">
          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-muted">Amount</label>
              <button
                onClick={handleSetMax}
                disabled={isWithdrawDisabled}
                className="text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                Available: ${parseFloat(balance).toFixed(2)}
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                disabled={isWithdrawDisabled}
                className="w-full rounded-lg border border-border bg-transparent py-3 pl-3 pr-16 text-lg text-foreground placeholder:text-muted focus:outline-none focus:border-foreground/50 disabled:opacity-50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">USDC</span>
            </div>
          </div>

          {/* Destination Address */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-muted">Destination Address</label>
              {externalWallet && (
                <button
                  onClick={handleUseConnectedWallet}
                  className="text-xs text-muted hover:text-foreground transition-colors"
                >
                  Use connected wallet
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="0x..."
              value={toAddress}
              onChange={(e) => {
                setToAddress(e.target.value);
                setError(null);
              }}
              disabled={isWithdrawDisabled}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-3 text-foreground font-mono text-sm placeholder:text-muted focus:outline-none focus:border-foreground/50 disabled:opacity-50"
            />
            <p className="mt-1.5 text-xs text-muted">
              Must be a verified wallet from your onboarding
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={handleRequestWithdrawal}
          disabled={
            !amount ||
            parseFloat(amount) <= 0 ||
            !toAddress ||
            isRequestingWithdrawal ||
            isWithdrawDisabled
          }
          className="mt-4 w-full rounded-lg bg-foreground py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isRequestingWithdrawal ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Continue"
          )}
        </button>
      </div>
    );
  }

  // Review Step
  if (step === "review") {
    return (
      <div>
        <h3 className="text-sm font-medium text-foreground mb-4">Review Withdrawal</h3>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Amount</span>
            <span className="font-medium text-foreground">${amount} USDC</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">To</span>
            <span className="font-mono text-foreground text-xs">
              {toAddress.slice(0, 10)}...{toAddress.slice(-8)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Network</span>
            <span className="text-foreground">Polygon</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Gas Fee</span>
            <span className="text-green-600 dark:text-green-400">
              Sponsored (Free)
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setStep("input")}
            className="flex-1 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleExecuteWithdrawal}
            disabled={isExecutingWithdrawal}
            className="flex-1 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isExecutingWithdrawal ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Withdrawing...
              </>
            ) : (
              "Confirm Withdrawal"
            )}
          </button>
        </div>
      </div>
    );
  }

  // MFA Step
  if (step === "mfa") {
    return (
      <div>
        <h3 className="text-sm font-medium text-foreground mb-4">Verification Required</h3>

        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <div className="text-sm">
            <p className="font-medium text-yellow-700 dark:text-yellow-300">
              Additional Verification Required
            </p>
            <p className="mt-0.5 text-yellow-600 dark:text-yellow-400">
              This withdrawal amount requires MFA verification.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted text-center">
          MFA verification coming soon. Contact support for large withdrawals.
        </p>
        <button
          onClick={handleReset}
          className="mt-4 w-full rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Pending Step
  if (step === "pending") {
    return (
      <div>
        <h3 className="text-sm font-medium text-foreground mb-4">Withdraw Funds</h3>

        <div className="py-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-foreground/20 border-t-foreground" />
          <h3 className="text-lg font-medium text-foreground">
            Processing Withdrawal
          </h3>
          <p className="mt-2 text-sm text-muted">
            Please wait while we process your withdrawal...
          </p>
        </div>
      </div>
    );
  }

  // Success Step
  if (step === "success") {
    return (
      <div>
        <h3 className="text-sm font-medium text-foreground mb-4">Withdraw Funds</h3>

        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
            <Check className="h-6 w-6 text-green-500" />
          </div>
          <h3 className="text-lg font-medium text-foreground">
            Withdrawal Successful
          </h3>
          <p className="mt-2 text-sm text-muted">
            ${amount} USDC has been sent to your wallet
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
            onClick={handleReset}
            className="mt-6 w-full rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return null;
}
