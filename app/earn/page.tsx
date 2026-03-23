import { getPrivateCompanies, getSyntheticSymbol, formatValuation, type PrivateCompany } from "@/lib/vaulto/companies";
import { formatUSD, formatPercent } from "@/lib/format";
import { EarnPoolsTable, type StockPool } from "@/components/EarnPoolsTable";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Seeded random number generator for consistent demo data.
 * Uses company ID as seed for deterministic results.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate realistic demo LP metrics for a stock based on its valuation.
 * Uses seeded random for consistent server/client rendering.
 */
function generateDemoMetrics(company: PrivateCompany) {
  const seed = company.id;
  const valuationBillion = company.valuationUsd / 1_000_000_000;

  // TVL ranges from $25K to $500K based on valuation tier
  const tvlBase = 25_000 + Math.min(valuationBillion, 200) * 2_000;
  const tvlVariance = 0.7 + seededRandom(seed) * 0.6;
  const tvlUSD = tvlBase * tvlVariance;

  // Volume is 3-10% of TVL per day
  const volumeRatio = 0.03 + seededRandom(seed + 1) * 0.07;
  const volume24h = tvlUSD * volumeRatio;

  // APR ranges from 12% to 38%
  const baseAPR = 18 + seededRandom(seed + 2) * 20;
  const apr = Math.max(12, Math.min(38, baseAPR));

  return {
    tvlUSD,
    volume24h,
    apr,
  };
}

export default async function EarnPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  if (!session.user.isVaultoEmployee) {
    redirect("/waitlist-success");
  }

  const companies = await getPrivateCompanies();

  // Generate demo pool data for each company
  const pools: StockPool[] = companies
    .filter((c) => c.valuationUsd > 0)
    .map((company) => {
      const symbol = getSyntheticSymbol(company.name);
      const metrics = generateDemoMetrics(company);
      return {
        company,
        symbol,
        poolName: `${symbol} / USDC`,
        ...metrics,
      };
    })
    .sort((a, b) => b.tvlUSD - a.tvlUSD); // Sort by TVL descending

  // Calculate totals
  const totalTVL = pools.reduce((sum, p) => sum + p.tvlUSD, 0);
  const totalVolume = pools.reduce((sum, p) => sum + p.volume24h, 0);
  const avgAPR = pools.length ? pools.reduce((sum, p) => sum + p.apr, 0) / pools.length : 0;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-medium tracking-tight">Earn</h1>
      <p className="mt-2 text-muted">
        Provide liquidity for synthetic private company tokens and earn trading fees.
      </p>

      {/* Summary Cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-background p-5 text-center">
          <p className="text-sm text-muted">Total TVL</p>
          <p className="mt-1 text-xl font-semibold">{formatUSD(totalTVL)}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-5 text-center">
          <p className="text-sm text-muted">Total Volume (24h)</p>
          <p className="mt-1 text-xl font-semibold">{formatUSD(totalVolume)}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-5 text-center">
          <p className="text-sm text-muted">Avg APR</p>
          <p className="mt-1 text-xl font-semibold text-green-500">{formatPercent(avgAPR)}</p>
        </div>
      </div>

      {/* Additional Stats - hidden on mobile */}
      <div className="mt-4 hidden gap-4 md:grid md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-sm text-muted">Active Pools</p>
          <p className="mt-1 text-lg font-semibold">{pools.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-sm text-muted">Combined Market Cap</p>
          <p className="mt-1 text-lg font-semibold">
            {formatValuation(companies.reduce((sum, c) => sum + c.valuationUsd, 0))}
          </p>
        </div>
      </div>

      <EarnPoolsTable pools={pools} />

      {/* Disclaimer */}
      <p className="mt-4 text-xs text-muted">
        Demo data shown. Actual TVL, volume, and APR will vary based on real market activity.
        Synthetic tokens represent exposure to private company valuations, not actual equity.
      </p>
    </div>
  );
}
