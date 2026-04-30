/**
 * Retry wrap step only. Approve already executed in prior run.
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
import { ERC20_ABI } from "../lib/trading-wallet/constants";

const EOA: Address = "0x6Ecf7305aD2A0a3C991A90C4E80A4908d0bbaa40";
const SAFE: Address = "0x7d58602bB47fB958b57f221C206D52E01afF401f";
const PRIVY_WALLET_ID = "m9ld2yozw656y99cpsqz0lsq";
const USDCE: Address = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const PUSD: Address = "0xc011a7e12a19f7b1f670d46f03b03f3342e82dfb";
const ONRAMP: Address = "0x93070a847efEf7F70739046A929D47a521F5B8ee";

const SAFE_ABI = [
  { name: "execTransaction", type: "function", stateMutability: "payable", inputs: [
    { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "data", type: "bytes" },
    { name: "operation", type: "uint8" }, { name: "safeTxGas", type: "uint256" }, { name: "baseGas", type: "uint256" },
    { name: "gasPrice", type: "uint256" }, { name: "gasToken", type: "address" }, { name: "refundReceiver", type: "address" },
    { name: "signatures", type: "bytes" }], outputs: [{ type: "bool" }] },
] as const;

const ONRAMP_ABI = [
  { name: "wrap", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "_asset", type: "address" }, { name: "_to", type: "address" }, { name: "_amount", type: "uint256" }], outputs: [] },
] as const;

const client = createPublicClient({
  chain: polygon,
  transport: http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon.drpc.org"),
});

function preValidatedSig(owner: Address): `0x${string}` {
  return concat([pad(owner, { size: 32 }), pad("0x", { size: 32 }), "0x01"]);
}

async function main() {
  const [usdceBefore, pusdBefore] = await Promise.all([
    client.readContract({ address: USDCE, abi: ERC20_ABI, functionName: "balanceOf", args: [SAFE] }),
    client.readContract({ address: PUSD, abi: ERC20_ABI, functionName: "balanceOf", args: [SAFE] }),
  ]);
  console.log(`Safe USDCe before: ${formatUnits(usdceBefore as bigint, 6)}`);
  console.log(`Safe pUSD  before: ${formatUnits(pusdBefore as bigint, 6)}`);

  const amount = usdceBefore as bigint;
  if (amount === 0n) { console.log("nothing to wrap"); return; }

  const wrapInner = encodeFunctionData({
    abi: ONRAMP_ABI,
    functionName: "wrap",
    args: [USDCE, SAFE, amount],
  });

  const data = encodeFunctionData({
    abi: SAFE_ABI,
    functionName: "execTransaction",
    args: [
      ONRAMP, 0n, wrapInner, 0,
      500000n, // safeTxGas: explicit so any estimate-gas race won't hit GS013
      0n, 0n,
      "0x0000000000000000000000000000000000000000" as Address,
      "0x0000000000000000000000000000000000000000" as Address,
      preValidatedSig(EOA),
    ],
  });

  console.log("sending wrap via Privy...");
  const r = await signAndSendTransaction(PRIVY_WALLET_ID, { to: SAFE, data, chainId: 137 });
  if (!r.success || !r.txHash) throw new Error(`failed: ${r.error}`);
  console.log("tx:", r.txHash);
  const rcpt = await waitForTransaction(r.txHash, 1, 180_000);
  if (!rcpt.success) throw new Error(`reverted: ${r.txHash}`);
  console.log("confirmed");

  const [usdceAfter, pusdAfter] = await Promise.all([
    client.readContract({ address: USDCE, abi: ERC20_ABI, functionName: "balanceOf", args: [SAFE] }),
    client.readContract({ address: PUSD, abi: ERC20_ABI, functionName: "balanceOf", args: [SAFE] }),
  ]);
  console.log(`Safe USDCe after: ${formatUnits(usdceAfter as bigint, 6)}`);
  console.log(`Safe pUSD  after: ${formatUnits(pusdAfter as bigint, 6)}`);
  console.log(`pUSD delta: +${formatUnits((pusdAfter as bigint) - (pusdBefore as bigint), 6)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
