/**
 * Export Privy Users for Backup/Audit Trail
 *
 * Creates a JSON backup of all Privy users before deletion.
 * Run this BEFORE delete-privy-users.ts
 *
 * Usage: npx tsx scripts/export-privy-users.ts
 */

import "dotenv/config";
import { PrivyClient } from "@privy-io/node";
import * as fs from "fs";
import * as path from "path";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

if (!appId || !appSecret) {
  console.error(
    "Missing Privy configuration: NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET are required"
  );
  process.exit(1);
}

const privy = new PrivyClient({ appId, appSecret });

interface ExportedUser {
  id: string;
  createdAt: number;
  linkedAccounts: Array<{
    type: string;
    address?: string;
    chainType?: string;
  }>;
}

async function main() {
  console.log("\n=== Privy User Export ===\n");

  const users: ExportedUser[] = [];
  let count = 0;

  console.log("Fetching users from Privy...");

  try {
    // Use automatic pagination to iterate through all users
    for await (const user of privy.users().list()) {
      count++;
      users.push({
        id: user.id,
        createdAt: user.created_at,
        linkedAccounts: (user.linked_accounts || []).map((account) => ({
          type: account.type,
          address: "address" in account ? account.address : undefined,
          chainType: "chain_type" in account ? account.chain_type : undefined,
        })),
      });

      if (count % 10 === 0) {
        process.stdout.write(`  Fetched ${count} users...\r`);
      }
    }

    console.log(`\nTotal users found: ${count}`);

    if (count === 0) {
      console.log("No users to export.");
      process.exit(0);
    }

    // Create backup file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `privy-users-backup-${timestamp}.json`;
    const filepath = path.join(process.cwd(), "scripts", filename);

    const exportData = {
      exportedAt: new Date().toISOString(),
      appId: appId,
      totalUsers: count,
      users: users,
    };

    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));

    console.log(`\nBackup saved to: ${filepath}`);
    console.log(`\nExported ${count} user(s).`);
    console.log("\nNext step:");
    console.log("  CONFIRM_DELETE=yes npx tsx scripts/delete-privy-users.ts");
    console.log("");

    process.exit(0);
  } catch (error) {
    console.error("\nError exporting users:", error);
    process.exit(1);
  }
}

main();
