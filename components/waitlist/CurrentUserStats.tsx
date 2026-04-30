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
  const [isSharePending, setIsSharePending] = useState(false);

  const handleShareReferral = useCallback(async () => {
    if (isSharePending) return;

    const referralUrl = currentUser?.referralCode
      ? `https://app.vaulto.fi?ref=${currentUser.referralCode}`
      : `https://app.vaulto.fi`;

    // Use native share on mobile if available
    if (navigator.share) {
      try {
        setIsSharePending(true);
        await navigator.share({
          title: "Join Vaulto",
          text: "Join me on Vaulto and get early access to trade private company stocks!",
          url: referralUrl,
        });
      } catch (error) {
        // User cancelled or share failed - ignore AbortError and InvalidStateError
        if ((error as Error).name !== "AbortError" && (error as Error).name !== "InvalidStateError") {
          console.error("Share failed:", error);
        }
      } finally {
        setIsSharePending(false);
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
  }, [currentUser?.referralCode, isSharePending]);

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
      {/* Mobile: minimal Share to X above, then Earn 250k row */}
      <div className="flex flex-col gap-3 sm:hidden">
        {!currentUser.hasSharedToX && (
          <div className="flex justify-end">
            <ShareToXButton
              hasShared={currentUser.hasSharedToX}
              onShare={shareToX}
              isSharing={isSharing}
              referralCode={currentUser.referralCode}
              minimal
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex gap-6">
            <div>
              <div className="text-xs text-[var(--muted)]">Rank</div>
              <div className={`text-xl font-semibold ${getRankStyles(currentUser.rank)}`}>
                #{currentUser.rank}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted)]">Points</div>
              <div className="text-xl font-semibold text-[var(--foreground)]">
                <PointsCounter
                  createdAt={currentUser.createdAt}
                  bonusPoints={currentUser.bonusPoints}
                />
              </div>
            </div>
          </div>
          <button
            onClick={handleShareReferral}
            disabled={isSharePending}
            className="inline-flex items-center justify-center gap-1 rounded-full bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-500 transition-opacity active:opacity-70 disabled:opacity-50"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Earn 250k
          </button>
        </div>
      </div>

      {/* Desktop: X first, then Invite Friends after verified */}
      <div className="hidden sm:flex sm:items-center sm:justify-between">
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
          <ShareToXButton
            hasShared={currentUser.hasSharedToX}
            onShare={shareToX}
            isSharing={isSharing}
            referralCode={currentUser.referralCode}
          />
          {(currentUser.referralCode || currentUser.hasSharedToX) && (
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
                    <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
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
        </div>
      </div>
    </div>
  );
}
