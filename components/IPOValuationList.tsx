"use client";

import { useState, useCallback } from "react";
import { IPOValuationCard } from "./IPOValuationCard";
import { IPOBandPositions } from "./IPOBandPositions";
import { IPOOverallTradeWidget } from "./IPOOverallTradeWidget";
import type { CompanyIPO } from "@/lib/polymarket/ipo-valuations";

type IPOValuationListProps = {
  ipos: CompanyIPO[];
};

type TradeState = {
  ipo: CompanyIPO;
  direction: "long" | "short";
} | null;

export function IPOValuationList({ ipos }: IPOValuationListProps) {
  const [tradeState, setTradeState] = useState<TradeState>(null);

  const handleTrade = useCallback(
    (ipo: CompanyIPO, direction: "long" | "short") => {
      setTradeState({ ipo, direction });
    },
    []
  );


  const handleCloseTrade = useCallback(() => {
    setTradeState(null);
  }, []);

  return (
    <>
      {/* User Positions */}
      <IPOBandPositions ipos={ipos} />

      {/* IPO Cards */}
      <div className="mt-6 space-y-6">
        {ipos.map((ipo) => (
          <IPOValuationCard key={ipo.eventSlug} ipo={ipo} onTrade={handleTrade} />
        ))}
      </div>

      {/* Trade Widget Modal */}
      {tradeState && (
        <IPOOverallTradeWidget
          ipo={tradeState.ipo}
          direction={tradeState.direction}
          isOpen={true}
          onClose={handleCloseTrade}
        />
      )}
    </>
  );
}
