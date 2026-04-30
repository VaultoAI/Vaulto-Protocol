import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE "WalletSyncState"
         SET "cachedHistory" = NULL,
             "cachedBalance" = NULL,
             "balanceSyncedAt" = NULL`
    );
    console.log(`[Invalidate] Cleared cache on ${result.rowCount} WalletSyncState rows`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
