"use client";

import Link from "next/link";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol, formatValuation, getCompanySlug } from "@/lib/vaulto/companies";
import { CompanyLogo } from "@/components/CompanyLogo";
import {
  getDailyChange,
  getCurrentPrice,
  formatPrice,
  getTopGainers,
  getTrending,
  getNewlyAdded,
} from "@/lib/vaulto/companyUtils";

interface ExploreTopSectionProps {
  companies: PrivateCompany[];
  /** Pre-fetched newly added companies from the database. Falls back to sorting by lastFundingDate if not provided. */
  newlyAdded?: PrivateCompany[];
}

/**
 * Top section with three columns: Top Gainers, Trending, Newly Added
 * Matches Ondo Finance layout with tighter spacing.
 */
export function ExploreTopSection({ companies, newlyAdded: newlyAddedProp }: ExploreTopSectionProps) {
  const gainers = getTopGainers(companies, 3);
  const trending = getTrending(companies, 3);
  // Use pre-fetched newlyAdded from database if provided, otherwise fall back to utility function
  const newlyAdded = newlyAddedProp ?? getNewlyAdded(companies, 3);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
      {/* Top Gainers */}
      <TopColumn
        title="Top Gainers"
        companies={gainers}
        renderMetric={(company) => {
          const { changePercent, isPositive } = getDailyChange(company);
          const displayPercent = changePercent > 999 ? `${(changePercent / 100).toFixed(0)}x` : `${changePercent.toFixed(2)}%`;
          return (
            <span className={`text-xs font-medium ${isPositive ? "text-green" : "text-red"}`}>
              <span className="text-[10px] mr-0.5">{isPositive ? "\u25B2" : "\u25BC"}</span>
              {displayPercent}
            </span>
          );
        }}
      />

      {/* Trending */}
      <TopColumn
        title="Trending"
        badge="24H"
        companies={trending}
        hasBorderLeft
        renderMetric={(company) => (
          <span className="text-xs text-muted">
            {formatValuation(company.valuationUsd)}
          </span>
        )}
      />

      {/* Newly Added */}
      <TopColumn
        title="Newly Added"
        companies={newlyAdded}
        hasBorderLeft
        renderMetric={() => (
          <span className="text-xs text-muted">
            Pre-IPO Stock
          </span>
        )}
      />
    </div>
  );
}

interface TopColumnProps {
  title: string;
  badge?: string;
  companies: PrivateCompany[];
  hasBorderLeft?: boolean;
  renderMetric: (company: PrivateCompany) => React.ReactNode;
}

function TopColumn({ title, badge, companies, hasBorderLeft, renderMetric }: TopColumnProps) {
  return (
    <div className={`py-6 ${hasBorderLeft ? "md:pl-8 md:pr-6 md:border-l md:border-border" : "md:pr-8"}`}>
      {/* Title */}
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {badge && (
          <span className="inline-flex items-center rounded-md bg-badge-bg px-2 py-0.5 text-[11px] font-medium text-badge-text">
            {badge}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="flex flex-col gap-4">
        {companies.map((company) => {
          const symbol = getSyntheticSymbol(company.name);
          const price = getCurrentPrice(company);

          return (
            <Link
              key={company.id}
              href={`/explore/${getCompanySlug(company.name)}`}
              className="flex items-center gap-3 cursor-pointer group"
            >
              {/* Logo */}
              <CompanyLogo name={company.name} website={company.website} size={36} className="shrink-0" />

              {/* Name - takes remaining space */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground leading-tight">{symbol}</p>
                <p className="text-xs text-muted leading-tight truncate">{company.name}</p>
              </div>

              {/* Price + metric - fixed width, right-aligned */}
              <div className="flex flex-col items-end shrink-0 w-[90px]">
                <p className="text-sm font-semibold text-foreground tabular-nums">{formatPrice(price)}</p>
                {renderMetric(company)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

