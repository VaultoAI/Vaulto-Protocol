"use client";

import { useState, useCallback } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import type { VaultoIndex, IndexPriceData, IndexHistoryPoint } from "@/lib/vaulto/indexes";
import { getIndexPrice, getIndexChange } from "@/lib/vaulto/indexes";
import { HoldingsAvatars } from "@/components/HoldingsAvatars";
import { IndexPriceChart, type IndexHoverData } from "@/components/IndexPriceChart";
import { IndexHoldingsTable } from "@/components/IndexHoldingsTable";
import { EtfTradeWidget } from "@/components/EtfTradeWidget";
import { EtfPositionCard } from "@/components/EtfPositionCard";
import { formatPrice } from "@/lib/vaulto/companyUtils";

interface IndexDetailPageProps {
  index: VaultoIndex;
  companies: PrivateCompany[];
  priceData?: IndexPriceData;
  history: IndexHistoryPoint[];
  /** Enable real ETF trading via Alpaca (default: false) */
  enableTrading?: boolean;
}

/**
 * Full index detail page matching the company detail page layout.
 * Layout: Chart (left) + Trade Widget (right) stacked above About section.
 */
export function IndexDetailPage({
  index,
  companies,
  priceData,
  history,
  enableTrading = false,
}: IndexDetailPageProps) {
  // Use real price data if available, otherwise calculate from holdings
  const hasRealData = priceData?.price != null;

  const currentPrice = hasRealData
    ? priceData.price!
    : getIndexPrice(index, companies);

  const changePercent = hasRealData && priceData.changePercent != null
    ? Math.abs(priceData.changePercent)
    : getIndexChange(index, companies).changePercent;

  const isPositive = hasRealData && priceData.changePercent != null
    ? priceData.changePercent >= 0
    : getIndexChange(index, companies).isPositive;

  const changeAmount = hasRealData && priceData.change != null
    ? Math.abs(priceData.change)
    : currentPrice * (changePercent / 100);

  // State for hover data from chart
  const [hoverData, setHoverData] = useState<IndexHoverData | null>(null);

  const handleChartHover = useCallback((data: IndexHoverData | null) => {
    setHoverData(data);
  }, []);

  // Calculate displayed price (hover or current)
  const displayedPrice = hoverData?.price ?? currentPrice;
  const displayedDate = hoverData?.date;

  // Count holdings (including cash)
  const totalHoldings = index.holdings.length;
  const hasCash = index.holdings.some((h) => h.isCash);

  return (
    <div>
      {/* Main content: Chart + Trade Widget */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left side: Index info + Chart */}
        <div className="flex-1 min-w-0">
          {/* Index header */}
          <div className="flex items-center gap-3 mb-1">
            <HoldingsAvatars
              holdings={index.holdings}
              companies={companies}
              maxVisible={5}
              size={32}
            />
            <h1 className="text-2xl font-semibold text-foreground">{index.symbol}</h1>
            <span className="inline-flex items-center rounded-md bg-badge-bg px-2.5 py-1 text-xs font-medium text-badge-text">
              {index.issuer}
            </span>
          </div>

          {/* Full name */}
          <p className="text-sm text-muted mb-3">{index.name}</p>

          {/* Price */}
          <p className="text-[42px] font-bold text-foreground leading-tight tracking-tight transition-all duration-150 ease-out">
            {formatPrice(displayedPrice)}
          </p>

          {/* Change indicator */}
          <div className="flex items-center gap-2 mt-1 mb-6">
            {displayedDate ? (
              <span className="text-sm text-muted transition-all duration-150 ease-out">
                {new Date(displayedDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            ) : (
              <>
                <span className={`text-sm font-medium ${isPositive ? "text-green" : "text-red"}`}>
                  {isPositive ? "+" : "-"}${changeAmount.toFixed(2)}
                  {" "}({isPositive ? "+" : "-"}{changePercent.toFixed(2)}%)
                </span>
                <span className="text-sm text-muted">24h</span>
              </>
            )}
          </div>

          {/* Price Chart */}
          <div className="w-full">
            <IndexPriceChart
              history={history}
              onHover={handleChartHover}
            />
          </div>

          {/* About section */}
          <div className="mt-10">
            <h2 className="text-base font-semibold text-foreground mb-1">About</h2>
            <div className="border-t border-border mb-4" />

            <p className="text-sm text-muted leading-relaxed mb-6">
              {index.description}
            </p>

            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-0.5">Issuer</p>
                <p className="text-sm font-medium text-foreground">{index.issuer}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-0.5">Holdings</p>
                <p className="text-sm font-medium text-foreground">
                  {totalHoldings - (hasCash ? 1 : 0)} Companies{hasCash ? " + Cash" : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-0.5">Index Price</p>
                <p className="text-sm font-medium text-foreground">{formatPrice(currentPrice)}</p>
              </div>
            </div>
          </div>

          {/* Holdings section */}
          <div className="mt-10">
            <h2 className="text-base font-semibold text-foreground mb-1">Holdings</h2>
            <div className="border-t border-border mb-4" />

            <IndexHoldingsTable
              holdings={index.holdings}
              companies={companies}
            />
          </div>
        </div>

        {/* Right side: Trade Widget + Position */}
        <div className="w-full lg:w-[340px] shrink-0">
          <div className="lg:sticky lg:top-8 space-y-4">
            {/* Trade Widget */}
            {enableTrading ? (
              <EtfTradeWidget index={index} />
            ) : (
              <div className="relative">
                {/* Coming Soon Overlay */}
                <div className="absolute inset-0 bg-white/60 dark:bg-black/40 backdrop-blur-[2px] rounded-xl z-10 flex items-center justify-center">
                  <div className="text-center px-4 md:px-6 py-3 md:py-4">
                    <p className="text-black/70 dark:text-white/90 uppercase tracking-widest text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Coming Soon</p>
                    <p className="text-black dark:text-white text-base md:text-lg font-semibold">Index Trading</p>
                  </div>
                </div>
                {/* Dimmed Widget placeholder */}
                <div className="blur-[1px] opacity-70 pointer-events-none">
                  <IndexTradeWidgetPlaceholder symbol={index.symbol} price={currentPrice} />
                </div>
              </div>
            )}

            {/* Position Card */}
            {enableTrading && (
              <EtfPositionCard symbol={index.symbol} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Placeholder trade widget for index pages (matches TradeWidget layout).
 */
function IndexTradeWidgetPlaceholder({ symbol, price }: { symbol: string; price: number }) {
  return (
    <div className="w-full rounded-xl border border-border bg-card-bg">
      {/* Header tabs */}
      <div className="flex border-b border-border">
        <button className="flex-1 py-3 text-sm font-semibold text-center text-green border-b-2 border-green">
          Buy {symbol}
        </button>
        <button className="flex-1 py-3 text-sm font-semibold text-center text-muted">
          Sell {symbol}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Order type */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Order type</span>
          <div className="bg-badge-bg border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground">
            Market
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
          <div className="bg-badge-bg border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground">
            Dollars
          </div>
        </div>

        {/* Amount input */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Amount</span>
          <div className="w-[120px] text-right bg-badge-bg border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-muted">
            $0.00
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Estimated quantity */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Estimated quantity</span>
          <span className="text-sm font-semibold text-foreground">0</span>
        </div>

        {/* Review order button */}
        <button className="w-full py-3 rounded-full text-sm font-bold bg-green text-white opacity-50 cursor-not-allowed">
          Review order
        </button>

        {/* Buying power */}
        <div className="text-center">
          <span className="text-xs text-muted">$0.00 buying power available</span>
        </div>
      </div>
    </div>
  );
}
