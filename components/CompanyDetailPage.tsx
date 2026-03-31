"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol, formatValuation } from "@/lib/vaulto/companies";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ValuationChart, type HoverData } from "@/components/ValuationChart";
import { CompanyAbout } from "@/components/CompanyAbout";

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
} from "@/lib/vaulto/companyUtils";
import Link from "next/link";

interface CompanyDetailPageProps {
  company: PrivateCompany;
}

/**
 * Full company detail page matching Robinhood design.
 * Layout: Chart (left) + Trade Widget (right) stacked above About section.
 */
export function CompanyDetailPage({ company }: CompanyDetailPageProps) {
  const symbol = getSyntheticSymbol(company.name);
  const basePrice = getCurrentPrice(company);
  const { changeAmount, changePercent, isPositive } = getDailyChange(company);

  // Get current valuation for ratio calculations
  const history = getValuationHistory(company);
  const currentValuation = history.length > 0 ? history[history.length - 1].valuation : company.valuationUsd;

  // State for hover data
  const [hoverData, setHoverData] = useState<HoverData | null>(null);

  const handleChartHover = useCallback((data: HoverData | null) => {
    setHoverData(data);
  }, []);

  // Calculate displayed price based on hover
  // When hovering, scale the price proportionally to the valuation change
  const displayedValuation = hoverData?.valuation ?? currentValuation;
  const displayedPrice = hoverData
    ? basePrice * (hoverData.valuation / currentValuation)
    : basePrice;

  return (
    <div>
      {/* Back navigation */}
      <Link
        href="/explore"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Explore
      </Link>

      {/* Main content: Chart + Trade Widget */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left side: Company info + Chart */}
        <div className="flex-1 min-w-0">
          {/* Company header */}
          <div className="flex items-center gap-3 mb-2">
            <CompanyLogo name={company.name} website={company.website} size={32} />
            <h1 className="text-2xl font-semibold text-foreground">{company.name}</h1>
          </div>

          {/* Price */}
          <p className="text-[42px] font-bold text-foreground leading-tight tracking-tight transition-all duration-150 ease-out">
            {formatPrice(displayedPrice)}
          </p>

          {/* Valuation */}
          <p className="text-lg text-muted font-medium transition-all duration-150 ease-out">
            {formatValuation(displayedValuation)} valuation
          </p>

          {/* Change indicator */}
          <div className="flex items-center gap-2 mt-1 mb-6">
            {hoverData ? (
              <span className="text-sm text-muted transition-all duration-150 ease-out">
                {new Date(hoverData.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            ) : (
              <>
                <span className={`text-sm font-medium ${isPositive ? "text-green" : "text-red"}`}>
                  {isPositive ? "+" : "-"}${Math.abs(changeAmount).toFixed(2)} ({isPositive ? "+" : "-"}{changePercent.toFixed(2)}%)
                </span>
                <span className="text-sm text-muted">Last Round</span>
              </>
            )}
          </div>

          {/* Chart */}
          <ValuationChart company={company} onHover={handleChartHover} />

        </div>

        {/* Right side: Trade Widget (Coming Soon) */}
        <div className="w-full lg:w-[340px] shrink-0">
          <div className="lg:sticky lg:top-8 relative">
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
        </div>
      </div>

      {/* About + Key Stats section */}
      <div className="mt-10">
        <CompanyAbout company={company} />
      </div>
    </div>
  );
}
