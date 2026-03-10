"use client";

import { useState, useCallback } from "react";

interface ReferralLinkShareProps {
  referralCode: string | null;
}

export function ReferralLinkShare({ referralCode }: ReferralLinkShareProps) {
  const [copied, setCopied] = useState(false);

  const referralUrl = referralCode
    ? `https://protocol.vaulto.ai?ref=${referralCode}`
    : null;

  const handleCopy = useCallback(async () => {
    if (!referralUrl) return;

    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [referralUrl]);

  if (!referralCode) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
        Invite Friends
      </h3>
      <p className="mb-4 text-sm text-[var(--foreground)]">
        Earn <span className="font-semibold text-purple-500">250,000 points</span> for each friend who joins!
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            readOnly
            value={referralUrl ?? ""}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 pr-20 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded bg-[var(--muted)]/10 px-2 py-0.5 text-xs text-[var(--muted)]">
            {referralCode}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:shadow-purple-500/20"
        >
          {copied ? (
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy Link
            </>
          )}
        </button>
      </div>
    </div>
  );
}
