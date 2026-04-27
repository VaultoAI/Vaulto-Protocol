/**
 * Add current snapshot with live position values
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createPublicClient, http, formatUnits } from "viem";
import { polygon } from "viem/chains";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const USDC_ADDRESSES = {
  POLYGON_NATIVE: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  POLYGON_BRIDGED: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
};

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon.drpc.org"),
});

const VAULTO_API_URL = process.env.VAULTO_API_URL || process.env.NEXT_PUBLIC_VAULTO_API_URL;
const VAULTO_API_KEY = process.env.VAULTO_API_TOKEN || "";

async function main() {
  const walletAddress = "0x6Ecf7305aD2A0a3C991A90C4E80A4908d0bbaa40";
  const safeAddress = "0x7d58602bB47fB958b57f221C206D52E01afF401f";
  const walletId = "cmoaid6ql0002oysbvo147n7j";

  // Fetch current balances
  const eoaBalance = await polygonClient.readContract({
    address: USDC_ADDRESSES.POLYGON_NATIVE as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [walletAddress as `0x${string}`],
  });
  const safeBalance = await polygonClient.readContract({
    address: USDC_ADDRESSES.POLYGON_BRIDGED as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [safeAddress as `0x${string}`],
  });

  const eoaUsd = parseFloat(formatUnits(eoaBalance, 6));
  const safeUsd = parseFloat(formatUnits(safeBalance, 6));

  // Fetch positions
  const posResponse = await fetch(`${VAULTO_API_URL}/api/trading/positions`, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": VAULTO_API_KEY,
      "x-user-id": walletAddress,
    },
  });
  const posData = await posResponse.json();
  const positionsValue = posData.summary?.totalValue || 0;
  const totalValue = eoaUsd + safeUsd + positionsValue;

  console.log("Current balances:");
  console.log("  EOA USDC:", eoaUsd.toFixed(2));
  console.log("  Safe USDC.e:", safeUsd.toFixed(2));
  console.log("  Positions:", positionsValue.toFixed(2));
  console.log("  Total:", totalValue.toFixed(2));
  console.log("  P&L from positions:", posData.summary?.totalPnl?.toFixed(2) || "N/A");

  // Create current snapshot
  await prisma.portfolioSnapshot.create({
    data: {
      tradingWalletId: walletId,
      timestamp: new Date(),
      eoaUsdcBalance: new Prisma.Decimal(eoaUsd.toFixed(2)),
      safeUsdceBalance: new Prisma.Decimal(safeUsd.toFixed(2)),
      positionsValue: new Prisma.Decimal(positionsValue.toFixed(2)),
      totalValue: new Prisma.Decimal(totalValue.toFixed(2)),
      positionsSnapshot: posData.positions,
    },
  });

  console.log("\nCreated current snapshot with live values");

  // Show all snapshots
  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: { tradingWalletId: walletId },
    orderBy: { timestamp: "asc" },
  });
  console.log("\nAll snapshots:");
  for (const s of snapshots) {
    console.log(
      s.timestamp.toISOString(),
      "Total:",
      Number(s.totalValue).toFixed(2),
      "Positions:",
      Number(s.positionsValue).toFixed(2)
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
