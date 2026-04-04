"use client";

import { useState } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { formatValuation, formatPricePerShare } from "@/lib/vaulto/companies";
import { NewsSection } from "./NewsSection";

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

  const descriptionLimit = 360;
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-5 gap-x-6">
          <InfoItem label="CEO" value={company.ceo || "—"} />
          <InfoItem label="Employees" value={company.employees ? company.employees.toLocaleString() : "—"} />
          <InfoItem label="Industry" value={company.industry || "—"} />
          <InfoItem label="Website" value={company.website ? (() => { try { const u = company.website!.startsWith("http") ? company.website! : `https://${company.website!}`; return new URL(u).hostname.replace("www.", ""); } catch { return company.website!; } })() : "—"} isLink={!!company.website} href={company.website?.startsWith("http") ? company.website : `https://${company.website}`} />
        </div>

        {/* Key facts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-5 gap-x-6 mt-6">
          <InfoItem label="Price / Share" value={formatPricePerShare(company.lastFundingEstPricePerShareUsd)} />
          <InfoItem label="Last Round" value={company.lastFundingRoundType || "—"} />
          <InfoItem
            label="Last Funding Date"
            value={company.lastFundingDate
              ? new Date(company.lastFundingDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "—"
            }
          />
          <InfoItem label="Funding Rounds" value={company.fundingHistory ? String(company.fundingHistory.length) : "—"} />
        </div>

      </section>

      {/* Products - horizontal scrolling chips */}
      {company.products && company.products.filter(p => p.name).length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-1">Products</h2>
          <div className="border-t border-border mb-4" />

          <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {company.products
              .filter(p => p.name)
              .map((product, index) => (
                <div
                  key={index}
                  className="group relative flex-shrink-0 rounded-lg border border-border bg-badge-bg/50 px-3 md:px-4 py-2.5 md:py-2 hover:bg-card-hover active:bg-card-hover transition-colors cursor-default"
                >
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">
                    {product.name}
                  </span>
                  {/* Tooltip on hover (hidden on mobile) */}
                  {product.description && (
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden md:group-hover:block z-10">
                      <div className="bg-foreground text-background text-xs rounded-lg px-3 py-2 max-w-[200px] shadow-lg">
                        {product.description}
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground" />
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}

      {/* News & Press */}
      <NewsSection
        companyName={company.name}
        ceo={company.ceo}
        products={company.products?.map((p) => p.name).filter(Boolean)}
      />

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
                        <span className="font-medium text-foreground">{round.type || "—"}</span>
                      </td>
                      <td className="py-2.5 px-4 text-muted">
                        {round.date ? new Date(round.date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
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
    <div className="min-w-0">
      <p className="text-xs text-muted mb-1">{label}</p>
      {isLink && href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-green hover:underline truncate block"
        >
          {value}
        </a>
      ) : (
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      )}
    </div>
  );
}

