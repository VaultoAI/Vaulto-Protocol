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
} from "@/lib/vaulto/companyUtils";

interface AssetCardProps {
  company: PrivateCompany;
}

/**
 * Asset card matching Ondo Finance design.
 * Clicking navigates to the company detail page.
 * Chart shows real post-money valuation from funding history.
 */
export function AssetCard({ company }: AssetCardProps) {
  const symbol = getSyntheticSymbol(company.name);
  const price = getCurrentPrice(company);
  const { changeAmount, changePercent, isPositive } = getDailyChange(company);
  const sparklineData = getValuationSparkline(company);

  return (
    <Link href={`/explore/${getCompanySlug(company.name)}`} className="block">
      <div className="group rounded-xl border border-border bg-card-bg p-5 transition-all duration-200 hover:shadow-md hover:border-border/80 cursor-pointer">
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
