"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { TokenSelect } from "@/components/TokenSelect";
import { useSwapConfig } from "@/hooks/useSwapConfig";
import { getTokenBySymbol, getPoolForPair } from "@/lib/tokens";
import { getQuote } from "@/lib/swap/quote";
import { getAllowance, checkAllowance, buildApproveParams, MAX_APPROVAL } from "@/lib/swap/approval";
import { buildExactInputSingleParams } from "@/lib/swap/execute";
import { getDemoQuote, getTokenPriceUsd, type DemoQuoteResult } from "@/lib/swap/demo-quote";
import { executeDemoSwap } from "@/lib/swap/demo-execute";
import { getDemoBalance } from "@/lib/swap/demo-state";
import { UNISWAP_ADDRESSES } from "@/lib/uniswap/constants";
import type { TokenWithName } from "@/lib/pools";
import type { DemoToken } from "@/lib/types/token";

const SLIPPAGE_BPS = 50; // 0.5%
const DEBOUNCE_MS = 400;

function parseAmount(value: string, decimals: number): bigint | null {
  if (!value || !/^\d*\.?\d*$/.test(value)) return null;
  const [whole = "0", frac = ""] = value.split(".");
  const combined = whole + frac.slice(0, decimals);
  if (combined === "0" || combined === "") return BigInt(0);
  return BigInt(combined) * BigInt(10) ** BigInt(Math.max(0, decimals - frac.length));
}

