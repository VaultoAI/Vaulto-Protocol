import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { PRIVATE_COMPANIES_CACHE_TAG } from "@/lib/vaulto/companies";

export const dynamic = "force-dynamic";

/**
 * POST /api/revalidate/companies
 *
 * Clears the private companies cache to force fresh data from the Vaulto API.
 * Requires a valid revalidation secret in the Authorization header.
 *
 * Usage: curl -X POST https://app.vaulto.ai/api/revalidate/companies \
 *        -H "Authorization: Bearer <REVALIDATION_SECRET>"
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.REVALIDATION_SECRET;

  // If no secret is configured, deny all requests
  if (!secret) {
    return NextResponse.json(
      { error: "Revalidation not configured" },
      { status: 503 }
    );
  }

  // Validate the secret
  const providedSecret = authHeader?.replace("Bearer ", "");
  if (providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    revalidateTag(PRIVATE_COMPANIES_CACHE_TAG);

    return NextResponse.json({
      revalidated: true,
      tag: PRIVATE_COMPANIES_CACHE_TAG,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to revalidate", details: String(error) },
      { status: 500 }
    );
  }
}
