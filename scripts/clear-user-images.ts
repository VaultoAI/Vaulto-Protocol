import "dotenv/config";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // First, check how many users have images
    const countResult = await client.query(`
      SELECT COUNT(*) as count FROM "User" WHERE image IS NOT NULL
    `);
    const count = parseInt(countResult.rows[0].count, 10);
    console.log(`Found ${count} user(s) with profile images`);

    if (count === 0) {
      console.log("No images to clear. Exiting.");
      return;
    }

    // Clear all user images
    const updateResult = await client.query(`
      UPDATE "User" SET image = NULL WHERE image IS NOT NULL
    `);
    console.log(`Cleared images for ${updateResult.rowCount} user(s)`);

    // Verify the update
    const verifyResult = await client.query(`
      SELECT COUNT(*) as count FROM "User" WHERE image IS NOT NULL
    `);
    const remaining = parseInt(verifyResult.rows[0].count, 10);
    console.log(`Remaining users with images: ${remaining}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
