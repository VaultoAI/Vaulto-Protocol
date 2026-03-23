"use client";

import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol } from "@/lib/vaulto/companies";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ValuationChart } from "@/components/ValuationChart";
import { TradeWidget } from "@/components/TradeWidget";
import { CompanyAbout } from "@/components/CompanyAbout";
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
  const price = getCurrentPrice(company);
  const { changeAmount, changePercent, isPositive } = getDailyChange(company);
  const history = getValuationHistory(company);

  // Compute total change from first to last round
  const totalChange = history.length >= 2
    ? {
        amount: history[history.length - 1].valuation - history[0].valuation,
        percent: ((history[history.length - 1].valuation - history[0].valuation) / history[0].valuation) * 100,
        isPositive: history[history.length - 1].valuation >= history[0].valuation,
      }
    : null;

  return (
    <div>
      {/* Back navigation */}
      <Link
        href="/mint"
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
          <p className="text-[42px] font-bold text-foreground leading-tight tracking-tight">
            {formatPrice(price)}
          </p>

          {/* Change indicator */}
          <div className="flex items-center gap-2 mt-1 mb-6">
            <span className={`text-sm font-medium ${isPositive ? "text-green" : "text-red"}`}>
              {isPositive ? "+" : "-"}${Math.abs(changeAmount).toFixed(2)} ({isPositive ? "+" : "-"}{changePercent.toFixed(2)}%)
            </span>
            <span className="text-sm text-muted">Last Round</span>
          </div>

          {/* Action buttons row */}
          <div className="flex items-center gap-3 mb-6">
            <button className="p-2 rounded-full border border-border hover:bg-badge-bg transition-colors" title="Share">
              <svg className="h-4 w-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            <button className="p-2 rounded-full border border-border hover:bg-badge-bg transition-colors" title="Expand">
              <svg className="h-4 w-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <Link
              href={company.website || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-medium text-foreground hover:bg-badge-bg transition-colors"
            >
              Company website
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>

          {/* Chart */}
          <ValuationChart company={company} />

          {/* Total change summary below chart */}
          {totalChange && (
            <div className="mt-4 flex items-center gap-2">
              <span className={`text-xs font-medium ${totalChange.isPositive ? "text-green" : "text-red"}`}>
                {totalChange.isPositive ? "+" : ""}{totalChange.percent.toFixed(1)}% all-time valuation change
              </span>
              <span className="text-xs text-muted">
                ({history[0]?.date?.split("-")[0] ?? "—"} &mdash; {history[history.length - 1]?.date?.split("-")[0] ?? "—"})
              </span>
            </div>
          )}
        </div>

        {/* Right side: Trade Widget */}
        <div className="w-full lg:w-[340px] shrink-0">
          <div className="lg:sticky lg:top-8">
            <TradeWidget company={company} />
          </div>
        </div>
      </div>

      {/* About + Key Stats section */}
      <div className="mt-12">
        <CompanyAbout company={company} />
      </div>
    </div>
  );
}
