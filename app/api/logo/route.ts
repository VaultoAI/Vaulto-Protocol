import { NextRequest, NextResponse } from "next/server";

/**
 * API route to proxy favicon requests from Google Favicon API.
 * This avoids CORS issues by fetching server-side.
 *
 * Usage: /api/logo?domain=openai.com
 *
 * IMPORTANT: Uses CDN-Cache-Control for edge caching with proper cache key.
 * The Vary header ensures each domain gets its own cached response.
 */

const CACHE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const CACHE_STALE_WHILE_REVALIDATE = 60 * 60 * 24 * 30; // 30 days

// Force dynamic rendering to ensure query params are always read
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");

  if (!domain) {
    return NextResponse.json({ error: "Missing domain parameter" }, { status: 400 });
  }

  // Validate domain format (basic check)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: "Invalid domain format" }, { status: 400 });
  }

  try {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;

    const response = await fetch(faviconUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VaultoBot/1.0)",
      },
      // Don't cache on the server side - let the CDN/browser handle it
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch favicon" },
        { status: response.status }
      );
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/png";

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Browser caching only - don't let CDN cache without proper key
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE}`,
        // Netlify CDN cache with domain as key
        "Netlify-CDN-Cache-Control": `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE}, durable`,
        // Cache key varies by the full URL including query string
        "Netlify-Vary": "query",
      },
    });
  } catch (error) {
    console.error("Logo proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch favicon" },
      { status: 500 }
    );
  }
}
