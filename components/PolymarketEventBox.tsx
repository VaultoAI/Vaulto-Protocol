"use client";

import { useState } from "react";
import { getProxiedFaviconUrl } from "@/lib/utils/companyLogo";
import { usePredictionMarketData } from "@/hooks/usePredictionMarketData";
import { getPolymarketEventUrl } from "@/lib/polymarket/ipo-valuations";

interface PolymarketEventBoxProps {
  eventSlug: string;
}

/**
 * Standalone Polymarket event link box.
 * Displays the event name with Polymarket branding and an external link.
 */
export function PolymarketEventBox({ eventSlug }: PolymarketEventBoxProps) {
  const { data } = usePredictionMarketData(eventSlug);
  const [logoError, setLogoError] = useState(false);
  const polymarketLogoUrl = getProxiedFaviconUrl("polymarket.com");
  const eventUrl = getPolymarketEventUrl(eventSlug);

  return (
    <a
      href={eventUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 hover:border-blue-400 dark:hover:border-blue-600 transition-colors group"
    >
      <div className="flex items-center gap-2">
        {logoError ? (
          <span className="w-5 h-5 rounded bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
            P
          </span>
        ) : (
          <img
            src={polymarketLogoUrl}
            alt="Polymarket"
            width={20}
            height={20}
            className="w-5 h-5 rounded object-cover"
            onError={() => setLogoError(true)}
          />
        )}
        <div>
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {data?.event.name || "Polymarket Event"}
          </span>
          <p className="text-xs text-blue-600/70 dark:text-blue-400/70">IPO Market Cap</p>
        </div>
      </div>
      <svg
        className="w-4 h-4 text-blue-400 dark:text-blue-500 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    </a>
  );
}
