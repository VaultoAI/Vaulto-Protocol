import { getPrivateCompanies, getSyntheticSymbol, formatValuation, type PrivateCompany } from "@/lib/vaulto/companies";
import type { StockPool } from "@/components/EarnPoolsTable";
import { EarnPageClient } from "@/components/earn/EarnPageClient";
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
  if (process.env.NODE_ENV !== "development") {
    const session = await auth();

    if (!session?.user) {
      redirect("/");
    }

    if (!session.user.isVaultoEmployee) {
      redirect("/waitlist-success");
    }
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
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-medium tracking-tight">Earn</h1>
      <p className="mt-2 text-muted">
        Provide liquidity for synthetic tokens and earn fees.
      </p>

      <EarnPageClient
        pools={pools}
        totalTVL={totalTVL}
        totalVolume={totalVolume}
        avgAPR={avgAPR}
      />

      {/* Disclaimer */}
      <p className="mt-8 text-xs text-muted">
        Demo data shown. Actual TVL, volume, and APR will vary based on real market activity.
        Synthetic tokens represent exposure to private company valuations, not actual equity.
      </p>
    </div>
  );
}
