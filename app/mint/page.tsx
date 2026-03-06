import {
  getPrivateCompanies,
  getPrivateCompanyMetrics,
  formatValuation,
  formatPricePerShare,
  getSyntheticSymbol,
} from "@/lib/vaulto/companies";
import { CompanyLogo } from "@/components/CompanyLogo";
import { MintWidget } from "@/components/MintWidget";

export default async function MintPage() {
  const [companies, metrics] = await Promise.all([
    getPrivateCompanies(),
    getPrivateCompanyMetrics(),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-medium tracking-tight">Mint</h1>
      <p className="mt-2 text-muted">
        Mint synthetic exposure to private companies.
      </p>

      {/* Summary Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted">Companies</p>
          <p className="mt-1 text-xl font-medium">{metrics.companyCount}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted">Total Valuation</p>
          <p className="mt-1 text-xl font-medium">
            {formatValuation(metrics.totalValuation)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted">Total Funding</p>
          <p className="mt-1 text-xl font-medium">
            {formatValuation(metrics.totalFunding)}
          </p>
        </div>
      </div>

      {/* Companies Table */}
      <div className="mt-8 overflow-x-auto border border-border rounded-md">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 px-4 font-medium">Company</th>
              <th className="py-3 px-4 font-medium text-muted">Industry</th>
              <th className="py-3 px-4 font-medium text-muted whitespace-nowrap">
                Valuation
              </th>
              <th className="py-3 px-4 font-medium text-muted whitespace-nowrap">
                Funding
              </th>
              <th className="py-3 px-4 font-medium text-muted whitespace-nowrap">
                Price/Share
              </th>
              <th className="py-3 px-4 font-medium text-muted">Token</th>
              <th className="px-4 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => {
              const syntheticSymbol = getSyntheticSymbol(company.name);
              return (
                <tr
                  key={company.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <CompanyLogo name={company.name} website={company.website} size={32} />
                      <div>
                        <p className="font-medium">{company.name}</p>
                        <p className="text-xs text-muted">{company.ceo}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted">{company.industry}</td>
                  <td className="py-3 px-4 text-muted">
                    {formatValuation(company.valuationUsd)}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {formatValuation(company.totalFundingUsd)}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {formatPricePerShare(company.lastFundingEstPricePerShareUsd)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center rounded-full bg-muted/50 px-2 py-0.5 text-xs font-medium">
                      {syntheticSymbol}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <MintWidget
                      companyName={company.name}
                      syntheticSymbol={syntheticSymbol}
                      valuationUsd={company.valuationUsd}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {companies.length === 0 && (
        <div className="mt-8 rounded-md border border-border bg-muted/30 px-6 py-12 text-center">
          <p className="text-muted">No companies available for minting.</p>
        </div>
      )}
    </div>
  );
}
