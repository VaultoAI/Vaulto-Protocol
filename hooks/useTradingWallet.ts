"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { CHAIN_IDS, USDC_DECIMALS } from "@/lib/trading-wallet/constants";

// Hook to track document visibility
function useDocumentVisibility() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

export interface TradingWalletStatus {
  id: string;
  address: string;
  chainId: number;
  status: "PENDING_CREATION" | "ACTIVE" | "SUSPENDED";
  balance: string;
  balanceUsd: string;
}

export interface DepositTransaction {
  amount: string;
  txHash?: string;
}

export interface WithdrawalRequest {
  amount: string;
  toAddress: string;
}

async function fetchTradingWalletStatus(): Promise<TradingWalletStatus | null> {
  const res = await fetch("/api/trading-wallet/status");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch trading wallet status");
  return res.json();
}

async function createTradingWallet(
  walletAddress: string
): Promise<TradingWalletStatus> {
  const res = await fetch("/api/trading-wallet/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to create trading wallet");
  }
  return res.json();
}

async function initiateDeposit(
  amount: string
): Promise<{ txData: { to: string; data: string; value: string } }> {
  const res = await fetch("/api/trading-wallet/deposit/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to initiate deposit");
  }
  return res.json();
}

async function confirmDeposit(txHash: string): Promise<{ success: boolean }> {
  const res = await fetch("/api/trading-wallet/deposit/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to confirm deposit");
  }
  return res.json();
}

async function requestWithdrawal(
  params: WithdrawalRequest
): Promise<{
  id: string;
  requiresMfa: boolean;
  status: string;
}> {
  const res = await fetch("/api/trading-wallet/withdraw/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to request withdrawal");
  }
  return res.json();
}

async function executeWithdrawal(withdrawalId: string): Promise<{
  success: boolean;
  status?: string;
  txHash?: string;
  txData?: {
    to: string;
    data: string;
    chainId: number;
  };
}> {
  const res = await fetch("/api/trading-wallet/withdraw/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ withdrawalId }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to execute withdrawal");
  }
  return res.json();
}

async function fetchBalance(): Promise<{
  balance: string;
  balanceUsd: string;
}> {
  const res = await fetch("/api/trading-wallet/balance");
  if (!res.ok) throw new Error("Failed to fetch balance");
  return res.json();
}

