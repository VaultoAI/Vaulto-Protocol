import type { Address } from "viem";
import { ERC20_ABI } from "@/lib/uniswap/abis";
import { UNISWAP_ADDRESSES } from "@/lib/uniswap/constants";
import type { PublicClient, WalletClient } from "viem";

/** Max uint256 for unlimited approval (optional; some prefer exact amount). */
export const MAX_APPROVAL = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

/**
 * Get current allowance for a spender (default: SwapRouter02).
 */
export async function getAllowance(
  client: PublicClient,
  params: {
    token: Address;
    owner: Address;
    spender?: Address;
  }
): Promise<bigint> {
  const spender = params.spender ?? UNISWAP_ADDRESSES.SwapRouter02;
  return client.readContract({
    address: params.token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [params.owner, spender],
  });
}

/**
 * Check if allowance is sufficient; if not, return amount needed to approve.
 */
export function checkAllowance(
  allowance: bigint,
  requiredAmount: bigint
): { sufficient: boolean; approveAmount: bigint } {
  if (allowance >= requiredAmount) {
    return { sufficient: true, approveAmount: BigInt(0) };
  }
  return { sufficient: false, approveAmount: requiredAmount };
}

/**
 * Build approve transaction params (for use with writeContract).
 */
export function buildApproveParams(params: {
  token: Address;
  spender: Address;
  amount: bigint;
}): {
  address: Address;
  abi: typeof ERC20_ABI;
  functionName: "approve";
  args: [Address, bigint];
} {
  return {
    address: params.token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [params.spender, params.amount],
  };
}
