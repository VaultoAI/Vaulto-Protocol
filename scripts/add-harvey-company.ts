/**
 * Add Harvey company to the platform
 *
 * Inserts Harvey into the private_companies table directly (not Prisma-managed).
 * Products are stored as JSON strings in the products column.
 *
 * Usage: npx tsx scripts/add-harvey-company.ts
 */

import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Harvey company data (AI-rewritten per project requirements)
const HARVEY_DATA = {
  name: "Harvey",
  industry: "Legal Tech",
  description: `Harvey develops AI-powered software for legal professionals, offering tools for automated legal research, contract analysis, and document interpretation. The platform provides secure collaboration features that enable law firms to streamline workflows and reduce time spent on routine paperwork. Founded in 2022 and headquartered in San Francisco, Harvey serves enterprise clients across the legal services industry.`,
  website: "https://harvey.ai",
  valuation_usd: 11000000000, // $11B
  valuation_as_of: "2026-03-25",
  total_funding_usd: 1190000000, // $1.19B
  last_funding_round_type: "Later Stage VC",
  last_funding_date: "2026-03-25",
  employees: 928,
  ceo: "Winston Weinberg",
};

// Harvey products (AI-rewritten per project requirements)
const HARVEY_PRODUCTS = [
  {
    name: "Harvey Assistant",
    description:
      "An AI-powered legal assistant that performs automated research with precise citations, interprets contracts, and executes legal tasks. The platform integrates with existing law firm workflows and supports collaboration across teams.",
  },
  {
    name: "Harvey for Contract Analysis",
    description:
      "Tools for analyzing and interpreting legal contracts using natural language processing. The system identifies key terms, potential risks, and relevant clauses to accelerate contract review processes.",
  },
];

async function main() {
  console.log("=".repeat(60));
  console.log("Adding Harvey Company (private_companies table)");
  console.log("=".repeat(60));

  const client = await pool.connect();

  try {
    // Check if Harvey already exists
    const existing = await client.query(
      "SELECT id, name FROM private_companies WHERE LOWER(name) = LOWER($1)",
      [HARVEY_DATA.name]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      console.log(
        `\nHarvey already exists with ID: ${existing.rows[0].id}. Skipping insert.`
      );
      console.log("If you want to update, use an UPDATE script instead.");
      return;
    }

    // Insert Harvey into the database
    console.log("\nInserting Harvey...");
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
        HARVEY_DATA.name,
        HARVEY_DATA.industry,
        HARVEY_DATA.description,
        HARVEY_DATA.website,
        HARVEY_DATA.valuation_usd,
        HARVEY_DATA.valuation_as_of,
        HARVEY_DATA.total_funding_usd,
        HARVEY_DATA.last_funding_round_type,
        HARVEY_DATA.last_funding_date,
        HARVEY_DATA.employees,
        HARVEY_DATA.ceo,
        JSON.stringify(HARVEY_PRODUCTS),
      ]
    );

    console.log(`  -> Inserted Harvey (ID: ${result.rows[0].id})`);
    console.log(`  -> Added ${HARVEY_PRODUCTS.length} products`);

    console.log("\n" + "=".repeat(60));
    console.log("Insert complete!");
    console.log("=".repeat(60));

    // Verification: fetch and display the new record
    console.log("\n--- VERIFICATION ---\n");

    const harvey = await client.query(
      `SELECT id, name, industry, description, website, valuation_usd,
              valuation_as_of, total_funding_usd, last_funding_round_type,
              last_funding_date, employees, ceo, products
       FROM private_companies WHERE id = $1`,
      [result.rows[0].id]
    );

    if (harvey.rows[0]) {
      const row = harvey.rows[0];
      console.log("HARVEY:");
      console.log(`  ID: ${row.id}`);
      console.log(`  Name: ${row.name}`);
      console.log(`  Industry: ${row.industry}`);
      console.log(`  Website: ${row.website}`);
      console.log(`  Valuation: $${(row.valuation_usd / 1e9).toFixed(2)}B`);
      console.log(`  Valuation as of: ${row.valuation_as_of}`);
      console.log(
        `  Total Funding: $${(row.total_funding_usd / 1e9).toFixed(2)}B`
      );
      console.log(`  Last Funding: ${row.last_funding_round_type}`);
      console.log(`  Last Funding Date: ${row.last_funding_date}`);
      console.log(`  Employees: ${row.employees}`);
      console.log(`  CEO: ${row.ceo}`);
      console.log(`  Description: ${row.description.substring(0, 100)}...`);

      const products = JSON.parse(row.products || "[]");
      console.log(`  Products (${products.length}):`);
      for (const p of products) {
        console.log(`    - ${p.name}: ${p.description.substring(0, 50)}...`);
      }
    }
  } catch (error) {
    console.error("\nInsert failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