export function useTradingWallet() {
  const queryClient = useQueryClient();
  const { ready, authenticated, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { client: smartWalletClient } = useSmartWallets();
  const isVisible = useDocumentVisibility();

  // Get embedded wallet (the trading wallet)
  // Only search when wallets are ready to avoid false negatives
  const embeddedWallet = walletsReady
    ? wallets.find((w) => w.walletClientType === "privy")
    : undefined;

  // Get external wallet (user's connected EOA)
  const externalWallet = wallets.find((w) => w.walletClientType !== "privy");

  // Fetch trading wallet status
  const {
    data: tradingWallet,
    isLoading: isLoadingWallet,
    error: walletError,
    refetch: refetchWallet,
  } = useQuery({
    queryKey: ["trading-wallet", user?.id],
    queryFn: fetchTradingWalletStatus,
    enabled: ready && authenticated,
    staleTime: 30_000,
  });

  // Fetch balance separately for faster updates
  // Only poll when tab is visible to save resources
  const {
    data: balanceData,
    isLoading: isLoadingBalance,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ["trading-wallet-balance", tradingWallet?.address],
    queryFn: fetchBalance,
    enabled: !!tradingWallet?.address && tradingWallet.status === "ACTIVE",
    staleTime: 15_000,
    refetchInterval: isVisible ? 30_000 : false, // Poll every 30 seconds only when visible
  });

  // Create trading wallet mutation
  const createWalletMutation = useMutation({
    mutationFn: (walletAddress: string) => createTradingWallet(walletAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trading-wallet"] });
    },
  });

  // Deposit mutations
  const initiateDepositMutation = useMutation({
    mutationFn: initiateDeposit,
  });

  const confirmDepositMutation = useMutation({
    mutationFn: confirmDeposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trading-wallet-balance"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
    },
  });

  // Withdrawal mutations
  const requestWithdrawalMutation = useMutation({
    mutationFn: requestWithdrawal,
  });

  const executeWithdrawalMutation = useMutation({
    mutationFn: executeWithdrawal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trading-wallet-balance"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
    },
  });

  // Auto-creation state
  const isAutoCreatingRef = useRef(false);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const [autoCreateError, setAutoCreateError] = useState<string | null>(null);

  // Auto-create trading wallet when conditions are met
  useEffect(() => {
    const shouldAutoCreate =
      ready &&
      walletsReady &&
      authenticated &&
      embeddedWallet?.address &&
      !tradingWallet &&
      !isLoadingWallet &&
      !createWalletMutation.isPending &&
      !isAutoCreatingRef.current;

    if (!shouldAutoCreate) return;

    const autoCreate = async () => {
      isAutoCreatingRef.current = true;
      setIsAutoCreating(true);
      setAutoCreateError(null);

      try {
        await createWalletMutation.mutateAsync(embeddedWallet.address);
      } catch (err) {
        // Handle "already exists" errors silently - just refetch
        if (err instanceof Error) {
          const errorMessage = err.message.toLowerCase();
          if (
            errorMessage.includes("already exists") ||
            errorMessage.includes("duplicate") ||
            errorMessage.includes("conflict")
          ) {
            // Wallet already exists, just refetch to get the data
            await refetchWallet();
          } else {
            setAutoCreateError(err.message);
          }
        } else {
          setAutoCreateError("Failed to create trading wallet");
        }
      } finally {
        setIsAutoCreating(false);
        isAutoCreatingRef.current = false;
      }
    };

    autoCreate();
  }, [
    ready,
    walletsReady,
    authenticated,
    embeddedWallet?.address,
    tradingWallet,
    isLoadingWallet,
    createWalletMutation,
    refetchWallet,
  ]);

  // Computed values
  const balance = balanceData?.balance ?? tradingWallet?.balance ?? "0";
  const balanceUsd = balanceData?.balanceUsd ?? tradingWallet?.balanceUsd ?? "0";
  const isActive = tradingWallet?.status === "ACTIVE";
  // Only show creation prompt when auto-creation failed (so manual prompt shows as fallback)
  const needsCreation =
    ready &&
    walletsReady &&
    authenticated &&
    !tradingWallet &&
    !isLoadingWallet &&
    !isAutoCreating &&
    autoCreateError !== null;

  // Format balance for display
  const formattedBalance = parseFloat(balance).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return {
    // Wallet state
    tradingWallet,
    embeddedWallet,
    externalWallet,
    smartWalletClient,

    // Loading states
    isLoading: isLoadingWallet || isLoadingBalance,
    isLoadingWallet,
    isLoadingBalance,
    walletsReady,
    walletError,

    // Computed values
    balance,
    balanceUsd,
    formattedBalance,
    isActive,
    needsCreation,
    isAutoCreating,
    autoCreateError,
    chainId: tradingWallet?.chainId ?? CHAIN_IDS.POLYGON,

    // Actions
    createWallet: createWalletMutation.mutateAsync,
    isCreatingWallet: createWalletMutation.isPending,

    initiateDeposit: initiateDepositMutation.mutateAsync,
    isInitiatingDeposit: initiateDepositMutation.isPending,

    confirmDeposit: confirmDepositMutation.mutateAsync,
    isConfirmingDeposit: confirmDepositMutation.isPending,

    requestWithdrawal: requestWithdrawalMutation.mutateAsync,
    isRequestingWithdrawal: requestWithdrawalMutation.isPending,

    executeWithdrawal: executeWithdrawalMutation.mutateAsync,
    isExecutingWithdrawal: executeWithdrawalMutation.isPending,

    // Refresh functions
    refetchWallet,
    refetchBalance,
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ["trading-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["trading-wallet-balance"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
    },
  };
}
