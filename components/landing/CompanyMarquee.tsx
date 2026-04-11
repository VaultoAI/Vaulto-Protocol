"use client";

import React, { memo } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";

const MARQUEE_COMPANIES = [
  "SpaceX",
  "Anthropic",
  "OpenAI",
  "Anduril",
  "Databricks",
  "Stripe",
  "Kalshi",
  "Polymarket",
  "Figma",
  "Discord",
  "Canva",
  "Plaid",
];

/**
 * Memoized marquee item to isolate logo state changes
 * from affecting the parent marquee animation
 */
const MarqueeItem = memo(function MarqueeItem({ company }: { company: string }) {
  return (
    <div className="flex flex-shrink-0 items-center gap-4 mr-20">
      <CompanyLogo name={company} size={44} />
      <span
        className="text-xl font-semibold tracking-tight text-[var(--foreground)]"
        style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
      >
        {company}
      </span>
    </div>
  );
});

/**
 * Isolated marquee component with GPU-accelerated animation
 * Wrapped in React.memo to prevent parent re-renders from affecting it
 */
export const CompanyMarquee = memo(function CompanyMarquee() {
  // Create a static list of items - no dynamic rendering
  const items = [...MARQUEE_COMPANIES, ...MARQUEE_COMPANIES];

  return (
    <div
      className="absolute bottom-24 left-0 right-0 z-10 overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0%, transparent 5%, black 25%, black 75%, transparent 95%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, transparent 5%, black 25%, black 75%, transparent 95%, transparent 100%)",
      }}
    >
      <div className="flex animate-marquee whitespace-nowrap">
        {items.map((company, i) => (
          <MarqueeItem key={`${company}-${i}`} company={company} />
        ))}
      </div>
    </div>
  );
});
