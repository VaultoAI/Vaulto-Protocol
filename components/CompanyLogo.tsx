"use client";

import { useState } from "react";
import { useCompanyLogo } from "@/hooks/useCompanyLogo";
import { DARK_LOGO_COMPANIES } from "@/lib/utils/companyLogo";

type CompanyLogoProps = {
  name: string;
  website?: string;
  size?: number;
  className?: string;
};

export function CompanyLogo({
  name,
  website,
  size = 32,
  className = "",
}: CompanyLogoProps) {
  const { logoUrl, isLoading } = useCompanyLogo(name, website);
  const [imgError, setImgError] = useState(false);

  const fallbackChar = name?.trim()[0]?.toUpperCase() ?? "?";
  const showFallback = isLoading || !logoUrl || imgError;

  if (showFallback) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium shrink-0 ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {fallbackChar}
      </span>
    );
  }

  // Check if this logo needs inversion in dark mode (dark/black logos)
  const normalizedName = name?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const needsDarkModeInvert = DARK_LOGO_COMPANIES.has(normalizedName);

  return (
    <img
      src={logoUrl}
      alt={`${name} logo`}
      width={size}
      height={size}
      className={`rounded-full object-cover shrink-0 ${needsDarkModeInvert ? "dark:invert" : ""} ${className}`}
      onError={() => setImgError(true)}
    />
  );
}
