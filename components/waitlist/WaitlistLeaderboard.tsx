"use client";

import { Fragment } from "react";
import { useLeaderboard } from "@/hooks/waitlist";
import { PointsCounter } from "./PointsCounter";

function VerifiedBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-black px-2 py-0.5">
      <svg
        className="h-3 w-3 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="white"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      <span className="text-[10px] font-semibold text-white">Verified</span>
    </span>
  );
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
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {user.rank}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center ${
                          user.isCurrentUser
                            ? "font-medium text-blue-500"
                            : "text-[var(--foreground)]"
                        }`}
                      >
                        {user.isCurrentUser ? "YOU" : user.displayName}
                        {user.hasSharedToX && <VerifiedBadge />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PointsCounter
                        createdAt={user.createdAt}
                        bonusPoints={user.bonusPoints}
                        className="text-[var(--foreground)]"
                      />
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
                  <span className="w-8 text-sm text-[var(--muted)]">
                    #{user.rank}
                  </span>
                  <span
                    className={`inline-flex items-center ${
                      user.isCurrentUser
                        ? "font-medium text-blue-500"
                        : "text-[var(--foreground)]"
                    }`}
                  >
                    {user.isCurrentUser ? "YOU" : user.displayName}
                    {user.hasSharedToX && <VerifiedBadge />}
                  </span>
                </div>
                <PointsCounter
                  createdAt={user.createdAt}
                  bonusPoints={user.bonusPoints}
                  className="text-sm text-[var(--foreground)]"
                />
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
