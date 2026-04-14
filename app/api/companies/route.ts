import { NextResponse } from "next/server";
import { getPrivateCompanies } from "@/lib/vaulto/companies";

/**
 * GET /api/companies
 * Returns all private companies for client-side autocomplete.
 */
export async function GET() {
  try {
    const companies = await getPrivateCompanies();
    return NextResponse.json({ companies });
  } catch (error) {
    console.error("Failed to fetch companies:", error);
    return NextResponse.json({ companies: [] }, { status: 500 });
  }
}
