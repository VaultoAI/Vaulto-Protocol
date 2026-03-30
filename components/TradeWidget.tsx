"use client";

import { useState } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol } from "@/lib/vaulto/companies";
import { getCurrentPrice, formatPrice } from "@/lib/vaulto/companyUtils";

interface TradeWidgetProps {
  company: PrivateCompany;
}

/**
 * Buy/Sell trade widget matching Robinhood design.
 * Design only — no real trading functionality.
 */
export function TradeWidget({ company }: TradeWidgetProps) {
  const symbol = getSyntheticSymbol(company.name);
  const price = getCurrentPrice(company);

  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState("Market");
  const [buyIn, setBuyIn] = useState("Dollars");
  const [amount, setAmount] = useState("");

  const numericAmount = parseFloat(amount) || 0;
  const estimatedQty =
    buyIn === "Dollars" && price > 0
      ? numericAmount / price
      : numericAmount;
  const estimatedTotal =
    buyIn === "Shares" ? numericAmount * price : numericAmount;

  return (
    <div className="w-full rounded-xl border border-border bg-card-bg">
      {/* Header tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("buy")}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
            activeTab === "buy"
              ? "text-green border-b-2 border-green"
              : "text-muted hover:text-foreground"
          }`}
        >
          Buy {symbol}
        </button>
        <button
          onClick={() => setActiveTab("sell")}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
            activeTab === "sell"
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
              onChange={(e) => setOrderType(e.target.value)}
              className="appearance-none bg-badge-bg border border-border rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-green/30"
            >
              <option>Market</option>
              <option>Limit</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          </div>
        </div>

        {/* Market info */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Market price</span>
          <span className="text-xs text-muted">{formatPrice(price)}</span>
        </div>

        {/* Buy in */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Buy in</span>
          <div className="relative">
            <select
              value={buyIn}
              onChange={(e) => setBuyIn(e.target.value)}
              className="appearance-none bg-badge-bg border border-border rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-green/30"
            >
              <option>Dollars</option>
              <option>Shares</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          </div>
        </div>

        {/* Amount input */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Amount</span>
          <div className="relative">
            <input
              type="text"
              value={amount}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, "");
                setAmount(val);
              }}
              placeholder="$0.00"
              className="w-[120px] text-right bg-badge-bg border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-green/30"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Estimated quantity */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            {buyIn === "Dollars" ? "Estimated quantity" : "Estimated total"}
          </span>
          <span className="text-sm font-semibold text-foreground">
            {buyIn === "Dollars"
              ? estimatedQty > 0
                ? estimatedQty.toFixed(6)
                : "0"
              : estimatedTotal > 0
              ? formatPrice(estimatedTotal)
              : "$0.00"}
          </span>
        </div>

        {/* Review order button */}
        <button
          className={`w-full py-3 rounded-full text-sm font-bold transition-all ${
            activeTab === "buy"
              ? "bg-green text-white hover:bg-green/90"
              : "bg-red text-white hover:bg-red/90"
          } ${numericAmount === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          disabled={numericAmount === 0}
        >
          Review order
        </button>

        {/* Buying power */}
        <div className="text-center">
          <span className="text-xs text-muted">
            $0.00 buying power available
          </span>
        </div>

      </div>
    </div>
  );
}
