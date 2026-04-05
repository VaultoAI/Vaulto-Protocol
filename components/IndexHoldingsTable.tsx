"use client";

import Link from "next/link";
import type { IndexHolding } from "@/lib/vaulto/indexes";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol, getCompanySlug } from "@/lib/vaulto/companies";
import { CompanyLogo } from "@/components/CompanyLogo";

interface IndexHoldingsTableProps {
  holdings: IndexHolding[];
  companies: PrivateCompany[];
}

/**
 * Table displaying index holdings with weights, symbols, and contribution values.
 * Links company rows to their detail pages.
 */
export function IndexHoldingsTable({
  holdings,
  companies,
}: IndexHoldingsTableProps) {
  // Sort holdings by weight descending
  const sortedHoldings = [...holdings].sort((a, b) => b.weight - a.weight);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Table header */}
      <div className="bg-badge-bg/50 border-b border-border px-4 py-2.5">
        <div className="grid grid-cols-[1fr_80px_80px] md:grid-cols-[1fr_100px_100px] gap-2">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">Company</span>
          <span className="text-xs font-medium text-muted uppercase tracking-wide text-right">Symbol</span>
          <span className="text-xs font-medium text-muted uppercase tracking-wide text-right">Weight</span>
        </div>
      </div>

      {/* Table rows */}
      {sortedHoldings.map((holding) => (
        <HoldingRow
          key={holding.companyName}
          holding={holding}
          companies={companies}
        />
      ))}
    </div>
  );
}

interface HoldingRowProps {
  holding: IndexHolding;
  companies: PrivateCompany[];
}

function HoldingRow({ holding, companies }: HoldingRowProps) {
  const company = holding.isCash
    ? null
    : companies.find(
        (c) => c.name.toLowerCase() === holding.companyName.toLowerCase()
      );

  const symbol = company ? getSyntheticSymbol(company.name) : "--";
  const slug = company ? getCompanySlug(company.name) : null;

  const content = (
    <div className="grid grid-cols-[1fr_80px_80px] md:grid-cols-[1fr_100px_100px] gap-2 items-center">
      {/* Company name + logo */}
      <div className="flex items-center gap-3 min-w-0">
        {holding.isCash ? (
          <div className="h-8 w-8 rounded-full bg-badge-bg flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        ) : company ? (
          <CompanyLogo name={company.name} website={company.website} size={32} />
        ) : (
          <div className="h-8 w-8 rounded-full bg-badge-bg shrink-0" />
        )}
        <span className="text-sm font-medium text-foreground truncate">
          {holding.companyName}
        </span>
      </div>

      {/* Symbol */}
      <span className="text-sm text-muted text-right tabular-nums">{symbol}</span>

      {/* Weight */}
      <span className="text-sm font-medium text-foreground text-right tabular-nums">
        {(holding.weight * 100).toFixed(2)}%
      </span>
    </div>
  );

  // Wrap in link if it's a company (not cash)
  if (slug) {
    return (
      <Link
        href={`/explore/${slug}`}
        className="block border-b border-border last:border-0 px-4 py-3 hover:bg-card-hover transition-colors"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="border-b border-border last:border-0 px-4 py-3 bg-badge-bg/20">
      {content}
    </div>
  );
}
