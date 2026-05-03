/**
 * Server-Side Wallet Operations
 *
 * This module handles server-side wallet creation with policies and signing.
 * Wallets are created with Server Side Signing Policy, enabling the server
 * to sign transactions on behalf of users without client-side wallet popups.
 */

import { PrivyClient } from "@privy-io/node";
import { encodeFunctionData, createPublicClient, http } from "viem";
import { polygon } from "viem/chains";
import {
  USDC_ADDRESSES,
  DEFAULT_TRADING_CHAIN_ID,
  ERC20_ABI,
} from "./constants";

// Privy client singleton
let _privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!_privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error(
        "Missing Privy configuration: NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET are required"
      );
    }

    _privyClient = new PrivyClient({ appId, appSecret });
  }
  return _privyClient;
}

/**
 * Check if server-side signing is properly configured
 */
export function isServerSigningConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
    process.env.PRIVY_APP_SECRET &&
    process.env.PRIVY_AUTHORIZATION_KEY_ID &&
    process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY &&
    process.env.PRIVY_TRADING_POLICY_ID
  );
}

/**
 * Get server signing configuration
 */
function getServerSigningConfig() {
  const authKeyId = process.env.PRIVY_AUTHORIZATION_KEY_ID;
  const authPrivateKey = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY;
  const policyId = process.env.PRIVY_TRADING_POLICY_ID;

  if (!authKeyId || !authPrivateKey || !policyId) {
    throw new Error(
      "Server signing not configured. Missing PRIVY_AUTHORIZATION_KEY_ID, PRIVY_AUTHORIZATION_PRIVATE_KEY, or PRIVY_TRADING_POLICY_ID"
    );
  }

  return { authKeyId, authPrivateKey, policyId };
}

export interface ServerWalletInfo {
  walletId: string;
  address: string;
  chainType: string;
  policyId: string;
}

/**
 * Create a server-controlled wallet for a Privy user
 *
 * This creates an embedded wallet with:
 * - The trading policy attached (USDC transfers only)
 * - Server authorization key as an additional signer
 *
 * @param privyUserId - The Privy user ID (e.g., "did:privy:xxxxx")
 * @returns Wallet information including ID, address, and policy
 */
export async function createServerWallet(
  privyUserId: string
): Promise<ServerWalletInfo> {
  const privy = getPrivyClient();
  const config = getServerSigningConfig();

  console.log("[Server Wallet] Creating wallet for user:", privyUserId);

  // Create wallet with policy and server signer
  // Using the wallets().create() method with owner
  const wallet = await privy.wallets().create({
    chain_type: "ethereum",
    owner: { user_id: privyUserId },
    policy_ids: [config.policyId],
    additional_signers: [
      {
        signer_id: config.authKeyId,
        // The policy already restricts what transactions are allowed
        // No override policy needed - use the main policy
      },
    ],
  });

  console.log("[Server Wallet] Created wallet:", {
    id: wallet.id,
    address: wallet.address,
    chainType: wallet.chain_type,
  });

  return {
    walletId: wallet.id,
    address: wallet.address,
    chainType: wallet.chain_type,
    policyId: config.policyId,
  };
}

/**
 * Create a wallet for an existing user via the pregenerate endpoint
 *
 * Use this when the user already exists in Privy but doesn't have a wallet.
 *
 * @param privyUserId - The Privy user ID
 * @returns Wallet information
 */
export async function createWalletForExistingUser(
  privyUserId: string
): Promise<ServerWalletInfo> {
  const privy = getPrivyClient();
  const config = getServerSigningConfig();

  console.log(
    "[Server Wallet] Creating wallet for existing user:",
    privyUserId
  );

  // Create wallet for existing user using the pregenerateWallets API
  const user = await privy.users().pregenerateWallets(privyUserId, {
    wallets: [
      {
        chain_type: "ethereum",
        policy_ids: [config.policyId],
        additional_signers: [
          {
            signer_id: config.authKeyId,
          },
        ],
      },
    ],
  });

  // Find the newly created ethereum wallet
  // The linked_accounts array contains wallet objects
  const embeddedWallet = user.linked_accounts.find(
    (account: { type: string; wallet_client_type?: string; chain_type?: string }) =>
      account.type === "wallet" &&
      account.wallet_client_type === "privy" &&
      account.chain_type === "ethereum"
  );

  if (!embeddedWallet || !("address" in embeddedWallet)) {
    throw new Error("Failed to create embedded wallet for user");
  }

  // Get wallet ID from the wallet object
  const walletWithId = embeddedWallet as { address: string; wallet_id?: string };
  const walletId = walletWithId.wallet_id || "";

  console.log("[Server Wallet] Created wallet for existing user:", {
    walletId,
    address: walletWithId.address,
  });

  return {
    walletId,
    address: walletWithId.address,
    chainType: "ethereum",
    policyId: config.policyId,
  };
}

/**
 * Ensure a wallet has the trading policy + server signer attached.
 *
 * Idempotent. Fetches the wallet from Privy and patches it via PATCH
 * /v1/wallets/{walletId} only when the desired policy/signer is missing.
 *
 * Required because Privy can auto-provision an embedded wallet during
 * OAuth login (despite createOnLogin:"off"), and that wallet has no
 * policy or signer attached.
 */
