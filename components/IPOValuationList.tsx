"use client";

import { useState, useCallback } from "react";
import { IPOValuationCard } from "./IPOValuationCard";
import { ValuationBandTradeWidget } from "./ValuationBandTradeWidget";
import { IPOBandPositions } from "./IPOBandPositions";
import type { CompanyIPO, ValuationBand } from "@/lib/polymarket/ipo-valuations";

type IPOValuationListProps = {
  ipos: CompanyIPO[];
};

type TradeState = {
  ipo: CompanyIPO;
  band: ValuationBand;
  direction: "long" | "short";
} | null;

export function IPOValuationList({ ipos }: IPOValuationListProps) {
  const [tradeState, setTradeState] = useState<TradeState>(null);

  const handleTrade = useCallback(
    (ipo: CompanyIPO, band: ValuationBand, direction: "long" | "short") => {
      setTradeState({ ipo, band, direction });
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
          <IPOValuationCard key={ipo.companyId} ipo={ipo} onTrade={handleTrade} />
        ))}
      </div>

      {/* Trade Widget Modal */}
      {tradeState && (
        <ValuationBandTradeWidget
          ipo={tradeState.ipo}
          band={tradeState.band}
          direction={tradeState.direction}
          isOpen={true}
          onClose={handleCloseTrade}
        />
      )}
    </>
  );
}
