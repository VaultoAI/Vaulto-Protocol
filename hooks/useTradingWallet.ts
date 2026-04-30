"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { CHAIN_IDS, USDC_DECIMALS } from "@/lib/trading-wallet/constants";

/**
 * Ensure trading credentials are set up (creates wallet server-side if needed)
 */
async function ensureCredentials(privyToken: string): Promise<{ ready: boolean; error?: string }> {
  const res = await fetch("/api/trading/ensure-credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-privy-token": privyToken,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    return { ready: false, error: data.error || "Failed to ensure credentials" };
  }
  return data;
}

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
  hasServerSigner?: boolean;
  safeAddress?: string | null;
}

export interface DepositTransaction {
  amount: string;
  txHash?: string;
}

export interface WithdrawalRequest {
  amount: string;
  toAddress: string;
}

async function fetchTradingWalletStatus(privyToken?: string): Promise<TradingWalletStatus | null> {
  const headers: HeadersInit = {};
  if (privyToken) {
    headers["x-privy-token"] = privyToken;
  }

  const res = await fetch("/api/trading-wallet/status", { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch trading wallet status");
  return res.json();
}

async function createTradingWallet(
  walletAddressOrToken: string,
  isPrivyToken: boolean = false
): Promise<TradingWalletStatus> {
  const body = isPrivyToken
    ? { privyToken: walletAddressOrToken }
    : { walletAddress: walletAddressOrToken };

  const res = await fetch("/api/trading-wallet/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || data.message || "Failed to create trading wallet");
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
    const data = await res.json();
    throw new Error(data.error || data.message || "Failed to initiate deposit");
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
    const data = await res.json();
    throw new Error(data.error || data.message || "Failed to confirm deposit");
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
    const data = await res.json();
    throw new Error(data.error || data.message || "Failed to request withdrawal");
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
  message?: string;
  withdrawalId?: string;
}> {
  console.log("[useTradingWallet] executeWithdrawal called with:", withdrawalId);

  const res = await fetch("/api/trading-wallet/withdraw/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ withdrawalId }),
  });

  console.log("[useTradingWallet] Response status:", res.status);

  const data = await res.json();
  console.log("[useTradingWallet] Response data:", JSON.stringify(data, null, 2));

  if (!res.ok) {
    const errorMsg = data.error || data.message || data.details || "Failed to execute withdrawal";
    console.error("[useTradingWallet] Error response:", errorMsg);
    throw new Error(errorMsg);
  }

  return data;
}

export interface BalanceResponse {
  balance: string;
  balanceUsd: string;
  usdc?: {
    balance: string;
    balanceUsd: string;
    raw: string;
  };
  matic?: {
    balance: string;
    raw: string;
    low: boolean;
  };
  polymarket?: {
    address: string;
    pusdBalance: string;
    pusdRaw: string;
  } | null;
  totalAvailable?: string;
  address?: string;
  chainId?: number;
}

async function fetchBalance(privyToken?: string): Promise<BalanceResponse> {
  const headers: HeadersInit = {};
  if (privyToken) {
    headers["x-privy-token"] = privyToken;
  }

  const res = await fetch("/api/trading-wallet/balance", { headers });
  if (!res.ok) throw new Error("Failed to fetch balance");
  return res.json();
}

async function detectDeposits(): Promise<{
  detected: number;
  deposits: Array<{
    id: string;
    txHash: string;
    amount: string;
    fromAddress: string;
    confirmedAt: string;
  }>;
  message: string;
}> {
  const res = await fetch("/api/trading-wallet/deposit/detect", {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || data.message || "Failed to detect deposits");
  }
  return res.json();
}

async function recoverWithdrawals(): Promise<{
  recovered: number;
  withdrawals: Array<{
    id: string;
    txHash: string;
    previousStatus: string;
    newStatus: string;
  }>;
  message: string;
}> {
  const res = await fetch("/api/trading-wallet/withdraw/recover", {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || data.message || "Failed to recover withdrawals");
  }
  return res.json();
}

export interface ReturnSafeFundsResponse {
  success: boolean;
  skipped?: boolean;
  amountReturned?: string;
  transactions?: {
    transferTxHash?: string;
    swapTxHash?: string;
  };
  message?: string;
  error?: string;
}

async function returnSafeFunds(privyToken: string): Promise<ReturnSafeFundsResponse> {
  const res = await fetch("/api/trading-wallet/withdraw/return-safe-funds", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-privy-token": privyToken,
    },
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || data.message || "Failed to return Safe funds");
  }
  return res.json();
}