export async function ensureWalletPolicy(
  privyUserId: string,
  walletId: string
): Promise<ServerWalletInfo & { serverSignerId: string; alreadyConfigured: boolean }> {
  const privy = getPrivyClient();
  const config = getServerSigningConfig();

  const wallet = await privy.wallets().get(walletId);

  const hasPolicy = wallet.policy_ids?.includes(config.policyId) ?? false;
  const hasSigner =
    wallet.additional_signers?.some((s) => s.signer_id === config.authKeyId) ?? false;

  if (hasPolicy && hasSigner) {
    console.log("[Server Wallet] Policy + signer already attached:", {
      privyUserId,
      walletId,
    });
    return {
      walletId,
      address: wallet.address,
      chainType: wallet.chain_type,
      policyId: config.policyId,
      serverSignerId: config.authKeyId,
      alreadyConfigured: true,
    };
  }

  console.log("[Server Wallet] Attaching policy/signer to wallet:", {
    privyUserId,
    walletId,
    hadPolicy: hasPolicy,
    hadSigner: hasSigner,
  });

  const updated = await privy.wallets()._update(walletId, {
    policy_ids: [config.policyId],
    additional_signers: [{ signer_id: config.authKeyId }],
  });

  return {
    walletId: updated.id,
    address: updated.address,
    chainType: updated.chain_type,
    policyId: config.policyId,
    serverSignerId: config.authKeyId,
    alreadyConfigured: false,
  };
}

export interface TransactionData {
  to: string;
  data: string;
  value?: string;
  chainId: number;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Sign and send a transaction using server-side signing
 *
 * This uses the authorization private key to sign transactions on behalf of users.
 * The policy must allow the transaction for it to succeed.
 *
 * @param walletId - The Privy wallet ID
 * @param txData - Transaction data (to, data, value, chainId)
 * @returns Transaction result with hash or error
 */
export async function signAndSendTransaction(
  walletId: string,
  txData: TransactionData
): Promise<TransactionResult> {
  const privy = getPrivyClient();
  const config = getServerSigningConfig();

  console.log("[Server Wallet] Signing transaction:", {
    walletId,
    to: txData.to,
    chainId: txData.chainId,
  });

  try {
    // CAIP-2 chain identifier for Polygon
    const caip2 = `eip155:${txData.chainId}`;

    // Send transaction using server authorization key
    const result = await privy.wallets().ethereum().sendTransaction(walletId, {
      caip2,
      params: {
        transaction: {
          to: txData.to as `0x${string}`,
          data: txData.data as `0x${string}`,
          value: txData.value || "0x0",
        },
      },
      authorization_context: {
        authorization_private_keys: [config.authPrivateKey],
      },
    });

    console.log("[Server Wallet] Transaction sent:", result.hash);

    return {
      success: true,
      txHash: result.hash,
    };
  } catch (error) {
    console.error("[Server Wallet] Transaction failed:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction failed",
    };
  }
}

/**
 * Execute a USDC transfer using server-side signing
 *
 * This is a convenience function that encodes the transfer call and sends it.
 *
 * @param walletId - The Privy wallet ID
 * @param toAddress - Recipient address
 * @param amount - Amount in raw units (with decimals)
 * @param chainId - Chain ID (default: Polygon)
 * @returns Transaction result
 */
export async function executeUsdcTransfer(
  walletId: string,
  toAddress: string,
  amount: bigint,
  chainId: number = DEFAULT_TRADING_CHAIN_ID
): Promise<TransactionResult> {
  // Use native USDC on Polygon
  const usdcAddress = USDC_ADDRESSES.POLYGON_NATIVE;

  // Encode the transfer call
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [toAddress as `0x${string}`, amount],
  });

  console.log("[Server Wallet] Executing USDC transfer:", {
    walletId,
    toAddress,
    amount: amount.toString(),
    usdcContract: usdcAddress,
  });

  return signAndSendTransaction(walletId, {
    to: usdcAddress,
    data,
    chainId,
  });
}

/**
 * Wait for a transaction to be confirmed on-chain
 *
 * @param txHash - Transaction hash
 * @param confirmations - Number of confirmations to wait for (default: 1)
 * @param timeout - Timeout in milliseconds (default: 60000)
 * @returns Transaction receipt status
 */
export async function waitForTransaction(
  txHash: string,
  confirmations: number = 1,
  timeout: number = 60000
): Promise<{ success: boolean; status: "success" | "reverted" }> {
  const publicClient = createPublicClient({
    chain: polygon,
    transport: http(),
  });

  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      confirmations,
      timeout,
    });

    return {
      success: receipt.status === "success",
      status: receipt.status,
    };
  } catch (error) {
    console.error("[Server Wallet] Transaction confirmation failed:", error);
    throw error;
  }
}

/**
 * Get a user's wallet from Privy
 *
 * @param privyUserId - The Privy user ID
 * @returns Wallet info or null if not found
 */
export async function getUserWallet(
  privyUserId: string
): Promise<ServerWalletInfo | null> {
  const privy = getPrivyClient();

  try {
    const user = await privy.users()._get(privyUserId);

    // Find the ethereum embedded wallet
    const embeddedWallet = user.linked_accounts.find(
      (account: { type: string; wallet_client_type?: string; chain_type?: string }) =>
        account.type === "wallet" &&
        account.wallet_client_type === "privy" &&
        account.chain_type === "ethereum"
    );

    if (!embeddedWallet || !("address" in embeddedWallet)) {
      return null;
    }

    const walletWithId = embeddedWallet as { address: string; wallet_id?: string };
    const walletId = walletWithId.wallet_id || "";

    return {
      walletId,
      address: walletWithId.address,
      chainType: "ethereum",
      policyId: process.env.PRIVY_TRADING_POLICY_ID || "",
    };
  } catch (error) {
    console.error("[Server Wallet] Failed to get user wallet:", error);
    return null;
  }
}
