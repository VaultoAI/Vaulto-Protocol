"use client";

import { useState } from "react";
import { useTokenLogo } from "@/hooks/useTokenLogo";
import { useCompanyLogo } from "@/hooks/useCompanyLogo";
import { getTokenAddressBySymbol, DARK_LOGO_SYMBOLS } from "@/lib/utils/tokenLogo";
import { DARK_LOGO_COMPANIES } from "@/lib/utils/companyLogo";

type TokenLogoProps = {
  symbol: string;
  address?: string | null;
  chainId?: number;
  size?: number;
  className?: string;
  /** Company name for private tokens - enables company logo fetching */
  companyName?: string;
  /** Company website for private tokens - used for logo lookup */
  companyWebsite?: string;
};

export function TokenLogo({
  symbol,
  address,
  chainId = 1,
  size = 24,
  className = "",
  companyName,
  companyWebsite,
}: TokenLogoProps) {
  const isPrivateToken = symbol?.startsWith("v") && symbol.length > 1;

  // For private tokens with company info, use the company logo hook (same as MintTable)
  const { logoUrl: companyLogoUrl, isLoading: companyLogoLoading } = useCompanyLogo(
    isPrivateToken && companyName ? companyName : "",
    companyWebsite
  );

  const resolvedAddress = address ?? getTokenAddressBySymbol(symbol);
  const { logoUrl: onchainLogoUrl, isLoading: onchainLoading } = useTokenLogo(resolvedAddress, chainId);
  const [imgError, setImgError] = useState(false);

  // For private tokens with company info, prefer company logo
  // Otherwise fall back to on-chain token logo
  const logoUrl = (isPrivateToken && companyName) ? companyLogoUrl : onchainLogoUrl;
  const isLoading = (isPrivateToken && companyName) ? companyLogoLoading : onchainLoading;

  const showFallback = isLoading || !logoUrl || imgError;
  const fallbackChar = (companyName || symbol)?.trim()[0]?.toUpperCase() ?? "?";

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

  // Check if this logo needs inversion in dark mode (dark/black logos)
  const normalizedName = companyName?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const needsDarkModeInvert = DARK_LOGO_SYMBOLS.has(symbol) || DARK_LOGO_COMPANIES.has(normalizedName);

  return (
    <img
      src={logoUrl}
      alt=""
      width={size}
      height={size}
      className={`rounded-full shrink-0 ${needsDarkModeInvert ? "dark:invert" : ""} ${className}`}
      style={{ width: size, height: size }}
      onError={() => setImgError(true)}
    />
  );
}
