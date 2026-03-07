import {
  getPrivateCompanies,
  getPrivateCompanyMetrics,
  formatValuation,
} from "@/lib/vaulto/companies";
import { MintTable } from "@/components/MintTable";

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
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      <MintTable companies={companies} />

      {companies.length === 0 && (
        <div className="mt-8 rounded-md border border-border bg-muted/30 px-6 py-12 text-center">
          <p className="text-muted">No companies available for minting.</p>
        </div>
      )}
    </div>
  );
}
