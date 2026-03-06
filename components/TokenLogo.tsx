"use client";

import { useState } from "react";
import { useTokenLogo } from "@/hooks/useTokenLogo";
import { getTokenAddressBySymbol, getPrivateTokenLogoUrl } from "@/lib/utils/tokenLogo";

type TokenLogoProps = {
  symbol: string;
  address?: string | null;
  chainId?: number;
  size?: number;
  className?: string;
};

export function TokenLogo({
  symbol,
  address,
  chainId = 1,
  size = 24,
  className = "",
}: TokenLogoProps) {
  // Check for private token logo first (symbols starting with "s")
  const privateLogoUrl = symbol?.startsWith("s") ? getPrivateTokenLogoUrl(symbol) : null;

  const resolvedAddress = address ?? getTokenAddressBySymbol(symbol);
  const { logoUrl: onchainLogoUrl, isLoading } = useTokenLogo(resolvedAddress, chainId);
  const [imgError, setImgError] = useState(false);

  // Use private logo if available, otherwise fall back to on-chain logo
  const logoUrl = privateLogoUrl || onchainLogoUrl;
  const showFallback = (!privateLogoUrl && !resolvedAddress) || (!privateLogoUrl && isLoading) || !logoUrl || imgError;
  const fallbackChar = symbol?.trim()[0]?.toUpperCase() ?? "?";

  if (showFallback) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium shrink-0 ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {fallbackChar}
      </span>
    );
  }

  return (
    <img
      src={logoUrl}
      alt=""
      width={size}
      height={size}
      className={`rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size }}
      onError={() => setImgError(true)}
    />
  );
}
