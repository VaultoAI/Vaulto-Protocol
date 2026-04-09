import { NextResponse } from "next/server";
import {
  isVaultoApiConfigured,
  getVaultoApiToken,
  getVaultoApiUrl,
  getVaultoApiDebugInfo,
} from "@/lib/vaulto-api/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/vaulto
 *
 * Debug endpoint to test Vaulto API connectivity.
 * Returns detailed error information for troubleshooting.
 */
export async function GET() {
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    config: getVaultoApiDebugInfo(),
    configured: isVaultoApiConfigured(),
  };

  if (!isVaultoApiConfigured()) {
    return NextResponse.json({
      ...debug,
      error: "Vaulto API not configured",
    }, { status: 503 });
  }

  // Try to fetch a quote
  const url = `${getVaultoApiUrl()}/api/etf/quote?symbol=RVI`;
  debug.testUrl = url;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": getVaultoApiToken(),
      },
    });

    debug.responseStatus = response.status;
    debug.responseStatusText = response.statusText;
    debug.responseHeaders = Object.fromEntries(response.headers.entries());

    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      const data = await response.json();
      debug.responseBody = data;
    } else {
      const text = await response.text();
      debug.responseBody = text.slice(0, 1000);
      debug.responseContentType = contentType;
    }

    if (!response.ok) {
      return NextResponse.json({
        ...debug,
        error: `Vaulto API returned ${response.status}`,
      }, { status: 502 });
    }

    return NextResponse.json({
      ...debug,
      success: true,
    });
  } catch (error) {
    debug.fetchError = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 5),
    } : String(error);

    return NextResponse.json({
      ...debug,
      error: "Failed to connect to Vaulto API",
    }, { status: 500 });
  }
}
