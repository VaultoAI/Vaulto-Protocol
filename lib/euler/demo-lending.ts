/**
 * Simulated lending rates for private company tokens.
 * Generates demo vault data based on company valuations.
 */

import { getPrivateCompanies, getSyntheticSymbol } from "@/lib/vaulto/companies";

export interface DemoVault {
  symbol: string;
  name: string;
  companyId: number;
  valuationUsd: number;
  website: string;
  totalSupply: number;
  totalBorrows: number;
  supplyApy: number;
  borrowApy: number;
  utilizationRate: number;
  isDemo: true;
}

/**
 * Generate simulated APY based on company valuation.
 * Higher valuation = lower risk = lower rates.
 */
function generateSupplyApy(valuationUsd: number): number {
  // Base rate: 2-8% depending on valuation
  // Higher valuation = lower perceived risk = lower yield
  const valuationBillions = valuationUsd / 1_000_000_000;

  if (valuationBillions >= 100) {
    // Very large companies (e.g., SpaceX) - lower rates
    return 0.02 + Math.random() * 0.015; // 2-3.5%
  } else if (valuationBillions >= 50) {
    return 0.025 + Math.random() * 0.02; // 2.5-4.5%
  } else if (valuationBillions >= 10) {
    return 0.035 + Math.random() * 0.025; // 3.5-6%
  } else {
    // Smaller companies - higher rates due to higher risk
    return 0.05 + Math.random() * 0.03; // 5-8%
  }
}

/**
 * Generate borrow APY based on supply APY and utilization.
 * Borrow rates are typically 2-4x supply rates.
 */
function generateBorrowApy(supplyApy: number, utilizationRate: number): number {
  // Higher utilization = higher borrow rates
  const multiplier = 2 + utilizationRate * 2;
  return supplyApy * multiplier;
}

/**
 * Generate simulated utilization rate (30-70%).
 */
function generateUtilizationRate(): number {
  return 0.3 + Math.random() * 0.4;
}

/**
 * Generate simulated total supply based on valuation.
 */
function generateTotalSupply(valuationUsd: number): number {
  // Assume 0.1-0.5% of valuation is available in lending pools
  const percentage = 0.001 + Math.random() * 0.004;
  return valuationUsd * percentage;
}

/**
 * Get demo vaults for all private companies.
 * Generates simulated lending metrics.
 */
export async function getDemoVaults(): Promise<DemoVault[]> {
  const companies = await getPrivateCompanies();

  return companies
    .filter((company) => company.valuationUsd > 0)
    .map((company) => {
      const symbol = getSyntheticSymbol(company.name);
      const totalSupply = generateTotalSupply(company.valuationUsd);
      const utilizationRate = generateUtilizationRate();
      const totalBorrows = totalSupply * utilizationRate;
      const supplyApy = generateSupplyApy(company.valuationUsd);
      const borrowApy = generateBorrowApy(supplyApy, utilizationRate);

      return {
        symbol,
        name: company.name,
        companyId: company.id,
        valuationUsd: company.valuationUsd,
        website: company.website,
        totalSupply,
        totalBorrows,
        supplyApy,
        borrowApy,
        utilizationRate,
        isDemo: true as const,
      };
    })
    .sort((a, b) => b.valuationUsd - a.valuationUsd); // Sort by valuation descending
}

/**
 * Format demo vault metrics for display.
 */
export function formatDemoVaultSupply(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(2)}K`;
  }
  return `$${amount.toFixed(2)}`;
}

/**
 * Format APY as percentage.
 */
export function formatDemoApy(apy: number): string {
  return `${(apy * 100).toFixed(2)}%`;
}
