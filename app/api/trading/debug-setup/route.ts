import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { setupWallet, deriveCredentials, checkCredentialsStatus } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";

/**
 * POST /api/trading/debug-setup
 *
 * Debug endpoint to manually trigger credential setup.
 * Shows detailed information about each step.
 */
export async function POST(request: NextRequest) {
  const steps: { step: string; status: string; data?: unknown; error?: string }[] = [];

  try {
    // Step 1: Check authentication
    steps.push({ step: "Check auth session", status: "running" });
    const session = await auth();
    if (!session?.user?.email) {
      steps[steps.length - 1].status = "failed";
      steps[steps.length - 1].error = "Not authenticated";
      return NextResponse.json({ success: false, steps });
    }
    steps[steps.length - 1].status = "success";
    steps[steps.length - 1].data = { email: session.user.email };

    // Step 2: Check Vaulto API config
    steps.push({ step: "Check Vaulto API config", status: "running" });
    if (!isVaultoApiConfigured()) {
      steps[steps.length - 1].status = "failed";
      steps[steps.length - 1].error = "Vaulto API not configured";
      return NextResponse.json({ success: false, steps });
    }
    steps[steps.length - 1].status = "success";

    // Step 3: Check database
    steps.push({ step: "Check database", status: "running" });
    const dbError = requireDatabase();
    if (dbError) {
      steps[steps.length - 1].status = "failed";
      steps[steps.length - 1].error = "Database not available";
      return NextResponse.json({ success: false, steps });
    }
    steps[steps.length - 1].status = "success";

    // Step 4: Get user and trading wallet
    steps.push({ step: "Get user and trading wallet", status: "running" });
    const db = getDb();
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { tradingWallet: true },
    });

    if (!user) {
      steps[steps.length - 1].status = "failed";
      steps[steps.length - 1].error = "User not found";
      return NextResponse.json({ success: false, steps });
    }

    if (!user.tradingWallet) {
      steps[steps.length - 1].status = "failed";
      steps[steps.length - 1].error = "No trading wallet. Create one first.";
      return NextResponse.json({ success: false, steps });
    }

    steps[steps.length - 1].status = "success";
    steps[steps.length - 1].data = {
      walletAddress: user.tradingWallet.address,
      walletStatus: user.tradingWallet.status,
    };

    // Step 5: Check current credential status
    steps.push({ step: "Check current credentials status", status: "running" });
    const apiKey = getVaultoApiToken();
    try {
      const credStatus = await checkCredentialsStatus(apiKey, user.tradingWallet.address);
      steps[steps.length - 1].status = "success";
      steps[steps.length - 1].data = credStatus;
    } catch (e) {
      steps[steps.length - 1].status = "warning";
      steps[steps.length - 1].error = e instanceof Error ? e.message : "Failed to check";
    }

    // Step 6: Get Privy token from request
    steps.push({ step: "Get Privy token", status: "running" });
    const privyAuthToken = request.headers.get("x-privy-token");
    if (!privyAuthToken) {
      steps[steps.length - 1].status = "failed";
      steps[steps.length - 1].error = "No x-privy-token header. You need to be logged in via Privy.";
      return NextResponse.json({ success: false, steps });
    }
    steps[steps.length - 1].status = "success";
    steps[steps.length - 1].data = { tokenLength: privyAuthToken.length };

    // Step 7: Setup wallet on Vaulto API
    steps.push({ step: "Setup wallet on Vaulto API", status: "running" });
    try {
      const walletResult = await setupWallet(apiKey, privyAuthToken);
      steps[steps.length - 1].status = "success";
      steps[steps.length - 1].data = walletResult;
    } catch (e) {
      steps[steps.length - 1].status = "failed";
      steps[steps.length - 1].error = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ success: false, steps });
    }

    // Step 8: Derive Polymarket credentials
    steps.push({ step: "Derive Polymarket credentials", status: "running" });
    try {
      const deriveResult = await deriveCredentials(apiKey, privyAuthToken);
      steps[steps.length - 1].status = "success";
      steps[steps.length - 1].data = deriveResult;
    } catch (e) {
      steps[steps.length - 1].status = "failed";
      steps[steps.length - 1].error = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ success: false, steps });
    }

    // Step 9: Verify credentials are now set up
    steps.push({ step: "Verify credentials are set up", status: "running" });
    try {
      const finalStatus = await checkCredentialsStatus(apiKey, user.tradingWallet.address);
      steps[steps.length - 1].status = finalStatus.hasCredentials ? "success" : "warning";
      steps[steps.length - 1].data = finalStatus;
    } catch (e) {
      steps[steps.length - 1].status = "warning";
      steps[steps.length - 1].error = e instanceof Error ? e.message : "Failed to verify";
    }

    return NextResponse.json({ success: true, steps });
  } catch (error) {
    return NextResponse.json({
      success: false,
      steps,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * GET /api/trading/debug-setup
 *
 * Check current setup status without making changes.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!isVaultoApiConfigured()) {
      return NextResponse.json({ error: "Vaulto API not configured" }, { status: 500 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;
    const db = getDb();

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { tradingWallet: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const apiKey = getVaultoApiToken();
    let credentialsStatus = { hasCredentials: false };

    if (user.tradingWallet) {
      try {
        credentialsStatus = await checkCredentialsStatus(apiKey, user.tradingWallet.address);
      } catch (e) {
        // Ignore error
      }
    }

    return NextResponse.json({
      user: {
        email: user.email,
        id: user.id,
      },
      tradingWallet: user.tradingWallet ? {
        address: user.tradingWallet.address,
        status: user.tradingWallet.status,
        privyWalletId: user.tradingWallet.privyWalletId,
      } : null,
      credentials: credentialsStatus,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
