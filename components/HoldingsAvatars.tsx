"use client";

import { useEffect, useState } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";
import type { IndexHolding } from "@/lib/vaulto/indexes";
import type { PrivateCompany } from "@/lib/vaulto/companies";

interface HoldingsAvatarsProps {
  holdings: IndexHolding[];
  companies: PrivateCompany[];
  maxVisible?: number;
  size?: number;
  indexSymbol?: string;
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isMobile;
}

/**
 * Renders overlapping company logos for index holdings.
 * Skips cash equivalents (no logo to show).
 */
export function HoldingsAvatars({
  holdings,
  companies,
  maxVisible = 5,
  size = 24,
  indexSymbol,
}: HoldingsAvatarsProps) {
  const isMobile = useIsMobile();

  // Filter out cash holdings and take top N by weight
  const visibleHoldings = holdings
    .filter((h) => !h.isCash)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxVisible);

  // Mobile-only reorder for RVI: move Mercor to end, Airwallex just before Mercor.
  if (isMobile && indexSymbol === "RVI") {
    const mercor = visibleHoldings.find((h) => h.companyName === "Mercor");
    const airwallex = visibleHoldings.find((h) => h.companyName === "Airwallex");
    if (mercor && airwallex) {
      const rest = visibleHoldings.filter(
        (h) => h.companyName !== "Mercor" && h.companyName !== "Airwallex"
      );
      visibleHoldings.length = 0;
      visibleHoldings.push(...rest, airwallex, mercor);
    }
  }

  // Find company data for each holding
  const holdingsWithCompany = visibleHoldings
    .map((holding) => {
      const company = companies.find(
        (c) => c.name.toLowerCase() === holding.companyName.toLowerCase()
      );
      return { holding, company };
    })
    .filter((item) => item.company !== undefined);

  if (holdingsWithCompany.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center">
      {holdingsWithCompany.map(({ holding, company }, index) => (
        <div
          key={holding.companyName}
          className="rounded-full border-2 border-background bg-background"
          style={{
            marginLeft: index === 0 ? 0 : -8,
            zIndex: maxVisible - index,
          }}
        >
          <CompanyLogo
            name={company!.name}
            website={company!.website}
            size={size}
          />
        </div>
      ))}
    </div>
  );
}
