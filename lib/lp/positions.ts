import type { PublicClient } from "viem";
import { UNISWAP_ADDRESSES } from "@/lib/uniswap/constants";
import { NONFUNGIBLE_POSITION_MANAGER_ABI } from "@/lib/uniswap/abis";

export type PositionInfo = {
  tokenId: bigint;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
};

/**
 * Fetch all position token IDs owned by the user.
 */
export async function getPositionTokenIds(
  client: PublicClient,
  owner: `0x${string}`
): Promise<bigint[]> {
  const balance = await client.readContract({
    address: UNISWAP_ADDRESSES.NonfungiblePositionManager,
    abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
    functionName: "balanceOf",
    args: [owner],
  });
  if (balance === BigInt(0)) return [];
  const ids: bigint[] = [];
  for (let i = 0; i < Number(balance); i++) {
    const id = await client.readContract({
      address: UNISWAP_ADDRESSES.NonfungiblePositionManager,
      abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
      functionName: "tokenOfOwnerByIndex",
      args: [owner, BigInt(i)],
    });
    ids.push(id);
  }
  return ids;
}

/**
 * Fetch full position data for one token ID.
 */
export async function getPosition(
  client: PublicClient,
  tokenId: bigint
): Promise<PositionInfo | null> {
  try {
    const data = await client.readContract({
      address: UNISWAP_ADDRESSES.NonfungiblePositionManager,
      abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
      functionName: "positions",
      args: [tokenId],
    });
    return {
      tokenId,
      token0: data[3] as unknown as `0x${string}`,
      token1: data[4] as unknown as `0x${string}`,
      fee: Number(data[5]),
      tickLower: Number(data[6]),
      tickUpper: Number(data[7]),
      liquidity: data[8],
      tokensOwed0: data[10],
      tokensOwed1: data[11],
    };
  } catch {
    return null;
  }
}

/**
 * Fetch all positions for a user.
 */
export async function getUserPositions(
  client: PublicClient,
  owner: `0x${string}`
): Promise<PositionInfo[]> {
  const ids = await getPositionTokenIds(client, owner);
  const results = await Promise.all(
    ids.map((id) => getPosition(client, id))
  );
  return results.filter((p): p is PositionInfo => p != null);
}
