/**
 * Update company descriptions for Epic Games and SSI
 *
 * Updates the private_companies table directly (not Prisma-managed).
 * Products are stored as JSON strings in the products column.
 *
 * Usage: npx tsx scripts/update-company-descriptions.ts
 */

import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Company IDs
const EPIC_GAMES_ID = 150;
const SSI_ID = 149;

// New company descriptions
const EPIC_GAMES_DESCRIPTION = `Epic Games is a leading interactive entertainment company that creates video games and game development technology. Its flagship titles include Fortnite, a globally popular battle royale game, and the company develops Unreal Engine, one of the most widely adopted 3D game engines in the industry. Epic additionally runs a digital distribution platform for PC games, providing developers with a higher revenue share than traditional storefronts.`;

const SSI_DESCRIPTION = `Safe Superintelligence Inc. is an AI research company focused on building superintelligent systems with safety as a core technical priority. The organization approaches safety and capability advancement as a unified engineering challenge, operating without the pressure of shipping intermediate products or managing commercial operations. This structure allows the research team to concentrate on foundational work toward transformative AI development.`;

// Epic Games products as JSON array
const EPIC_PRODUCTS = [
  {
    name: "Fortnite",
    description:
      "Fortnite is a free-to-play battle royale title that supports cross-platform multiplayer across consoles, PC, and mobile. The game hosts live in-game events and has partnered with numerous entertainment brands. Beyond competitive gameplay, Fortnite has grown into a social platform hosting virtual concerts, film premieres, and creator-built experiences.",
  },
  {
    name: "Unreal Engine",
    description:
      "Unreal Engine is a comprehensive 3D development platform serving game studios, film and television productions, architectural firms, and automotive designers. The engine delivers real-time rendering capabilities and is available under licensing terms that allow independent developers to use it without upfront costs.",
  },
  {
    name: "Epic Games Store",
    description:
      "The Epic Games Store is a digital distribution platform for PC games that provides developers with an 88% revenue share on sales, compared to the 70% offered by competing storefronts. The platform features weekly free game promotions and exclusive game releases to attract and retain users.",
  },
  {
    name: "UEFN",
    description:
      "UEFN is a development toolkit that allows creators to design and publish custom game modes and experiences within Fortnite. The tools lower the barrier to entry for user-generated content, enabling a creator ecosystem similar to sandbox gaming platforms.",
  },
];

async function main() {
  console.log("=".repeat(60));
  console.log("Updating Company Descriptions (private_companies table)");
  console.log("=".repeat(60));

  const client = await pool.connect();

  try {
    // Update Epic Games company description and products
    console.log("\nUpdating Epic Games...");
    const epicResult = await client.query(
      `UPDATE private_companies
       SET description = $1, products = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, name`,
      [EPIC_GAMES_DESCRIPTION, JSON.stringify(EPIC_PRODUCTS), EPIC_GAMES_ID]
    );
    if (epicResult.rowCount === 1) {
      console.log(`  -> Updated Epic Games (ID: ${epicResult.rows[0].id})`);
      console.log(`  -> Updated 4 product descriptions`);
    } else {
      console.log(`  -> WARNING: Epic Games not found (ID: ${EPIC_GAMES_ID})`);
    }

    // Update SSI company description
    console.log("\nUpdating SSI...");
    const ssiResult = await client.query(
      `UPDATE private_companies
       SET description = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name`,
      [SSI_DESCRIPTION, SSI_ID]
    );
    if (ssiResult.rowCount === 1) {
      console.log(`  -> Updated SSI (ID: ${ssiResult.rows[0].id})`);
    } else {
      console.log(`  -> WARNING: SSI not found (ID: ${SSI_ID})`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("Updates complete!");
    console.log("=".repeat(60));

    // Verification: fetch and display updated records
    console.log("\n--- VERIFICATION ---\n");

    const epic = await client.query(
      "SELECT id, name, description, products FROM private_companies WHERE id = $1",
      [EPIC_GAMES_ID]
    );

    if (epic.rows[0]) {
      const row = epic.rows[0];
      console.log("EPIC GAMES:");
      console.log(`Description: ${row.description.substring(0, 100)}...`);
      const products = JSON.parse(row.products || "[]");
      console.log(`Products (${products.length}):`);
      for (const p of products) {
        console.log(`  - ${p.name}: ${p.description.substring(0, 60)}...`);
      }
    }

    const ssi = await client.query(
      "SELECT id, name, description FROM private_companies WHERE id = $1",
      [SSI_ID]
    );

    if (ssi.rows[0]) {
      console.log("\nSSI:");
      console.log(`Description: ${ssi.rows[0].description.substring(0, 100)}...`);
    }
  } catch (error) {
    console.error("\nUpdate failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
