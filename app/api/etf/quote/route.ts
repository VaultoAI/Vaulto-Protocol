import { NextRequest, NextResponse } from "next/server";
import { fetchEtfQuote } from "@/lib/vaulto-api/etf";
import {
  isVaultoApiConfigured,
  getVaultoApiToken,
  getVaultoApiConfigError,
  getVaultoApiDebugInfo,
} from "@/lib/vaulto-api/config";

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

    // Check Vaulto API configuration
    if (!isVaultoApiConfigured()) {
      const errorMsg = getVaultoApiConfigError();
      console.error("[ETF Quote] Config error:", errorMsg, getVaultoApiDebugInfo());
      return NextResponse.json(
        {
          error: "Service temporarily unavailable",
          ...(process.env.NODE_ENV === "development" && { details: errorMsg }),
        },
        { status: 503 }
      );
    }

    const quote = await fetchEtfQuote(symbol, getVaultoApiToken());
    return NextResponse.json(quote);
  } catch (error) {
    console.error("[ETF Quote] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch quote" },
      { status: 500 }
    );
  }
}
