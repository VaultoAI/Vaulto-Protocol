"use client";

import { useReadContract, useAccount } from "wagmi";
import { formatUnits } from "viem";
import { USDC_ADDRESSES, USDC_DECIMALS, ERC20_ABI, CHAIN_IDS } from "@/lib/trading-wallet/constants";

/**
 * Hook to fetch USDC balance from connected external wallet on Polygon
 */
export function useExternalUsdcBalance() {
  const { address, chain } = useAccount();

  const isPolygon = chain?.id === CHAIN_IDS.POLYGON;

  const {
    data: balance,
    isLoading,
    refetch,
  } = useReadContract({
    address: USDC_ADDRESSES.POLYGON_NATIVE,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN_IDS.POLYGON,
    query: {
      enabled: !!address && isPolygon,
      staleTime: 15_000,
    },
  });

  const formattedBalance = balance
    ? parseFloat(formatUnits(balance as bigint, USDC_DECIMALS)).toFixed(2)
    : "0.00";

  return {
    balance: balance as bigint | undefined,
    formattedBalance,
    isLoading,
    refetch,
    isPolygon,
  };
}
