import { NextResponse } from "next/server";

export const revalidate = 300; // 5 minutes

const IMPLIED_VALUATIONS_API_URL =
  process.env.NEXT_PUBLIC_IMPLIED_VALUATIONS_API_URL ||
  process.env.NEXT_PUBLIC_VAULTO_API_URL ||
  "https://api.vaulto.ai";

export async function GET() {
  try {
    const apiKey = process.env.VAULTO_API_TOKEN;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API configuration" },
        { status: 500 }
      );
    }

    const url = `${IMPLIED_VALUATIONS_API_URL}/api/implied-valuations`;

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
        { error: `Failed to fetch all implied valuations: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to fetch all implied valuations:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to fetch all implied valuations",
      },
      { status: 500 }
    );
  }
}
