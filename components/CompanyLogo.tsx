"use client";

import { useState } from "react";
import { useCompanyLogo } from "@/hooks/useCompanyLogo";
import { DARK_LOGO_COMPANIES } from "@/lib/utils/companyLogo";

type CompanyLogoProps = {
  name: string;
  website?: string;
  size?: number;
  className?: string;
  /** Above-the-fold logos opt in for eager + high priority. Default lazy. */
  priority?: boolean;
};

export function CompanyLogo({
  name,
  website,
  size = 32,
  className = "",
  priority = false,
}: CompanyLogoProps) {
  const { logoUrl } = useCompanyLogo(name, website);
  const [imgError, setImgError] = useState(false);

  const fallbackChar = name?.trim()[0]?.toUpperCase() ?? "?";
  const showFallback = !logoUrl || imgError;

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

  const normalizedName = name?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const needsDarkModeInvert = DARK_LOGO_COMPANIES.has(normalizedName);

  return (
    <img
      src={logoUrl}
      alt={`${name} logo`}
      width={size}
      height={size}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      className={`rounded-full object-cover shrink-0 ${needsDarkModeInvert ? "dark:invert" : ""} ${className}`}
      onError={() => setImgError(true)}
    />
  );
}
