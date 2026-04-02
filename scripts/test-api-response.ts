import "dotenv/config";

const VAULTO_API_URL = "https://api.vaulto.ai/api/private-companies";

async function testApiResponse() {
  const apiKey = process.env.VAULTO_API_TOKEN;

  if (!apiKey) {
    console.error("Missing VAULTO_API_TOKEN");
    process.exit(1);
  }

  console.log("Fetching from Vaulto API...\n");

  const res = await fetch(VAULTO_API_URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    cache: "no-store", // Bypass any fetch caching
  });

  // Check cache headers
  console.log("Response Headers:");
  console.log("  Cache-Control:", res.headers.get("cache-control") || "none");
  console.log("  Age:", res.headers.get("age") || "none");
  console.log("  X-Cache:", res.headers.get("x-cache") || "none");
  console.log("");

  const json = await res.json();

  // Find TML
  const tml = json.companies?.find((c: any) =>
    c.name.toLowerCase().includes("thinking machines") ||
    c.name.toLowerCase().includes("tml")
  );

  if (!tml) {
    console.log("TML not found in API response");
    console.log("Available companies:", json.companies?.map((c: any) => c.name));
    return;
  }

  console.log("=== TML Data from API ===");
  console.log("Name:", tml.name);
  console.log("Valuation:", tml.valuationUsd);
  console.log("Total Funding:", tml.totalFundingUsd);
  console.log("Last Funding Round:", tml.lastFundingRoundType);
  console.log("Last Funding Date:", tml.lastFundingDate);
  console.log("");
  console.log("Funding History:");
  tml.fundingHistory?.forEach((round: any, i: number) => {
    console.log(`  ${i + 1}. ${round.type} - ${round.date}`);
    console.log(`     Amount: $${round.amountRaisedUsd?.toLocaleString() || "N/A"}`);
    console.log(`     Post-Money: $${round.postMoneyValuationUsd?.toLocaleString() || "N/A"}`);
  });
}

testApiResponse().catch(console.error);
