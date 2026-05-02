"use client";

import { useMemo } from "react";
import { getCompanyLogoUrl } from "@/lib/utils/companyLogo";

export function useCompanyLogo(
  companyName: string,
  website?: string
): { logoUrl: string | null; isLoading: boolean } {
  const logoUrl = useMemo(
    () => (companyName ? getCompanyLogoUrl(companyName, website) : null),
    [companyName, website]
  );

  return { logoUrl, isLoading: false };
}
