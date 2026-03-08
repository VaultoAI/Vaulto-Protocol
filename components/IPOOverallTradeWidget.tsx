"use client";

import { useState, useCallback } from "react";
import { getDemoBalance } from "@/lib/swap/demo-state";
import { buyOverallIPOPosition } from "@/lib/polymarket/demo-trading";
import type { CompanyIPO } from "@/lib/polymarket/ipo-valuations";
import {
  formatValuationPrecise,
  getPolymarketEventUrl,
} from "@/lib/polymarket/ipo-valuations";

type TradeWidgetProps = {
  ipo: CompanyIPO;
  direction: "long" | "short";
  isOpen: boolean;
  onClose: () => void;
};

type TradeState = "idle" | "loading" | "success" | "error";

export function IPOOverallTradeWidget({
  ipo,
  direction,
  isOpen,
  onClose,
}: TradeWidgetProps) {
  const [amount, setAmount] = useState("");
  const [tradeState, setTradeState] = useState<TradeState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ totalShares: number; bandCount: number } | null>(null);

  const isLong = direction === "long";
  const usdcAmount = parseFloat(amount) || 0;

  const handleClose = useCallback(() => {
    setAmount("");
    setTradeState("idle");
    setErrorMessage(null);
    setResult(null);
    onClose();
  }, [onClose]);

  const handleBuy = useCallback(async () => {
    if (!amount || usdcAmount <= 0) {
      setErrorMessage("Please enter a valid amount");
      return;
    }

    const usdcBalance = getDemoBalance("USDC");
    if (usdcBalance < usdcAmount) {
      setErrorMessage(`Insufficient USDC balance (${usdcBalance.toFixed(2)} available)`);
      return;
    }

    setTradeState("loading");
    setErrorMessage(null);

    const tradeResult = await buyOverallIPOPosition({
      ipo,
      direction,
      usdcAmount,
    });

    if (tradeResult.success) {
      setTradeState("success");
      setResult({
        totalShares: tradeResult.totalShares,
        bandCount: tradeResult.bandAllocations.length,
      });
    } else {
      setTradeState("error");
      setErrorMessage(tradeResult.error ?? "Trade failed");
    }
  }, [amount, usdcAmount, ipo, direction]);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setTradeState("idle");
      setErrorMessage(null);
    }
  }, []);

  if (!isOpen) return null;

  const directionLabel = isLong ? "Long" : "Short";
  const eventUrl = getPolymarketEventUrl(ipo.eventSlug);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">
            <span className={isLong ? "text-green-600" : "text-red-600"}>
              {directionLabel}
            </span>{" "}
            {ipo.company} IPO
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted hover:text-foreground"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Trade Context */}
        <div className="mt-3 rounded-md border border-border bg-muted/30 px-4 py-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Expected IPO Value</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {formatValuationPrecise(ipo.expectedIPOValue)}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted">Valuation Bands</span>
            <span className="font-medium">{ipo.bands.length} ranges</span>
          </div>
          <div className="flex justify-between text-sm mt-1 pt-2 border-t border-border">
            <span className="text-muted">Polymarket</span>
            <a
              href={eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              View event
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        {/* Trade Explanation */}
        <div className={`mt-3 rounded-md px-4 py-3 ${
          isLong
            ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
        }`}>
          {isLong ? (
            <p className="text-sm text-green-700 dark:text-green-400">
              <strong>Long:</strong> You&apos;re betting the {ipo.company} IPO will close{" "}
              <strong>above</strong> the expected value of {formatValuationPrecise(ipo.expectedIPOValue)}.
              Buys more Yes contracts on higher valuation bands.
            </p>
          ) : (
            <p className="text-sm text-red-700 dark:text-red-400">
              <strong>Short:</strong> You&apos;re betting the {ipo.company} IPO will close{" "}
              <strong>below</strong> the expected value of {formatValuationPrecise(ipo.expectedIPOValue)}.
              Buys more No contracts on lower valuation bands.
            </p>
          )}
        </div>

        {tradeState === "success" && result ? (
          <div className={`mt-6 rounded-md ${
            isLong ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"
          } p-4 text-center`}>
            <svg
              className={`mx-auto h-10 w-10 ${isLong ? "text-green-500" : "text-red-500"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className={`mt-2 font-medium ${
              isLong ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
            }`}>
              {directionLabel} Position Opened
            </p>
            <p className={`mt-1 text-sm ${
              isLong ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"
            }`}>
              {result.totalShares.toFixed(2)} total shares across {result.bandCount} bands
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-4 w-full rounded border border-border bg-foreground py-2 text-background font-medium hover:opacity-90"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Amount Input */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label htmlFor="trade-amount" className="block text-sm font-medium">
                  Amount (USDC)
                </label>
                <span className="text-xs text-muted">
                  Balance: ${getDemoBalance("USDC").toFixed(2)}
                </span>
              </div>
              <input
                id="trade-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                disabled={tradeState === "loading"}
                className="mt-1 w-full rounded border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-border disabled:opacity-50"
              />
            </div>

            {/* Trade Summary */}
            {usdcAmount > 0 && (
              <div className="mt-4 rounded-md border border-border bg-muted/30 px-4 py-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Investment</span>
                  <span className="font-medium">${usdcAmount.toFixed(2)} USDC</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted">Distribution</span>
                  <span className="font-medium">Across {ipo.bands.length} bands</span>
                </div>
                <div className="flex justify-between text-sm mt-1 pt-2 border-t border-border">
                  <span className="text-muted">Strategy</span>
                  <span className={`font-medium ${
                    isLong ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}>
                    {isLong ? "Favor higher bands" : "Favor lower bands"}
                  </span>
                </div>
              </div>
            )}

            {errorMessage && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
                {errorMessage}
              </p>
            )}

            <button
              type="button"
              onClick={handleBuy}
              disabled={tradeState === "loading" || !amount || usdcAmount <= 0}
              className={`mt-6 w-full rounded border py-3 font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${
                isLong
                  ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                  : "border-red-600 bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {tradeState === "loading" ? "Processing..." : `${directionLabel} ${ipo.company}`}
            </button>

            <p className="mt-3 text-xs text-center text-muted">
              Demo mode: Trades are simulated with virtual USDC
            </p>
          </>
        )}
      </div>
    </div>
  );
}
