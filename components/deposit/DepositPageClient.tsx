"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { usePredictionTrading } from "@/hooks/usePredictionTrading";
import { usePortfolioHistory } from "@/hooks/usePortfolioHistory";
import { useOnChainTransactions, OnChainTransaction } from "@/hooks/useOnChainTransactions";
import { useExternalUsdcBalance } from "@/hooks/useExternalUsdcBalance";
import { useReferralStats } from "@/hooks/useReferralStats";
import { useProfile } from "@/hooks/useProfile";
import { MiniChart, MiniChartHoverData } from "@/components/MiniChart";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CHAIN_IDS } from "@/lib/trading-wallet/constants";
import { generateUsername } from "@/lib/utils/username";
import { getProxiedFaviconUrl } from "@/lib/utils/companyLogo";
import { getCompanySlug, getCompanySlugFromSymbol } from "@/lib/vaulto/companies";
import { getCompanyFromEventSlug } from "@/lib/polymarket/implied-valuations";
import { Check, ExternalLink, Wallet, Loader2, Copy, Pencil, ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { PredictionPositions } from "@/components/PredictionPositions";

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
  const [transactionFilter, setTransactionFilter] = useState<"all" | "trades">("trades");

  const {
    tradingWallet,
    formattedBalance,
    balance,
    polymarketBalance,
    totalAvailable,
    isLoadingWallet,
    isLoadingBalance,
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

  // Fetch prediction positions for market value
  const { positionsTotals, isLoadingPositions } = usePredictionTrading();

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

  const isDepositing = depositStatus === "initiating" || depositStatus === "pending" || depositStatus === "confirming" || isInitiatingDeposit || isSending || isConfirmingTx;

  // Fetch portfolio history for chart data
  const { chartData, history, isLoading: isLoadingHistory } = usePortfolioHistory(tradingWallet?.address);

  // Hover state for portfolio chart
  const [chartHover, setChartHover] = useState<MiniChartHoverData | null>(null);

  // Fetch on-chain transactions (deposits/withdrawals) merged with ETF orders
  const { transactions } = useOnChainTransactions(tradingWallet?.address);

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

        {/* Transactions Skeleton */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <div className="h-4 w-24 animate-pulse rounded bg-foreground/10" />
            <div className="flex items-center rounded-lg border border-border p-0.5 bg-foreground/5">
              <div className="h-6 w-10 animate-pulse rounded-md bg-foreground/10 sm:w-12" />
              <div className="h-6 w-12 animate-pulse rounded-md bg-foreground/5 sm:w-14" />
            </div>
          </div>
          <div className="space-y-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 sm:py-4">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="h-7 w-7 animate-pulse rounded-full bg-foreground/10 sm:h-8 sm:w-8" />
                  <div className="space-y-1">
                    <div className="h-3 w-16 animate-pulse rounded bg-foreground/10 sm:h-4 sm:w-20" />
                    <div className="h-3 w-20 animate-pulse rounded bg-foreground/5 sm:w-24" />
                  </div>
                </div>
                <div className="h-5 w-16 animate-pulse rounded bg-foreground/10 sm:h-6 sm:w-20" />
              </div>
            ))}
          </div>
        </div>

        {/* Prediction Positions Skeleton - desktop only */}
        <div className="mt-8 hidden sm:block">
          <div className="h-5 w-28 animate-pulse rounded bg-foreground/10 mb-4" />
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-foreground/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-foreground/10" />
                <div className="h-3 w-24 animate-pulse rounded bg-foreground/5" />
              </div>
              <div className="h-8 w-20 animate-pulse rounded bg-foreground/10" />
            </div>
          </div>
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
              walletAddress={walletAddress}
              size={48}
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

          {/* Available Balance - mobile inline */}
          <div className="text-right sm:hidden">
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              ${chartHover ? chartHover.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (parseFloat(totalAvailable) + (positionsTotals?.totalValue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-xs text-muted">
              {chartHover
                ? new Date(chartHover.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Total Balance"}
            </p>
          </div>
        </div>

        {/* Available Balance - desktop */}
        <div className="hidden border-l border-border pl-8 sm:block">
          <span className="text-4xl font-semibold tracking-tight text-foreground">
            ${chartHover ? chartHover.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (parseFloat(totalAvailable) + (positionsTotals?.totalValue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <p className="mt-1 text-sm text-muted">
            {chartHover
              ? new Date(chartHover.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
              : "Total Balance"}
          </p>
        </div>

        {/* Active Positions - hidden on mobile */}
        <div className="hidden border-l border-border pl-8 md:block">
          <span className="text-4xl font-semibold tracking-tight text-muted">
            {isLoadingPositions ? (
              <span className="inline-block h-10 w-32 animate-pulse rounded bg-foreground/10" />
            ) : (
              `$${(positionsTotals?.totalValue || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            )}
          </span>
          <p className="mt-1 text-sm text-muted">Active Positions</p>
        </div>

        {/* Trading P&L - hidden on mobile */}
        <div className="hidden border-l border-border pl-8 md:block">
          {isLoadingPositions ? (
            <>
              <span className="inline-block h-10 w-24 animate-pulse rounded bg-foreground/10" />
              <p className="mt-1 text-sm text-muted">&nbsp;</p>
            </>
          ) : (() => {
            const pnl = positionsTotals?.unrealizedPnl ?? 0;
            const totalBalance = parseFloat(totalAvailable) + (positionsTotals?.totalValue || 0);
            const pnlPctOfBalance = totalBalance > 0 ? (pnl / totalBalance) * 100 : 0;
            const isPositivePnl = pnl >= 0;
            return (
              <>
                <span className={`text-4xl font-semibold tracking-tight ${isPositivePnl ? "text-green" : "text-red"}`}>
                  ${Math.abs(pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <p className={`mt-1 text-sm ${isPositivePnl ? "text-green" : "text-red"}`}>
                  {isPositivePnl ? "+" : "-"}{Math.abs(pnlPctOfBalance).toFixed(2)}% P&L
                </p>
              </>
            );
          })()}
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
      <div className="mt-6 -mx-5 border-t border-border pt-8 pb-0 px-5 sm:mt-8 sm:pt-10">
        <div className="w-full">
          <MiniChart
            data={chartData}
            history={history}
            width={800}
            height={200}
            isPositive={isPositive}
            strokeWidth={2}
            showGradient={true}
            onHover={setChartHover}
          />
        </div>
      </div>

      {/* Transactions Section */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Transactions</h3>
            {isLoadingHistory && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
              </span>
            )}
          </div>
          {/* Filter Toggle */}
          <div className="flex items-center rounded-lg border border-border p-0.5 bg-foreground/5">
            <button
              onClick={() => setTransactionFilter("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors sm:px-3 sm:text-sm ${
                transactionFilter === "all"
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTransactionFilter("trades")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors sm:px-3 sm:text-sm ${
                transactionFilter === "trades"
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Trades
            </button>
          </div>
        </div>
        {(() => {
          const filteredTransactions = transactionFilter === "trades"
            ? transactions.filter((tx) =>
                tx.type === "buy" ||
                tx.type === "sell" ||
                tx.type === "buy_long" ||
                tx.type === "buy_short" ||
                tx.type === "sell_long" ||
                tx.type === "sell_short"
              )
            : transactions;

          if (filteredTransactions.length === 0) {
            return (
              <p className="text-sm text-muted">
                {transactionFilter === "trades" ? "No trades yet" : "No transactions yet"}
              </p>
            );
          }

          return (
            <div className="space-y-1">
              {filteredTransactions.map((tx) => {
              // Determine icon and colors based on transaction type
              const isBuy = tx.type === "buy";
              const isSell = tx.type === "sell";
              const isDeposit = tx.type === "deposit";
              const isWithdrawal = tx.type === "withdrawal";
              const isBuyLong = tx.type === "buy_long";
              const isBuyShort = tx.type === "buy_short";
              const isSellLong = tx.type === "sell_long";
              const isSellShort = tx.type === "sell_short";
              const isEtfOrder = isBuy || isSell;
              const isPredictionBuy = isBuyLong || isBuyShort;
              const isPredictionSell = isSellLong || isSellShort;
              const isPrediction = isPredictionBuy || isPredictionSell;

              // Buy long = green (positive), Buy short = blue, Sell = red (exiting)
              const iconBgClass = isDeposit || isBuy || isBuyLong
                ? "bg-green-500/10 text-green-500"
                : isBuyShort
                  ? "bg-blue-500/10 text-blue-500"
                  : isSellLong || isSellShort
                    ? "bg-orange-500/10 text-orange-500"
                    : "bg-red-500/10 text-red-500";

              const isPositiveAmount = isDeposit || isBuy || isPredictionSell;
              const amountColorClass = isPositiveAmount ? "text-green" : "text-red";

              const getStatusLabel = (status: string) => {
                if (status === "COMPLETED" || status === "FILLED") return "Completed";
                if (status === "PENDING" || status === "PENDING_APPROVAL" || status === "SUBMITTED") return "Pending";
                if (status === "CONFIRMING" || status === "PROCESSING" || status === "PARTIALLY_FILLED") return "Processing";
                if (status === "CANCELED") return "Canceled";
                if (status === "REJECTED" || status === "FAILED") return "Failed";
                return status;
              };

              const getStatusColorClass = (status: string) => {
                if (status === "COMPLETED" || status === "FILLED") return "text-green-500";
                if (status === "FAILED" || status === "REJECTED" || status === "CANCELED") return "text-red-500";
                return "text-yellow-500";
              };

              const predictionCompany = isPrediction
                ? tx.company || getCompanyFromEventSlug(tx.eventId)
                : null;

              const getTypeLabel = () => {
                if (isBuy) return `Buy ${tx.symbol}`;
                if (isSell) return `Sell ${tx.symbol}`;
                const predictionLabel = predictionCompany || tx.eventId;
                if (isBuyLong) return `Buy Long ${predictionLabel}`;
                if (isBuyShort) return `Buy Short ${predictionLabel}`;
                if (isSellLong) return `Sell Long ${predictionLabel}`;
                if (isSellShort) return `Sell Short ${predictionLabel}`;
                // Show asset name for deposits/withdrawals (e.g., "Deposit USDC", "Withdrawal MATIC")
                const assetLabel = tx.asset ? ` ${tx.asset}` : "";
                if (isDeposit) return `Deposit${assetLabel}`;
                return `Withdrawal${assetLabel}`;
              };

              const polygonUrl = tx.txHash ? `https://polygonscan.com/tx/${tx.txHash}` : null;

              // Both ETF trades and prediction trades link to the Vaulto company page.
              const companyUrl = isEtfOrder && tx.symbol
                ? `/explore/${getCompanySlugFromSymbol(tx.symbol)}`
                : isPrediction && predictionCompany
                  ? `/explore/${getCompanySlug(predictionCompany)}`
                  : null;

              const isInternalLink = !!companyUrl;
              const externalUrl = !isInternalLink ? polygonUrl : null;
              const hasLink = isInternalLink || !!externalUrl;

              const rowContent = (
                <>
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    {/* Show asset logo for USDC/MATIC transactions, otherwise show icon */}
                    {(tx.asset === "USDC" || tx.asset === "USDC.e" || tx.asset === "USDCE") ? (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
                        <img
                          src={getProxiedFaviconUrl("usdc.com")}
                          alt="USDC"
                          className="h-7 w-7 sm:h-8 sm:w-8 rounded-full"
                        />
                      </div>
                    ) : tx.asset === "MATIC" ? (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
                        <img
                          src={getProxiedFaviconUrl("polygon.technology")}
                          alt="MATIC"
                          className="h-7 w-7 sm:h-8 sm:w-8 rounded-full"
                        />
                      </div>
                    ) : (isPredictionBuy || isPredictionSell) && predictionCompany ? (
                      <CompanyLogo
                        name={predictionCompany}
                        size={28}
                        className="sm:w-8 sm:h-8"
                      />
                    ) : isEtfOrder && tx.symbol ? (
                      <CompanyLogo
                        name={tx.symbol.replace(/^v/, "")}
                        size={28}
                        className="sm:w-8 sm:h-8"
                      />
                    ) : (
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8 ${iconBgClass}`}
                      >
                        {isBuy ? (
                          <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        ) : isSell ? (
                          <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        ) : isDeposit ? (
                          <ArrowDownLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        )}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-foreground sm:text-sm">
                        {getTypeLabel()}
                      </p>
                      {/* Show shares and price for prediction trades (hidden on mobile) */}
                      {(isPredictionBuy || isPredictionSell) && typeof tx.shares === 'number' && tx.shares > 0 && tx.averagePrice && (
                        <p className="hidden text-xs text-muted sm:block">
                          {tx.shares.toFixed(2)} shares @ ${tx.averagePrice.toFixed(3)}
                        </p>
                      )}
                      <p className="text-xs text-muted sm:text-sm">
                        {new Date(tx.timestamp).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {/* Only show status for non-completed transactions */}
                        {tx.status !== "COMPLETED" && tx.status !== "FILLED" && (
                          <>
                            {" · "}
                            <span className={getStatusColorClass(tx.status)}>
                              {getStatusLabel(tx.status)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    {tx.amount > 0 ? (
                      <span className={`text-base font-semibold sm:text-lg ${amountColorClass}`}>
                        {isDeposit || isBuy || isPredictionSell ? "+" : "-"}${tx.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    ) : (tx.status === "PENDING" || tx.status === "PENDING_APPROVAL" || tx.status === "SUBMITTED" || tx.status === "PROCESSING" || tx.status === "CONFIRMING") ? (
                      <span className="text-base font-medium sm:text-lg text-muted">
                        Pending
                      </span>
                    ) : (
                      <span className="text-base font-medium sm:text-lg text-muted">
                        —
                      </span>
                    )}
                    {externalUrl && !isInternalLink && (
                      <ExternalLink className="h-4 w-4 text-muted" />
                    )}
                  </div>
                </>
              );

              const rowClassName = `flex items-center justify-between py-3 sm:py-4 -mx-3 px-3 rounded-lg transition-colors ${
                hasLink ? "hover:bg-foreground/[0.08] cursor-pointer" : "cursor-default"
              }`;

              // Use Link for internal navigation, anchor for external
              if (isInternalLink && companyUrl) {
                return (
                  <Link key={tx.id} href={companyUrl} className={rowClassName}>
                    {rowContent}
                  </Link>
                );
              }

              return (
                <a
                  key={tx.id}
                  href={externalUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={rowClassName}
                >
                  {rowContent}
                </a>
              );
              })}
            </div>
          );
        })()}
      </div>

      {/* Prediction Market Positions - hidden on mobile */}
      <div className="mt-8 hidden sm:block">
        <PredictionPositions />
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
            disabled={parseFloat(totalAvailable) <= 0}
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
