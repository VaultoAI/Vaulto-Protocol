"use client";

import { useState } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { formatValuation, formatPricePerShare } from "@/lib/vaulto/companies";

interface CompanyAboutProps {
  company: PrivateCompany;
}

/**
 * About section + Key Statistics for company detail page.
 * Matches Robinhood's layout with description, company info grid,
 * key statistics, products, and funding history.
 */
export function CompanyAbout({ company }: CompanyAboutProps) {
  const [showFullDesc, setShowFullDesc] = useState(false);

  const descriptionLimit = 280;
  const isLong = company.description && company.description.length > descriptionLimit;
  const displayDesc = showFullDesc || !isLong
    ? company.description
    : company.description.slice(0, descriptionLimit) + "...";

  return (
    <div className="space-y-10">
      {/* About */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-1">About</h2>
        <div className="border-t border-border mb-4" />

        {company.description && (
          <div className="mb-6">
            <p className="text-sm text-foreground leading-relaxed">
              {displayDesc}
              {isLong && (
                <button
                  onClick={() => setShowFullDesc(!showFullDesc)}
                  className="ml-1 text-green font-medium hover:underline"
                >
                  {showFullDesc ? "Show less" : "Show more"}
                </button>
              )}
            </p>
          </div>
        )}

        {/* Company info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-8">
          <InfoItem label="CEO" value={company.ceo || "—"} />
          <InfoItem label="Employees" value={company.employees ? company.employees.toLocaleString() : "—"} />
          <InfoItem label="Industry" value={company.industry || "—"} />
          <InfoItem label="Website" value={company.website ? (() => { try { const u = company.website!.startsWith("http") ? company.website! : `https://${company.website!}`; return new URL(u).hostname.replace("www.", ""); } catch { return company.website!; } })() : "—"} isLink={!!company.website} href={company.website?.startsWith("http") ? company.website : `https://${company.website}`} />
        </div>
      </section>

      {/* Key Statistics */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-1">Key statistics</h2>
        <div className="border-t border-border mb-4" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-8">
          <InfoItem label="Valuation" value={formatValuation(company.valuationUsd)} />
          <InfoItem label="Total Funding" value={formatValuation(company.totalFundingUsd)} />
          <InfoItem label="Price / Share" value={formatPricePerShare(company.lastFundingEstPricePerShareUsd)} />
          <InfoItem label="Last Round" value={company.lastFundingRoundType || "—"} />
          <InfoItem
            label="Last Funding Date"
            value={company.lastFundingDate
              ? new Date(company.lastFundingDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "—"
            }
          />
          <InfoItem
            label="Valuation As Of"
            value={company.valuationAsOf
              ? new Date(company.valuationAsOf).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "—"
            }
          />
          <InfoItem label="Funding Rounds" value={company.fundingHistory ? String(company.fundingHistory.length) : "—"} />
          <InfoItem label="Status" value="Pre-IPO" />
        </div>
      </section>

      {/* Products */}
      {company.products && company.products.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-1">Products</h2>
          <div className="border-t border-border mb-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {company.products.map((product, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-badge-bg/30 p-4"
              >
                <h3 className="text-sm font-semibold text-foreground mb-1">{product.name}</h3>
                <p className="text-xs text-muted leading-relaxed">{product.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Funding History */}
      {company.fundingHistory && company.fundingHistory.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-1">Funding History</h2>
          <div className="border-t border-border mb-4" />

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-badge-bg/50 border-b border-border">
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-muted uppercase tracking-wider">Round</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-muted uppercase tracking-wider">Date</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-muted uppercase tracking-wider">Amount Raised</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-muted uppercase tracking-wider hidden md:table-cell">Post-Money Val.</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-muted uppercase tracking-wider hidden lg:table-cell">Price/Share</th>
                </tr>
              </thead>
              <tbody>
                {[...company.fundingHistory]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((round, index) => (
                    <tr key={index} className="border-b border-border last:border-0 hover:bg-card-hover transition-colors">
                      <td className="py-2.5 px-4">
                        <span className="font-medium text-foreground">{round.type}</span>
                      </td>
                      <td className="py-2.5 px-4 text-muted">
                        {new Date(round.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </td>
                      <td className="py-2.5 px-4 text-right text-foreground">
                        {round.amountRaisedUsd
                          ? formatValuation(round.amountRaisedUsd)
                          : round.amountRaisedNote || "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted hidden md:table-cell">
                        {round.postMoneyValuationUsd
                          ? formatValuation(round.postMoneyValuationUsd)
                          : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted hidden lg:table-cell">
                        {round.pricePerShareUsd
                          ? formatPricePerShare(round.pricePerShareUsd)
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function InfoItem({
  label,
  value,
  isLink,
  href,
}: {
  label: string;
  value: string;
  isLink?: boolean;
  href?: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {isLink && href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-green hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="text-sm text-muted">{value}</p>
      )}
    </div>
  );
}
