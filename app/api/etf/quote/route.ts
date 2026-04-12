import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/alpaca/client";
import { isValidEtfSymbol, isEtfFractionable } from "@/lib/alpaca/constants";
import type { EtfSymbol } from "@/lib/alpaca/constants";

/**
 * GET /api/etf/quote?symbol=RVI
 *
 * Vaulto API route — fetches real-time ETF quotes via Alpaca.
 */
export async function GET(request: NextRequest) {
  try {
    const symbol = request.nextUrl.searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing symbol parameter" },
        { status: 400 }
      );
    }

    if (!isValidEtfSymbol(symbol)) {
      return NextResponse.json(
        { error: `Invalid ETF symbol: ${symbol}` },
        { status: 400 }
      );
    }

    const quote = await getQuote(symbol.toUpperCase() as EtfSymbol);

    return NextResponse.json({
      symbol: quote.symbol,
      askPrice: quote.askPrice,
      bidPrice: quote.bidPrice,
      midPrice: quote.midPrice,
      spread: quote.spread,
      spreadPercent: quote.spreadPercent,
      fractionable: isEtfFractionable(symbol),
      marketStatus: quote.marketStatus,
      timestamp: quote.timestamp,
    });
  } catch (error) {
    console.error("[ETF Quote] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch quote" },
      { status: 500 }
    );
  }
}
