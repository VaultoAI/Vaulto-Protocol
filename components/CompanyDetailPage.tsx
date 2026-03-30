"use client";

import type { PrivateCompany } from "@/lib/vaulto/companies";
import {
  formatValuation,
  formatPricePerShare,
  getSyntheticSymbol,
} from "@/lib/vaulto/companies";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Sparkline } from "@/components/Sparkline";
import { MintWidget } from "@/components/MintWidget";
import Link from "next/link";

type CompanyDetailPageProps = {
  company: PrivateCompany;
};

export function CompanyDetailPage({ company }: CompanyDetailPageProps) {
  const syntheticSymbol = getSyntheticSymbol(company.name);

  return (
    <div className="max-w-4xl">
      {/* Back link */}
      <Link
        href="/mint"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Mint
      </Link>

      {/* Company Header */}
      <div className="mt-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <CompanyLogo name={company.name} website={company.website} size={64} />
          <div>
            <h1 className="text-2xl font-medium tracking-tight">{company.name}</h1>
            <p className="mt-1 text-muted">{company.industry}</p>
          </div>
        </div>
        <MintWidget
          companyName={company.name}
          syntheticSymbol={syntheticSymbol}
          valuationUsd={company.valuationUsd}
        />
      </div>

      {/* Description */}
      <p className="mt-4 text-muted">{company.description}</p>

      {/* Key Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted">Valuation</p>
          <p className="mt-1 text-xl font-medium">
            {formatValuation(company.valuationUsd)}
          </p>
          <p className="text-xs text-muted">as of {company.valuationAsOf}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted">Total Funding</p>
          <p className="mt-1 text-xl font-medium">
            {formatValuation(company.totalFundingUsd)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted">Price/Share</p>
          <p className="mt-1 text-xl font-medium">
            {formatPricePerShare(company.lastFundingEstPricePerShareUsd)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted">Token</p>
          <p className="mt-1 text-xl font-medium">{syntheticSymbol}</p>
        </div>
      </div>

      {/* Valuation Trend */}
      <div className="mt-6 rounded-md border border-border bg-muted/30 p-4">
        <h2 className="text-sm font-medium text-muted">Valuation Trend</h2>
        <div className="mt-3">
          <Sparkline company={company} width={300} height={60} />
        </div>
      </div>

      {/* Company Details */}
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <h2 className="text-sm font-medium">Company Info</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">CEO</dt>
              <dd>{company.ceo}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Employees</dt>
              <dd>{company.employees.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Last Funding</dt>
              <dd>{company.lastFundingRoundType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Last Funding Date</dt>
              <dd>{company.lastFundingDate}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Website</dt>
              <dd>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {company.website.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </div>
          </dl>
        </div>

        {/* Products */}
        {company.products.length > 0 && (
          <div className="rounded-md border border-border bg-muted/30 p-4">
            <h2 className="text-sm font-medium">Products</h2>
            <ul className="mt-3 space-y-2">
              {company.products.map((product, index) => (
                <li key={index} className="text-sm">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-muted">{product.description}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Funding History */}
      {company.fundingHistory.length > 0 && (
        <div className="mt-6 rounded-md border border-border bg-muted/30 p-4">
          <h2 className="text-sm font-medium">Funding History</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 pr-4 font-medium text-muted">Round</th>
                  <th className="pb-2 pr-4 font-medium text-muted">Date</th>
                  <th className="pb-2 pr-4 font-medium text-muted">Amount</th>
                  <th className="pb-2 font-medium text-muted">Valuation</th>
                </tr>
              </thead>
              <tbody>
                {company.fundingHistory.map((round, index) => (
                  <tr key={index} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4">{round.type}</td>
                    <td className="py-2 pr-4 text-muted">{round.date}</td>
                    <td className="py-2 pr-4">
                      {round.amountRaisedUsd
                        ? formatValuation(round.amountRaisedUsd)
                        : round.amountRaisedNote || "—"}
                    </td>
                    <td className="py-2">
                      {round.postMoneyValuationUsd
                        ? formatValuation(round.postMoneyValuationUsd)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
