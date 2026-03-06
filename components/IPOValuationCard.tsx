"use client";

import { CompanyLogo } from "@/components/CompanyLogo";
import type { CompanyIPO, ValuationBand } from "@/lib/polymarket/ipo-valuations";
import {
  formatBandRange,
  formatValuationPrecise,
  getPolymarketEventUrl,
} from "@/lib/polymarket/ipo-valuations";

type IPOValuationCardProps = {
  ipo: CompanyIPO;
  onTrade: (ipo: CompanyIPO, band: ValuationBand, direction: "long" | "short") => void;
};

function ValuationBandRow({
  band,
  onTrade,
}: {
  band: ValuationBand;
  onTrade: (direction: "long" | "short") => void;
}) {
  const percentWidth = Math.min(100, Math.max(2, Math.round(band.probability * 100)));
  const probabilityText = `${(band.probability * 100).toFixed(1)}%`;

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Range label */}
      <span className="w-28 text-sm font-medium text-foreground" title={band.question}>
        {formatBandRange(band)}
      </span>

      {/* Probability bar */}
      <div className="flex-1 flex items-center gap-2">
        <div className="relative flex-1 h-6 rounded-full bg-muted/50 overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all ${
              band.probability >= 0.10
                ? "bg-green-500/80"
                : "bg-red-500/80"
            }`}
            style={{ width: `${percentWidth}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-foreground">
            {probabilityText}
          </span>
        </div>
      </div>

      {/* Trade buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onTrade("long")}
          className="px-3 py-1 text-xs font-medium rounded border border-green-500 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
          title="Bet Yes - IPO lands in this range"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onTrade("short")}
          className="px-3 py-1 text-xs font-medium rounded border border-red-500 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
          title="Bet No - IPO does NOT land in this range"
        >
          No
        </button>
      </div>
    </div>
  );
}

export function IPOValuationCard({ ipo, onTrade }: IPOValuationCardProps) {
  const sortedBands = [...ipo.bands].sort((a, b) => (a.lowThreshold ?? 0) - (b.lowThreshold ?? 0));
  const eventUrl = getPolymarketEventUrl(ipo.eventSlug);

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <CompanyLogo name={ipo.company} website={ipo.website} size={40} />
          <div>
            <h3 className="text-lg font-semibold">{ipo.company} IPO</h3>
            <a
              href={eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              View on Polymarket
            </a>
          </div>
        </div>
        {ipo.noIPOProbability !== undefined && (
          <div className="text-right">
            <p className="text-xs text-muted">No IPO probability</p>
            <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
              {(ipo.noIPOProbability * 100).toFixed(0)}%
            </p>
          </div>
        )}
      </div>

      {/* Valuation Summary */}
      <div className="px-4 py-3 grid grid-cols-2 gap-4 border-b border-border bg-muted/10">
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Expected IPO Value</p>
          <p className="mt-0.5 text-xl font-semibold text-blue-600 dark:text-blue-400">
            {formatValuationPrecise(ipo.expectedIPOValue)}
          </p>
          <p className="text-xs text-muted">(probability-weighted)</p>
        </div>
        {ipo.currentValuation && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">Current Valuation</p>
            <p className="mt-0.5 text-xl font-semibold">
              {formatValuationPrecise(ipo.currentValuation)}
            </p>
            <p className="text-xs text-muted">(via Vaulto)</p>
          </div>
        )}
      </div>

      {/* Valuation Bands */}
      <div className="px-4 py-3">
        <p className="text-xs text-muted uppercase tracking-wide mb-2">
          IPO Closing Market Cap Ranges
        </p>

        <div className="space-y-0.5">
          {sortedBands.map((band) => (
            <ValuationBandRow
              key={band.marketId}
              band={band}
              onTrade={(direction) => onTrade(ipo, band, direction)}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-end gap-4 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-500/80" />
            Yes = IPO lands here
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500/80" />
            No = IPO doesn&apos;t land here
          </span>
        </div>
      </div>
    </div>
  );
}
