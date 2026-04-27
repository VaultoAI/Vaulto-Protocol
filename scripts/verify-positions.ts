/**
 * Verify Prediction Market Positions
 *
 * Directly queries the Vaulto API to verify positions are real and not just database entries.
 *
 * Usage:
 *   npx tsx scripts/verify-positions.ts --email=user@example.com
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Initialize Prisma
function createPrismaClient(): PrismaClient {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: ["error", "warn"] });
}

async function main() {
  // Parse email arg
  let email = "";
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--email=")) {
      email = arg.split("=")[1];
    }
  }

  if (!email) {
    console.error("Usage: npx tsx scripts/verify-positions.ts --email=user@example.com");
    process.exit(1);
  }

  const prisma = createPrismaClient();
  const vaultoApiUrl = process.env.NEXT_PUBLIC_VAULTO_API_URL || process.env.VAULTO_API_URL || "https://api.vaulto.ai";
  const vaultoApiToken = process.env.VAULTO_API_TOKEN;

  if (!vaultoApiToken) {
    console.error("VAULTO_API_TOKEN not set");
    process.exit(1);
  }

  try {
    // 1. Get user and trading wallet from database
    console.log(`\n🔍 Looking up user: ${email}`);
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tradingWallet: {
          include: {
            predictionTrades: {
              orderBy: { createdAt: "desc" },
              take: 5,
            },
          },
        },
      },
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    if (!user.tradingWallet) {
      console.error(`❌ User has no trading wallet`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.id}`);
    console.log(`   Trading Wallet: ${user.tradingWallet.address}`);
    console.log(`   Status: ${user.tradingWallet.status}`);

    // 2. Show database trades
    console.log(`\n📊 Database Trades (last 5):`);
    if (user.tradingWallet.predictionTrades.length === 0) {
      console.log("   (no trades in database)");
    } else {
      for (const trade of user.tradingWallet.predictionTrades) {
        console.log(`   - ${trade.eventId} | ${trade.side} | $${trade.amount} | Status: ${trade.status} | PositionId: ${trade.positionId}`);
      }
    }

    // 3. Query Vaulto API directly for positions
    console.log(`\n🌐 Querying Vaulto API for positions...`);
    const positionsUrl = `${vaultoApiUrl}/api/trading/positions`;

    const response = await fetch(positionsUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": vaultoApiToken,
        "x-user-id": user.tradingWallet.address,
      },
    });

    console.log(`   Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Vaulto API error: ${errorText}`);
    } else {
      const data = await response.json();
      console.log(`\n📈 Vaulto API Positions Response:`);
      console.log(JSON.stringify(data, null, 2));

      if (data.positions && data.positions.length > 0) {
        console.log(`\n✅ Found ${data.positions.length} real position(s) on Vaulto API`);
      } else {
        console.log(`\n⚠️  No positions found on Vaulto API - trades may not have executed on Polymarket`);
      }
    }

    // 4. Check credentials status
    console.log(`\n🔑 Checking credentials status...`);
    const credUrl = `${vaultoApiUrl}/api/trading/credentials-status?userId=${encodeURIComponent(user.tradingWallet.address)}`;

    const credResponse = await fetch(credUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": vaultoApiToken,
      },
    });

    if (credResponse.ok) {
      const credData = await credResponse.json();
      console.log(`   Has Credentials: ${credData.hasCredentials}`);
    } else {
      console.log(`   ⚠️  Could not check credentials: ${credResponse.status}`);
    }

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
