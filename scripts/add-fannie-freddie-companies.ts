/**
 * Add Fannie Mae and Freddie Mac to the platform
 *
 * Inserts both GSEs into the private_companies table directly (not Prisma-managed).
 * These companies are needed for the Polymarket IPO prediction markets.
 *
 * Usage: npx tsx scripts/add-fannie-freddie-companies.ts
 */

import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Fannie Mae company data (AI-rewritten per project requirements)
const FANNIE_MAE_DATA = {
  name: "Fannie Mae",
  industry: "Financial Services",
  description: `Fannie Mae is a government-sponsored enterprise that operates in the secondary mortgage market. The company purchases mortgages from lenders and packages them into mortgage-backed securities for sale to investors, providing liquidity and stability to the U.S. housing finance system. Founded in 1938 and headquartered in Washington, D.C., Fannie Mae plays a central role in making homeownership accessible to millions of Americans.`,
  website: "https://fanniemae.com",
  valuation_usd: 0, // Under conservatorship, market-based valuation pending IPO
  valuation_as_of: "2025-01-01",
  total_funding_usd: 0, // GSE - not applicable
  last_funding_round_type: "Government Conservatorship",
  last_funding_date: "2008-09-07",
  employees: 8100,
  ceo: "Priscilla Almodovar",
};

// Fannie Mae products (AI-rewritten per project requirements)
const FANNIE_MAE_PRODUCTS = [
  {
    name: "Mortgage-Backed Securities",
    description:
      "Securities backed by pools of residential mortgages that provide investors with regular income while supplying liquidity to mortgage lenders.",
  },
  {
    name: "HomeReady Mortgage",
    description:
      "A mortgage product designed for creditworthy low-income borrowers, featuring flexible down payment options and reduced mortgage insurance requirements.",
  },
  {
    name: "Desktop Underwriter",
    description:
      "An automated underwriting system that helps lenders evaluate mortgage applications quickly and consistently using standardized credit and risk assessment criteria.",
  },
];

// Freddie Mac company data (AI-rewritten per project requirements)
const FREDDIE_MAC_DATA = {
  name: "Freddie Mac",
  industry: "Financial Services",
  description: `Freddie Mac is a government-sponsored enterprise that provides liquidity to the U.S. housing market by purchasing mortgages from lenders. The company packages loans into mortgage-backed securities, helping to maintain affordable mortgage rates for homebuyers. Founded in 1970 and headquartered in McLean, Virginia, Freddie Mac works alongside Fannie Mae to support the secondary mortgage market.`,
  website: "https://freddiemac.com",
  valuation_usd: 0, // Under conservatorship, market-based valuation pending IPO
  valuation_as_of: "2025-01-01",
  total_funding_usd: 0, // GSE - not applicable
  last_funding_round_type: "Government Conservatorship",
  last_funding_date: "2008-09-07",
  employees: 7500,
  ceo: "Michael DeVito",
};

// Freddie Mac products (AI-rewritten per project requirements)
const FREDDIE_MAC_PRODUCTS = [
  {
    name: "Mortgage-Backed Securities",
    description:
      "Securities backed by residential mortgage pools that provide liquidity to the housing finance system and generate returns for investors.",
  },
  {
    name: "Home Possible Mortgage",
    description:
      "A mortgage program designed for low- to moderate-income borrowers with flexible credit requirements and low down payment options.",
  },
  {
    name: "Loan Product Advisor",
    description:
      "An automated underwriting system that assesses borrower eligibility and loan risk, helping lenders make faster and more consistent lending decisions.",
  },
];

async function insertCompany(
  client: pg.PoolClient,
  data: typeof FANNIE_MAE_DATA,
  products: typeof FANNIE_MAE_PRODUCTS
) {
  // Check if company already exists
  const existing = await client.query(
    "SELECT id, name FROM private_companies WHERE LOWER(name) = LOWER($1)",
    [data.name]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    console.log(
      `\n${data.name} already exists with ID: ${existing.rows[0].id}. Skipping insert.`
    );
    return null;
  }

  // Insert company into the database
  console.log(`\nInserting ${data.name}...`);
  const result = await client.query(
    `INSERT INTO private_companies (
      name,
      industry,
      description,
      website,
      valuation_usd,
      valuation_as_of,
      total_funding_usd,
      last_funding_round_type,
      last_funding_date,
      employees,
      ceo,
      products,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
    RETURNING id, name`,
    [
      data.name,
      data.industry,
      data.description,
      data.website,
      data.valuation_usd,
      data.valuation_as_of,
      data.total_funding_usd,
      data.last_funding_round_type,
      data.last_funding_date,
      data.employees,
      data.ceo,
      JSON.stringify(products),
    ]
  );

  console.log(`  -> Inserted ${data.name} (ID: ${result.rows[0].id})`);
  console.log(`  -> Added ${products.length} products`);

  return result.rows[0].id;
}

async function verifyCompany(client: pg.PoolClient, id: number) {
  const result = await client.query(
    `SELECT id, name, industry, description, website, valuation_usd,
            valuation_as_of, total_funding_usd, last_funding_round_type,
            last_funding_date, employees, ceo, products
     FROM private_companies WHERE id = $1`,
    [id]
  );

  if (result.rows[0]) {
    const row = result.rows[0];
    console.log(`\n${row.name.toUpperCase()}:`);
    console.log(`  ID: ${row.id}`);
    console.log(`  Name: ${row.name}`);
    console.log(`  Industry: ${row.industry}`);
    console.log(`  Website: ${row.website}`);
    console.log(`  Employees: ${row.employees}`);
    console.log(`  CEO: ${row.ceo}`);
    console.log(`  Description: ${row.description.substring(0, 100)}...`);

    const products = JSON.parse(row.products || "[]");
    console.log(`  Products (${products.length}):`);
    for (const p of products) {
      console.log(`    - ${p.name}: ${p.description.substring(0, 50)}...`);
    }
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("Adding Fannie Mae and Freddie Mac (private_companies table)");
  console.log("=".repeat(60));

  const client = await pool.connect();
  const insertedIds: number[] = [];

  try {
    // Insert Fannie Mae
    const fannieMaeId = await insertCompany(
      client,
      FANNIE_MAE_DATA,
      FANNIE_MAE_PRODUCTS
    );
    if (fannieMaeId) insertedIds.push(fannieMaeId);

    // Insert Freddie Mac
    const freddieMacId = await insertCompany(
      client,
      FREDDIE_MAC_DATA,
      FREDDIE_MAC_PRODUCTS
    );
    if (freddieMacId) insertedIds.push(freddieMacId);

    console.log("\n" + "=".repeat(60));
    console.log("Insert complete!");
    console.log("=".repeat(60));

    // Verification: fetch and display the new records
    if (insertedIds.length > 0) {
      console.log("\n--- VERIFICATION ---");
      for (const id of insertedIds) {
        await verifyCompany(client, id);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("Next steps:");
    console.log("  1. Visit /explore/fannie-mae to verify the page loads");
    console.log("  2. Visit /explore/freddie-mac to verify the page loads");
    console.log("  3. Check that Polymarket widget appears on both pages");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\nInsert failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
