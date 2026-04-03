import { NextRequest, NextResponse } from "next/server";

export const revalidate = 300; // 5 minutes

const VAULTO_API_URL =
  process.env.NEXT_PUBLIC_VAULTO_API_URL || "https://api.vaulto.ai";

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

    const url = `${VAULTO_API_URL}/api/implied-valuations/${companySlug}`;

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

    const data = await res.json();
    return NextResponse.json(data);
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
