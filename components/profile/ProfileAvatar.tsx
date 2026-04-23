"use client";

import { GradientAvatar } from "@/components/GradientAvatar";

interface ProfileAvatarProps {
  walletAddress: string | null;
  size?: number;
}

export function ProfileAvatar({
  walletAddress,
  size = 80,
}: ProfileAvatarProps) {
  return (
    <div className="relative">
      <div
        className="overflow-hidden rounded-full"
        style={{ width: size, height: size }}
      >
        {walletAddress ? (
          <GradientAvatar address={walletAddress} size={size} />
        ) : (
          <div
            className="flex items-center justify-center bg-foreground/10 text-foreground/50"
            style={{ width: size, height: size }}
          >
            <span className="text-2xl">?</span>
          </div>
        )}
      </div>
    </div>
  );
}
