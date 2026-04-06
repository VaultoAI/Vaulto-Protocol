/**
 * Deposit Detection Utility
 * Queries on-chain USDC Transfer events to detect deposits that weren't tracked
 * (e.g., from Privy's fundWallet fiat on-ramp)
 */

import { createPublicClient, http, parseAbiItem } from "viem";
import { polygon } from "viem/chains";
import { USDC_ADDRESSES, USDC_DECIMALS, CHAIN_IDS } from "./constants";

// Create a public client for Polygon
const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon.drpc.org"),
});

// ERC20 Transfer event signature
const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

// Polygon block time is ~2 seconds
// Free tier RPCs (drpc.org) have strict block range limits
// Use 10,000 blocks (~5.5 hours) as default to catch delayed fiat on-ramp deposits
const DEFAULT_BLOCK_RANGE = BigInt(10000);
const MAX_BLOCKS_PER_QUERY = BigInt(2000); // Conservative limit for free tier RPCs

export interface DetectedTransfer {
  txHash: `0x${string}`;
  fromAddress: `0x${string}`;
  toAddress: `0x${string}`;
  amount: bigint;
  amountFormatted: string;
  blockNumber: bigint;
  timestamp?: number;
}

/**
 * Query USDC Transfer events to a specific address
 * Returns all transfers within the specified block range
 * Automatically chunks large ranges to stay under RPC limits
 */
export async function queryUsdcTransfers(
  toAddress: `0x${string}`,
  options: {
    blockRange?: bigint;
    fromBlock?: bigint;
    toBlock?: bigint;
    chainId?: number;
  } = {}
): Promise<DetectedTransfer[]> {
  const chainId = options.chainId ?? CHAIN_IDS.POLYGON;

  // Get the USDC contract address for the chain
  const usdcAddress = chainId === CHAIN_IDS.POLYGON
    ? USDC_ADDRESSES.POLYGON_NATIVE
    : null;

  if (!usdcAddress) {
    throw new Error(`USDC not supported on chain ${chainId}`);
  }

  // Get current block number
  const currentBlock = await polygonClient.getBlockNumber();

  // Calculate block range
  const toBlock = options.toBlock ?? currentBlock;
  const requestedFromBlock = options.fromBlock ?? toBlock - (options.blockRange ?? DEFAULT_BLOCK_RANGE);

  // Ensure fromBlock is not negative
  const fromBlock = requestedFromBlock < BigInt(0) ? BigInt(0) : requestedFromBlock;

  const totalRange = toBlock - fromBlock;
  const transfers: DetectedTransfer[] = [];

  // If range is within limit, do a single query
  if (totalRange <= MAX_BLOCKS_PER_QUERY) {
    const results = await queryBlockRange(usdcAddress, toAddress, fromBlock, toBlock);
    transfers.push(...results);
  } else {
    // Chunk the query into smaller ranges
    let chunkStart = fromBlock;
    while (chunkStart < toBlock) {
      const chunkEnd = chunkStart + MAX_BLOCKS_PER_QUERY > toBlock
        ? toBlock
        : chunkStart + MAX_BLOCKS_PER_QUERY;

      const results = await queryBlockRange(usdcAddress, toAddress, chunkStart, chunkEnd);
      transfers.push(...results);

      chunkStart = chunkEnd + BigInt(1);
    }
  }

  return transfers;
}

/**
 * Query a single block range for Transfer events
 */
async function queryBlockRange(
  usdcAddress: string,
  toAddress: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint
): Promise<DetectedTransfer[]> {
  try {
    const logs = await polygonClient.getLogs({
      address: usdcAddress as `0x${string}`,
      event: TRANSFER_EVENT,
      args: {
        to: toAddress,
      },
      fromBlock,
      toBlock,
    });

    const transfers: DetectedTransfer[] = [];

    for (const log of logs) {
      if (!log.transactionHash) continue;

      const fromAddr = log.args.from;
      const toAddr = log.args.to;
      const value = log.args.value;

      if (!fromAddr || !toAddr || value === undefined) continue;

      // Format amount for display (USDC has 6 decimals)
      const amountFormatted = (Number(value) / Math.pow(10, USDC_DECIMALS)).toFixed(2);

      transfers.push({
        txHash: log.transactionHash,
        fromAddress: fromAddr,
        toAddress: toAddr,
        amount: value,
        amountFormatted,
        blockNumber: log.blockNumber,
      });
    }

    return transfers;
  } catch (error) {
    console.error("[Deposit Detection] Failed to query block range:", fromBlock, "-", toBlock, error);
    throw error;
  }
}

/**
 * Get block timestamp for a block number
 */
export async function getBlockTimestamp(blockNumber: bigint): Promise<number> {
  const block = await polygonClient.getBlock({ blockNumber });
  return Number(block.timestamp);
}

/**
 * Get transaction receipt to verify a transfer was successful
 */
export async function getTransactionReceipt(txHash: `0x${string}`) {
  try {
    return await polygonClient.getTransactionReceipt({ hash: txHash });
  } catch (error) {
    console.error("[Deposit Detection] Failed to get tx receipt:", error);
    return null;
  }
}

/**
 * Get current block number
 */
export async function getCurrentBlockNumber(): Promise<bigint> {
  return polygonClient.getBlockNumber();
}
