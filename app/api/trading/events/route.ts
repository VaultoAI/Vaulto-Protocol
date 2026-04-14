import { NextResponse } from "next/server";

export const revalidate = 300; // 5 minutes

const VAULTO_API_URL =
  process.env.NEXT_PUBLIC_VAULTO_API_URL || "https://api.vaulto.ai";

export interface PredictionMarketEvent {
  slug: string;
  name: string;
  company: string;
  numBands: number;
  totalVolume: number;
  endDate: string;
}

/**
 * Fetches all available prediction market events from Vaulto API.
 * Returns a list of companies with active prediction markets.
 */
export async function GET() {
  try {
    const apiKey = process.env.VAULTO_API_TOKEN;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API configuration" },
        { status: 500 }
      );
    }

    const url = `${VAULTO_API_URL}/api/trading/events`;

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
        `Trading events API error: ${res.status} ${res.statusText}`,
        errorText
      );
      return NextResponse.json(
        { error: `Failed to fetch trading events: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to fetch trading events:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to fetch trading events",
      },
      { status: 500 }
    );
  }
}
