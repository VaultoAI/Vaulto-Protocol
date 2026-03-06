"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getIPOBandPositions,
  sellIPOBandPosition,
  calculatePositionValue,
  type IPOBandPosition,
} from "@/lib/polymarket/demo-trading";
import type { CompanyIPO } from "@/lib/polymarket/ipo-valuations";

type PositionsProps = {
  ipos: CompanyIPO[];
};

export function IPOBandPositions({ ipos }: PositionsProps) {
  const [positions, setPositions] = useState<IPOBandPosition[]>([]);
  const [selling, setSelling] = useState<string | null>(null);

  // Refresh positions on mount and after any updates
  const refreshPositions = useCallback(() => {
    setPositions(getIPOBandPositions(ipos));
  }, [ipos]);

  useEffect(() => {
    refreshPositions();
    // Poll for updates every 2 seconds
    const interval = setInterval(refreshPositions, 2000);
    return () => clearInterval(interval);
  }, [refreshPositions]);

  const handleSell = useCallback(async (position: IPOBandPosition) => {
    const ipo = ipos.find((i) => i.company === position.company);
    if (!ipo) return;

    // Find the band by matching the question
    const band = ipo.bands.find((b) => b.question === position.question);
    if (!band) return;

    setSelling(position.symbol);
    await sellIPOBandPosition({
      ipo,
      band,
      direction: position.direction,
      shares: position.shares,
    });
    refreshPositions();
    setSelling(null);
  }, [ipos, refreshPositions]);

  if (positions.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium">Your IPO Positions</h2>
      <div className="mt-3 overflow-x-auto border border-border rounded-md">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 px-4 font-medium">Position</th>
              <th className="py-3 px-4 font-medium text-muted">Outcome</th>
              <th className="py-3 px-4 font-medium text-muted">Range</th>
              <th className="py-3 px-4 font-medium text-muted">Shares</th>
              <th className="py-3 px-4 font-medium text-muted">Current Value</th>
              <th className="py-3 px-4 font-medium text-muted">Potential Payout</th>
              <th className="px-4 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const currentValue = calculatePositionValue(position.shares, position.currentPrice);
              const potentialPayout = position.shares;
              const isYes = position.direction === "long";

              return (
                <tr key={position.symbol} className="border-b border-border last:border-0">
                  <td className="py-3 px-4">
                    <p className="font-medium text-sm">{position.company} IPO</p>
                    <p className="text-xs text-muted mt-0.5">{position.symbol}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        isYes
                          ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                      }`}
                    >
                      {isYes ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {position.bandRange}
                  </td>
                  <td className="py-3 px-4 text-muted">{position.shares.toFixed(2)}</td>
                  <td className="py-3 px-4 text-muted">${currentValue.toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <span className={`font-medium ${
                      isYes ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}>
                      ${potentialPayout.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSell(position)}
                      disabled={selling === position.symbol}
                      className="inline-block rounded border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/50 disabled:opacity-50"
                    >
                      {selling === position.symbol ? "Selling..." : "Sell"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
