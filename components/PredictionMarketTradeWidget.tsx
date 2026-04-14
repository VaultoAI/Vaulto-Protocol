"use client";

import { useState, useCallback } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol } from "@/lib/vaulto/companies";
import { getDemoBalance } from "@/lib/swap/demo-state";
import {
  usePredictionMarketData,
  formatVolume,
  formatCostPerDollar,
  formatSpreadPercent,
} from "@/hooks/usePredictionMarketData";
import { buyPredictionMarketPosition } from "@/lib/polymarket/demo-trading";
import { getPolymarketEventUrl } from "@/lib/polymarket/ipo-valuations";

interface PredictionMarketTradeWidgetProps {
  company: PrivateCompany;
  eventSlug: string;
}

type TradeState = "idle" | "loading" | "success" | "error";

/**
 * Inline prediction market trading widget with Long/Short tabs.
 * Displays market metrics and allows demo trading.
 */
export function PredictionMarketTradeWidget({
  company,
  eventSlug,
}: PredictionMarketTradeWidgetProps) {
  const symbol = getSyntheticSymbol(company.name);
  const { data, isLoading, error } = usePredictionMarketData(eventSlug);

  const [activeTab, setActiveTab] = useState<"long" | "short">("long");
  const [amount, setAmount] = useState("");
  const [tradeState, setTradeState] = useState<TradeState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ shares: number; txHash: string } | null>(null);

  const usdcBalance = getDemoBalance("USDC");
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

  // Calculate trade estimates
  const sharesToReceive = positionCost > 0 ? usdcAmount / positionCost : 0;
  const potentialPayout = sharesToReceive; // $1 per share if outcome is correct

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

    if (usdcBalance < usdcAmount) {
      setErrorMessage(`Insufficient USDC balance (${usdcBalance.toFixed(2)} available)`);
      return;
    }

    setTradeState("loading");
    setErrorMessage(null);

    const tradeResult = await buyPredictionMarketPosition({
      company: company.name,
      eventSlug,
      direction: activeTab,
      usdcAmount,
    });

    if (tradeResult.success) {
      setTradeState("success");
      setResult({
        shares: tradeResult.shares,
        txHash: tradeResult.txHash,
      });
      setAmount("");
    } else {
      setTradeState("error");
      setErrorMessage(tradeResult.error ?? "Trade failed");
    }
  }, [amount, usdcAmount, usdcBalance, company.name, eventSlug, activeTab]);

  const handleReset = useCallback(() => {
    setTradeState("idle");
    setResult(null);
    setErrorMessage(null);
  }, []);

  const eventUrl = getPolymarketEventUrl(eventSlug);

  return (
    <div className="w-full rounded-xl border border-border bg-card-bg">
      {/* Long/Short tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => {
            setActiveTab("long");
            handleReset();
          }}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
            activeTab === "long"
              ? "text-green border-b-2 border-green"
              : "text-muted hover:text-foreground"
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
              : "text-muted hover:text-foreground"
          }`}
        >
          Short
        </button>
      </div>

      <div className="p-5 space-y-4">
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Position Cost</span>
                <span className="text-sm font-medium text-foreground">
                  {formatCostPerDollar(positionCost)} per $1
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

            {/* Success state */}
            {tradeState === "success" && result ? (
              <div
                className={`rounded-lg p-4 text-center ${
                  isLong
                    ? "bg-green/10 border border-green/20"
                    : "bg-red/10 border border-red/20"
                }`}
              >
                <svg
                  className={`mx-auto h-8 w-8 ${isLong ? "text-green" : "text-red"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className={`mt-2 font-medium ${isLong ? "text-green" : "text-red"}`}>
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
                    disabled={tradeState === "loading"}
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
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-sm text-muted">Potential Payout</span>
                      <span
                        className={`text-sm font-medium ${
                          isLong ? "text-green" : "text-red"
                        }`}
                      >
                        ${potentialPayout.toFixed(2)}
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
                    !amount ||
                    usdcAmount <= 0 ||
                    usdcAmount > usdcBalance
                  }
                  className={`w-full py-3 rounded-full text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isLong
                      ? "bg-green text-white hover:bg-green/90"
                      : "bg-red text-white hover:bg-red/90"
                  }`}
                >
                  {tradeState === "loading"
                    ? "Processing..."
                    : `${isLong ? "Long" : "Short"} ${symbol}`}
                </button>

                {/* Polymarket link */}
                <div className="text-center">
                  <a
                    href={eventUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted hover:text-foreground inline-flex items-center gap-1"
                  >
                    View on Polymarket
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
