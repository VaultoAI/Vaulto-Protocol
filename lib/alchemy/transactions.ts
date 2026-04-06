/**
 * Alchemy service for fetching on-chain transactions
 * Uses the Asset Transfers API to get ERC20 and native token transfers
 */

export interface OnChainTransaction {
  id: string;
  txHash: string;
  type: "deposit" | "withdrawal";
  asset: string | null;
  amount: number | null;
  from: string;
  to: string | null;
  timestamp: string;
  status: "COMPLETED";
  address: string; // Counterparty address
}

interface AlchemyTransfer {
  blockNum: string;
  hash: string;
  from: string;
  to: string | null;
  value: number | null;
  asset: string | null;
  category: string;
  rawContract: {
    value: string | null;
    address: string | null;
    decimal: string | null;
  };
  metadata: {
    blockTimestamp: string;
  };
}

interface AlchemyAssetTransfersResponse {
  result: {
    transfers: AlchemyTransfer[];
    pageKey?: string;
  };
}

interface FetchOptions {
  maxCount?: number;
}

const ALCHEMY_BASE_URL = "https://polygon-mainnet.g.alchemy.com/v2";

/**
 * Whitelist of legitimate token contract addresses on Polygon mainnet.
 * Only transactions involving these tokens will be displayed to users.
 * This prevents spam/scam tokens from appearing in transaction history.
 */
const WHITELISTED_TOKEN_CONTRACTS: Set<string> = new Set([
  // USDC (Native Circle USDC on Polygon)
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
  // USDC.e (Bridged USDC from Ethereum)
  "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
  // USDT (Tether)
  "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  // WETH (Wrapped Ether)
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
  // WMATIC (Wrapped MATIC)
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
]);

/**
 * Check if a transfer is from a legitimate/whitelisted source.
 * Allows native token transfers (MATIC/POL) and whitelisted ERC20 tokens.
 */
function isLegitimateTransfer(transfer: AlchemyTransfer): boolean {
  // Native token transfers (MATIC/POL) are always legitimate
  if (transfer.category === "external") {
    return true;
  }

  // For ERC20 transfers, check if the contract address is whitelisted
  if (transfer.category === "erc20" && transfer.rawContract?.address) {
    const contractAddress = transfer.rawContract.address.toLowerCase();
    return WHITELISTED_TOKEN_CONTRACTS.has(contractAddress);
  }

  return false;
}

/**
 * Fetch transfers from Alchemy Asset Transfers API
 */
async function fetchTransfers(
  apiKey: string,
  walletAddress: string,
  direction: "from" | "to",
  options: FetchOptions = {}
): Promise<AlchemyTransfer[]> {
  const { maxCount = 100 } = options;

  const params: Record<string, unknown> = {
    category: ["erc20", "external"],
    withMetadata: true,
    order: "desc",
    maxCount: `0x${maxCount.toString(16)}`, // Convert to hex string
  };

  if (direction === "from") {
    params.fromAddress = walletAddress;
  } else {
    params.toAddress = walletAddress;
  }

  const response = await fetch(`${ALCHEMY_BASE_URL}/${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [params],
    }),
  });

  // Handle non-OK responses (including 403 for disabled networks)
  if (!response.ok) {
    const text = await response.text();
    console.error(`[Alchemy] API error ${response.status}: ${text}`);
    throw new Error(`Alchemy API error: ${response.status} - ${text}`);
  }

  // Parse JSON response, handling potential non-JSON responses
  let data: AlchemyAssetTransfersResponse;
  try {
    data = (await response.json()) as AlchemyAssetTransfersResponse;
  } catch {
    const text = await response.text();
    console.error(`[Alchemy] Invalid JSON response: ${text}`);
    throw new Error(`Alchemy API returned invalid JSON: ${text}`);
  }

  // Check for JSON-RPC errors
  if ((data as unknown as { error?: { message: string } }).error) {
    const error = (data as unknown as { error: { message: string } }).error;
    console.error(`[Alchemy] JSON-RPC error: ${error.message}`);
    throw new Error(`Alchemy API error: ${error.message}`);
  }

  if (!data.result?.transfers) {
    return [];
  }

  return data.result.transfers;
}

/**
 * Convert Alchemy transfer to our OnChainTransaction format
 */
function toOnChainTransaction(
  transfer: AlchemyTransfer,
  walletAddress: string
): OnChainTransaction {
  const isIncoming = transfer.to?.toLowerCase() === walletAddress.toLowerCase();
  const type = isIncoming ? "deposit" : "withdrawal";
  const counterpartyAddress = isIncoming ? transfer.from : (transfer.to ?? "");

  // Normalize asset name
  let asset = transfer.asset;
  if (asset === "MATIC" || asset === "POL") {
    asset = "MATIC"; // Normalize POL to MATIC for display
  }

  return {
    id: `${transfer.hash}-${type}`,
    txHash: transfer.hash,
    type,
    asset,
    amount: transfer.value,
    from: transfer.from,
    to: transfer.to,
    timestamp: transfer.metadata.blockTimestamp,
    status: "COMPLETED",
    address: counterpartyAddress,
  };
}

/**
 * Filter transactions to USDC-only (both native USDC and USDC.e bridged)
 * Used for balance chart calculations
 */
export function filterUsdcTransactions(
  txs: OnChainTransaction[]
): OnChainTransaction[] {
  return txs.filter((tx) => tx.asset === "USDC" || tx.asset === "USDC.e");
}

/**
 * Fetch all wallet transactions (both incoming and outgoing)
 * Returns transactions sorted by timestamp (newest first)
 */
export async function fetchWalletTransactions(
  walletAddress: string,
  options: FetchOptions = {}
): Promise<OnChainTransaction[]> {
  const apiKey = process.env.ALCHEMY_API_KEY;

  if (!apiKey) {
    console.warn("[Alchemy] ALCHEMY_API_KEY not configured");
    return [];
  }

  try {
    // Fetch both incoming (deposits) and outgoing (withdrawals) transfers in parallel
    const [incomingTransfers, outgoingTransfers] = await Promise.all([
      fetchTransfers(apiKey, walletAddress, "to", options),
      fetchTransfers(apiKey, walletAddress, "from", options),
    ]);

    // Filter out spam/fraudulent transfers and convert to our transaction format
    const legitimateIncoming = incomingTransfers.filter(isLegitimateTransfer);
    const legitimateOutgoing = outgoingTransfers.filter(isLegitimateTransfer);

    const incomingTxs = legitimateIncoming.map((t) =>
      toOnChainTransaction(t, walletAddress)
    );
    const outgoingTxs = legitimateOutgoing.map((t) =>
      toOnChainTransaction(t, walletAddress)
    );

    // Merge and deduplicate (same hash could appear in both if it's a self-transfer)
    const allTxs = [...incomingTxs, ...outgoingTxs];
    const seen = new Set<string>();
    const uniqueTxs = allTxs.filter((tx) => {
      if (seen.has(tx.id)) return false;
      seen.add(tx.id);
      return true;
    });

    // Sort by timestamp descending (newest first)
    uniqueTxs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return uniqueTxs;
  } catch (error) {
    console.error("[Alchemy] Failed to fetch transactions:", error);
    throw error;
  }
}
