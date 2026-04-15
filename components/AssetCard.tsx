"use client";

import { useState, useEffect } from "react";
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

interface AssetCardProps {
  company: PrivateCompany;
  priceChange24h?: PriceChange24h;
}

/**
 * Convert IPO history data to sparkline format (array of values)
 */
function historyToSparkline(history: { value: number }[], numPoints: number = 48): number[] | null {
  if (!history || history.length < 2) return null;

  const values = history.map(h => h.value);

  // If we have exactly the number of points we need, return them directly
  if (values.length === numPoints) return values;

  // If we have fewer points, interpolate
  if (values.length < numPoints) {
    const result: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const scaledT = t * (values.length - 1);
      const idx = Math.floor(scaledT);
      const frac = scaledT - idx;
      const v0 = values[idx];
      const v1 = values[Math.min(idx + 1, values.length - 1)];
      result.push(v0 + (v1 - v0) * frac);
    }
    return result;
  }

  // If we have more points, sample evenly
  const result: number[] = [];
  for (let i = 0; i < numPoints; i++) {
    const idx = Math.round((i / (numPoints - 1)) * (values.length - 1));
    result.push(values[idx]);
  }
  return result;
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

  // Check if we need to fetch IPO data (no funding sparkline but has IPO data)
  const hasIpoData = hasImpliedValuationData(company.name);
  const needsIpoData = !fundingSparkline && hasIpoData;
  const ipoSlug = needsIpoData ? getImpliedValuationSlug(company.name) : null;

  // State for IPO sparkline data and current valuation
  const [ipoSparkline, setIpoSparkline] = useState<number[] | null>(null);
  const [ipoCurrentValuation, setIpoCurrentValuation] = useState<number | null>(null);
  const [ipoLoading, setIpoLoading] = useState(false);

  // Fetch IPO sparkline data if needed
  useEffect(() => {
    if (!needsIpoData || !ipoSlug || ipoSparkline || ipoLoading) return;

    setIpoLoading(true);
    fetch(`/api/implied-valuations/${ipoSlug}/history?range=ALL`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.history) {
          const sparkline = historyToSparkline(data.history, 48);
          setIpoSparkline(sparkline);
          // Get the current (latest) valuation from the history
          if (data.history.length > 0) {
            setIpoCurrentValuation(data.history[data.history.length - 1].value);
          }
        }
        setIpoLoading(false);
      })
      .catch(() => setIpoLoading(false));
  }, [needsIpoData, ipoSlug, ipoSparkline, ipoLoading]);

  // Use funding sparkline if available, otherwise IPO sparkline
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
