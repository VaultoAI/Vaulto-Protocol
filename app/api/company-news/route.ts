import { NextRequest, NextResponse } from "next/server";
import { getCompanyNews } from "@/lib/news/fetcher";

export const revalidate = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get("company");
    const ceo = searchParams.get("ceo");
    const productsParam = searchParams.get("products");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 6;

    if (!company) {
      return NextResponse.json(
        { error: "Missing required parameter: company" },
        { status: 400 }
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 20) {
      return NextResponse.json(
        { error: "Invalid limit parameter. Must be between 1 and 20." },
        { status: 400 }
      );
    }

    // Parse products from comma-separated string
    const products = productsParam
      ? productsParam.split(",").map((p) => p.trim()).filter(Boolean)
      : undefined;

    const response = await getCompanyNews({
      company,
      ceo: ceo || undefined,
      products,
      limit,
    });
    return NextResponse.json(response);
  } catch (err) {
    console.error("Company news API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch company news" },
      { status: 500 }
    );
  }
}
