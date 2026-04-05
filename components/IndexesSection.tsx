"use client";

import Link from "next/link";
import type { VaultoIndex, IndexPricesMap } from "@/lib/vaulto/indexes";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { HoldingsAvatars } from "@/components/HoldingsAvatars";
import { getIndexPrice, getIndexChange } from "@/lib/vaulto/indexes";
import { formatPrice } from "@/lib/vaulto/companyUtils";

interface IndexesSectionProps {
  indexes: VaultoIndex[];
  companies: PrivateCompany[];
  indexPrices?: IndexPricesMap;
}

/**
 * Section displaying index products in a two-column layout with vertical divider.
 * Styled to match the ExploreTopSection design.
 */
export function IndexesSection({ indexes, companies, indexPrices = {} }: IndexesSectionProps) {
  if (indexes.length === 0) {
    return null;
  }

  return (
    <div className="py-6">
      {/* Title */}
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-base font-semibold text-foreground">Index Products</h2>
        <span className="inline-flex items-center rounded-md bg-badge-bg px-2 py-0.5 text-[11px] font-medium text-badge-text">
          NEW
        </span>
      </div>

      {/* Index items in two columns with vertical divider */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {indexes.map((index, i) => (
          <IndexItem
            key={index.id}
            index={index}
            companies={companies}
            priceData={indexPrices[index.symbol]}
            hasBorderLeft={i > 0}
            isFirst={i === 0}
          />
        ))}
      </div>
    </div>
  );
}

interface IndexItemProps {
  index: VaultoIndex;
  companies: PrivateCompany[];
  priceData?: { price: number | null; changePercent: number | null };
  hasBorderLeft?: boolean;
  isFirst?: boolean;
}

function IndexItem({ index, companies, priceData, hasBorderLeft, isFirst }: IndexItemProps) {
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
    <div className={`${hasBorderLeft ? "md:pl-8 md:border-l md:border-border" : ""} ${isFirst ? "md:pr-8" : ""}`}>
      {/* Index item row */}
      <Link
        href={`/explore/index/${index.symbol.toLowerCase()}`}
        className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity"
      >
        {/* Holdings avatars as the "logo" */}
        <HoldingsAvatars
          holdings={index.holdings}
          companies={companies}
          maxVisible={4}
          size={36}
        />

        {/* Name - takes remaining space */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground leading-tight">{index.symbol}</p>
          <p className="text-xs text-muted leading-tight truncate">{index.name}</p>
        </div>

        {/* Price + change - fixed width, right-aligned */}
        <div className="flex flex-col items-end shrink-0 w-[90px]">
          <p className="text-sm font-semibold text-foreground tabular-nums">{formatPrice(price)}</p>
          <span className={`text-xs font-medium ${isPositive ? "text-green" : "text-red"}`}>
            <span className="text-[10px] mr-0.5">{isPositive ? "\u25B2" : "\u25BC"}</span>
            {changePercent.toFixed(2)}%
          </span>
        </div>
      </Link>
    </div>
  );
}
