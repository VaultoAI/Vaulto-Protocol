/**
 * Manual one-shot: wrap USDCe held by a Polymarket Safe into pUSD
 *
 * The on-chain "swapper" was trying to route USDC.e -> pUSD via a DEX, but
 * no liquid pool exists. Polymarket's CollateralOnramp.wrap() accepts USDC.e
 * directly and mints pUSD 1:1 to a recipient. This script drives two
 * Safe.execTransaction calls from the EOA owner via Privy server signing:
 *
 *   1. Safe -> USDCe.approve(onramp, amount)
 *   2. Safe -> onramp.wrap(USDCe, safe, amount)
 *
 * Pre-validated owner signatures are used (msg.sender == EOA owner), so no
 * ECDSA signing is required for execTransaction itself.
 *
 * Usage: npx tsx scripts/manual-wrap-safe-usdce-to-pusd.ts
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  createPublicClient,
  encodeFunctionData,
  http,
  pad,
  concat,
  formatUnits,
  type Address,
} from "viem";
import { polygon } from "viem/chains";
import { signAndSendTransaction, waitForTransaction } from "../lib/trading-wallet/server-wallet";
import { ERC20_ABI, POLYMARKET_V2 } from "../lib/trading-wallet/constants";

const EOA: Address = "0x6Ecf7305aD2A0a3C991A90C4E80A4908d0bbaa40";
const SAFE: Address = "0x7d58602bB47fB958b57f221C206D52E01afF401f";
const PRIVY_WALLET_ID = "m9ld2yozw656y99cpsqz0lsq";

const USDCE: Address = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const PUSD: Address = "0xc011a7e12a19f7b1f670d46f03b03f3342e82dfb";
const ONRAMP: Address = POLYMARKET_V2.COLLATERAL_ONRAMP;

const SAFE_ABI = [
  {
    name: "execTransaction",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "signatures", type: "bytes" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "nonce",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getOwners",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    name: "getThreshold",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

const ONRAMP_ABI = [
  {
    name: "wrap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_asset", type: "address" },
      { name: "_to", type: "address" },
      { name: "_amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const client = createPublicClient({
  chain: polygon,
  transport: http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon.drpc.org"),
});

/**
 * Pre-validated owner signature for Gnosis Safe execTransaction:
 *   r = pad32(owner)
 *   s = 0x0...0 (32 bytes)
 *   v = 0x01
 * Length: 65 bytes. Valid only when msg.sender == owner.
 */
function preValidatedOwnerSignature(owner: Address): `0x${string}` {
  const r = pad(owner, { size: 32 });
  const s = pad("0x", { size: 32 });
  const v = "0x01" as const;
  return concat([r, s, v]);
}

async function execFromSafe(
  innerTo: Address,
  innerData: `0x${string}`,
  label: string,
): Promise<string> {
  const sig = preValidatedOwnerSignature(EOA);
  const data = encodeFunctionData({
    abi: SAFE_ABI,
    functionName: "execTransaction",
    args: [
      innerTo,
      0n,
      innerData,
      0, // CALL
      0n,
      0n,
      0n,
      "0x0000000000000000000000000000000000000000" as Address,
      "0x0000000000000000000000000000000000000000" as Address,
      sig,
    ],
  });

  console.log(`[${label}] sending Safe.execTransaction via Privy...`);
  const result = await signAndSendTransaction(PRIVY_WALLET_ID, {
    to: SAFE,
    data,
    chainId: 137,
  });

  if (!result.success || !result.txHash) {
    throw new Error(`[${label}] tx failed: ${result.error}`);
  }
  console.log(`[${label}] tx hash:`, result.txHash);

  const receipt = await waitForTransaction(result.txHash, 1, 180_000);
  if (!receipt.success) {
    throw new Error(`[${label}] tx reverted: ${result.txHash}`);
  }
  console.log(`[${label}] confirmed`);
  return result.txHash;
}

async function main() {
  // 1. Sanity: Safe owner must be EOA, threshold 1
  const [owners, threshold, nonce] = await Promise.all([
    client.readContract({ address: SAFE, abi: SAFE_ABI, functionName: "getOwners" }),
    client.readContract({ address: SAFE, abi: SAFE_ABI, functionName: "getThreshold" }),
    client.readContract({ address: SAFE, abi: SAFE_ABI, functionName: "nonce" }),
  ]);
  console.log("Safe owners:", owners);
  console.log("Safe threshold:", threshold.toString());
  console.log("Safe nonce:", nonce.toString());

  if (threshold !== 1n) {
    throw new Error(`Expected threshold 1, got ${threshold}`);
  }
  const ownerSet = new Set(owners.map((o) => o.toLowerCase()));
  if (!ownerSet.has(EOA.toLowerCase())) {
    throw new Error(`EOA ${EOA} is not an owner of Safe ${SAFE}`);
  }

  // 2. Read balances
  const [usdceBefore, pusdBefore, eoaMatic] = await Promise.all([
    client.readContract({ address: USDCE, abi: ERC20_ABI, functionName: "balanceOf", args: [SAFE] }),
    client.readContract({ address: PUSD, abi: ERC20_ABI, functionName: "balanceOf", args: [SAFE] }),
    client.getBalance({ address: EOA }),
  ]);
  console.log(`Safe USDCe before: ${formatUnits(usdceBefore as bigint, 6)}`);
  console.log(`Safe pUSD  before: ${formatUnits(pusdBefore as bigint, 6)}`);
  console.log(`EOA  MATIC       : ${formatUnits(eoaMatic, 18)}`);

  const amount = usdceBefore as bigint;
  if (amount === 0n) {
    console.log("Nothing to wrap. Done.");
    return;
  }
  if (eoaMatic < 5n * 10n ** 16n) {
    throw new Error("EOA MATIC < 0.05, refuel before running");
  }

  // 3. Approve onramp from Safe
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [ONRAMP, amount],
  });
  await execFromSafe(USDCE, approveData, "approve");

  // 4. Wrap USDCe -> pUSD with Safe as recipient
  const wrapData = encodeFunctionData({
    abi: ONRAMP_ABI,
    functionName: "wrap",
    args: [USDCE, SAFE, amount],
  });
  await execFromSafe(ONRAMP, wrapData, "wrap");

  // 5. Verify
  const [usdceAfter, pusdAfter] = await Promise.all([
    client.readContract({ address: USDCE, abi: ERC20_ABI, functionName: "balanceOf", args: [SAFE] }),
    client.readContract({ address: PUSD, abi: ERC20_ABI, functionName: "balanceOf", args: [SAFE] }),
  ]);
  console.log(`Safe USDCe after : ${formatUnits(usdceAfter as bigint, 6)}`);
  console.log(`Safe pUSD  after : ${formatUnits(pusdAfter as bigint, 6)}`);
  console.log(
    `Delta pUSD: +${formatUnits((pusdAfter as bigint) - (pusdBefore as bigint), 6)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