function formatAmount(amount: bigint, decimals: number): string {
  if (amount === BigInt(0)) return "0";
  const s = amount.toString().padStart(decimals + 1, "0");
  const intPart = s.slice(0, -decimals) || "0";
  const fracPart = s.slice(-decimals).replace(/\.?0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

type SwapWidgetProps = { tokens: TokenWithName[] };

export function SwapWidget({ tokens }: SwapWidgetProps) {
  const [fromToken, setFromToken] = useState("USDC");
  const [toToken, setToToken] = useState("");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [quoteOut, setQuoteOut] = useState<bigint | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [demoQuote, setDemoQuote] = useState<DemoQuoteResult | null>(null);
  const [isDemoSwapping, setIsDemoSwapping] = useState(false);
  const [demoSwapHash, setDemoSwapHash] = useState<string | null>(null);

  const { address, chain, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { login, authenticated } = usePrivy();
  const { data: config } = useSwapConfig();
  const { balance: tradingWalletBalance, formattedBalance, isActive: hasTradingWallet } = useTradingWallet();
  const swapAfterApproveRef = useRef<string | null>(null);
  const tokenRegistry = config?.tokens ?? {};
  const poolsForPair = config?.poolsForPair ?? {};
  const demoTokensList = config?.demoTokens ?? [];

  // Build a map of demo tokens for quick lookup
  const demoTokensMap = useMemo(() => {
    const map = new Map<string, DemoToken>();
    for (const token of demoTokensList) {
      map.set(token.symbol, token);
    }
    return map;
  }, [demoTokensList]);

  // Set of demo symbols for TokenSelect
  const demoSymbols = useMemo(() => {
    return new Set(demoTokensList.map((t) => t.symbol));
  }, [demoTokensList]);

  // Filter tokens to only include base tokens (USDC) and private tokens
  // Remove public stock tokens (those ending in "on" like NVDAon, TSLAon)
  const filteredTokens = useMemo(() => {
    // Keep only USDC from on-chain tokens
    const baseTokens = tokens.filter((t) => t.symbol === "USDC");
    // Add private company tokens
    const privateTokens = demoTokensList.map((dt) => ({
      symbol: dt.symbol,
      name: dt.name,
    }));
    return [...baseTokens, ...privateTokens];
  }, [tokens, demoTokensList]);

  // Set default toToken to first private token when available
  useEffect(() => {
    if (!toToken && demoTokensList.length > 0) {
      setToToken(demoTokensList[0].symbol);
    }
  }, [toToken, demoTokensList]);

  // Check if this is a demo swap (either token is a demo token)
  const isDemoSwap = useMemo(() => {
    return demoSymbols.has(fromToken) || demoSymbols.has(toToken);
  }, [fromToken, toToken, demoSymbols]);

  const poolForPair = useMemo(
    () => getPoolForPair(poolsForPair, fromToken, toToken),
    [poolsForPair, fromToken, toToken]
  );
  const tokenInInfo = getTokenBySymbol(tokenRegistry, fromToken);
  const tokenOutInfo = getTokenBySymbol(tokenRegistry, toToken);
  const amountInRaw = useMemo(
    () =>
      tokenInInfo && fromAmount
        ? parseAmount(fromAmount, tokenInInfo.decimals)
        : null,
    [fromAmount, tokenInInfo]
  );

  // Debounced quote (on-chain)
  useEffect(() => {
    // Skip on-chain quoting for demo swaps
    if (isDemoSwap) {
      setQuoteOut(null);
      return;
    }
    if (
      !publicClient ||
      !poolForPair ||
      !tokenInInfo ||
      !tokenOutInfo ||
      amountInRaw === null ||
      amountInRaw <= BigInt(0)
    ) {
      setQuoteOut(null);
      return;
    }
    const tokenIn = tokenInInfo.address as `0x${string}`;
    const tokenOut = tokenOutInfo.address as `0x${string}`;
    let cancelled = false;
    setQuoteLoading(true);
    const t = setTimeout(async () => {
      try {
        const result = await getQuote(publicClient, {
          tokenIn,
          tokenOut,
          amountIn: amountInRaw,
          fee: poolForPair.feeTier,
        });
        if (!cancelled && result) {
          setQuoteOut(result.amountOut);
          setToAmount(formatAmount(result.amountOut, tokenOutInfo.decimals));
        } else if (!cancelled) {
          setQuoteOut(null);
          setToAmount("");
        }
      } catch {
        if (!cancelled) {
          setQuoteOut(null);
          setToAmount("");
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    publicClient,
    poolForPair,
    tokenInInfo?.address,
    tokenOutInfo?.address,
    amountInRaw?.toString(),
    fromToken,
    toToken,
    isDemoSwap,
  ]);

  // Debounced demo quote
  useEffect(() => {
    if (!isDemoSwap || !fromAmount || Number(fromAmount) <= 0) {
      setDemoQuote(null);
      setToAmount("");
      return;
    }

    const tokenInPrice = getTokenPriceUsd(fromToken, demoTokensMap);
    const tokenOutPrice = getTokenPriceUsd(toToken, demoTokensMap);

    if (tokenInPrice <= 0 || tokenOutPrice <= 0) {
      setDemoQuote(null);
      setToAmount("");
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);
    const t = setTimeout(() => {
      if (cancelled) return;
      const amountIn = Number(fromAmount);
      const quote = getDemoQuote({
        tokenIn: fromToken,
        tokenOut: toToken,
        amountIn,
        tokenInPrice,
        tokenOutPrice,
      });
      setDemoQuote(quote);
      setToAmount(quote.amountOut.toFixed(6));
      setQuoteLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isDemoSwap, fromToken, toToken, fromAmount, demoTokensMap]);

  const handleFlip = useCallback(() => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
    setQuoteOut(null);
    setDemoQuote(null);
  }, [fromToken, toToken, fromAmount, toAmount]);

  const isMainnet = chain?.id === 1;

  // Demo swap doesn't require wallet connection or chain
  const canDemoSwap =
    isDemoSwap &&
    demoQuote != null &&
    demoQuote.amountOut > 0 &&
    Number(fromAmount) > 0 &&
    getDemoBalance(fromToken) >= Number(fromAmount);

  // On-chain swap requires wallet and chain
  const canSwap =
    !isDemoSwap &&
    isConnected &&
    isMainnet &&
    address &&
    amountInRaw != null &&
    amountInRaw > BigInt(0) &&
    quoteOut != null &&
    quoteOut > BigInt(0) &&
    tokenInInfo &&
    tokenOutInfo &&
    poolForPair;

  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveHash,
  });
  const {
    writeContract: writeSwap,
    data: swapHash,
    isPending: isSwapPending,
    error: swapErrorWrite,
    reset: resetSwap,
  } = useWriteContract();
  const { isLoading: isSwapConfirming } = useWaitForTransactionReceipt({
    hash: swapHash,
  });

  const isApproveFlow = isApprovePending || isApproveConfirming;
  const isSwapFlow = isSwapPending || isSwapConfirming;
  const isBusy = isApproveFlow || isSwapFlow;

  const allowance = useMemo(() => {
    if (!address || !tokenInInfo || !amountInRaw) return undefined;
    return { owner: address, token: tokenInInfo.address as `0x${string}`, amountIn: amountInRaw };
  }, [address, tokenInInfo?.address, amountInRaw?.toString()]);

  const [allowanceValue, setAllowanceValue] = useState<bigint | null>(null);
  useEffect(() => {
    if (!publicClient || !allowance) {
      setAllowanceValue(null);
      return;
    }
    getAllowance(publicClient, {
      owner: allowance.owner,
      token: allowance.token,
    }).then(setAllowanceValue).catch(() => setAllowanceValue(null));
  }, [publicClient, allowance?.owner, allowance?.token]);

  const needsApproval =
    canSwap &&
    allowanceValue != null &&
    !checkAllowance(allowanceValue, amountInRaw!).sufficient;

  const doApprove = useCallback(() => {
    if (!tokenInInfo || !amountInRaw) return;
    setSwapError(null);
    resetApprove();
    resetSwap();
    writeApprove(
      buildApproveParams({
        token: tokenInInfo.address as `0x${string}`,
        spender: UNISWAP_ADDRESSES.SwapRouter02,
        amount: MAX_APPROVAL,
      })
    );
  }, [tokenInInfo, amountInRaw, writeApprove, resetApprove, resetSwap]);

  const doSwap = useCallback(() => {
    if (!canSwap || !address || !quoteOut || !tokenInInfo || !tokenOutInfo || !poolForPair)
      return;
    setSwapError(null);
    resetSwap();
    const params = buildExactInputSingleParams({
      tokenIn: tokenInInfo.address as `0x${string}`,
      tokenOut: tokenOutInfo.address as `0x${string}`,
      fee: poolForPair.feeTier,
      recipient: address,
      amountIn: amountInRaw!,
      quotedAmountOut: quoteOut,
      slippageBps: SLIPPAGE_BPS,
    });
    writeSwap(params);
  }, [
    canSwap,
    address,
    quoteOut,
    tokenInInfo,
    tokenOutInfo,
    poolForPair,
    amountInRaw,
    writeSwap,
    resetSwap,
  ]);

  useEffect(() => {
    if (approveError) setSwapError(approveError.message ?? "Approval failed");
  }, [approveError]);
  useEffect(() => {
    if (swapErrorWrite) setSwapError(swapErrorWrite.message ?? "Swap failed");
  }, [swapErrorWrite]);

  // After approve confirms, run swap once
  useEffect(() => {
    if (
      approveHash &&
      !isApproveConfirming &&
      !isSwapFlow &&
      canSwap &&
      swapAfterApproveRef.current !== approveHash
    ) {
      swapAfterApproveRef.current = approveHash;
      doSwap();
    }
  }, [approveHash, isApproveConfirming, isSwapFlow, canSwap, doSwap]);

  // Demo swap execution
  const doDemoSwap = useCallback(async () => {
    if (!canDemoSwap || !demoQuote) return;
    setSwapError(null);
    setIsDemoSwapping(true);
    setDemoSwapHash(null);
    try {
      const result = await executeDemoSwap({ quote: demoQuote });
      if (result.success) {
        setDemoSwapHash(result.txHash);
        // Clear amounts after successful swap
        setFromAmount("");
        setToAmount("");
        setDemoQuote(null);
      } else {
        setSwapError(result.error ?? "Demo swap failed");
      }
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : "Demo swap failed");
    } finally {
      setIsDemoSwapping(false);
    }
  }, [canDemoSwap, demoQuote]);

  const handleSwapClick = useCallback(() => {
    // Demo swaps don't require wallet connection
    if (isDemoSwap) {
      if (canDemoSwap) {
        doDemoSwap();
      }
      return;
    }

    // On-chain swap requires wallet
    if (!isConnected) {
      login();
      return;
    }
    if (!isMainnet || !canSwap) return;
    if (needsApproval) doApprove();
    else doSwap();
  }, [isDemoSwap, canDemoSwap, doDemoSwap, isConnected, isMainnet, canSwap, needsApproval, login, doApprove, doSwap]);

  const isBusyOverall = isBusy || isDemoSwapping;

  const swapButtonLabel = isDemoSwap
    ? isDemoSwapping
      ? "Demo Swapping..."
      : canDemoSwap
        ? "Demo Swap"
        : Number(fromAmount) > 0 && getDemoBalance(fromToken) < Number(fromAmount)
          ? "Insufficient balance"
          : "Demo Swap"
    : !isConnected
      ? "Connect wallet"
      : !isMainnet
        ? "Switch to Ethereum"
        : needsApproval && !isBusy
          ? "Approve & Swap"
          : isApproveFlow
            ? "Approve..."
            : isSwapFlow
              ? "Swapping..."
              : "Swap";

  return (
    <div className="max-w-md rounded-lg border border-border bg-background" aria-label="Swap widget">
      <div className="p-4">
        <label className="sr-only" htmlFor="swap-from-amount">
          From amount
        </label>
        <label className="sr-only" htmlFor="swap-from-token">
          From token
        </label>
        <div className="flex items-center gap-2 rounded border border-border bg-background">
          <input
            id="swap-from-amount"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-foreground placeholder:text-muted focus:outline-none"
            aria-label="From amount"
          />
          <div className="flex items-center border-l border-border pl-2 pr-3 py-3">
            <TokenSelect
              id="swap-from-token"
              tokens={filteredTokens}
              value={fromToken}
              onChange={setFromToken}
              disabledValue={toToken}
              ariaLabel="From token"
              demoSymbols={demoSymbols}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-center -mt-2 relative z-[1]">
        <button
          type="button"
          onClick={handleFlip}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground hover:opacity-90 transition-opacity"
          aria-label="Flip from and to"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7M17 7H7M17 7V17" />
          </svg>
        </button>
      </div>

      <div className="p-4 pt-2">
        <label className="sr-only" htmlFor="swap-to-amount">
          To amount
        </label>
        <label className="sr-only" htmlFor="swap-to-token">
          To token
        </label>
        <div className="flex items-center gap-2 rounded border border-border bg-background">
          <input
            id="swap-to-amount"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={toAmount}
            readOnly
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-foreground placeholder:text-muted focus:outline-none"
            aria-label="To amount"
          />
          <div className="flex items-center border-l border-border pl-2 pr-3 py-3">
            <TokenSelect
              id="swap-to-token"
              tokens={filteredTokens}
              value={toToken}
              onChange={setToToken}
              disabledValue={fromToken}
              ariaLabel="To token"
              demoSymbols={demoSymbols}
            />
          </div>
        </div>
        {quoteLoading && fromAmount && (
          <p className="mt-1.5 text-xs text-muted">Getting quote…</p>
        )}
      </div>

      {swapError && (
        <div className="px-4 pb-2">
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {swapError}
          </p>
        </div>
      )}

      {demoSwapHash && (
        <div className="px-4 pb-2">
          <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300">
            <p className="font-medium">Demo swap successful</p>
            <p className="mt-0.5 text-xs opacity-80 font-mono truncate">
              {demoSwapHash}
            </p>
          </div>
        </div>
      )}

      <div className="p-4 pt-0">
        <button
          type="button"
          onClick={handleSwapClick}
          disabled={
            isDemoSwap
              ? isBusyOverall || !canDemoSwap
              : isConnected && (isBusy || !isMainnet || (isMainnet && !canSwap))
          }
          className="w-full border border-foreground bg-foreground py-3 text-background font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={swapButtonLabel}
        >
          {swapButtonLabel}
        </button>
        {authenticated && hasTradingWallet && (
          <p className="mt-2 text-center text-xs text-muted">
            Trading wallet: ${formattedBalance} USDC
          </p>
        )}
      </div>
    </div>
  );
}
