"use client";

import { useState, useCallback } from "react";
import { usePredictionTrading } from "@/hooks/usePredictionTrading";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import type { CompanyIPO, ValuationBand } from "@/lib/polymarket/ipo-valuations";
import {
  formatBandRange,
  formatValuationPrecise,
  getIPOBandSymbol,
  getPolymarketUrl,
} from "@/lib/polymarket/ipo-valuations";

type TradeWidgetProps = {
  ipo: CompanyIPO;
  band: ValuationBand;
  direction: "long" | "short";
  isOpen: boolean;
  onClose: () => void;
};

type TradeState = "idle" | "loading" | "success" | "error";

export function ValuationBandTradeWidget({
  ipo,
  band,
  direction,
  isOpen,
  onClose,
}: TradeWidgetProps) {
  const { buyLong, buyShort, isBuying } = usePredictionTrading({ fetchPositions: false });
  const { balance, isActive: hasActiveWallet } = useTradingWallet();

  const [amount, setAmount] = useState("");
  const [tradeState, setTradeState] = useState<TradeState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ shares: number; symbol: string } | null>(null);

  // Long = Yes (betting IPO lands in this range)
  // Short = No (betting IPO does NOT land in this range)
  const isYes = direction === "long";
  const price = isYes ? band.probability : 1 - band.probability;

  // Calculate shares to receive
  const usdcBalance = parseFloat(balance) || 0;
  const usdcAmount = parseFloat(amount) || 0;
  const sharesToReceive = usdcAmount > 0 ? usdcAmount / price : 0;
  const potentialPayout = sharesToReceive; // $1 per share if outcome is correct

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
      // Use the band's slug as the eventId for band-specific trades
      const eventId = band.slug || ipo.eventSlug;
      const tradeFn = direction === "long" ? buyLong : buyShort;
      const tradeResult = await tradeFn(eventId, usdcAmount);

      if (tradeResult.success) {
        setTradeState("success");
        const avgPrice = tradeResult.averagePrice || price;
        const shares = avgPrice > 0 ? usdcAmount / avgPrice : 0;
        const symbol = getIPOBandSymbol(ipo.company, band, direction);
        setResult({ shares, symbol });
      } else {
        setTradeState("error");
        setErrorMessage(tradeResult.error ?? "Trade failed");
      }
    } catch (err) {
      setTradeState("error");
      setErrorMessage(err instanceof Error ? err.message : "Trade failed");
    }
  }, [amount, usdcAmount, usdcBalance, hasActiveWallet, ipo, band, direction, price, buyLong, buyShort]);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setTradeState("idle");
      setErrorMessage(null);
    }
  }, []);

  if (!isOpen) return null;

  const outcomeLabel = isYes ? "Yes" : "No";
  const rangeText = formatBandRange(band);

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
            Buy{" "}
            <span className={isYes ? "text-green-600" : "text-red-600"}>
              {outcomeLabel}
            </span>{" "}
            - {ipo.company} IPO
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

        {/* Market Question */}
        <p className="mt-2 text-sm text-muted line-clamp-2">{band.question}</p>

        {/* Trade Context */}
        <div className="mt-3 rounded-md border border-border bg-muted/30 px-4 py-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Range</span>
            <span className="font-medium">{rangeText}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted">Market Probability</span>
            <span className="font-medium">{(band.probability * 100).toFixed(1)}% chance</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted">Expected IPO Value</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {formatValuationPrecise(ipo.expectedIPOValue)}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-1 pt-2 border-t border-border">
            <span className="text-muted">Polymarket</span>
            <a
              href={getPolymarketUrl(band.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              View market
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        {/* Trade Explanation */}
        <div className={`mt-3 rounded-md px-4 py-3 ${
          isYes
            ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
        }`}>
          {isYes ? (
            <p className="text-sm text-green-700 dark:text-green-400">
              <strong>Buy Yes:</strong> You&apos;re betting the {ipo.company} IPO closing market cap
              will be in the range <strong>{rangeText}</strong>.
            </p>
          ) : (
            <p className="text-sm text-red-700 dark:text-red-400">
              <strong>Buy No:</strong> You&apos;re betting the {ipo.company} IPO closing market cap
              will <strong>NOT</strong> be in the range {rangeText}.
            </p>
          )}
        </div>

        {tradeState === "success" && result ? (
          <div className={`mt-6 rounded-md ${
            isYes ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"
          } p-4 text-center`}>
            <svg
              className={`mx-auto h-10 w-10 ${isYes ? "text-green-500" : "text-red-500"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className={`mt-2 font-medium ${
              isYes ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
            }`}>
              Position Opened
            </p>
            <p className={`mt-1 text-sm ${
              isYes ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"
            }`}>
              You received {result.shares.toFixed(2)} shares
            </p>
            <p className={`mt-1 text-xs ${
              isYes ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"
            }`}>
              Potential payout: ${result.shares.toFixed(2)} if {outcomeLabel}
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
            {/* Price Display */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className={`rounded-md border-2 p-4 text-center ${
                isYes
                  ? "border-green-500 bg-green-50 dark:bg-green-900/30"
                  : "border-red-500 bg-red-50 dark:bg-red-900/30"
              }`}>
                <p className={`font-semibold ${
                  isYes ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}>
                  Buy {outcomeLabel}
                </p>
                <p className="text-lg font-bold mt-2">{(price * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted">${price.toFixed(2)} per share</p>
              </div>
              <div className="rounded-md border border-border p-4 text-center">
                <p className="font-medium text-muted">Payout if Correct</p>
                <p className="text-2xl font-bold mt-2">$1.00</p>
                <p className="text-xs text-muted">per share</p>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label htmlFor="trade-amount" className="block text-sm font-medium">
                  Amount (USDC)
                </label>
                <span className="text-xs text-muted">
                  Balance: ${usdcBalance.toFixed(2)}
                </span>
              </div>
              <input
                id="trade-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                disabled={tradeState === "loading" || isBuying}
                className="mt-1 w-full rounded border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-border disabled:opacity-50"
              />
            </div>

            {/* Trade Summary */}
            {sharesToReceive > 0 && (
              <div className="mt-4 rounded-md border border-border bg-muted/30 px-4 py-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">You will receive</span>
                  <span className="font-medium">
                    {sharesToReceive.toFixed(2)} shares
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted">Price per share</span>
                  <span className="font-medium">${price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1 pt-2 border-t border-border">
                  <span className="text-muted">Potential payout</span>
                  <span className={`font-semibold ${
                    isYes ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}>
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
              disabled={tradeState === "loading" || isBuying || !amount || usdcAmount <= 0 || usdcAmount > usdcBalance || !hasActiveWallet}
              className={`mt-6 w-full rounded border py-3 font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${
                isYes
                  ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                  : "border-red-600 bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {tradeState === "loading" || isBuying
                ? "Processing..."
                : !hasActiveWallet
                  ? "Set up wallet to trade"
                  : `Buy ${outcomeLabel}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