export function useTradingWallet() {
  const queryClient = useQueryClient();
  const { ready, authenticated, user, getAccessToken } = usePrivy();
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
    queryFn: async () => {
      // Get Privy token to pass to the API
      const token = await getAccessToken();
      return fetchTradingWalletStatus(token || undefined);
    },
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
    queryFn: async () => {
      const token = await getAccessToken();
      return fetchBalance(token || undefined);
    },
    enabled: !!tradingWallet?.address && tradingWallet.status === "ACTIVE",
    staleTime: 15_000,
    refetchInterval: isVisible ? 30_000 : false, // Poll every 30 seconds only when visible
  });

  // Create trading wallet mutation
  // Supports both legacy (wallet address) and new (Privy token) modes
  const createWalletMutation = useMutation({
    mutationFn: ({
      walletAddressOrToken,
      isPrivyToken = false,
    }: {
      walletAddressOrToken: string;
      isPrivyToken?: boolean;
    }) => createTradingWallet(walletAddressOrToken, isPrivyToken),
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

  // Deposit detection mutation (for Privy fundWallet fiat on-ramp)
  const detectDepositsMutation = useMutation({
    mutationFn: detectDeposits,
    onSuccess: (data) => {
      if (data.detected > 0) {
        queryClient.invalidateQueries({ queryKey: ["trading-wallet-balance"] });
        queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
      }
    },
  });

  // Withdrawal recovery mutation (for stuck withdrawals)
  const recoverWithdrawalsMutation = useMutation({
    mutationFn: recoverWithdrawals,
    onSuccess: (data) => {
      if (data.recovered > 0) {
        queryClient.invalidateQueries({ queryKey: ["trading-wallet-balance"] });
        queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
      }
    },
  });

  // Return Safe funds mutation (for withdrawing all funds including Polymarket wallet)
  const returnSafeFundsMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Failed to get authentication token");
      }
      return returnSafeFunds(token);
    },
    onSuccess: (data) => {
      if (data.success && !data.skipped) {
        queryClient.invalidateQueries({ queryKey: ["trading-wallet-balance"] });
      }
    },
  });

  // Auto-creation state
  const isAutoCreatingRef = useRef(false);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const [autoCreateError, setAutoCreateError] = useState<string | null>(null);

  // Track last detection time to avoid too frequent checks
  const lastDetectionRef = useRef<number>(0);

  // Auto-detect deposits when tab becomes visible (user returns to app)
  // This catches deposits made via fund wallet while user was in another tab
  useEffect(() => {
    if (!isVisible) return;
    if (!tradingWallet?.address || tradingWallet.status !== "ACTIVE") return;
    if (detectDepositsMutation.isPending) return;

    // Throttle: only run detection once every 30 seconds
    const now = Date.now();
    if (now - lastDetectionRef.current < 30_000) return;

    lastDetectionRef.current = now;

    // Run detection in background (don't block UI)
    detectDepositsMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.detected > 0) {
          console.log(`[useTradingWallet] Auto-detected ${data.detected} deposit(s) on tab focus`);
        }
      },
      onError: (err) => {
        console.error("[useTradingWallet] Auto-detection failed:", err);
      },
    });
  }, [isVisible, tradingWallet?.address, tradingWallet?.status, detectDepositsMutation]);

  // Periodic polling for deposit detection (every 60 seconds when tab is visible)
  // This ensures deposits from fiat on-ramp are reliably caught regardless of when they settle
  useEffect(() => {
    if (!isVisible) return;
    if (!tradingWallet?.address || tradingWallet.status !== "ACTIVE") return;

    const interval = setInterval(() => {
      if (!detectDepositsMutation.isPending) {
        detectDepositsMutation.mutate(undefined, {
          onSuccess: (data) => {
            if (data.detected > 0) {
              console.log(`[useTradingWallet] Periodic detection found ${data.detected} deposit(s)`);
            }
          },
          onError: (err) => {
            console.error("[useTradingWallet] Periodic detection failed:", err);
          },
        });
      }
    }, 60_000); // Poll every 60 seconds

    return () => clearInterval(interval);
  }, [isVisible, tradingWallet?.address, tradingWallet?.status, detectDepositsMutation]);

  // Auto-create trading wallet when conditions are met
  // Note: With server-side wallet creation, we don't need an embedded wallet to exist first
  useEffect(() => {
    const shouldAutoCreate =
      ready &&
      walletsReady &&
      authenticated &&
      user?.id &&
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
        // Always use ensure-credentials to handle wallet creation server-side
        // This works for both new users and users with existing embedded wallets
        console.log("[useTradingWallet] Calling ensure-credentials to set up trading wallet...");

        // Get Privy access token
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error("Failed to get Privy access token");
        }

        // Call ensure-credentials to create/configure wallet server-side
        const result = await ensureCredentials(accessToken);

        if (!result.ready) {
          throw new Error(result.error || "Failed to set up trading wallet");
        }

        console.log("[useTradingWallet] ensure-credentials succeeded, refetching wallet...");
        // Refetch to get the newly created wallet
        await refetchWallet();
      } catch (err) {
        // Handle specific errors appropriately
        if (err instanceof Error) {
          const errorMessage = err.message.toLowerCase();
          if (
            errorMessage.includes("already exists") ||
            errorMessage.includes("duplicate")
          ) {
            // Wallet already exists, just refetch to get the data
            console.log("[useTradingWallet] Wallet already exists, refetching...");
            await refetchWallet();
          } else if (errorMessage.includes("conflict") || errorMessage.includes("registered to another")) {
            // Conflict error - wallet belongs to different user (data issue)
            // Mark as permanent error to stop retrying
            console.error("[useTradingWallet] Conflict error (wallet belongs to another user):", err.message);
            setAutoCreateError("This wallet is registered to another account. Please contact support.");
          } else {
            console.error("[useTradingWallet] Auto-create error:", err.message);
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
    user?.id,
    embeddedWallet?.address,
    tradingWallet,
    isLoadingWallet,
    createWalletMutation,
    refetchWallet,
    getAccessToken,
  ]);

  // Computed values
  const balance = balanceData?.balance ?? tradingWallet?.balance ?? "0";
  const balanceUsd = balanceData?.balanceUsd ?? tradingWallet?.balanceUsd ?? "0";
  const maticBalance = balanceData?.matic?.balance ?? "0";
  const maticLow = balanceData?.matic?.low ?? false;
  const polymarketBalance = balanceData?.polymarket?.pusdBalance ?? "0";
  const totalAvailable = balanceData?.totalAvailable ?? balance;
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

  // Format balance for display (2 decimal places)
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
    maticBalance,
    maticLow,
    polymarketBalance,
    polymarketAddress: balanceData?.polymarket?.address ?? tradingWallet?.safeAddress ?? null,
    totalAvailable,
    isActive,
    needsCreation,
    isAutoCreating,
    autoCreateError,
    chainId: tradingWallet?.chainId ?? CHAIN_IDS.POLYGON,

    // Server signer status
    hasServerSigner: tradingWallet?.hasServerSigner ?? false,

    // Actions
    createWallet: (walletAddressOrToken: string, isPrivyToken: boolean = false) =>
      createWalletMutation.mutateAsync({ walletAddressOrToken, isPrivyToken }),
    isCreatingWallet: createWalletMutation.isPending,

    initiateDeposit: initiateDepositMutation.mutateAsync,
    isInitiatingDeposit: initiateDepositMutation.isPending,

    confirmDeposit: confirmDepositMutation.mutateAsync,
    isConfirmingDeposit: confirmDepositMutation.isPending,

    requestWithdrawal: requestWithdrawalMutation.mutateAsync,
    isRequestingWithdrawal: requestWithdrawalMutation.isPending,

    executeWithdrawal: executeWithdrawalMutation.mutateAsync,
    isExecutingWithdrawal: executeWithdrawalMutation.isPending,

    detectDeposits: detectDepositsMutation.mutateAsync,
    isDetectingDeposits: detectDepositsMutation.isPending,

    recoverWithdrawals: recoverWithdrawalsMutation.mutateAsync,
    isRecoveringWithdrawals: recoverWithdrawalsMutation.isPending,

    returnSafeFunds: returnSafeFundsMutation.mutateAsync,
    isReturningSafeFunds: returnSafeFundsMutation.isPending,

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
