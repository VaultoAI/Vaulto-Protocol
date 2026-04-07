import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { fetchEtfPositions } from "@/lib/vaulto-api/etf";

const VAULTO_API_KEY = process.env.VAULTO_API_KEY || "";

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

    if (!VAULTO_API_KEY) {
      return NextResponse.json(
        { error: "API not configured" },
        { status: 500 }
      );
    }

    const positions = await fetchEtfPositions(VAULTO_API_KEY, user.id);
    return NextResponse.json(positions);
  } catch (error) {
    console.error("[ETF Positions] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch positions" },
      { status: 500 }
    );
  }
}
