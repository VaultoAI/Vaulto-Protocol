"use client";

import { HoldingsAvatars } from "@/components/HoldingsAvatars";
import type { VaultoIndex, IndexPriceData } from "@/lib/vaulto/indexes";
import { getIndexPrice, getIndexChange } from "@/lib/vaulto/indexes";
import { formatPrice } from "@/lib/vaulto/companyUtils";
import type { PrivateCompany } from "@/lib/vaulto/companies";

interface IndexCardProps {
  index: VaultoIndex;
  companies: PrivateCompany[];
  priceData?: IndexPriceData;
}

/**
 * Professional card for displaying an index product.
 * Shows: symbol, name, issuer, holdings logos, price, and daily change.
 * Uses real-time price data from API when available, falls back to calculated values.
 */
export function IndexCard({ index, companies, priceData }: IndexCardProps) {
  // Use real price data if available, otherwise calculate from holdings
  const hasRealData = priceData?.price != null;

  const price = hasRealData
    ? priceData.price!
    : getIndexPrice(index, companies);

  const changePercent = hasRealData && priceData.changePercent != null
    ? Math.abs(priceData.changePercent)
    : getIndexChange(index, companies).changePercent;

  const isPositive = hasRealData && priceData.changePercent != null
    ? priceData.changePercent >= 0
    : getIndexChange(index, companies).isPositive;

  // Count non-cash holdings
  const holdingsCount = index.holdings.filter((h) => !h.isCash).length;

  return (
    <div className="rounded-xl border border-border bg-background p-5 hover:bg-card-hover transition-colors">
      {/* Top row: Symbol/Name and Issuer badge */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{index.symbol}</h3>
          <p className="text-sm text-muted mt-0.5">{index.name}</p>
        </div>
        <span className="inline-flex items-center rounded-md bg-badge-bg px-2.5 py-1 text-xs font-medium text-badge-text">
          {index.issuer}
        </span>
      </div>

      {/* Holdings avatars */}
      <div className="flex items-center gap-3 mb-4">
        <HoldingsAvatars
          holdings={index.holdings}
          companies={companies}
          maxVisible={6}
          size={28}
        />
        <span className="text-xs text-muted">
          {holdingsCount} holdings
        </span>
      </div>

      {/* Bottom row: Price and Change */}
      <div className="flex items-end justify-between pt-3 border-t border-border">
        <div>
          <p className="text-xs text-muted mb-0.5">Index Price</p>
          <p className="text-xl font-semibold text-foreground tabular-nums">
            {formatPrice(price)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted mb-0.5">24h Change</p>
          <span
            className={`text-base font-semibold ${
              isPositive ? "text-green" : "text-red"
            }`}
          >
            <span className="text-xs mr-0.5">
              {isPositive ? "\u25B2" : "\u25BC"}
            </span>
            {changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}
