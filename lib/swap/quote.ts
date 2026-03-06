import { type PublicClient, decodeAbiParameters } from "viem";
import { UNISWAP_ADDRESSES } from "@/lib/uniswap/constants";
import { QUOTER_V2_ABI } from "@/lib/uniswap/abis";

export type QuoteParams = {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  fee: number; // fee tier in hundredths of bps, e.g. 3000 for 0.3%
};

export type QuoteResult = {
  amountOut: bigint;
  sqrtPriceX96After?: bigint;
  gasEstimate?: bigint;
};

/**
 * Get exact-in single-hop quote from Uniswap V3 QuoterV2.
 * QuoterV2 simulates the swap and reverts with the result; we decode the revert data.
 */
export async function getQuote(
  client: PublicClient,
  params: QuoteParams
): Promise<QuoteResult | null> {
  const { tokenIn, tokenOut, amountIn, fee } = params;

  if (amountIn <= BigInt(0)) return null;

  try {
    // QuoterV2.quoteExactInputSingle reverts with (amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate)
    await client.simulateContract({
      address: UNISWAP_ADDRESSES.QuoterV2,
      abi: QUOTER_V2_ABI,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn,
          tokenOut,
          amountIn,
          fee,
          sqrtPriceLimitX96: BigInt(0),
        },
      ],
    });
    return null; // should not reach here (contract reverts)
  } catch (err: unknown) {
    // QuoterV2 reverts with the result; decode revert data (may include 4-byte selector)
    const data =
      (err as { data?: unknown; cause?: { data?: unknown } })?.data ??
      (err as { cause?: { data?: unknown } })?.cause?.data;
    if (typeof data !== "string" || !data.startsWith("0x")) return null;
    const hex = data as `0x${string}`;
    const tupleTypes = [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ];
    try {
      const decoded = decodeAbiParameters(tupleTypes, hex);
      return {
        amountOut: decoded[0] as bigint,
        sqrtPriceX96After: decoded[1] as bigint,
        gasEstimate: decoded[3] as bigint,
      };
    } catch {
      // Some deployments prefix with a selector (4 bytes = 8 hex chars after 0x)
      if (hex.length >= 10) {
        try {
          const decoded = decodeAbiParameters(
            tupleTypes,
            (`0x${hex.slice(10)}` as `0x${string}`)
          );
          return {
            amountOut: decoded[0] as bigint,
            sqrtPriceX96After: decoded[1] as bigint,
            gasEstimate: decoded[3] as bigint,
          };
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

/** Apply slippage (e.g. 0.005 = 0.5%) to get minimum amount out. */
export function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  if (slippageBps >= 10000) return BigInt(0);
  return (amountOut * BigInt(10000 - slippageBps)) / BigInt(10000);
}
