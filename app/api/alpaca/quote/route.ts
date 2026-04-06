import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getQuote, isValidEtfSymbol, isEtfFractionable, type EtfSymbol } from "@/lib/alpaca";

/**
 * GET /api/alpaca/quote?symbol=RVI
 *
 * Fetch real-time quote for an ETF from Alpaca.
 * Returns bid/ask prices, spread, and market status.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get symbol from query params
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.toUpperCase();

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing symbol parameter" },
        { status: 400 }
      );
    }

    if (!isValidEtfSymbol(symbol)) {
      return NextResponse.json(
        { error: `Invalid ETF symbol: ${symbol}. Supported: RVI, VCX` },
        { status: 400 }
      );
    }

    // Fetch quote from Alpaca
    const quote = await getQuote(symbol as EtfSymbol);

    return NextResponse.json({
      ...quote,
      fractionable: isEtfFractionable(symbol),
    });
  } catch (error) {
    console.error("[Alpaca Quote] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch quote" },
      { status: 500 }
    );
  }
}
