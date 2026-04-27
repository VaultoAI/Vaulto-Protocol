"use client";

import Link from "next/link";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol, getCompanySlug } from "@/lib/vaulto/companies";
import { CompanyLogo } from "@/components/CompanyLogo";
import { MiniChart } from "@/components/MiniChart";
import {
  getDailyChange,
  getCurrentPrice,
  formatPrice,
  getValuationSparkline,
  isIpoOnlyCompany,
  IPO_ONLY_DEFAULT_PRICE,
  IPO_ONLY_BASE_VALUATION,
} from "@/lib/vaulto/companyUtils";
import type { PriceChange24h } from "@/lib/polymarket/implied-valuations";
import { hasPrestockToken } from "@/lib/prestock/tokens";
import { getCompanyPredictionMarket } from "@/lib/polymarket/ipo-valuations";
import {
  hasImpliedValuationData,
  getImpliedValuationSlug,
} from "@/lib/polymarket/implied-valuations";
import { useImpliedValuationHistory } from "@/hooks/useImpliedValuationHistory";

interface AssetCardProps {
  company: PrivateCompany;
  priceChange24h?: PriceChange24h;
}

/**
 * Asset card matching Ondo Finance design.
 * Clicking navigates to the company detail page.
 * Chart shows real post-money valuation from funding history,
 * or IPO prediction data if funding history is unavailable.
 */
export function AssetCard({ company }: AssetCardProps) {
  const symbol = getSyntheticSymbol(company.name);
  const basePrice = getCurrentPrice(company);
  const { changeAmount, changePercent, isPositive } = getDailyChange(company);
  const fundingSparkline = getValuationSparkline(company);
  const hasToken = hasPrestockToken(company.name);
  const hasPredictionMarket = getCompanyPredictionMarket(company.name) !== null;
  const isIpoOnly = isIpoOnlyCompany(company);

  // Check if we need to fetch IPO/implied valuation data
  // Only fetch IPO data as fallback when no funding sparkline exists
  const hasIpoData = hasImpliedValuationData(company.name);
  const needsIpoData = !fundingSparkline && hasIpoData;
  const ipoSlug = needsIpoData ? getImpliedValuationSlug(company.name) : null;

  // Fetch IPO sparkline data with React Query (cached across navigation)
  const { sparkline: ipoSparkline, currentValuation: ipoCurrentValuation } =
    useImpliedValuationHistory(ipoSlug, { numPoints: 48, enabled: needsIpoData });

  // Always prioritize funding sparkline, fall back to IPO sparkline only if no funding data
  const sparklineData = fundingSparkline ?? ipoSparkline;

  // Calculate displayed price - for IPO-only companies, scale based on implied valuation
  const price = (() => {
    if (isIpoOnly && ipoCurrentValuation) {
      return IPO_ONLY_DEFAULT_PRICE * (ipoCurrentValuation / IPO_ONLY_BASE_VALUATION);
    }
    return basePrice;
  })();

  return (
    <Link href={`/explore/${getCompanySlug(company.name)}`} className="block">
      <div className="group relative rounded-xl border border-border bg-card-bg p-5 transition-all duration-200 hover:shadow-md hover:border-border/80 cursor-pointer">
        {/* Status indicators */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {hasToken && (
            <span className="inline-flex items-center rounded-md bg-badge-bg px-2 py-0.5 text-[11px] font-medium text-badge-text">
              LIVE
            </span>
          )}
          {hasPredictionMarket && (
            <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400">
              POLY
            </span>
          )}
        </div>

        {/* Header: Logo + Ticker + Name */}
        <div className="flex items-center gap-3 mb-4">
          <CompanyLogo name={company.name} website={company.website} size={36} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">{symbol}</p>
            <p className="text-xs text-muted leading-tight truncate">{company.name}</p>
          </div>
        </div>

        {/* Price */}
        <div className="mb-1">
          <p className="text-[28px] font-semibold text-foreground leading-tight tracking-tight">
            {formatPrice(price)}
          </p>
        </div>

        {/* Change indicator - based on real valuation change between last two rounds */}
        <div className="flex items-center gap-1.5 mb-4">
          <span className={`text-[10px] ${isPositive ? "text-green" : "text-red"}`}>
            {isPositive ? "\u25B2" : "\u25BC"}
          </span>
          <span className={`text-xs font-medium ${isPositive ? "text-green" : "text-red"}`}>
            ${changeAmount.toFixed(2)}
          </span>
          <span className={`text-xs font-medium ${isPositive ? "text-green" : "text-red"}`}>
            ({changePercent.toFixed(2)}%)
          </span>
          <span className="text-xs text-muted ml-0.5">Last Round</span>
        </div>

        {/* Mini chart - real post-money valuation from funding history */}
        <div className="-mx-5 -mb-5 mt-2 overflow-hidden rounded-b-xl">
          {sparklineData ? (
            <MiniChart
              data={sparklineData}
              width={320}
              height={90}
              isPositive={isPositive}
              strokeWidth={1.5}
              disableTouch
              disableHover
            />
          ) : (
            <div className="h-[90px] flex items-center justify-center">
              <span className="text-xs text-muted">No valuation history</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
