"use client";

import { useState, useCallback } from "react";
import { PointsCounter } from "./PointsCounter";
import { ShareToXButton } from "./ShareToXButton";
import { useLeaderboard } from "@/hooks/waitlist";

function getRankStyles(rank: number): string {
  if (rank === 1) return "text-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.5)]";
  if (rank === 2) return "text-slate-300 drop-shadow-[0_0_3px_rgba(203,213,225,0.5)]";
  if (rank === 3) return "text-amber-600 drop-shadow-[0_0_3px_rgba(217,119,6,0.5)]";
  return "text-[var(--foreground)]";
}

export function CurrentUserStats() {
  const { currentUser, isLoading, shareToX, isSharing } = useLeaderboard();
  const [copied, setCopied] = useState(false);

  const handleShareReferral = useCallback(async () => {
    if (!currentUser?.referralCode) return;

    const referralUrl = `https://protocol.vaulto.ai?ref=${currentUser.referralCode}`;

    // Use native share on mobile if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Vaulto",
          text: "Join me on Vaulto and get early access to trade private company stocks!",
          url: referralUrl,
        });
      } catch (error) {
        // User cancelled or share failed - ignore AbortError
        if ((error as Error).name !== "AbortError") {
          console.error("Share failed:", error);
        }
      }
    } else {
      // Fallback to clipboard for desktop
      try {
        await navigator.clipboard.writeText(referralUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error("Failed to copy:", error);
      }
    }
  }, [currentUser?.referralCode]);

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-4 h-4 w-24 rounded bg-[var(--muted)]/20" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-6">
            <div className="h-10 w-20 rounded bg-[var(--muted)]/20" />
            <div className="h-10 w-32 rounded bg-[var(--muted)]/20" />
          </div>
          <div className="h-10 w-40 rounded bg-[var(--muted)]/20" />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-10">
          <div>
            <div className="text-sm text-[var(--muted)]">Rank</div>
            <div className={`text-2xl font-semibold ${getRankStyles(currentUser.rank)}`}>
              #{currentUser.rank}
            </div>
          </div>
          <div>
            <div className="text-sm text-[var(--muted)]">Points</div>
            <div className="text-2xl font-semibold text-[var(--foreground)]">
              <PointsCounter
                createdAt={currentUser.createdAt}
                bonusPoints={currentUser.bonusPoints}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-2">
          {currentUser.referralCode && (
            <div className="flex flex-col items-center justify-center gap-1">
              <span className="text-xs text-[var(--muted)]">
                Earn <span className="font-semibold text-purple-500">250,000 pts</span>
              </span>
              <button
                onClick={handleShareReferral}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-6 py-2 text-sm font-medium text-[var(--foreground)] transition-opacity hover:opacity-90"
              >
                {copied ? (
                  <>
                    <svg
                      className="h-4 w-4 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
                      />
                    </svg>
                    Invite Friends
                  </>
                )}
              </button>
              <span className="text-xs text-[var(--muted)]">
                {currentUser.referralCount ?? 0} referral{(currentUser.referralCount ?? 0) !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          <ShareToXButton
            hasShared={currentUser.hasSharedToX}
            onShare={shareToX}
            isSharing={isSharing}
          />
        </div>
      </div>
    </div>
  );
}
