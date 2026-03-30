"use client";

import Link from "next/link";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { formatValuation, formatPricePerShare, getSyntheticSymbol } from "@/lib/vaulto/companies";
import { getDailyChange } from "@/lib/vaulto/companyUtils";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Sparkline } from "@/components/Sparkline";

interface AssetListRowProps {
  company: PrivateCompany;
}

/**
 * Asset list row component for table view in Explore Assets.
 * Displays company info in a horizontal table row format.
 */
export function AssetListRow({ company }: AssetListRowProps) {
  const symbol = getSyntheticSymbol(company.name);
  const dailyChange = getDailyChange(company);
  const isPositive = dailyChange >= 0;

  return (
    <tr className="border-b border-border last:border-0 transition-colors hover:bg-card-hover">
      {/* Asset (Logo + Name + Symbol) */}
      <td className="py-4 px-4">
        <Link href={`/mint/${company.id}`} className="flex items-center gap-3 min-w-0">
          <CompanyLogo name={company.name} website={company.website} size={36} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{company.name}</p>
            <p className="text-xs text-muted">{symbol}</p>
          </div>
        </Link>
      </td>

      {/* Price */}
      <td className="py-4 px-4 text-right">
        <p className="text-sm font-medium text-foreground">
          {formatPricePerShare(company.lastFundingEstPricePerShareUsd)}
        </p>
        <p
          className={`text-xs font-medium ${
            isPositive ? "text-green" : "text-red"
          }`}
        >
          {isPositive ? "+" : ""}
          {dailyChange.toFixed(2)}%
        </p>
      </td>

      {/* Last Round */}
      <td className="py-4 px-4 text-right">
        <p className="text-sm text-muted">{company.lastFundingRoundType}</p>
        <p className="text-xs text-muted">{company.lastFundingDate}</p>
      </td>

      {/* Valuation */}
      <td className="py-4 px-4 text-right">
        <p className="text-sm font-medium text-foreground">
          {formatValuation(company.valuationUsd)}
        </p>
      </td>

      {/* Chart */}
      <td className="py-4 px-4">
        <div className="flex justify-end">
          <Sparkline
            company={company}
            width={80}
            height={32}
            color={isPositive ? "#22c55e" : "#ef4444"}
          />
        </div>
      </td>
    </tr>
  );
}
