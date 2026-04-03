/**
 * Query SSI (Safe Superintelligence) data from the database
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});

async function main() {
  console.log("Querying SSI data from database...\n");

  // First list all companies
  const allCompanies = await prisma.privateCompany.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  console.log("All companies in database:");
  for (const c of allCompanies) {
    console.log(`  ${c.id}: ${c.name}`);
  }
  console.log("");

  const ssi = await prisma.privateCompany.findFirst({
    where: {
      OR: [
        { name: { contains: "SSI", mode: "insensitive" } },
        { name: { contains: "Safe Superintelligence", mode: "insensitive" } },
        { name: { contains: "Superintelligence", mode: "insensitive" } },
      ],
    },
    include: {
      products: true,
      fundingHistory: true,
    },
  });

  if (!ssi) {
    console.log("No SSI company found in database");
    return;
  }

  console.log("=".repeat(60));
  console.log("COMPANY: " + ssi.name);
  console.log("=".repeat(60));
  console.log("\n--- DESCRIPTION ---");
  console.log(ssi.description);
  console.log("\n--- CEO ---");
  console.log(ssi.ceo);
  console.log("\n--- INDUSTRY ---");
  console.log(ssi.industry);
  console.log("\n--- WEBSITE ---");
  console.log(ssi.website);

  if (ssi.products.length > 0) {
    console.log("\n--- PRODUCTS ---");
    for (const product of ssi.products) {
      console.log(`\nProduct: ${product.name}`);
      if (product.description) {
        console.log(`Description: ${product.description}`);
      }
    }
  }

  if (ssi.fundingHistory.length > 0) {
    console.log("\n--- FUNDING ROUNDS ---");
    for (const round of ssi.fundingHistory) {
      console.log(`\nRound: ${round.type}`);
      if (round.amountRaisedNote) {
        console.log(`Note: ${round.amountRaisedNote}`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
