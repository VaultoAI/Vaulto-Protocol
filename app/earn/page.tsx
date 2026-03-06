import { getPrivateCompanies, getSyntheticSymbol, formatValuation, type PrivateCompany } from "@/lib/vaulto/companies";
import { TokenLogo } from "@/components/TokenLogo";
import { formatUSD, formatPercent } from "@/lib/format";

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

type StockPool = {
  company: PrivateCompany;
  symbol: string;
  poolName: string;
  tvlUSD: number;
  volume24h: number;
  apr: number;
};

function PoolCell({ pool }: { pool: StockPool }) {
  const tokens = [pool.symbol, "USDC"];
  return (
    <td className="py-3 px-4">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <div className="flex -space-x-1 shrink-0">
          {tokens.map((symbol) => (
            <TokenLogo key={symbol} symbol={symbol} size={24} className="ring-2 ring-background" />
          ))}
        </div>
        <span>{pool.poolName}</span>
      </div>
    </td>
  );
}

function IndustryBadge({ industry }: { industry: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted/50 px-2 py-0.5 text-xs text-muted">
      {industry}
    </span>
  );
}

export default async function EarnPage() {
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
      <div className="mt-8 grid grid-cols-3 gap-4">
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

      {/* Additional Stats */}
      <div className="mt-4 grid grid-cols-2 gap-4">
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

      {/* Pools Table */}
      <div className="mt-8 overflow-x-auto border border-border rounded-md">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="py-3 px-4 font-medium">Pool</th>
              <th className="py-3 px-4 font-medium text-muted">Industry</th>
              <th className="py-3 px-4 font-medium text-muted">Valuation</th>
              <th className="py-3 px-4 font-medium text-muted text-right">TVL</th>
              <th className="py-3 px-4 font-medium text-muted text-right">Volume (24h)</th>
              <th className="py-3 px-4 font-medium text-muted text-right">APR</th>
              <th className="w-28" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {pools.map((pool) => (
              <tr key={pool.company.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                <PoolCell pool={pool} />
                <td className="py-3 px-4">
                  <IndustryBadge industry={pool.company.industry} />
                </td>
                <td className="py-3 px-4 text-muted">
                  {formatValuation(pool.company.valuationUsd)}
                </td>
                <td className="py-3 px-4 text-muted text-right">{formatUSD(pool.tvlUSD)}</td>
                <td className="py-3 px-4 text-muted text-right">{formatUSD(pool.volume24h)}</td>
                <td className="py-3 px-4 text-right font-medium text-green-500">
                  {formatPercent(pool.apr)}
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    className="inline-block rounded border border-border bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
                    disabled
                    title="Coming soon"
                  >
                    Add LP
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Disclaimer */}
      <p className="mt-4 text-xs text-muted">
        Demo data shown. Actual TVL, volume, and APR will vary based on real market activity.
        Synthetic tokens represent exposure to private company valuations, not actual equity.
      </p>
    </div>
  );
}
