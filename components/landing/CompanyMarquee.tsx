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
    <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3 md:gap-4 mr-10 sm:mr-14 md:mr-20">
      <CompanyLogo name={company} size={32} className="sm:w-10 sm:h-10 md:w-11 md:h-11" />
      <span
        className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold tracking-tight text-[var(--foreground)]"
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
  return (
    <div
      className="animate-fade-in-up animation-delay-600 absolute bottom-16 sm:bottom-20 lg:bottom-24 left-0 right-0 z-10 overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0%, transparent 5%, black 25%, black 75%, transparent 95%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, transparent 5%, black 25%, black 75%, transparent 95%, transparent 100%)",
      }}
    >
      <div className="flex whitespace-nowrap">
        {/* Two identical strips side by side - creates seamless infinite loop */}
        <div className="flex animate-marquee">
          {MARQUEE_COMPANIES.map((company, i) => (
            <MarqueeItem key={`a-${company}-${i}`} company={company} />
          ))}
        </div>
        <div className="flex animate-marquee" aria-hidden="true">
          {MARQUEE_COMPANIES.map((company, i) => (
            <MarqueeItem key={`b-${company}-${i}`} company={company} />
          ))}
        </div>
      </div>
    </div>
  );
});
