"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol, formatValuation, getCompanySlug } from "@/lib/vaulto/companies";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ValuationChart, type HoverData } from "@/components/ValuationChart";
import { ImpliedValuationChart, type ImpliedHoverData, type ImpliedChartData } from "@/components/ImpliedValuationChart";
import { LivePriceChart, type LiveHoverData, type LiveChartData } from "@/components/LivePriceChart";
import { hasPrestockToken, getPrestockAddress } from "@/lib/prestock/tokens";
import { CompanyAbout } from "@/components/CompanyAbout";
import {
  hasImpliedValuationData,
  getImpliedValuationSlug,
  getIPOMarketEndDate,
  type ImpliedValuationHistoryResponse,
} from "@/lib/polymarket/implied-valuations";
import { getCompanyPredictionMarket } from "@/lib/polymarket/ipo-valuations";

// Lazy-load PolymarketEventBox
const PolymarketEventBox = dynamic(
  () => import("@/components/PolymarketEventBox").then((mod) => mod.PolymarketEventBox),
  {
    ssr: false,
    loading: () => (
      <div className="h-14 animate-pulse rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50" />
    ),
  }
);

// Lazy-load PredictionMarketTradeWidget to reduce initial bundle
const PredictionMarketTradeWidget = dynamic(
  () => import("@/components/PredictionMarketTradeWidget").then((mod) => mod.PredictionMarketTradeWidget),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 animate-pulse rounded-xl border border-border bg-card-bg" />
    ),
  }
);

// Lazy-load PredictionPositionCard
const PredictionPositionCard = dynamic(
  () => import("@/components/PredictionPositionCard").then((mod) => mod.PredictionPositionCard),
  {
    ssr: false,
    loading: () => null,
  }
);

// Lazy-load TradeWidget to reduce initial bundle
const TradeWidget = dynamic(
  () => import("@/components/TradeWidget").then((mod) => mod.TradeWidget),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 animate-pulse rounded-xl border border-border bg-card-bg" />
    ),
  }
);
import {
  getDailyChange,
  getCurrentPrice,
  formatPrice,
  getValuationHistory,
  getBaseValuation,
  isIpoOnlyCompany,
  IPO_ONLY_DEFAULT_PRICE,
  IPO_ONLY_BASE_VALUATION,
} from "@/lib/vaulto/companyUtils";

interface CompanyDetailPageProps {
  company: PrivateCompany;
  prefetchedImpliedData?: ImpliedValuationHistoryResponse | null;
  prefetchedTotalVolume?: number | null;
}

/**
 * Full company detail page matching Robinhood design.
 * Layout: Chart (left) + Trade Widget (right) stacked above About section.
 */
type ChartType = "funding" | "market" | "live";

