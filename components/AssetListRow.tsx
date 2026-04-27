"use client";

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
import { useImpliedValuationHistory } from "@/hooks/useImpliedValuationHistory";

interface AssetListRowProps {
  company: PrivateCompany;
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

  // Check if we need to fetch IPO/implied valuation data
  // Only fetch IPO data as fallback when no funding sparkline exists
  const hasIpoData = hasImpliedValuationData(company.name);
  const needsIpoData = !fundingSparkline && hasIpoData;
  const ipoSlug = needsIpoData ? getImpliedValuationSlug(company.name) : null;

  // Fetch IPO sparkline data with React Query (cached across navigation)
  const { sparkline: ipoSparkline, currentValuation: ipoCurrentValuation } =
    useImpliedValuationHistory(ipoSlug, { numPoints: 30, enabled: needsIpoData });

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
