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
  onTrade?: (ipo: CompanyIPO, direction: "long" | "short") => void;
};

function ValuationBandRow({
  band,
}: {
  band: ValuationBand;
}) {
  const percentWidth = Math.min(100, Math.max(2, Math.round(band.probability * 100)));
  const probabilityText = `${(band.probability * 100).toFixed(1)}%`;
  const isHighProbability = band.probability >= 0.10;

  return (
    <div className="flex items-center gap-2 py-2 sm:gap-3">
      {/* Range label - fixed width so all bars align on the same vertical axis */}
      <span
        className="w-[7rem] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-foreground sm:text-sm"
        title={band.question}
      >
        {formatBandRange(band)}
      </span>

      {/* Probability bar - less rounding, mobile-optimized */}
      <div className="min-w-0 flex-1 flex items-center">
        <div className="relative flex-1 h-7 min-w-[3rem] rounded-sm overflow-hidden sm:h-6 sm:min-w-[4rem] sm:rounded">
          <div
            className="absolute inset-y-0 left-0 rounded-sm transition-all sm:rounded"
            style={{
              width: `${percentWidth}%`,
              backgroundColor: isHighProbability ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)',
            }}
          />
          <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-medium text-foreground">
            {probabilityText}
          </span>
        </div>
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
      <div className="flex items-center px-4 py-3 border-b border-border bg-muted/20">
        {/* Left: Logo + Name */}
        <div className="flex items-center gap-3 flex-shrink-0">
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

        {/* Right: Trade Buttons */}
        {onTrade && (
          <div className="flex-1 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onTrade(ipo, "long")}
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
              className="px-6 py-2 text-sm font-bold rounded-full text-white shadow-[0_0_12px_rgba(34,197,94,0.4)] hover:shadow-[0_0_20px_rgba(34,197,94,0.6)] hover:scale-105 active:scale-95 transition-all duration-200"
            >
              ▲ Long
            </button>
            <button
              type="button"
              onClick={() => onTrade(ipo, "short")}
              style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
              className="px-6 py-2 text-sm font-bold rounded-full text-white shadow-[0_0_12px_rgba(239,68,68,0.4)] hover:shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:scale-105 active:scale-95 transition-all duration-200"
            >
              ▼ Short
            </button>
          </div>
        )}

      </div>

      {/* Valuation Summary */}
      <div className="px-4 py-3 flex flex-wrap items-start gap-8 border-b border-border bg-muted/10">
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
        {ipo.noIPOProbability !== undefined && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">No IPO Probability</p>
            <p className="mt-0.5 text-xl font-semibold text-orange-600 dark:text-orange-400">
              {(ipo.noIPOProbability * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted">&nbsp;</p>
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
            />
          ))}
        </div>

      </div>
    </div>
  );
}
