import { NextRequest, NextResponse } from "next/server";

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const MORALIS_API_URL = "https://deep-index.moralis.io/api/v2.2/wallets";

// Supported chains for net worth calculation
const SUPPORTED_CHAINS = [
  "eth",      // Ethereum
  "polygon",  // Polygon
  "bsc",      // BNB Chain
  "arbitrum", // Arbitrum
  "optimism", // Optimism
  "base",     // Base
  "avalanche", // Avalanche
];

interface ChainNetWorth {
  chain: string;
  native_balance: string;
  native_balance_formatted: string;
  native_balance_usd: string;
  token_balance_usd: string;
  networth_usd: string;
}

interface MoralisNetWorthResponse {
  total_networth_usd: string;
  chains: ChainNetWorth[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Wallet address is required" },
      { status: 400 }
    );
  }

  if (!MORALIS_API_KEY) {
    console.warn("[wallet-networth] MORALIS_API_KEY is not configured");
    // Return empty data instead of error - allows UI to gracefully show "—"
    return NextResponse.json({
      totalNetWorthUsd: null,
      chains: [],
      error: "Service temporarily unavailable",
    });
  }

  try {
    // Build chains parameter in array format: chains[0]=eth&chains[1]=polygon
    const chainsParam = SUPPORTED_CHAINS.map((chain, i) => `chains[${i}]=${chain}`).join("&");
    const url = `${MORALIS_API_URL}/${address}/net-worth?${chainsParam}&exclude_spam=true&exclude_unverified_contracts=true`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-API-Key": MORALIS_API_KEY,
      },
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Moralis API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to fetch wallet net worth" },
        { status: response.status }
      );
    }

    const data: MoralisNetWorthResponse = await response.json();

    return NextResponse.json({
      totalNetWorthUsd: data.total_networth_usd,
      chains: data.chains.map((chain) => ({
        chain: chain.chain,
        nativeBalanceUsd: chain.native_balance_usd,
        tokenBalanceUsd: chain.token_balance_usd,
        totalUsd: chain.networth_usd,
      })),
    });
  } catch (error) {
    console.error("Error fetching wallet net worth:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet net worth" },
      { status: 500 }
    );
  }
}
