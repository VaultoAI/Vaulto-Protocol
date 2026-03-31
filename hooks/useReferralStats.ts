"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";

interface ReferralStats {
  referralCode: string | null;
  referralCount: number;
  bonusPoints: number;
}

async function fetchReferralStats(): Promise<ReferralStats> {
  const res = await fetch("/api/profile/referral-stats");
  if (!res.ok) {
    throw new Error("Failed to fetch referral stats");
  }
  return res.json();
}

export function useReferralStats() {
  const { ready, authenticated } = usePrivy();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["referral-stats"],
    queryFn: fetchReferralStats,
    enabled: ready && authenticated,
    staleTime: 60_000, // 1 minute
  });

  return {
    referralCode: data?.referralCode ?? null,
    referralCount: data?.referralCount ?? 0,
    bonusPoints: data?.bonusPoints ?? 0,
    isLoading,
    error,
    refetch,
  };
}
