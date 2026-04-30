import { NextRequest, NextResponse } from "next/server";
import {
  fetchPolymarketEndDate,
  IPO_MARKET_END_DATES,
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

    const url = `${IMPLIED_VALUATIONS_API_URL}/api/implied-valuations/${companySlug}`;

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
        { error: `Failed to fetch implied valuation: ${res.status}` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as { endDate?: string | null };
    let endDate = data.endDate ?? null;
    if (!endDate) {
      endDate =
        (await fetchPolymarketEndDate(companySlug)) ??
        IPO_MARKET_END_DATES[companySlug] ??
        null;
    }
    return NextResponse.json({ ...data, endDate });
  } catch (err) {
    console.error("Failed to fetch implied valuation:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to fetch implied valuation",
      },
      { status: 500 }
    );
  }
}