export function CompanyDetailPage({
  company,
  prefetchedImpliedData,
  prefetchedTotalVolume,
}: CompanyDetailPageProps) {
  const symbol = getSyntheticSymbol(company.name);
  const basePrice = getCurrentPrice(company);
  const { changeAmount, changePercent, isPositive } = getDailyChange(company);

  // Get current valuation for ratio calculations
  const history = getValuationHistory(company);
  const isIpoOnly = isIpoOnlyCompany(company);
  // For IPO-only companies, use the default base valuation ($1.3B)
  const currentValuation = isIpoOnly
    ? IPO_ONLY_BASE_VALUATION
    : (history.length > 0 ? history[history.length - 1].valuation : company.valuationUsd);

  // State for hover data
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [impliedHoverData, setImpliedHoverData] = useState<ImpliedHoverData | null>(null);

  // Check if company has implied valuation data
  const hasMarketData = hasImpliedValuationData(company.name);
  const impliedValuationSlug = getImpliedValuationSlug(company.name);
  const fallbackMarketEndDate = impliedValuationSlug ? getIPOMarketEndDate(impliedValuationSlug) : null;

  // Check if company has prestock (live) data
  const hasLiveData = hasPrestockToken(company.name);
  const prestockAddress = getPrestockAddress(company.name);

  // Check if company has a prediction market
  const predictionMarket = getCompanyPredictionMarket(company.name);

  // Check if there's sufficient funding data for the funding chart
  const hasSufficientFundingData = history.length >= 2;

  // Chart type toggle - default to market (IPO prediction) if available, otherwise funding
  const [chartType, setChartType] = useState<ChartType>(() => {
    if (hasMarketData) {
      return "market";
    }
    return "funding";
  });
  const [impliedData, setImpliedData] = useState<ImpliedValuationHistoryResponse | null>(
    prefetchedImpliedData ?? null
  );
  const [impliedDataLoading, setImpliedDataLoading] = useState(false);
  const [impliedChartData, setImpliedChartData] = useState<ImpliedChartData | null>(null);

  // State for live chart
  const [liveHoverData, setLiveHoverData] = useState<LiveHoverData | null>(null);
  const [liveChartData, setLiveChartData] = useState<LiveChartData | null>(null);

  // Fetch implied valuation data when switching to market view
  useEffect(() => {
    if (chartType === "market" && !impliedData && !impliedDataLoading && impliedValuationSlug) {
      setImpliedDataLoading(true);
      fetch(`/api/implied-valuations/${impliedValuationSlug}/history?range=ALL`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          setImpliedData(data);
          setImpliedDataLoading(false);
        })
        .catch(() => setImpliedDataLoading(false));
    }
  }, [chartType, impliedData, impliedDataLoading, impliedValuationSlug]);

  const handleChartHover = useCallback((data: HoverData | null) => {
    setHoverData(data);
  }, []);

  const handleImpliedChartHover = useCallback((data: ImpliedHoverData | null) => {
    setImpliedHoverData(data);
  }, []);

  const handleImpliedDataChange = useCallback((data: ImpliedChartData | null) => {
    setImpliedChartData(data);
  }, []);

  const handleLiveChartHover = useCallback((data: LiveHoverData | null) => {
    setLiveHoverData(data);
  }, []);

  const handleLiveDataChange = useCallback((data: LiveChartData | null) => {
    setLiveChartData(data);
  }, []);

  // Get market implied current valuation (when available)
  const marketImpliedValuation = impliedChartData?.endValue ?? null;

  // Get live prestock current price (when available)
  const liveCurrentPrice = liveChartData?.endValue ?? null;

  // Calculate displayed price based on hover and chart type
  // When in market view, use market implied valuation as the base
  // When in live view, show live prestock token price
  const displayedValuation = (() => {
    if (chartType === "live") {
      // For live view, scale database valuation proportionally with price
      const dbValuation = company.valuationUsd;
      const baseLivePrice = liveChartData?.endValue;
      if (liveHoverData && baseLivePrice && baseLivePrice > 0) {
        return dbValuation * (liveHoverData.price / baseLivePrice);
      }
      return dbValuation;
    }
    if (chartType === "market") {
      if (impliedHoverData) return impliedHoverData.valuation;
      return marketImpliedValuation ?? currentValuation;
    }
    return hoverData?.valuation ?? currentValuation;
  })();

  // Scale price proportionally to valuation (or show live token price)
  const displayedPrice = (() => {
    if (chartType === "live") {
      // For live view, show the token price
      if (liveHoverData) return liveHoverData.price;
      return liveCurrentPrice ?? basePrice;
    }
    if (chartType === "market") {
      const marketBase = marketImpliedValuation ?? currentValuation;
      if (impliedHoverData) {
        return basePrice * (impliedHoverData.valuation / currentValuation);
      }
      return basePrice * (marketBase / currentValuation);
    }
    if (hoverData) {
      return basePrice * (hoverData.valuation / currentValuation);
    }
    return basePrice;
  })();

  // Get date to display based on chart type
  const displayedDate = (() => {
    if (chartType === "live" && liveHoverData) {
      return new Date(liveHoverData.timestamp).toISOString();
    }
    if (chartType === "market" && impliedHoverData) {
      return impliedHoverData.timestamp;
    }
    return hoverData?.date;
  })();

  // Calculate scaled market cap for live view (scales with price)
  const displayedMarketCap = (() => {
    if (chartType !== "live" || !liveChartData?.marketCap) return null;
    const baseMarketCap = liveChartData.marketCap;
    const basePrice = liveChartData.endValue;
    if (!basePrice || basePrice === 0) return baseMarketCap;
    // Scale market cap proportionally to price
    return baseMarketCap * (displayedPrice / basePrice);
  })();

  // Get change data based on chart type
  const displayedChange = (() => {
    if (chartType === "live" && liveChartData) {
      return {
        amount: liveChartData.changeAmount,
        percent: liveChartData.changePercent,
        isPositive: liveChartData.isPositive,
        label: liveChartData.range === "ALL" ? "All Time" : liveChartData.range,
      };
    }
    if (chartType === "market" && impliedChartData) {
      // For market view, show change in valuation (in billions) over the time range
      const changeInBillions = impliedChartData.changeAmount / 1_000_000_000;
      return {
        amount: changeInBillions,
        percent: impliedChartData.changePercent,
        isPositive: impliedChartData.isPositive,
        label: impliedChartData.range === "ALL" ? "All Time" : impliedChartData.range,
      };
    }
    return {
      amount: changeAmount,
      percent: changePercent,
      isPositive,
      label: "Last Round",
    };
  })();

  return (
    <div>
      {/* Main content: Chart + Trade Widget */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left side: Company info + Chart */}
        <div className="flex-1 min-w-0">
          {/* Company header */}
          <div className="flex items-center gap-3 mb-2">
            {company.website ? (
              <a
                href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <CompanyLogo name={company.name} website={company.website} size={32} />
                <h1 className="text-2xl font-semibold text-foreground">{company.name}</h1>
              </a>
            ) : (
              <>
                <CompanyLogo name={company.name} website={company.website} size={32} />
                <h1 className="text-2xl font-semibold text-foreground">{company.name}</h1>
              </>
            )}
          </div>

          {/* Price */}
          <p className="text-[42px] font-bold text-foreground leading-tight tracking-tight transition-all duration-150 ease-out">
            {formatPrice(displayedPrice)}
          </p>

          {/* Valuation - scales with hover for all chart types */}
          <p className="text-lg text-muted font-medium transition-all duration-150 ease-out">
            {formatValuation(displayedValuation)} valuation
          </p>

          {/* Change indicator */}
          <div className="flex items-center gap-2 mt-1 mb-6">
            {displayedDate ? (
              <span className="text-sm text-muted transition-all duration-150 ease-out">
                {new Date(displayedDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  ...(chartType === "live" ? { hour: "numeric", minute: "2-digit" } : {}),
                })}
              </span>
            ) : (
              <>
                <span className={`text-sm font-medium ${displayedChange.isPositive ? "text-green" : "text-red"}`}>
                  {displayedChange.isPositive ? "+" : "-"}
                  {chartType === "market"
                    ? `$${Math.abs(displayedChange.amount).toFixed(1)}B`
                    : `$${Math.abs(displayedChange.amount).toFixed(2)}`
                  }
                  {" "}({displayedChange.isPositive ? "+" : "-"}{Math.abs(displayedChange.percent).toFixed(2)}%)
                </span>
                <span className="text-sm text-muted">{displayedChange.label}</span>
              </>
            )}
          </div>

