import "dotenv/config";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Check the specific wallet
    const walletResult = await client.query(`
      SELECT id, address, "hasServerSigner", "policyId", "serverSignerId", "privyWalletId", status
      FROM "TradingWallet"
      WHERE id = 'cmoaid6ql0002oysbvo147n7j'
    `);
    console.log("Trading wallet from DB:", JSON.stringify(walletResult.rows, null, 2));

    // Check all wallets
    const allWallets = await client.query(`
      SELECT id, address, "hasServerSigner", "policyId", status
      FROM "TradingWallet"
      ORDER BY "createdAt" DESC
      LIMIT 5
    `);
    console.log("\nRecent trading wallets:", JSON.stringify(allWallets.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
