"use client";

import { useEffect, useState } from "react";
import { fetchCompanyLogo } from "@/lib/utils/companyLogo";

export function useCompanyLogo(
  companyName: string,
  website?: string
): { logoUrl: string | null; isLoading: boolean } {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!!companyName);

  useEffect(() => {
    if (!companyName) {
      setLogoUrl(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchCompanyLogo(companyName, website).then((url) => {
      if (!cancelled) {
        setLogoUrl(url);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [companyName, website]);

  return { logoUrl, isLoading };
}
