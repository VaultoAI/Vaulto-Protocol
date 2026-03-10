"use client";

import { Fragment } from "react";
import { useLeaderboard } from "@/hooks/waitlist";
import { PointsCounter } from "./PointsCounter";
import { ShareToXButton } from "./ShareToXButton";

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5">
      <svg
        className="h-3 w-3 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="black"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      <span className="text-[10px] font-semibold text-black">Verified</span>
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="text-xl font-bold text-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.5)]">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="text-xl font-bold text-slate-300 drop-shadow-[0_0_3px_rgba(203,213,225,0.5)]">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="text-xl font-bold text-amber-600 drop-shadow-[0_0_3px_rgba(217,119,6,0.5)]">
        3
      </span>
    );
  }
  return <span className="text-[var(--muted)]">{rank}</span>;
}

export function WaitlistLeaderboard() {
  const { leaderboard, totalUsers, isLoading, isError } = useLeaderboard();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--muted)]/20" />
        </div>
        <div className="p-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-[var(--border)] py-3 last:border-0"
            >
              <div className="h-6 w-8 animate-pulse rounded bg-[var(--muted)]/20" />
              <div className="h-6 w-32 animate-pulse rounded bg-[var(--muted)]/20" />
              <div className="ml-auto h-6 w-24 animate-pulse rounded bg-[var(--muted)]/20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-[var(--muted)]">
        Failed to load leaderboard
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-[var(--muted)]">
        No users on the waitlist yet
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          Leaderboard
        </h3>
        <span className="text-xs text-[var(--muted)]">
          {totalUsers} {totalUsers === 1 ? "user" : "users"} on waitlist
        </span>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              <th className="px-4 py-3 w-16">#</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((user, index) => {
              const showDivider =
                index > 0 &&
                user.rank > leaderboard[index - 1].rank + 1;

              return (
                <Fragment key={user.rank}>
                  {showDivider && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-2 text-center text-xs text-[var(--muted)]"
                      >
                        ...
                      </td>
                    </tr>
                  )}
                  <tr
                    className={`border-b border-[var(--border)] last:border-0 transition-colors ${
                      user.isCurrentUser
                        ? "bg-blue-500/5"
                        : "hover:bg-[var(--muted)]/5"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <RankBadge rank={user.rank} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          user.isCurrentUser
                            ? "font-bold text-blue-500"
                            : "text-[var(--foreground)]"
                        }
                      >
                        {user.displayName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center justify-end gap-2">
                        {user.hasSharedToX && <VerifiedBadge />}
                        <PointsCounter
                          createdAt={user.createdAt}
                          bonusPoints={user.bonusPoints}
                          className="text-[var(--foreground)]"
                        />
                      </span>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden">
        {leaderboard.map((user, index) => {
          const showDivider =
            index > 0 &&
            user.rank > leaderboard[index - 1].rank + 1;

          return (
            <Fragment key={user.rank}>
              {showDivider && (
                <div className="py-2 text-center text-xs text-[var(--muted)]">
                  ...
                </div>
              )}
              <div
                className={`flex items-center justify-between border-b border-[var(--border)] p-4 last:border-0 ${
                  user.isCurrentUser ? "bg-blue-500/5" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8">
                    <RankBadge rank={user.rank} />
                  </span>
                  <span
                    className={
                      user.isCurrentUser
                        ? "font-bold text-blue-500"
                        : "text-[var(--foreground)]"
                    }
                  >
                    {user.displayName}
                  </span>
                </div>
                <span className="inline-flex items-center gap-2">
                  {user.hasSharedToX && <VerifiedBadge />}
                  <PointsCounter
                    createdAt={user.createdAt}
                    bonusPoints={user.bonusPoints}
                    className="text-sm text-[var(--foreground)]"
                  />
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
