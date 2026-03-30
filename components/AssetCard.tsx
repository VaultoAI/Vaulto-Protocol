"use client";

import Link from "next/link";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { formatValuation, formatPricePerShare, getSyntheticSymbol } from "@/lib/vaulto/companies";
import { getDailyChange } from "@/lib/vaulto/companyUtils";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Sparkline } from "@/components/Sparkline";

interface AssetCardProps {
  company: PrivateCompany;
}

/**
 * Asset card component for grid view in Explore Assets.
 * Displays company info, price, daily change, and sparkline.
 */
export function AssetCard({ company }: AssetCardProps) {
  const symbol = getSyntheticSymbol(company.name);
  const dailyChange = getDailyChange(company);
  const isPositive = dailyChange >= 0;

  return (
    <Link
      href={`/mint/${company.id}`}
      className="group block rounded-xl border border-border bg-card-bg p-4 transition-all hover:border-foreground/20 hover:bg-card-hover"
    >
      {/* Header: Logo + Name + Symbol */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CompanyLogo name={company.name} website={company.website} size={40} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{company.name}</p>
            <p className="text-xs text-muted">{symbol}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            isPositive
              ? "bg-green/10 text-green"
              : "bg-red/10 text-red"
          }`}
        >
          {isPositive ? "+" : ""}
          {dailyChange.toFixed(2)}%
        </span>
      </div>

      {/* Price + Valuation */}
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-lg font-semibold text-foreground">
            {formatPricePerShare(company.lastFundingEstPricePerShareUsd)}
          </p>
          <p className="text-xs text-muted">
            {formatValuation(company.valuationUsd)} valuation
          </p>
        </div>

        {/* Mini Sparkline */}
        <div className="shrink-0">
          <Sparkline
            company={company}
            width={64}
            height={28}
            color={isPositive ? "#22c55e" : "#ef4444"}
          />
        </div>
      </div>

      {/* Industry tag */}
      <div className="mt-3 pt-3 border-t border-border">
        <span className="inline-block rounded-full bg-badge-bg px-2.5 py-1 text-xs text-muted">
          {company.industry}
        </span>
      </div>
    </Link>
  );
}
