"use client";

import { useState, useCallback, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { VaultoIndex } from "@/lib/vaulto/indexes";
import { formatPrice } from "@/lib/vaulto/companyUtils";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { useEtfQuote, formatNextOpen } from "@/hooks/useEtfQuote";
import { useEtfTrading } from "@/hooks/useEtfTrading";

interface EtfTradeWidgetProps {
  index: VaultoIndex;
}

type OrderSide = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";
type InputMode = "Dollars" | "Shares";

interface OrderConfirmation {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  notionalUsd?: number;
  qty?: number;
  limitPrice?: number;
  estimatedQty?: number;
  estimatedTotal?: number;
}

/**
 * ETF trading widget with real Alpaca integration.
 * Displays real-time quotes and allows placing buy/sell orders.
 */
export function EtfTradeWidget({ index }: EtfTradeWidgetProps) {
  const symbol = index.symbol;
  const { authenticated, login } = usePrivy();
  const { balance, formattedBalance, isActive, needsCreation, refetchBalance } = useTradingWallet();

  // Quote polling - only when widget is active
  const {
    data: quote,
    isLoading: isLoadingQuote,
    error: quoteError,
  } = useEtfQuote(symbol, { enabled: true, pollingInterval: 5000 });

  // Trading operations
  const {
    getPositionForSymbol,
    placeOrder,
    isPlacingOrder,
    placeOrderError,
    isLoadingPositions,
    refetchPositions,
  } = useEtfTrading();

  // Some symbols don't support dollar-based orders (shares only)
  const sharesOnlySymbols = ["RVI", "VCX"];
  const isSharesOnly = sharesOnlySymbols.includes(symbol);

  // Form state
  const [activeTab, setActiveTab] = useState<OrderSide>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [inputMode, setInputMode] = useState<InputMode>(isSharesOnly ? "Shares" : "Dollars");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");

  // Modal state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<OrderConfirmation | null>(null);
  const [orderResult, setOrderResult] = useState<{
    success: boolean;
    message: string;
    filledQty?: number;
    filledAvgPrice?: number;
    totalValue?: number;
    status?: string;
  } | null>(null);

  // Get current position for sell tab
  const position = getPositionForSymbol(symbol);

  // Check if ETF supports fractional shares
  const isFractionable = quote?.fractionable ?? false;

  // Calculate values
  const numericAmount = parseFloat(amount) || 0;
  const numericLimitPrice = parseFloat(limitPrice) || 0;
  const effectivePrice = orderType === "LIMIT" && numericLimitPrice > 0
    ? numericLimitPrice
    : activeTab === "BUY"
    ? quote?.askPrice || 0
    : quote?.bidPrice || 0;

  // For non-fractionable ETFs, calculate whole shares
  const rawEstimatedQty = inputMode === "Dollars" && effectivePrice > 0
    ? numericAmount / effectivePrice
    : numericAmount;

  const estimatedQty = isFractionable
    ? rawEstimatedQty
    : Math.floor(rawEstimatedQty);

  const estimatedTotal = inputMode === "Shares"
    ? numericAmount * effectivePrice
    : isFractionable
    ? numericAmount
    : estimatedQty * effectivePrice;

  // Check if order is valid
  const balanceNum = parseFloat(balance) || 0;
  const canBuy = activeTab === "BUY"
    && numericAmount > 0
    && estimatedTotal <= balanceNum
    && quote?.marketStatus?.isOpen;

  const canSell = activeTab === "SELL"
    && numericAmount > 0
    && !isLoadingPositions
    && position
    && (inputMode === "Shares" ? numericAmount <= position.qty : estimatedQty <= position.qty)
    && quote?.marketStatus?.isOpen;

  const canSubmit = activeTab === "BUY" ? canBuy : canSell;

  // Handle order type change
  const handleOrderTypeChange = (type: OrderType) => {
    setOrderType(type);
    if (type === "LIMIT" && quote) {
      // Pre-fill limit price with current mid price
      setLimitPrice(quote.midPrice.toFixed(2));
    }
  };

  // Handle review order
  const handleReviewOrder = useCallback(() => {
    if (!canSubmit || !quote) return;

    const order: OrderConfirmation = {
      symbol,
      side: activeTab,
      type: orderType,
      estimatedQty,
      estimatedTotal,
    };

    if (inputMode === "Dollars") {
      order.notionalUsd = numericAmount;
    } else {
      order.qty = numericAmount;
    }

    if (orderType === "LIMIT") {
      order.limitPrice = numericLimitPrice;
    }

    setPendingOrder(order);
    setShowConfirmation(true);
    setOrderResult(null);
  }, [canSubmit, quote, symbol, activeTab, orderType, inputMode, numericAmount, numericLimitPrice, estimatedQty, estimatedTotal]);

  // Handle confirm order
  const handleConfirmOrder = useCallback(async () => {
    if (!pendingOrder) return;

    try {
      const result = await placeOrder({
        symbol: pendingOrder.symbol,
        side: pendingOrder.side,
        type: pendingOrder.type,
        notionalUsd: pendingOrder.notionalUsd,
        qty: pendingOrder.qty,
        limitPrice: pendingOrder.limitPrice,
      });

      const filledQty = result.order.filledQty;
      const filledAvgPrice = result.order.filledAvgPrice ?? undefined;
      const totalValue = filledQty && filledAvgPrice ? filledQty * filledAvgPrice : undefined;
      const isFilled = result.order.status === "FILLED";

      setOrderResult({
        success: true,
        message: isFilled
          ? `${pendingOrder.side === "BUY" ? "Bought" : "Sold"} ${filledQty} ${pendingOrder.symbol} shares`
          : "Order submitted - awaiting fill",
        filledQty: filledQty > 0 ? filledQty : undefined,
        filledAvgPrice,
        totalValue,
        status: result.order.status,
      });

      // Clear form and refresh balance & positions
      setAmount("");
      setLimitPrice("");
      refetchBalance();
      refetchPositions();

      // Close modal after delay
      setTimeout(() => {
        setShowConfirmation(false);
        setPendingOrder(null);
        setOrderResult(null);
      }, 3000);
    } catch (error) {
      setOrderResult({
        success: false,
        message: error instanceof Error ? error.message : "Order failed",
      });
    }
  }, [pendingOrder, placeOrder, refetchBalance, refetchPositions]);

  // Reset amount when switching tabs
  useEffect(() => {
    setAmount("");
    setLimitPrice("");
  }, [activeTab]);

  // Market closed banner
  const isMarketClosed = quote && !quote.marketStatus.isOpen;

  return (
    <div>
      {/* Market closed indicator - above widget */}
      {isMarketClosed && (
        <div className="w-full bg-yellow-500/10 border-x border-t border-yellow-500/20 rounded-t-xl px-3 py-1.5">
          <p className="text-[11px] text-yellow-600 dark:text-yellow-400 text-center font-medium">
            Market closed · Opens {formatNextOpen(quote.marketStatus.nextOpen)}
          </p>
        </div>
      )}
      <div className={`w-full rounded-xl border border-border bg-card-bg ${isMarketClosed ? 'rounded-t-none' : ''}`}>
        {/* Header tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("BUY")}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
            activeTab === "BUY"
              ? "text-accent border-b-2 border-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          Buy {symbol}
        </button>
        <button
          onClick={() => setActiveTab("SELL")}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
            activeTab === "SELL"
              ? "text-red border-b-2 border-red"
              : "text-muted hover:text-foreground"
          }`}
        >
          Sell {symbol}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Order type */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Order type</span>
          <div className="relative">
            <select
              value={orderType}
              onChange={(e) => handleOrderTypeChange(e.target.value as OrderType)}
              className="appearance-none bg-badge-bg border border-border rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/30"
            >
              <option value="MARKET">Market</option>
              <option value="LIMIT">Limit</option>
            </select>
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          </div>
        </div>

        {/* Limit price input (for limit orders) */}
        {orderType === "LIMIT" && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Limit price</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
              <input
                type="text"
                value={limitPrice}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, "");
                  setLimitPrice(val);
                }}
                placeholder="0.00"
                className="w-[120px] text-right bg-badge-bg border border-border rounded-lg pl-6 pr-3 py-1.5 text-sm font-medium text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
            </div>
          </div>
        )}

        {/* Market info - hide when market closed and price unavailable */}
        {(() => {
          const price = activeTab === "BUY" ? quote?.askPrice : quote?.bidPrice;
          const showPrice = !isMarketClosed || (price && price > 0);
          return showPrice ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">
                {activeTab === "BUY" ? "Ask price" : "Bid price"}
              </span>
              <span className="text-xs text-muted">
                {isLoadingQuote ? (
                  "Loading..."
                ) : quoteError ? (
                  "Error loading quote"
                ) : quote ? (
                  price && price > 0 ? formatPrice(price) : "Unavailable"
                ) : (
                  "--"
                )}
              </span>
            </div>
          ) : null;
        })()}

        {/* Bid/Ask spread */}
        {quote && quote.askPrice > 0 && quote.bidPrice > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Spread</span>
            <span className="text-xs text-muted">
              ${quote.spread.toFixed(2)} ({quote.spreadPercent.toFixed(2)}%)
            </span>
          </div>
        )}

        {/* Input mode selector */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {activeTab === "BUY" ? "Buy in" : "Sell in"}
          </span>
          {isSharesOnly ? (
            <div className="bg-badge-bg border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground">
              Shares
            </div>
          ) : (
            <div className="relative">
              <select
                value={inputMode}
                onChange={(e) => setInputMode(e.target.value as InputMode)}
                className="appearance-none bg-badge-bg border border-border rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/30"
              >
                <option value="Dollars">Dollars</option>
                <option value="Shares">Shares</option>
              </select>
              <svg
                className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </div>
          )}
        </div>

        {/* Amount input */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Amount</span>
          <div className="relative">
            {inputMode === "Dollars" && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
            )}
            <input
              type="text"
              value={amount}
              onChange={(e) => {
                // For non-fractionable ETFs in Shares mode, only allow whole numbers
                const allowDecimals = inputMode === "Dollars" || isFractionable;
                const val = allowDecimals
                  ? e.target.value.replace(/[^0-9.]/g, "")
                  : e.target.value.replace(/[^0-9]/g, "");
                setAmount(val);
              }}
              placeholder={inputMode === "Dollars" ? "0.00" : "0"}
              className={`w-[120px] text-right bg-badge-bg border border-border rounded-lg ${
                inputMode === "Dollars" ? "pl-6" : "pl-3"
              } pr-3 py-1.5 text-sm font-medium text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30`}
            />
          </div>
        </div>

        {/* Position info for sell tab */}
        {activeTab === "SELL" && position && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Your position</span>
            <span className="text-muted">
              {isFractionable ? position.qty.toFixed(4) : Math.floor(position.qty)} shares (~{formatPrice(position.marketValue || 0)})
            </span>
          </div>
        )}

        {/* Loading positions state for sell tab */}
        {activeTab === "SELL" && !position && isLoadingPositions && (
          <div className="text-xs text-muted text-center py-2">
            Loading position...
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Estimated quantity/total */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            {inputMode === "Dollars" ? "Estimated quantity" : "Estimated total"}
          </span>
          <span className="text-sm font-semibold text-foreground">
            {inputMode === "Dollars"
              ? estimatedQty > 0
                ? isFractionable
                  ? estimatedQty.toFixed(6)
                  : `${estimatedQty} shares`
                : "0"
              : estimatedTotal > 0
              ? formatPrice(estimatedTotal)
              : "$0.00"}
          </span>
        </div>

        {/* Review order button */}
        {!authenticated ? (
          <button
            onClick={login}
            className="w-full py-3 rounded-full text-sm font-bold bg-foreground text-background hover:opacity-90 transition-all"
          >
            Connect Wallet
          </button>
        ) : needsCreation ? (
          <button
            className="w-full py-3 rounded-full text-sm font-bold bg-foreground text-background opacity-50 cursor-not-allowed"
            disabled
          >
            Set up Trading Wallet
          </button>
        ) : isMarketClosed ? (
          <button
            className="w-full py-3 rounded-full text-sm font-bold bg-muted/30 text-muted cursor-not-allowed"
            disabled
          >
            Market Closed
          </button>
        ) : (
          <button
            onClick={handleReviewOrder}
            className={`w-full py-3 rounded-full text-sm font-bold transition-all ${
              activeTab === "BUY"
                ? "bg-accent text-white hover:bg-accent/90"
                : "bg-red text-white hover:bg-red/90"
            } ${!canSubmit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            disabled={!canSubmit}
          >
            Review order
          </button>
        )}

        {/* Buying power / Position info */}
        <div className="text-center">
          <span className="text-xs text-muted">
            {activeTab === "BUY"
              ? `${isActive ? `$${formattedBalance}` : "$0.00"} buying power available`
              : isLoadingPositions
              ? "Loading position..."
              : position
              ? `${isFractionable ? position.qty.toFixed(4) : Math.floor(position.qty)} ${symbol} shares available`
              : `You don't have any ${symbol} shares to sell`}
          </span>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && pendingOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card-bg border border-border rounded-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-foreground text-center">
              Confirm {pendingOrder.side === "BUY" ? "Purchase" : "Sale"}
            </h3>

            {orderResult ? (
              <div className={`text-center py-4 ${orderResult.success ? "text-green-500" : "text-red-500"}`}>
                <div className="mb-2">
                  {orderResult.success ? (
                    <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="font-semibold text-foreground">{orderResult.message}</p>
                {orderResult.success && orderResult.filledAvgPrice && (
                  <p className="text-sm text-muted mt-1">
                    at {formatPrice(orderResult.filledAvgPrice)} per share
                  </p>
                )}
                {orderResult.success && orderResult.totalValue && (
                  <p className="text-lg font-bold text-foreground mt-2">
                    {formatPrice(orderResult.totalValue)}
                  </p>
                )}
                {orderResult.success && orderResult.status === "SUBMITTED" && (
                  <p className="text-xs text-muted mt-2">
                    Check your profile for order status
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Symbol</span>
                    <span className="font-medium text-foreground">{pendingOrder.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Side</span>
                    <span className={`font-medium ${pendingOrder.side === "BUY" ? "text-accent" : "text-red"}`}>
                      {pendingOrder.side}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Order Type</span>
                    <span className="font-medium text-foreground">{pendingOrder.type}</span>
                  </div>
                  {pendingOrder.notionalUsd && (
                    <div className="flex justify-between">
                      <span className="text-muted">Amount</span>
                      <span className="font-medium text-foreground">
                        {formatPrice(pendingOrder.notionalUsd)}
                      </span>
                    </div>
                  )}
                  {pendingOrder.qty && (
                    <div className="flex justify-between">
                      <span className="text-muted">Quantity</span>
                      <span className="font-medium text-foreground">
                        {isFractionable ? pendingOrder.qty.toFixed(6) : pendingOrder.qty} shares
                      </span>
                    </div>
                  )}
                  {pendingOrder.limitPrice && (
                    <div className="flex justify-between">
                      <span className="text-muted">Limit Price</span>
                      <span className="font-medium text-foreground">
                        {formatPrice(pendingOrder.limitPrice)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-muted">Est. {pendingOrder.notionalUsd ? "Qty" : "Total"}</span>
                      <span className="font-semibold text-foreground">
                        {pendingOrder.notionalUsd
                          ? isFractionable
                            ? `${pendingOrder.estimatedQty?.toFixed(6)} shares`
                            : `${Math.floor(pendingOrder.estimatedQty || 0)} shares`
                          : formatPrice(pendingOrder.estimatedTotal || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowConfirmation(false);
                      setPendingOrder(null);
                    }}
                    className="flex-1 py-2.5 rounded-full text-sm font-semibold border border-border text-foreground hover:bg-badge-bg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmOrder}
                    disabled={isPlacingOrder}
                    className={`flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-all ${
                      pendingOrder.side === "BUY"
                        ? "bg-accent hover:bg-accent/90"
                        : "bg-red hover:bg-red/90"
                    } ${isPlacingOrder ? "opacity-50 cursor-wait" : ""}`}
                  >
                    {isPlacingOrder ? "Processing..." : "Confirm"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
