"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { usePortfolioHistory, Transaction } from "@/hooks/usePortfolioHistory";
import { useWalletNetWorth } from "@/hooks/useWalletNetWorth";
import { useExternalUsdcBalance } from "@/hooks/useExternalUsdcBalance";
import { useReferralStats } from "@/hooks/useReferralStats";
import { useProfile } from "@/hooks/useProfile";
import { MiniChart } from "@/components/MiniChart";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { CHAIN_IDS } from "@/lib/trading-wallet/constants";
import { generateUsername } from "@/lib/utils/username";
import { Check, ExternalLink, Wallet, Loader2, Copy, Pencil, ArrowDownLeft, ArrowUpRight } from "lucide-react";

// Lazy-load modal to reduce initial bundle
const WithdrawModal = dynamic(
  () => import("@/components/trading-wallet/WithdrawModal").then((mod) => mod.WithdrawModal),
  { ssr: false }
);

type DepositStatus = "idle" | "initiating" | "pending" | "confirming" | "success" | "error";

export function DepositPageClient() {
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositStatus, setDepositStatus] = useState<DepositStatus>("idle");
  const [depositError, setDepositError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { ready, authenticated } = usePrivy();
  const { chain, address: connectedAddress } = useAccount();

  // Fetch connected wallet total net worth across all chains
  const { formattedNetWorth, isLoading: isLoadingNetWorth } = useWalletNetWorth(connectedAddress);

  // Fetch external wallet USDC balance for max deposit
  const { formattedBalance: externalUsdcBalance, isLoading: isLoadingExternalBalance } = useExternalUsdcBalance();

  // Fetch referral stats
  const { referralCode, referralCount, bonusPoints, isLoading: isLoadingReferral } = useReferralStats();

  // Fetch profile data
  const { profile, updateProfile, isUpdating: isUpdatingProfile } = useProfile();

  // Profile editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const {
    tradingWallet,
    formattedBalance,
    balance,
    isLoadingWallet,
    walletsReady,
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

  // Track client-side mounting to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Profile name handling
  const walletAddress = tradingWallet?.address ?? null;
  const displayName = profile?.name || (walletAddress ? generateUsername(walletAddress) : "User");

  const handleStartEditName = () => {
    setNameInput(profile?.name || "");
    setNameError(null);
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setNameInput(profile?.name || "");
    setNameError(null);
  };

  const handleSaveName = async () => {
    const trimmedName = nameInput.trim();
    if (trimmedName.length === 0) {
      setNameError("Username cannot be empty");
      return;
    }
    if (trimmedName.length > 50) {
      setNameError("Username must be at most 50 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_\s]+$/.test(trimmedName)) {
      setNameError("Only letters, numbers, spaces, and underscores allowed");
      return;
    }

    try {
      await updateProfile({ name: trimmedName });
      setIsEditingName(false);
      setNameError(null);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleImageChange = async (dataUrl: string | null) => {
    try {
      await updateProfile({ image: dataUrl });
    } catch (err) {
      console.error("Failed to update image:", err);
    }
  };

  const isDepositing = depositStatus === "initiating" || depositStatus === "pending" || depositStatus === "confirming" || isInitiatingDeposit || isSending || isConfirmingTx;

  // Fetch real portfolio history and transactions
  const { chartData, transactions } = usePortfolioHistory(tradingWallet?.address);

  // Calculate if portfolio is positive (current balance >= initial)
  const isPositive = chartData.length >= 2
    ? chartData[chartData.length - 1] >= chartData[0]
    : true;

  // Show loading skeleton while Privy initializes, wallets are loading, or trading wallet is loading
  if (!ready || !walletsReady || isLoadingWallet) {
    return (
      <>
        {/* Header Skeleton - Mobile responsive */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-12 w-12 animate-pulse rounded-full bg-foreground/10" />
              <div>
                <div className="h-5 w-28 animate-pulse rounded bg-foreground/10 sm:h-6 sm:w-40" />
                <div className="mt-2 h-3 w-20 animate-pulse rounded bg-foreground/10 sm:h-4 sm:w-24" />
              </div>
            </div>
            {/* Mobile portfolio skeleton */}
            <div className="text-right sm:hidden">
              <div className="h-7 w-24 animate-pulse rounded bg-foreground/10" />
              <div className="mt-1 h-3 w-14 ml-auto animate-pulse rounded bg-foreground/10" />
            </div>
          </div>
          {/* Desktop portfolio skeleton */}
          <div className="hidden border-l border-border pl-8 sm:block">
            <div className="h-10 w-32 animate-pulse rounded bg-foreground/10" />
            <div className="mt-2 h-4 w-20 animate-pulse rounded bg-foreground/10" />
          </div>
          {/* Desktop wallet total skeleton - hidden on mobile */}
          <div className="ml-auto hidden border-l border-border pl-8 md:block">
            <div className="h-10 w-32 animate-pulse rounded bg-foreground/10" />
            <div className="mt-2 h-4 w-20 animate-pulse rounded bg-foreground/10" />
          </div>
        </div>

        {/* Chart Skeleton */}
        <div className="mt-6 -mx-5 border-t border-border pt-6 pb-4 px-5 sm:mt-8 sm:pt-8">
          <div className="h-[140px] w-full animate-pulse rounded bg-foreground/10" />
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
      {/* Header - Profile + Balances */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        {/* Profile Avatar + Name + Portfolio (mobile combined row) */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <ProfileAvatar
              image={profile?.image ?? null}
              walletAddress={walletAddress}
              size={48}
              editable
              onImageChange={handleImageChange}
            />
            <div className="min-w-0">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") handleCancelEditName();
                    }}
                    className="w-32 rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-base font-semibold text-foreground focus:border-foreground/50 focus:outline-none sm:w-auto sm:text-lg"
                    placeholder="Enter username"
                    maxLength={50}
                    autoFocus
                    disabled={isUpdatingProfile}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isUpdatingProfile}
                    className="rounded-md p-1 text-green-500 transition hover:bg-green-500/10 disabled:opacity-50"
                  >
                    {isUpdatingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={handleCancelEditName}
                    disabled={isUpdatingProfile}
                    className="rounded-md p-1 text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-foreground sm:text-lg">{displayName}</span>
                  <button
                    onClick={handleStartEditName}
                    className="rounded-md p-1 text-muted transition hover:bg-foreground/10 hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {nameError && <p className="mt-0.5 text-xs text-red-500">{nameError}</p>}
              {profile?.email && <p className="text-xs text-muted truncate sm:text-sm">{profile.email}</p>}
            </div>
          </div>

          {/* Portfolio Value - mobile inline */}
          <div className="text-right sm:hidden">
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              ${formattedBalance}
            </span>
            <p className="text-xs text-muted">Portfolio</p>
          </div>
        </div>

        {/* Portfolio Value - desktop */}
        <div className="hidden border-l border-border pl-8 sm:block">
          <span className="text-4xl font-semibold tracking-tight text-foreground">
            ${formattedBalance}
          </span>
          <p className="mt-1 text-sm text-muted">Portfolio Value</p>
        </div>

        {/* Wallet Total - hidden on mobile */}
        <div className="ml-auto hidden border-l border-border pl-8 md:block">
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
      </div>

      {/* Feedback Messages */}
      <div className="mt-4 space-y-2">
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
      <div className="mt-6 -mx-5 border-t border-border pt-6 pb-4 px-5 sm:mt-8 sm:pt-8">
        <div className="w-full overflow-hidden">
          <MiniChart
            data={chartData}
            width={800}
            height={140}
            isPositive={isPositive}
            strokeWidth={2}
            showGradient={true}
          />
        </div>
      </div>

      {/* Transactions Section */}
      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="text-sm font-medium text-foreground mb-3 sm:mb-4">Transactions</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted">No transactions yet</p>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-1.5 sm:py-2"
              >
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8 ${
                      tx.type === "deposit"
                        ? "bg-green-500/10 text-green-500"
                        : "bg-red-500/10 text-red-500"
                    }`}
                  >
                    {tx.type === "deposit" ? (
                      <ArrowDownLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground sm:text-sm">
                      {tx.type === "deposit" ? "Deposit" : "Withdrawal"}
                    </p>
                    <p className="text-[10px] text-muted sm:text-xs">
                      {new Date(tx.timestamp).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {" · "}
                      <span
                        className={`${
                          tx.status === "COMPLETED"
                            ? "text-green-500"
                            : tx.status === "FAILED" || tx.status === "REJECTED"
                              ? "text-red-500"
                              : "text-yellow-500"
                        }`}
                      >
                        {tx.status === "COMPLETED"
                          ? "Completed"
                          : tx.status === "PENDING" || tx.status === "PENDING_APPROVAL"
                            ? "Pending"
                            : tx.status === "CONFIRMING" || tx.status === "PROCESSING"
                              ? "Processing"
                              : tx.status}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span
                    className={`text-xs font-medium sm:text-sm ${
                      tx.type === "deposit" ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {tx.type === "deposit" ? "+" : "-"}${tx.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  {tx.txHash && (
                    <a
                      href={`https://polygonscan.com/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Referral Section */}
      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="text-sm font-medium text-foreground mb-3 sm:mb-4">Invite Friends</h3>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-lg border border-border bg-foreground/5 px-3 py-2.5">
            <span className="text-xs text-muted font-mono truncate block sm:text-sm">
              {!mounted
                ? "Loading..."
                : referralCode
                  ? `${window.location.origin}/join?ref=${referralCode}`
                  : isLoadingReferral
                    ? "Loading..."
                    : "No referral code"}
            </span>
          </div>
          <button
            onClick={handleCopyReferral}
            disabled={!referralCode}
            className="shrink-0 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted sm:gap-4 sm:text-sm">
          <span>{referralCount} Referral{referralCount !== 1 ? "s" : ""}</span>
          <span className="text-border">•</span>
          <span>{bonusPoints.toLocaleString()} Bonus Points</span>
        </div>
      </div>

      {/* Wallet Section */}
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setIsWithdrawOpen(true)}
            disabled={parseFloat(balance) <= 0}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:px-4 sm:py-2.5"
          >
            Withdraw
          </button>
          <a
            href={`https://polygonscan.com/address/${tradingWallet.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors sm:gap-1.5 sm:text-sm"
          >
            <span className="hidden sm:inline">View on Polygon</span>
            <span className="sm:hidden">View Wallet</span>
            <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