{/* Charts Container */}
          <div className="w-full">
            {chartType === "funding" && (
              <ValuationChart
                company={company}
                onHover={handleChartHover}
                chartType={chartType}
                onChartTypeChange={setChartType}
                hasMarketData={hasMarketData}
                hasLiveData={hasLiveData}
              />
            )}
            {chartType === "market" && (
              <ImpliedValuationChart
                companySlug={impliedValuationSlug || ""}
                companyName={company.name}
                initialData={impliedData}
                initialTotalVolume={prefetchedTotalVolume}
                marketEndDate={impliedData?.endDate ?? fallbackMarketEndDate}
                onHover={handleImpliedChartHover}
                onDataChange={handleImpliedDataChange}
                chartType={chartType}
                onChartTypeChange={setChartType}
                hasLiveData={hasLiveData}
                hasFundingData={hasSufficientFundingData}
              />
            )}
            {chartType === "live" && prestockAddress && (
              <LivePriceChart
                tokenAddress={prestockAddress}
                companyName={company.name}
                onHover={handleLiveChartHover}
                onDataChange={handleLiveDataChange}
                chartType={chartType}
                onChartTypeChange={setChartType}
                hasMarketData={hasMarketData}
              />
            )}
          </div>

          {/* Mobile trading widget - integrated under chart/change box */}
          {predictionMarket && (
            <div className="lg:hidden mt-4 space-y-4">
              <PredictionMarketTradeWidget
                company={company}
                eventSlug={predictionMarket.eventSlug}
                currentImpliedValuation={impliedChartData?.endValue}
                variant="mobile"
              />
              <PredictionPositionCard eventSlug={predictionMarket.eventSlug} />
            </div>
          )}

          {/* About + Key Stats section - inside left column so trading widget stays sticky */}
          <div className="mt-10">
            <CompanyAbout company={company} />
          </div>

        </div>

        {/* Right side: Trade Widget - hidden on mobile */}
        <div className="hidden lg:block w-full lg:w-[340px] shrink-0">
          <div className="lg:sticky lg:top-8 space-y-4">
            {predictionMarket ? (
              /* Polymarket Event Box + Active Prediction Market Widget + Position Card */
              <>
                <PolymarketEventBox eventSlug={predictionMarket.eventSlug} />
                <PredictionMarketTradeWidget
                  company={company}
                  eventSlug={predictionMarket.eventSlug}
                  currentImpliedValuation={impliedChartData?.endValue}
                />
                <PredictionPositionCard eventSlug={predictionMarket.eventSlug} />
              </>
            ) : (
              /* Fallback: Coming Soon Widget for companies without prediction markets */
              <div className="relative">
                {/* Coming Soon Overlay */}
                <div className="absolute inset-0 bg-white/60 dark:bg-black/40 backdrop-blur-[2px] rounded-xl z-10 flex items-center justify-center">
                  <div className="text-center px-4 md:px-6 py-3 md:py-4">
                    <p className="text-black/70 dark:text-white/90 uppercase tracking-widest text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">Coming Soon</p>
                    <p className="text-black dark:text-white text-base md:text-lg font-semibold">Trading</p>
                  </div>
                </div>
                {/* Dimmed Widget */}
                <div className="blur-[1px] opacity-70 pointer-events-none">
                  <TradeWidget company={company} />
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
