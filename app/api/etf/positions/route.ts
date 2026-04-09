import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { fetchEtfPositions } from "@/lib/vaulto-api/etf";
import {
  isVaultoApiConfigured,
  getVaultoApiToken,
  getVaultoApiConfigError,
  getVaultoApiDebugInfo,
} from "@/lib/vaulto-api/config";

/**
 * GET /api/etf/positions
 *
 * Proxy to Vaulto-API for fetching user's ETF positions.
 */
export async function GET() {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;
    const db = getDb();

    // Get user
    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check Vaulto API configuration
    if (!isVaultoApiConfigured()) {
      const errorMsg = getVaultoApiConfigError();
      console.error("[ETF Positions] Config error:", errorMsg, getVaultoApiDebugInfo());
      return NextResponse.json(
        {
          error: "Service temporarily unavailable",
          ...(process.env.NODE_ENV === "development" && { details: errorMsg }),
        },
        { status: 503 }
      );
    }

    const positions = await fetchEtfPositions(getVaultoApiToken(), user.id);
    return NextResponse.json(positions);
  } catch (error) {
    console.error("[ETF Positions] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch positions" },
      { status: 500 }
    );
  }
}
