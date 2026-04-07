import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { fetchEtfOrder, cancelEtfOrder } from "@/lib/vaulto-api/etf";

const VAULTO_API_TOKEN = process.env.VAULTO_API_TOKEN || "";

/**
 * GET /api/etf/order/:orderId
 *
 * Proxy to Vaulto-API for fetching order status.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

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

    if (!VAULTO_API_TOKEN) {
      return NextResponse.json(
        { error: "API not configured" },
        { status: 500 }
      );
    }

    const order = await fetchEtfOrder(orderId, VAULTO_API_TOKEN, user.id);
    return NextResponse.json(order);
  } catch (error) {
    console.error("[ETF Order] Get error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch order" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/etf/order/:orderId
 *
 * Proxy to Vaulto-API for cancelling orders.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

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

    if (!VAULTO_API_TOKEN) {
      return NextResponse.json(
        { error: "API not configured" },
        { status: 500 }
      );
    }

    const result = await cancelEtfOrder(orderId, VAULTO_API_TOKEN, user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[ETF Order] Cancel error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel order" },
      { status: 500 }
    );
  }
}
