"use client";

import { useEffect, useState } from "react";
import { fetchTrustWalletLogo } from "@/lib/utils/tokenLogo";

export function useTokenLogo(
  tokenAddress: string | null,
  chainId: number = 1
): { logoUrl: string | null; isLoading: boolean } {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!!tokenAddress);

  useEffect(() => {
    if (!tokenAddress) {
      setLogoUrl(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetchTrustWalletLogo(tokenAddress, chainId).then((url) => {
      if (!cancelled) {
        setLogoUrl(url);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tokenAddress, chainId]);

  return { logoUrl, isLoading };
}
