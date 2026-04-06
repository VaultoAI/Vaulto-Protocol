import { NextRequest, NextResponse } from "next/server";

export const revalidate = 30; // 30 seconds cache

const VAULTO_API_URL =
  process.env.NEXT_PUBLIC_VAULTO_API_URL || "https://api.vaulto.ai";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const apiKey = process.env.VAULTO_API_TOKEN;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API configuration" },
        { status: 500 }
      );
    }

    const url = `${VAULTO_API_URL}/api/prestock/${address}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(
        `Prestock API error: ${res.status} ${res.statusText}`,
        errorText
      );
      return NextResponse.json(
        { error: `Failed to fetch prestock price: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to fetch prestock price:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch prestock price",
      },
      { status: 500 }
    );
  }
}
