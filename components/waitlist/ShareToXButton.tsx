"use client";

import { useState, useCallback } from "react";

interface ShareToXButtonProps {
  hasShared: boolean;
  onShare: () => void;
  isSharing: boolean;
  /** User's referral code – when set, the shared link includes ?ref= so signups award 250k pts */
  referralCode?: string | null;
  /** Compact styling for mobile (similar size to Earn 250k button) */
  minimal?: boolean;
}

const TWEET_PREFIX = `I just joined the @VaultoProtocol waitlist!

Vaulto is building the future of private market investing - trade pre-IPO companies like SpaceX, OpenAI, and Stripe.

Join me on the waitlist and earn points while you wait
`;

export function ShareToXButton({
  hasShared,
  onShare,
  isSharing,
  referralCode,
  minimal = false,
}: ShareToXButtonProps) {
  const [justShared, setJustShared] = useState(false);

  const handleShare = useCallback(() => {
    const shareUrl = referralCode
      ? `https://app.vaulto.fi?ref=${encodeURIComponent(referralCode)}`
      : "https://app.vaulto.fi";
    const tweetText = TWEET_PREFIX + shareUrl;

    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, "_blank", "width=550,height=420");

    // Record share in backend
    onShare();
    setJustShared(true);
  }, [onShare, referralCode]);

  if (hasShared || justShared) {
    return null;
  }

  if (minimal) {
    return (
      <button
        onClick={handleShare}
        disabled={isSharing}
        className="inline-flex items-center justify-center gap-1 rounded-full bg-[var(--foreground)] px-3 py-1.5 text-xs font-semibold text-[var(--background)] transition-opacity active:opacity-70 disabled:opacity-50"
      >
        {isSharing ? (
          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <>
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>+100k</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      disabled={isSharing}
      className="inline-flex items-center gap-2 rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {isSharing ? (
        <>
          <svg
            className="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Sharing...</span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>Share for +100,000 pts</span>
        </>
      )}
    </button>
  );
}
