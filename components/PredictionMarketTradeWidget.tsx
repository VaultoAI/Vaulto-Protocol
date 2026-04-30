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

type TradeState = "idle" | "loading" | "success" | "error";

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
  const bestReturn = isLong
    ? data?.valuation.bestLongReturn ?? 0
    : data?.valuation.bestShortReturn ?? 0;

  // Use passed prop if available (synced with chart), otherwise fall back to fetched data
  const impliedValuation = currentImpliedValuation ?? impliedData?.impliedValuationUsd ?? 0;

  // Calculate trade estimates
  const sharesToReceive = positionCost > 0 ? usdcAmount / positionCost : 0;

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

  const handleTrade = useCallback(async () => {
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

    setTradeState("loading");
    setErrorMessage(null);

    try {
      const tradeFn = activeTab === "long" ? buyLong : buyShort;
      const tradeResult = await tradeFn(eventSlug, usdcAmount);

      if (tradeResult.success) {
        setTradeState("success");
        // Calculate approximate shares from average price
        const avgPrice = tradeResult.averagePrice || positionCost;
        const shares = avgPrice > 0 ? usdcAmount / avgPrice : 0;
        setResult({
          shares,
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
  }, [amount, usdcAmount, usdcBalance, hasActiveWallet, eventSlug, activeTab, buyLong, buyShort, positionCost]);

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
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Spread {formatSpreadPercent(spreadPercent)}</span>
                <span>Volume {formatVolume(data.totalVolume)}</span>
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
                  {result.shares.toFixed(2)} shares
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-3 text-sm text-foreground underline hover:no-underline"
                >
                  Make another trade
                </button>
              </div>
            ) : (
              <>
                {/* Amount input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">Amount (USDC)</span>
                    <span className="text-xs text-muted">
                      Balance: ${usdcBalance.toFixed(2)}
                    </span>
                  </div>
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

                {/* Cost breakdown */}
                {usdcAmount > 0 && (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted">Total Cost</span>
                      <span className="text-sm font-medium text-foreground">
                        ${usdcAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted">Shares to Receive</span>
                      <span className="text-sm font-medium text-foreground">
                        {sharesToReceive.toFixed(2)}
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
                  onClick={handleTrade}
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
                      : `${isLong ? "Long" : "Short"} ${symbol}`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
