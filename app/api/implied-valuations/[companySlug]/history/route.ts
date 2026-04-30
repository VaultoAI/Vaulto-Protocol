import { NextRequest, NextResponse } from "next/server";
import {
  filterValidHistoryPoints,
  type ImpliedValuationHistoryResponse,
} from "@/lib/polymarket/implied-valuations";

export const revalidate = 300; // 5 minutes

const IMPLIED_VALUATIONS_API_URL =
  process.env.NEXT_PUBLIC_IMPLIED_VALUATIONS_API_URL ||
  process.env.NEXT_PUBLIC_VAULTO_API_URL ||
  "https://api.vaulto.ai";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companySlug: string }> }
) {
  try {
    const { companySlug } = await params;
    const apiKey = process.env.VAULTO_API_TOKEN;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API configuration" },
        { status: 500 }
      );
    }

    // Get range from query params
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get("range") || "ALL";

    const url = `${IMPLIED_VALUATIONS_API_URL}/api/implied-valuations/${companySlug}/history?range=${range}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(
        `Implied valuations API error: ${res.status} ${res.statusText}`,
        errorText
      );
      return NextResponse.json(
        {
          error: `Failed to fetch implied valuation history: ${res.status}`,
          upstreamUrl: url,
          upstreamError: errorText.slice(0, 500),
        },
        { status: res.status }
      );
    }

    const data = (await res.json()) as ImpliedValuationHistoryResponse;

    // Filter out invalid/extreme valuations before returning to client
    const originalCount = data.history?.length ?? 0;
    const filteredHistory = filterValidHistoryPoints(data.history ?? [], {
      logWarnings: true,
      companySlug,
    });

    // Return filtered data with updated dataPoints count
    return NextResponse.json({
      ...data,
      history: filteredHistory,
      dataPoints: filteredHistory.length,
      _filteredCount: originalCount - filteredHistory.length, // For debugging
    });
  } catch (err) {
    console.error("Failed to fetch implied valuation history:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to fetch implied valuation history",
        errorType: err instanceof Error ? err.name : "Unknown",
      },
      { status: 500 }
    );
  }
}
