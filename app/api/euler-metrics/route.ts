import { NextResponse } from "next/server";
import { getEulerVaults, getEulerProtocolMetrics } from "@/lib/euler/lending";

export const revalidate = 60;

export async function GET() {
  try {
    const [vaults, protocol] = await Promise.all([
      getEulerVaults(),
      getEulerProtocolMetrics(),
    ]);
    return NextResponse.json({
      vaults,
      protocol: {
        vaultCount: protocol.vaultCount,
        totalSupplyBySymbol: protocol.totalSupplyBySymbol,
        totalBorrowsBySymbol: protocol.totalBorrowsBySymbol,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch Euler metrics" },
      { status: 500 }
    );
  }
}
