"use client";

import { useState, useEffect } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import {
  getCurrentPrice,
  formatPrice,
  isIpoOnlyCompany,
  IPO_ONLY_DEFAULT_PRICE,
  IPO_ONLY_BASE_VALUATION,
} from "@/lib/vaulto/companyUtils";
import {
  getImpliedValuationSlug,
} from "@/lib/polymarket/implied-valuations";

interface DynamicPriceProps {
  company: PrivateCompany;
  className?: string;
}

/**
 * Displays the price for a company.
 * For IPO-only companies, fetches the current implied valuation and scales the price.
 */
export function DynamicPrice({ company, className }: DynamicPriceProps) {
  const basePrice = getCurrentPrice(company);
  const isIpoOnly = isIpoOnlyCompany(company);
  const ipoSlug = isIpoOnly ? getImpliedValuationSlug(company.name) : null;

  const [adjustedPrice, setAdjustedPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isIpoOnly || !ipoSlug || adjustedPrice !== null || loading) return;

    setLoading(true);
    fetch(`/api/implied-valuations/${ipoSlug}/history?range=ALL`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.history && data.history.length > 0) {
          const currentValuation = data.history[data.history.length - 1].value;
          const price = IPO_ONLY_DEFAULT_PRICE * (currentValuation / IPO_ONLY_BASE_VALUATION);
          setAdjustedPrice(price);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isIpoOnly, ipoSlug, adjustedPrice, loading]);

  const displayPrice = isIpoOnly && adjustedPrice !== null ? adjustedPrice : basePrice;

  return (
    <span className={className}>
      {formatPrice(displayPrice)}
    </span>
  );
}
