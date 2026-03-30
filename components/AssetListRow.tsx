"use client";

import { useRouter } from "next/navigation";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol, formatValuation } from "@/lib/vaulto/companies";
import { CompanyLogo } from "@/components/CompanyLogo";
import { MiniChart } from "@/components/MiniChart";
import {
  getDailyChange,
  getCurrentPrice,
  formatPrice,
  getValuationSparkline,
} from "@/lib/vaulto/companyUtils";

interface AssetListRowProps {
  company: PrivateCompany;
}

/**
 * List view row for an asset.
 * Chart shows real post-money valuation from funding history.
 */
export function AssetListRow({ company }: AssetListRowProps) {
  const router = useRouter();
  const symbol = getSyntheticSymbol(company.name);
  const price = getCurrentPrice(company);
  const { changePercent, isPositive } = getDailyChange(company);
  const sparklineData = getValuationSparkline(company, 30);

  return (
    <tr
      className="border-b border-border last:border-0 hover:bg-card-hover transition-colors cursor-pointer"
      onClick={() => router.push(`/mint/${company.id}`)}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <CompanyLogo name={company.name} website={company.website} size={32} />
          <div>
            <p className="text-sm font-semibold text-foreground">{symbol}</p>
            <p className="text-xs text-muted">{company.name}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <p className="text-sm font-semibold text-foreground">{formatPrice(price)}</p>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <span className={`text-[10px] ${isPositive ? "text-green" : "text-red"}`}>
            {isPositive ? "\u25B2" : "\u25BC"}
          </span>
          <span className={`text-sm font-medium ${isPositive ? "text-green" : "text-red"}`}>
            {changePercent.toFixed(2)}%
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <p className="text-sm text-muted">{formatValuation(company.valuationUsd)}</p>
      </td>
      <td className="py-3 px-4">
        <div className="flex justify-end">
          {sparklineData ? (
            <MiniChart
              data={sparklineData}
              width={100}
              height={32}
              isPositive={isPositive}
              strokeWidth={1.2}
              showGradient={false}
            />
          ) : (
            <span className="text-[10px] text-muted">--</span>
          )}
        </div>
      </td>
    </tr>
  );
}
