"use client";

import { useState, useCallback } from "react";

interface ShareToXButtonProps {
  hasShared: boolean;
  onShare: () => void;
  isSharing: boolean;
}

const TWEET_TEXT = `I just joined the @VaultoProtocol waitlist!

Vaulto is building the future of private market investing - trade pre-IPO companies like SpaceX, OpenAI, and Stripe.

Join me on the waitlist and earn points while you wait
https://vaulto.ai`;

export function ShareToXButton({
  hasShared,
  onShare,
  isSharing,
}: ShareToXButtonProps) {
  const [justShared, setJustShared] = useState(false);

  const handleShare = useCallback(() => {
    // Open X intent
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(TWEET_TEXT)}`;
    window.open(tweetUrl, "_blank", "width=550,height=420");

    // Record share in backend
    onShare();
    setJustShared(true);
  }, [onShare]);

  if (hasShared || justShared) {
    return null;
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
