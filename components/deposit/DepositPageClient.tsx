"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { WithdrawModal } from "@/components/trading-wallet/WithdrawModal";
import { MiniChart } from "@/components/MiniChart";
import { CHAIN_IDS } from "@/lib/trading-wallet/constants";
import { Check, ExternalLink, Wallet, Loader2 } from "lucide-react";

type DepositStatus = "idle" | "initiating" | "pending" | "confirming" | "success" | "error";

const PRESET_AMOUNTS = ["25", "50", "100", "250"];

export function DepositPageClient() {
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositStatus, setDepositStatus] = useState<DepositStatus>("idle");
  const [depositError, setDepositError] = useState<string | null>(null);

  const { ready, authenticated } = usePrivy();
  const { chain } = useAccount();
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

  const handlePresetClick = (amount: string) => {
    setDepositAmount(amount);
    setDepositError(null);
    if (depositStatus === "error" || depositStatus === "success") {
      setDepositStatus("idle");
    }
  };

  const resetDeposit = () => {
    setDepositAmount("");
    setDepositError(null);
    setDepositStatus("idle");
    resetTransaction();
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

  // Show loading while Privy initializes or wallet is loading
  if (!ready || isLoadingWallet) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-foreground/20 border-t-foreground" />
        <p className="text-muted">Loading wallet...</p>
      </div>
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
      {/* Header - Balance */}
      <div>
        <span className="text-4xl font-semibold tracking-tight text-foreground">
          ${formattedBalance}
        </span>
        <p className="mt-1 text-sm text-muted">Portfolio Value</p>
      </div>

      {/* Chart Section */}
      <div className="mt-6 -mx-5 border-t border-border pt-6 px-5">
        <MiniChart
          data={chartData}
          width={800}
          height={120}
          isPositive={true}
          strokeWidth={2}
          showGradient={true}
        />
      </div>

      {/* Deposit Section */}
      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="text-sm font-medium text-foreground mb-4">Add Funds</h3>

        {/* Amount Input */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted">$</span>
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
            className="w-full rounded-lg border border-border bg-transparent py-3 pl-8 pr-16 text-lg text-foreground placeholder:text-muted focus:outline-none focus:border-foreground/50 disabled:opacity-50"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">USDC</span>
        </div>

        {/* Preset Amount Buttons */}
        <div className="flex gap-2 mb-4">
          {PRESET_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => handlePresetClick(amount)}
              disabled={isDepositing}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                depositAmount === amount
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-foreground hover:bg-foreground/5"
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>

        {/* Network Warning */}
        {!isPolygon && (
          <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5 text-sm text-yellow-700 dark:text-yellow-400">
            Please switch to Polygon network to deposit
          </div>
        )}

        {/* Error Message */}
        {depositError && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
            {depositError}
            <button onClick={resetDeposit} className="ml-2 underline">
              Try again
            </button>
          </div>
        )}

        {/* Success Message */}
        {depositStatus === "success" && (
          <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
            <Check className="h-4 w-4" />
            ${depositAmount} USDC deposited successfully!
          </div>
        )}

        {/* Deposit Button */}
        <button
          onClick={handleDeposit}
          disabled={
            !depositAmount ||
            parseFloat(depositAmount) <= 0 ||
            isDepositing ||
            !isPolygon ||
            depositStatus === "success"
          }
          className="w-full rounded-lg bg-foreground py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isDepositing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {depositStatus === "initiating" && "Preparing..."}
              {depositStatus === "pending" && "Confirm in wallet..."}
              {depositStatus === "confirming" && "Confirming..."}
              {(isSending || isConfirmingTx) && !["initiating", "pending", "confirming"].includes(depositStatus) && "Processing..."}
            </>
          ) : (
            "Add Funds"
          )}
        </button>

        {/* Transaction Link */}
        {txHash && depositStatus !== "idle" && (
          <a
            href={`https://polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            View transaction
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
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
