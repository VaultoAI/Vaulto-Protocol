import { NextRequest, NextResponse } from "next/server";
import { fetchEtfQuote } from "@/lib/vaulto-api/etf";

const VAULTO_API_KEY = process.env.VAULTO_API_KEY || "";

/**
 * GET /api/etf/quote?symbol=RVI
 *
 * Proxy to Vaulto-API for ETF quotes.
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

    if (!VAULTO_API_KEY) {
      return NextResponse.json(
        { error: "API not configured" },
        { status: 500 }
      );
    }

    const quote = await fetchEtfQuote(symbol, VAULTO_API_KEY);
    return NextResponse.json(quote);
  } catch (error) {
    console.error("[ETF Quote] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch quote" },
      { status: 500 }
    );
  }
}
