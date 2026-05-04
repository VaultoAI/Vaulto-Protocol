"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol } from "@/lib/vaulto/companies";
import {
  usePredictionMarketData,
  formatVolume,
  formatSpreadPercent,
} from "@/hooks/usePredictionMarketData";
import { usePredictionTrading } from "@/hooks/usePredictionTrading";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { formatValuationPrecise } from "@/lib/polymarket/ipo-valuations";
import {
  getImpliedValuationSlug,
  type ImpliedValuationResponse,
} from "@/lib/polymarket/implied-valuations";

interface PredictionMarketTradeWidgetProps {
  company: PrivateCompany;
  eventSlug: string;
  currentImpliedValuation?: number | null;
  variant?: "default" | "mobile";
}

type TradeState = "idle" | "confirming" | "loading" | "success" | "error";

/**
 * Inline prediction market trading widget with Long/Short tabs.
 * Displays market metrics and allows demo trading.
 */
export function PredictionMarketTradeWidget({
  company,
  eventSlug,
  currentImpliedValuation,
  variant = "default",
}: PredictionMarketTradeWidgetProps) {
  const isMobile = variant === "mobile";
  const symbol = getSyntheticSymbol(company.name);
  const { data, isLoading, error } = usePredictionMarketData(eventSlug);
  const { buyLong, buyShort, isBuying } = usePredictionTrading({ fetchPositions: false });
  const { balance, isActive: hasActiveWallet } = useTradingWallet();

  // Fetch implied valuation from the implied-valuations API (same as IPO visualization)
  const impliedValuationSlug = getImpliedValuationSlug(company.name);
  const { data: impliedData } = useQuery({
    queryKey: ["implied-valuation", impliedValuationSlug],
    queryFn: async () => {
      if (!impliedValuationSlug) return null;
      const res = await fetch(`/api/implied-valuations/${impliedValuationSlug}`);
      if (!res.ok) return null;
      return res.json() as Promise<ImpliedValuationResponse>;
    },
    enabled: !!impliedValuationSlug,
    staleTime: 60000, // 1 minute
  });

  const [activeTab, setActiveTab] = useState<"long" | "short">("long");
  const [amount, setAmount] = useState("");
  const [tradeState, setTradeState] = useState<TradeState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ shares: number; positionId: string } | null>(null);

  const usdcBalance = parseFloat(balance) || 0;
  const usdcAmount = parseFloat(amount) || 0;

  // Get current direction data
  const isLong = activeTab === "long";
  const positionCost = isLong
    ? data?.valuation.longCost ?? 0.5
    : data?.valuation.shortCost ?? 0.5;
  const spreadPercent = isLong
    ? data?.slippage.long.spreadPercent ?? 0
    : data?.slippage.short.spreadPercent ?? 0;
  const buyCost = isLong
    ? data?.slippage.long.buyCost ?? positionCost
    : data?.slippage.short.buyCost ?? positionCost;
  const sellValue = isLong
    ? data?.slippage.long.sellValue ?? positionCost
    : data?.slippage.short.sellValue ?? positionCost;
  const bestReturn = isLong
    ? data?.valuation.bestLongReturn ?? 0
    : data?.valuation.bestShortReturn ?? 0;

  // Spread is realized as a one-time cost at entry. After that the position
  // tracks the implied valuation chart only, so a fresh position reads $0/0%.
  const spreadCostUsd = usdcAmount > 0 ? (usdcAmount * spreadPercent) / 100 : 0;
  const fairSellValueAtEntry =
    usdcAmount > 0 && buyCost > 0 ? usdcAmount * (sellValue / buyCost) : 0;

  // Use passed prop if available (synced with chart), otherwise fall back to fetched data
  const impliedValuation = currentImpliedValuation ?? impliedData?.impliedValuationUsd ?? 0;

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (/^\d*\.?\d*$/.test(value)) {
        setAmount(value);
        setTradeState("idle");
        setErrorMessage(null);
        setResult(null);
      }
    },
    []
  );

  const handleReview = useCallback(() => {
    if (!amount || usdcAmount <= 0) {
      setErrorMessage("Please enter a valid amount");
      return;
    }
    if (!hasActiveWallet) {
      setErrorMessage("Please set up your trading wallet first");
      return;
    }
    if (usdcBalance < usdcAmount) {
      setErrorMessage(`Insufficient USDC balance ($${usdcBalance.toFixed(2)} available)`);
      return;
    }
    setErrorMessage(null);
    setTradeState("confirming");
  }, [amount, usdcAmount, usdcBalance, hasActiveWallet]);

  const handleConfirm = useCallback(async () => {
    setTradeState("loading");
    setErrorMessage(null);

    try {
      const tradeFn = activeTab === "long" ? buyLong : buyShort;
      const tradeResult = await tradeFn(eventSlug, usdcAmount);

      if (tradeResult.success) {
        setTradeState("success");
        // Position size displayed = fair sell value at entry. Frontend's
        // success copy reflects that the spread has been deducted up front.
        setResult({
          shares: fairSellValueAtEntry,
          positionId: tradeResult.positionId || "",
        });
        setAmount("");
      } else {
        setTradeState("error");
        setErrorMessage(tradeResult.error ?? "Trade failed");
      }
    } catch (err) {
      setTradeState("error");
      setErrorMessage(err instanceof Error ? err.message : "Trade failed");
    }
  }, [activeTab, buyLong, buyShort, eventSlug, usdcAmount, fairSellValueAtEntry]);

  const handleCancelConfirm = useCallback(() => {
    setTradeState("idle");
    setErrorMessage(null);
  }, []);

  const handleReset = useCallback(() => {
    setTradeState("idle");
    setResult(null);
    setErrorMessage(null);
  }, []);

  return (
    <div
      className={
        isMobile
          ? "w-full"
          : "w-full rounded-xl border border-border bg-card-bg"
      }
    >
      {/* Long/Short tabs */}
      <div className={`flex ${isMobile ? "" : "border-b border-border"}`}>
        <button
          onClick={() => {
            setActiveTab("long");
            handleReset();
          }}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
            activeTab === "long"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : `text-muted hover:text-foreground ${isMobile ? "border-b-2 border-border" : ""}`
          }`}
        >
          Long
        </button>
        <button
          onClick={() => {
            setActiveTab("short");
            handleReset();
          }}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
            activeTab === "short"
              ? "text-red border-b-2 border-red"
              : `text-muted hover:text-foreground ${isMobile ? "border-b-2 border-border" : ""}`
          }`}
        >
          Short
        </button>
      </div>

      <div className={isMobile ? "pt-4 space-y-4" : "p-5 space-y-4"}>
        {/* Loading state */}
        {isLoading && (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-badge-bg rounded w-3/4" />
            <div className="h-4 bg-badge-bg rounded w-1/2" />
            <div className="h-4 bg-badge-bg rounded w-2/3" />
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="text-sm text-red">
            Failed to load market data
          </div>
        )}

        {/* Market info */}
        {data && !isLoading && (
          <>
            {isMobile ? (
              <div className="grid grid-cols-3 rounded-xl border border-border bg-badge-bg/50 divide-x divide-border overflow-hidden">
                <div className="px-3 py-2.5 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-muted mb-0.5">Spread</p>
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {formatSpreadPercent(spreadPercent)}
                  </p>
                </div>
                <div className="px-3 py-2.5 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-muted mb-0.5">Volume</p>
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {formatVolume(data.totalVolume)}
                  </p>
                </div>
                <div className="px-3 py-2.5 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-muted mb-0.5">Balance</p>
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    ${usdcBalance.toFixed(2)}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Implied Valuation</span>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {formatValuationPrecise(impliedValuation)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Current Spread</span>
                    <span className="text-sm font-medium text-foreground">
                      {formatSpreadPercent(spreadPercent)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Market Volume</span>
                    <span className="text-sm font-medium text-foreground">
                      {formatVolume(data.totalVolume)}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border" />
              </>
            )}

            {/* Success state */}
            {tradeState === "success" && result ? (
              <div
                className={`rounded-lg p-4 text-center ${
                  isLong
                    ? "bg-blue-600/10 border border-blue-600/20"
                    : "bg-red/10 border border-red/20"
                }`}
              >
                <svg
                  className={`mx-auto h-8 w-8 ${isLong ? "text-blue-600 dark:text-blue-400" : "text-red"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className={`mt-2 font-medium ${isLong ? "text-blue-600 dark:text-blue-400" : "text-red"}`}>
                  {isLong ? "Long" : "Short"} Position Opened
                </p>
                <p className="mt-1 text-sm text-muted">
                  Position size: ${result.shares.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  P&amp;L now tracks the implied valuation chart.
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-3 text-sm text-foreground underline hover:no-underline"
                >
                  Make another trade
                </button>
              </div>
            ) : tradeState === "confirming" ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Total Cost</span>
                  <span className="text-sm font-medium text-foreground">
                    ${usdcAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Spread (fixed cost)</span>
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    −${spreadCostUsd.toFixed(2)} ({spreadPercent.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-sm font-medium text-foreground">Position size</span>
                  <span className="text-sm font-semibold text-foreground">
                    ${fairSellValueAtEntry.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  After purchase, P&amp;L tracks the implied valuation. Today&apos;s spread is locked in as a one-time cost — your position opens at $0.00 / 0%.
                </p>
                {errorMessage && (
                  <p className="text-sm text-red" role="alert">
                    {errorMessage}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelConfirm}
                    disabled={tradeState !== "confirming" || isBuying}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isBuying}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isLong
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-red text-white hover:bg-red/90"
                    }`}
                  >
                    Accept &amp; Buy
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Amount input */}
                <div>
                  {!isMobile && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">Amount (USDC)</span>
                      <span className="text-xs text-muted">
                        Balance: ${usdcBalance.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0.00"
                    disabled={tradeState === "loading" || isBuying}
                    className="w-full bg-badge-bg border border-border rounded-lg px-3 py-2.5 text-sm font-medium text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
                  />
                </div>

                {/* Cost preview */}
                {usdcAmount > 0 && (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted">Total Cost</span>
                      <span className="text-sm font-medium text-foreground">
                        ${usdcAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted">Spread (fixed cost)</span>
                      <span className="text-sm font-medium text-foreground">
                        −${spreadCostUsd.toFixed(2)} ({spreadPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {errorMessage && (
                  <p className="text-sm text-red" role="alert">
                    {errorMessage}
                  </p>
                )}

                {/* Action button */}
                <button
                  type="button"
                  onClick={handleReview}
                  disabled={
                    tradeState === "loading" ||
                    isBuying ||
                    !amount ||
                    usdcAmount <= 0 ||
                    usdcAmount > usdcBalance ||
                    !hasActiveWallet
                  }
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isLong
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-red text-white hover:bg-red/90"
                  }`}
                >
                  {tradeState === "loading" || isBuying
                    ? "Processing..."
                    : !hasActiveWallet
                      ? "Set up wallet to trade"
                      : `Review ${isLong ? "Long" : "Short"} ${symbol}`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
