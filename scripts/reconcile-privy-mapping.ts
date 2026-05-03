/**
 * Reconcile Wallet ↔ User Mapping with Privy
 *
 * Privy is the source of truth for wallet ownership. This script iterates
 * every Privy user, derives the canonical (privyUserId, email, embedded
 * wallet address), and reconciles the Supabase `User` and `TradingWallet`
 * tables to match. Vaulto API credentials (Polymarket, etc.) are *not*
 * re-keyed server-to-server here — affected users are written to
 * `scripts/mismatches.json` so the next time they sign in,
 * `/api/trading/ensure-credentials` recreates Vaulto credentials against
 * the corrected wallet address.
 *
 * Modes (env):
 *   DRY_RUN=1   (default) print plan, no writes
 *   APPLY=1     execute Supabase writes
 *
 * Usage:
 *   npx tsx scripts/reconcile-privy-mapping.ts             # dry-run
 *   APPLY=1 npx tsx scripts/reconcile-privy-mapping.ts     # write
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrivyClient } from "@privy-io/node";
import {
  resolvePrivyEmail,
  getPrivyEmbeddedWalletAddress,
} from "../lib/trading-wallet/privy-server";

const APPLY = process.env.APPLY === "1";
const DRY_RUN = !APPLY;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function getPrivy(): PrivyClient {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Missing NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET");
  }
  return new PrivyClient({ appId, appSecret });
}

interface Mismatch {
  privyUserId: string;
  email: string;
  oldAddress: string | null;
  newAddress: string;
  reason: "address_changed" | "wallet_created" | "user_relinked";
}

interface Stats {
  privyUsers: number;
  noEmbeddedWallet: number;
  privyOnly: number;
  userIdentityUpdates: number;
  walletNoops: number;
  walletCreates: number;
  walletUpdates: number;
  walletConflicts: number;
}

async function main() {
  console.log(`\n=== Reconcile Privy Mapping (${DRY_RUN ? "DRY RUN" : "APPLY"}) ===\n`);

  const privy = getPrivy();
  const stats: Stats = {
    privyUsers: 0,
    noEmbeddedWallet: 0,
    privyOnly: 0,
    userIdentityUpdates: 0,
    walletNoops: 0,
    walletCreates: 0,
    walletUpdates: 0,
    walletConflicts: 0,
  };
  const mismatches: Mismatch[] = [];
  const conflicts: Array<{
    privyUserId: string;
    email: string;
    address: string;
    addressOwnedByUserId: string;
  }> = [];

  for await (const privyUser of privy.users().list()) {
    stats.privyUsers++;

    const email = resolvePrivyEmail(privyUser as unknown as { id: string; linked_accounts: Array<{ type: string; [k: string]: unknown }> });
    const newAddress = getPrivyEmbeddedWalletAddress(privyUser as unknown as { id: string; linked_accounts: Array<{ type: string; [k: string]: unknown }> });

    if (!newAddress) {
      stats.noEmbeddedWallet++;
      continue;
    }

    // Find DB user: privyUserId first, then email
    let user = await prisma.user.findUnique({
      where: { privyUserId: privyUser.id },
      include: { tradingWallet: true },
    });
    if (!user) {
      user = await prisma.user.findUnique({
        where: { email },
        include: { tradingWallet: true },
      });
    }

    if (!user) {
      stats.privyOnly++;
      console.log(`[privy-only] ${privyUser.id} ${email} — no DB row, skipping (will be created on next sign-in)`);
      continue;
    }

    // Reconcile User identity
    if (user.privyUserId !== privyUser.id || user.email !== email) {
      stats.userIdentityUpdates++;
      console.log(`[user] ${user.id}: email ${user.email} → ${email}, privyUserId ${user.privyUserId ?? "<null>"} → ${privyUser.id}`);
      if (APPLY) {
        await prisma.user.update({
          where: { id: user.id },
          data: { privyUserId: privyUser.id, email },
        });
      }
    }

    // Reconcile TradingWallet
    const tw = user.tradingWallet;
    const conflictingAddrRow = await prisma.tradingWallet.findUnique({
      where: { address: newAddress },
    });

    if (!tw && !conflictingAddrRow) {
      stats.walletCreates++;
      mismatches.push({
        privyUserId: privyUser.id,
        email,
        oldAddress: null,
        newAddress,
        reason: "wallet_created",
      });
      console.log(`[wallet+] user ${user.id} ← ${newAddress}`);
      if (APPLY) {
        await prisma.tradingWallet.create({
          data: {
            userId: user.id,
            address: newAddress,
            privyWalletId: newAddress,
            status: "PENDING_CREATION",
          },
        });
      }
    } else if (tw && tw.address.toLowerCase() === newAddress.toLowerCase()) {
      stats.walletNoops++;
    } else if (tw && conflictingAddrRow && conflictingAddrRow.userId !== user.id) {
      stats.walletConflicts++;
      conflicts.push({
        privyUserId: privyUser.id,
        email,
        address: newAddress,
        addressOwnedByUserId: conflictingAddrRow.userId,
      });
      console.warn(`[CONFLICT] user ${user.id} should own ${newAddress} but it's held by user ${conflictingAddrRow.userId} — manual resolution required`);
    } else if (tw && tw.address.toLowerCase() !== newAddress.toLowerCase()) {
      // user has a wallet, but address differs from Privy
      stats.walletUpdates++;
      mismatches.push({
        privyUserId: privyUser.id,
        email,
        oldAddress: tw.address,
        newAddress,
        reason: "address_changed",
      });
      console.log(`[wallet~] user ${user.id}: ${tw.address} → ${newAddress}`);
      if (APPLY) {
        // If a stale row holds the new address under this same user, drop it first
        if (conflictingAddrRow && conflictingAddrRow.userId === user.id) {
          await prisma.tradingWallet.delete({ where: { id: conflictingAddrRow.id } });
        }
        await prisma.tradingWallet.update({
          where: { id: tw.id },
          data: { address: newAddress, privyWalletId: newAddress },
        });
      }
    } else if (!tw && conflictingAddrRow) {
      // address belongs to another user — conflict
      stats.walletConflicts++;
      conflicts.push({
        privyUserId: privyUser.id,
        email,
        address: newAddress,
        addressOwnedByUserId: conflictingAddrRow.userId,
      });
      console.warn(`[CONFLICT] user ${user.id} has no wallet; ${newAddress} held by user ${conflictingAddrRow.userId}`);
    }
  }

  // Write mismatches.json so Vaulto-side credentials can be re-derived later
  const outDir = path.join(process.cwd(), "scripts");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const mismatchPath = path.join(outDir, `mismatches-${stamp}.json`);
  const conflictPath = path.join(outDir, `conflicts-${stamp}.json`);

  if (mismatches.length > 0) {
    fs.writeFileSync(
      mismatchPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), apply: APPLY, mismatches }, null, 2)
    );
    console.log(`\nMismatches written to: ${mismatchPath}`);
  }
  if (conflicts.length > 0) {
    fs.writeFileSync(
      conflictPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), conflicts }, null, 2)
    );
    console.log(`Conflicts written to: ${conflictPath}`);
  }

  console.log("\n=== Stats ===");
  console.log(JSON.stringify(stats, null, 2));
  console.log(`\nMode: ${DRY_RUN ? "DRY RUN — no changes written" : "APPLIED"}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
