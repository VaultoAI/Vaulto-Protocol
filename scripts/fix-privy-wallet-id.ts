import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import pg from "pg";

async function main() {
  const correctWalletId = "m9ld2yozw656y99cpsqz0lsq";
  const tradingWalletId = "cmoaid6ql0002oysbvo147n7j";

  console.log("Fixing privyWalletId in database...");
  console.log("  Trading Wallet ID:", tradingWalletId);
  console.log("  Correct Privy Wallet ID:", correctWalletId);

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Update the privyWalletId
    const result = await client.query(`
      UPDATE "TradingWallet"
      SET "privyWalletId" = $1
      WHERE id = $2
      RETURNING id, address, "privyWalletId", "hasServerSigner"
    `, [correctWalletId, tradingWalletId]);

    if (result.rows.length === 0) {
      console.log("No wallet found to update!");
      return;
    }

    console.log("\nUpdated wallet:", JSON.stringify(result.rows[0], null, 2));
    console.log("\nDone! The privyWalletId has been corrected.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
