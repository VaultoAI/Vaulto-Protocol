"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol, formatValuation, getCompanySlug } from "@/lib/vaulto/companies";
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
import {
  hasImpliedValuationData,
  getImpliedValuationSlug,
} from "@/lib/polymarket/implied-valuations";
import { getCompanyPredictionMarket } from "@/lib/polymarket/ipo-valuations";

interface AssetListRowProps {
  company: PrivateCompany;
}

/**
 * Convert IPO history data to sparkline format (array of values)
 */
function historyToSparkline(history: { value: number }[], numPoints: number = 30): number[] | null {
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
 * List view row for an asset.
 * Chart shows real post-money valuation from funding history,
 * or IPO prediction data if funding history is unavailable.
 */
export function AssetListRow({ company }: AssetListRowProps) {
  const router = useRouter();
  const symbol = getSyntheticSymbol(company.name);
  const basePrice = getCurrentPrice(company);
  const { changePercent, isPositive } = getDailyChange(company);
  const fundingSparkline = getValuationSparkline(company, 30);
  const isIpoOnly = isIpoOnlyCompany(company);
  const hasPredictionMarket = getCompanyPredictionMarket(company.name) !== null;

  // Check if we need to fetch IPO/implied valuation data
  // For companies with Polymarket data, always show implied valuation history
  // Otherwise, fall back to IPO data only if no funding sparkline
  const hasIpoData = hasImpliedValuationData(company.name);
  const needsIpoData = (hasPredictionMarket && hasIpoData) || (!fundingSparkline && hasIpoData);
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
          const sparkline = historyToSparkline(data.history, 30);
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

  // For Polymarket companies, prioritize implied valuation sparkline
  // Otherwise, use funding sparkline if available, then IPO sparkline
  const sparklineData = (hasPredictionMarket && ipoSparkline) ? ipoSparkline : (fundingSparkline ?? ipoSparkline);

  // Calculate displayed price - for IPO-only companies, scale based on implied valuation
  const price = (() => {
    if (isIpoOnly && ipoCurrentValuation) {
      return IPO_ONLY_DEFAULT_PRICE * (ipoCurrentValuation / IPO_ONLY_BASE_VALUATION);
    }
    return basePrice;
  })();

  return (
    <tr
      className="border-b border-border last:border-0 hover:bg-card-hover transition-colors cursor-pointer"
      onClick={() => router.push(`/explore/${getCompanySlug(company.name)}`)}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <CompanyLogo name={company.name} website={company.website} size={32} />
          <div>
            <p className="text-sm font-semibold text-foreground">{symbol}</p>
            <p className="text-xs text-muted">{company.name}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <p className="text-sm font-semibold text-foreground">{formatPrice(price)}</p>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <span className={`text-[10px] ${isPositive ? "text-green" : "text-red"}`}>
            {isPositive ? "\u25B2" : "\u25BC"}
          </span>
          <span className={`text-sm font-medium ${isPositive ? "text-green" : "text-red"}`}>
            {changePercent.toFixed(2)}%
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <p className="text-sm text-muted">{formatValuation(company.valuationUsd)}</p>
      </td>
      <td className="py-3 px-4">
        <div className="flex justify-end">
          {sparklineData ? (
            <MiniChart
              data={sparklineData}
              width={100}
              height={32}
              isPositive={isPositive}
              strokeWidth={1.2}
              showGradient={false}
              disableHover
            />
          ) : (
            <span className="text-[10px] text-muted">--</span>
          )}
        </div>
      </td>
    </tr>
  );
}
