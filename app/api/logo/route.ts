import { NextRequest, NextResponse } from "next/server";

/**
 * API route to proxy favicon requests from Google Favicon API.
 * Avoids CORS by fetching server-side. Adds per-process memory cache
 * so a cold page load with many logos doesn't hammer Google for each.
 */

const CACHE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const CACHE_STALE_WHILE_REVALIDATE = 60 * 60 * 24 * 30; // 30 days
const MEMORY_TTL_MS = 1000 * 60 * 60 * 24; // 24h in-process

type CachedLogo = { buffer: ArrayBuffer; contentType: string; expires: number };
const memoryCache = new Map<string, CachedLogo>();
const inflight = new Map<string, Promise<CachedLogo>>();

async function fetchFromGoogle(domain: string): Promise<CachedLogo> {
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  const response = await fetch(faviconUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; VaultoBot/1.0)" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Google favicon ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "image/png";
  return { buffer, contentType, expires: Date.now() + MEMORY_TTL_MS };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");

  if (!domain) {
    return NextResponse.json({ error: "Missing domain parameter" }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: "Invalid domain format" }, { status: 400 });
  }

  try {
    let entry = memoryCache.get(domain);
    if (!entry || entry.expires < Date.now()) {
      let pending = inflight.get(domain);
      if (!pending) {
        pending = fetchFromGoogle(domain).finally(() => inflight.delete(domain));
        inflight.set(domain, pending);
      }
      entry = await pending;
      memoryCache.set(domain, entry);
    }

    return new NextResponse(entry.buffer, {
      status: 200,
      headers: {
        "Content-Type": entry.contentType,
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE}, immutable`,
        "Netlify-CDN-Cache-Control": `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE}, durable`,
        "Netlify-Vary": "query",
      },
    });
  } catch (error) {
    console.error("Logo proxy error:", error);
    return NextResponse.json({ error: "Failed to fetch favicon" }, { status: 500 });
  }
}
