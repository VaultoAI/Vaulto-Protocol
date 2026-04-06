import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const client = await pool.connect();

  try {
    // Delete the barikuta account
    console.log("Deleting user with email markus@barikuta.com...");
    const deleteResult = await client.query(
      `DELETE FROM "User" WHERE email = $1 RETURNING id, email, name`,
      ["markus@barikuta.com"]
    );

    if (deleteResult.rows.length > 0) {
      console.log("Deleted user:", deleteResult.rows[0]);
    } else {
      console.log("No user found with email markus@barikuta.com");
    }

    // Whitelist the gmail account as Vaulto employee
    console.log("\nUpdating markus.rinderer@gmail.com to be a Vaulto employee...");
    const updateResult = await client.query(
      `UPDATE "User" SET "isVaultoEmployee" = true WHERE email = $1 RETURNING id, email, name, "isVaultoEmployee"`,
      ["markus.rinderer@gmail.com"]
    );

    if (updateResult.rows.length > 0) {
      console.log("Updated user:", updateResult.rows[0]);
    } else {
      console.log("No user found with email markus.rinderer@gmail.com");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
