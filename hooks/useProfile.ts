"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";

interface Profile {
  name: string | null;
  image: string | null;
  email: string;
  walletAddress: string | null;
}

interface UpdateProfileData {
  name?: string;
  image?: string | null;
}

async function fetchProfile(): Promise<Profile> {
  const res = await fetch("/api/profile");
  if (!res.ok) {
    throw new Error("Failed to fetch profile");
  }
  return res.json();
}

async function updateProfile(data: UpdateProfileData): Promise<Profile> {
  const res = await fetch("/api/profile/update", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to update profile");
  }
  return res.json();
}

export function useProfile() {
  const { ready, authenticated } = usePrivy();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    enabled: ready && authenticated,
    staleTime: 60_000, // 1 minute
  });

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      // Update the cache with the new data
      queryClient.setQueryData(["profile"], data);
    },
  });

  return {
    profile: profileQuery.data ?? null,
    name: profileQuery.data?.name ?? null,
    image: profileQuery.data?.image ?? null,
    email: profileQuery.data?.email ?? null,
    walletAddress: profileQuery.data?.walletAddress ?? null,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    refetch: profileQuery.refetch,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
  };
}
