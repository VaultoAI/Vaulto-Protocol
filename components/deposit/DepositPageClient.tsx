"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { useWalletNetWorth } from "@/hooks/useWalletNetWorth";
import { useExternalUsdcBalance } from "@/hooks/useExternalUsdcBalance";
import { useReferralStats } from "@/hooks/useReferralStats";
import { WithdrawModal } from "@/components/trading-wallet/WithdrawModal";
import { MiniChart } from "@/components/MiniChart";
import { CHAIN_IDS } from "@/lib/trading-wallet/constants";
import { Check, ExternalLink, Wallet, Loader2, Copy } from "lucide-react";

type DepositStatus = "idle" | "initiating" | "pending" | "confirming" | "success" | "error";

export function DepositPageClient() {
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositStatus, setDepositStatus] = useState<DepositStatus>("idle");
  const [depositError, setDepositError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { ready, authenticated } = usePrivy();
  const { chain, address: connectedAddress } = useAccount();

  // Fetch connected wallet total net worth across all chains
  const { formattedNetWorth, isLoading: isLoadingNetWorth } = useWalletNetWorth(connectedAddress);

  // Fetch external wallet USDC balance for max deposit
  const { formattedBalance: externalUsdcBalance, isLoading: isLoadingExternalBalance } = useExternalUsdcBalance();

  // Fetch referral stats
  const { referralCode, referralCount, bonusPoints, isLoading: isLoadingReferral } = useReferralStats();

  const {
    tradingWallet,
    formattedBalance,
    balance,
    isLoadingWallet,
    needsCreation,
    createWallet,
    isCreatingWallet,
    embeddedWallet,
    initiateDeposit,
    confirmDeposit,
    isInitiatingDeposit,
    invalidateAll,
  } = useTradingWallet();

  const {
    sendTransaction,
    data: txHash,
    isPending: isSending,
    error: sendError,
    reset: resetTransaction,
  } = useSendTransaction();

  const { isLoading: isConfirmingTx, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  const isPolygon = chain?.id === CHAIN_IDS.POLYGON;

  const handleCreateWallet = async () => {
    if (!embeddedWallet?.address) {
      console.error("No embedded wallet address available");
      return;
    }
    try {
      await createWallet(embeddedWallet.address);
    } catch (error) {
      console.error("Failed to create wallet:", error);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setDepositError("Please enter a valid amount");
      return;
    }

    setDepositError(null);
    setDepositStatus("initiating");

    try {
      const { txData } = await initiateDeposit(depositAmount);

      setDepositStatus("pending");
      sendTransaction({
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: BigInt(txData.value),
      });
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : "Failed to initiate deposit");
      setDepositStatus("error");
    }
  };

  const handleConfirmation = useCallback(async () => {
    if (txHash && isConfirmed && depositStatus === "pending") {
      setDepositStatus("confirming");
      try {
        await confirmDeposit(txHash);
        setDepositStatus("success");
        invalidateAll();
        // Reset after success
        setTimeout(() => {
          setDepositAmount("");
          setDepositStatus("idle");
          resetTransaction();
        }, 3000);
      } catch (err) {
        setDepositError(err instanceof Error ? err.message : "Failed to confirm deposit");
        setDepositStatus("error");
      }
    }
  }, [txHash, isConfirmed, depositStatus, confirmDeposit, invalidateAll, resetTransaction]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && depositStatus === "pending") {
      handleConfirmation();
    }
  }, [isConfirmed, depositStatus, handleConfirmation]);

  // Parse error message to be more user-friendly
  const getReadableError = (error: Error): string => {
    const message = error.message.toLowerCase();

    // User rejected/denied the transaction
    if (
      message.includes("user rejected") ||
      message.includes("user denied") ||
      message.includes("rejected the request") ||
      message.includes("denied transaction")
    ) {
      return "Transaction cancelled";
    }

    // Insufficient funds
    if (message.includes("insufficient funds") || message.includes("insufficient balance")) {
      return "Insufficient funds in your wallet";
    }

    // Network errors
    if (message.includes("network") || message.includes("disconnected")) {
      return "Network error. Please check your connection";
    }

    // Default: return a cleaned up version
    return error.message.split("Details:")[0].trim() || "Transaction failed";
  };

  // Handle send error
  useEffect(() => {
    if (sendError && depositStatus === "pending") {
      setDepositError(getReadableError(sendError));
      setDepositStatus("error");
    }
  }, [sendError, depositStatus]);

  const resetDeposit = () => {
    setDepositAmount("");
    setDepositError(null);
    setDepositStatus("idle");
    resetTransaction();
  };

  const handleCopyReferral = async () => {
    if (!referralCode) return;
    const referralUrl = `${window.location.origin}/join?ref=${referralCode}`;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSetMaxDeposit = () => {
    if (externalUsdcBalance && parseFloat(externalUsdcBalance) > 0) {
      setDepositAmount(externalUsdcBalance);
    }
  };

  const isDepositing = depositStatus === "initiating" || depositStatus === "pending" || depositStatus === "confirming" || isInitiatingDeposit || isSending || isConfirmingTx;

  // Generate demo chart data - flat line at current balance value
  const chartData = useMemo(() => {
    const balanceNum = parseFloat(balance) || 0;
    // Create 30 data points with slight variation for visual interest
    return Array.from({ length: 30 }, (_, i) => {
      // Add small random variation (±2%) for visual effect
      const variation = 1 + (Math.sin(i * 0.5) * 0.02);
      return balanceNum * variation;
    });
  }, [balance]);

  // Show loading skeleton while Privy initializes or wallet is loading
  if (!ready || isLoadingWallet) {
    return (
      <>
        {/* Header Skeleton */}
        <div className="flex items-center justify-between gap-8">
          <div>
            <div className="h-10 w-40 animate-pulse rounded bg-foreground/10" />
            <div className="mt-2 h-4 w-24 animate-pulse rounded bg-foreground/10" />
          </div>
          <div className="border-l border-border pl-8">
            <div className="h-10 w-32 animate-pulse rounded bg-foreground/10" />
            <div className="mt-2 h-4 w-20 animate-pulse rounded bg-foreground/10" />
          </div>
          <div className="ml-auto flex flex-col items-end gap-2">
            <div className="h-4 w-20 animate-pulse rounded bg-foreground/10" />
            <div className="h-9 w-32 animate-pulse rounded-lg bg-foreground/10" />
            <div className="h-9 w-32 animate-pulse rounded-lg bg-foreground/10" />
          </div>
        </div>

        {/* Chart Skeleton */}
        <div className="mt-8 -mx-5 border-t border-border pt-8 pb-4 px-5">
          <div className="h-[180px] w-full animate-pulse rounded bg-foreground/10" />
        </div>

        {/* Referral Skeleton */}
        <div className="mt-6 pt-6 border-t border-border">
          <div className="h-4 w-24 animate-pulse rounded bg-foreground/10 mb-4" />
          <div className="flex items-center gap-2">
            <div className="flex-1 h-10 animate-pulse rounded-lg bg-foreground/10" />
            <div className="h-10 w-20 animate-pulse rounded-lg bg-foreground/10" />
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="h-4 w-20 animate-pulse rounded bg-foreground/10" />
            <div className="h-4 w-28 animate-pulse rounded bg-foreground/10" />
          </div>
        </div>

        {/* Wallet Section Skeleton */}
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="h-10 w-24 animate-pulse rounded-lg bg-foreground/10" />
            <div className="h-4 w-28 animate-pulse rounded bg-foreground/10" />
          </div>
        </div>
      </>
    );
  }

  // Show login prompt if not authenticated
  if (!authenticated) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-foreground/10">
          <Wallet className="h-8 w-8 text-muted" />
        </div>
        <h2 className="text-xl font-medium text-foreground mb-2">Connect Your Wallet</h2>
        <p className="text-muted">Please connect your wallet to access the deposit page.</p>
      </div>
    );
  }

  // Show create wallet prompt if user needs to create one
  if (needsCreation || !tradingWallet) {
    const hasEmbeddedWallet = !!embeddedWallet?.address;

    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-foreground/10">
          <Wallet className="h-8 w-8 text-muted" />
        </div>
        <h2 className="text-xl font-medium text-foreground mb-2">Create Trading Wallet</h2>
        <p className="text-muted mb-6">
          {hasEmbeddedWallet
            ? "You need a trading wallet to deposit and trade. Create one to get started."
            : "Setting up your embedded wallet... Please wait a moment."}
        </p>
        <button
          onClick={handleCreateWallet}
          disabled={isCreatingWallet || !hasEmbeddedWallet}
          className="rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isCreatingWallet
            ? "Creating..."
            : !hasEmbeddedWallet
              ? "Waiting for wallet..."
              : "Create Trading Wallet"}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Header - Balances + Add Funds */}
      <div className="flex items-center justify-between gap-8">
        {/* Portfolio Value */}
        <div>
          <span className="text-4xl font-semibold tracking-tight text-foreground">
            ${formattedBalance}
          </span>
          <p className="mt-1 text-sm text-muted">Portfolio Value</p>
        </div>

        {/* Wallet Total */}
        <div className="border-l border-border pl-8">
          <span className="text-4xl font-semibold tracking-tight text-muted">
            {isLoadingNetWorth ? (
              <span className="inline-block h-10 w-32 animate-pulse rounded bg-foreground/10" />
            ) : formattedNetWorth ? (
              `$${formattedNetWorth}`
            ) : (
              "—"
            )}
          </span>
          <p className="mt-1 text-sm text-muted">Wallet Total</p>
        </div>

        {/* Add Funds - input on top, button on bottom */}
        <div className="ml-auto flex flex-col items-end gap-2">
          {/* Max link */}
          <button
            onClick={handleSetMaxDeposit}
            disabled={isLoadingExternalBalance || !externalUsdcBalance || parseFloat(externalUsdcBalance) <= 0}
            className="text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-default"
          >
            Max: ${isLoadingExternalBalance ? "..." : externalUsdcBalance}
          </button>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={depositAmount}
              onChange={(e) => {
                setDepositAmount(e.target.value);
                setDepositError(null);
                if (depositStatus === "error") setDepositStatus("idle");
              }}
              disabled={isDepositing}
              className="w-32 rounded-lg border border-border bg-transparent py-2 pl-7 pr-14 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-foreground/50 disabled:opacity-50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">USDC</span>
          </div>
          <button
            onClick={handleDeposit}
            disabled={
              !depositAmount ||
              parseFloat(depositAmount) <= 0 ||
              isDepositing ||
              !isPolygon ||
              depositStatus === "success"
            }
            className="w-32 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isDepositing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Add Funds"
            )}
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      <div className="mt-4 space-y-2">
        {/* Network Warning */}
        {!isPolygon && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
            Please switch to Polygon network to deposit
          </div>
        )}

        {/* Error Message */}
        {depositError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {depositError}
            <button onClick={resetDeposit} className="ml-2 underline">
              Try again
            </button>
          </div>
        )}

        {/* Success Message */}
        {depositStatus === "success" && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
            <Check className="h-4 w-4" />
            ${depositAmount} USDC deposited successfully!
          </div>
        )}

        {/* Transaction Link */}
        {txHash && depositStatus !== "idle" && (
          <a
            href={`https://polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            View transaction
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Chart Section */}
      <div className="mt-8 -mx-5 border-t border-border pt-8 pb-4 px-5">
        <MiniChart
          data={chartData}
          width={800}
          height={180}
          isPositive={true}
          strokeWidth={2}
          showGradient={true}
        />
      </div>

      {/* Referral Section */}
      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="text-sm font-medium text-foreground mb-4">Invite Friends</h3>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-border bg-foreground/5 px-3 py-2.5">
            <span className="text-sm text-muted font-mono truncate block">
              {referralCode
                ? `${typeof window !== "undefined" ? window.location.origin : ""}/join?ref=${referralCode}`
                : isLoadingReferral
                  ? "Loading..."
                  : "No referral code"}
            </span>
          </div>
          <button
            onClick={handleCopyReferral}
            disabled={!referralCode}
            className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm text-muted">
          <span>{referralCount} Referral{referralCount !== 1 ? "s" : ""}</span>
          <span className="text-border">•</span>
          <span>{bonusPoints.toLocaleString()} Bonus Points</span>
        </div>
      </div>

      {/* Wallet Section */}
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsWithdrawOpen(true)}
            disabled={parseFloat(balance) <= 0}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Withdraw
          </button>
          <a
            href={`https://polygonscan.com/address/${tradingWallet.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <span>View on Polygon</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Modals */}
      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
      />
    </>
  );
}
