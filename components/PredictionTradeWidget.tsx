"use client";

import { useState, useCallback } from "react";
import { buyPredictionShares } from "@/lib/polymarket/demo-trading";
import { getDemoBalance } from "@/lib/swap/demo-state";
import type { PredictionMarket } from "@/lib/polymarket/markets";
import { formatPriceAsPercent, getPredictionTokenSymbol } from "@/lib/polymarket/markets";

type TradeWidgetProps = {
  market: PredictionMarket;
};

type TradeState = "idle" | "loading" | "success" | "error";
type OutcomeType = "Yes" | "No";

export function PredictionTradeWidget({ market }: TradeWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeType>("Yes");
  const [amount, setAmount] = useState("");
  const [tradeState, setTradeState] = useState<TradeState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ shares: number; symbol: string } | null>(null);

  // Get current price for selected outcome
  const yesPrice = market.outcomePrices[0] ?? 0.5;
  const noPrice = market.outcomePrices[1] ?? 0.5;
  const currentPrice = selectedOutcome === "Yes" ? yesPrice : noPrice;

  // Calculate shares to receive
  const usdcAmount = parseFloat(amount) || 0;
  const sharesToReceive = usdcAmount > 0 ? usdcAmount / currentPrice : 0;
  const potentialPayout = sharesToReceive; // $1 per share if outcome is correct

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setAmount("");
    setTradeState("idle");
    setErrorMessage(null);
    setResult(null);
    setSelectedOutcome("Yes");
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setAmount("");
    setTradeState("idle");
    setErrorMessage(null);
    setResult(null);
  }, []);

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

    const tradeResult = await buyPredictionShares({
      market,
      outcome: selectedOutcome,
      usdcAmount,
    });

    if (tradeResult.success) {
      setTradeState("success");
      setResult({ shares: tradeResult.shares, symbol: tradeResult.symbol });
    } else {
      setTradeState("error");
      setErrorMessage(tradeResult.error ?? "Trade failed");
    }
  }, [amount, usdcAmount, market, selectedOutcome]);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setTradeState("idle");
      setErrorMessage(null);
    }
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-block rounded border border-border bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-white/90 dark:bg-white dark:text-black"
      >
        Trade
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Trade Prediction</h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-muted hover:text-foreground"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mt-2 text-sm text-muted line-clamp-2">{market.question}</p>

            {tradeState === "success" && result ? (
              <div className="mt-6 rounded-md bg-green-50 dark:bg-green-900/20 p-4 text-center">
                <svg className="mx-auto h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="mt-2 font-medium text-green-700 dark:text-green-400">Trade Successful</p>
                <p className="mt-1 text-sm text-green-600 dark:text-green-500">
                  You received {result.shares.toFixed(2)} {result.symbol} shares
                </p>
                <p className="mt-1 text-xs text-green-600 dark:text-green-500">
                  Potential payout: ${result.shares.toFixed(2)} if {selectedOutcome}
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
                {/* Outcome Selection */}
                <div className="mt-6">
                  <label className="block text-sm font-medium mb-2">Select Outcome</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedOutcome("Yes")}
                      className={`rounded-md border-2 p-4 text-center transition-colors ${
                        selectedOutcome === "Yes"
                          ? "border-green-500 bg-green-50 dark:bg-green-900/30"
                          : "border-border hover:border-green-300"
                      }`}
                    >
                      <p className="font-semibold text-green-600 dark:text-green-400">Buy Yes</p>
                      <p className="text-xs text-muted mt-1">Bullish</p>
                      <p className="text-lg font-bold mt-2">{formatPriceAsPercent(yesPrice)}</p>
                      <p className="text-xs text-muted">${yesPrice.toFixed(2)} per share</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedOutcome("No")}
                      className={`rounded-md border-2 p-4 text-center transition-colors ${
                        selectedOutcome === "No"
                          ? "border-red-500 bg-red-50 dark:bg-red-900/30"
                          : "border-border hover:border-red-300"
                      }`}
                    >
                      <p className="font-semibold text-red-600 dark:text-red-400">Buy No</p>
                      <p className="text-xs text-muted mt-1">Bearish</p>
                      <p className="text-lg font-bold mt-2">{formatPriceAsPercent(noPrice)}</p>
                      <p className="text-xs text-muted">${noPrice.toFixed(2)} per share</p>
                    </button>
                  </div>
                </div>

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
                {sharesToReceive > 0 && (
                  <div className="mt-4 rounded-md border border-border bg-muted/30 px-4 py-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">You will receive</span>
                      <span className="font-medium">
                        {sharesToReceive.toFixed(2)} {getPredictionTokenSymbol(market, selectedOutcome)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted">Price per share</span>
                      <span className="font-medium">${currentPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1 pt-2 border-t border-border">
                      <span className="text-muted">Potential payout if {selectedOutcome}</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        ${potentialPayout.toFixed(2)}
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
                    selectedOutcome === "Yes"
                      ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                      : "border-red-600 bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  {tradeState === "loading" ? "Processing..." : `Buy ${selectedOutcome}`}
                </button>

                <p className="mt-3 text-xs text-center text-muted">
                  Demo mode: Trades are simulated with virtual USDC
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
