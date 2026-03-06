"use client";

type DemoModeBannerProps = {
  className?: string;
};

/**
 * Amber banner explaining that the current operation is in demo mode.
 * No real tokens are exchanged, transactions are simulated.
 */
export function DemoModeBanner({ className = "" }: DemoModeBannerProps) {
  return (
    <div
      className={`flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300 ${className}`}
      role="alert"
    >
      <svg
        className="mt-0.5 h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div>
        <p className="font-medium">Demo Mode</p>
        <p className="mt-0.5 text-xs opacity-80">
          This is a simulated transaction. No real tokens are exchanged. Balances
          are stored locally for demonstration purposes.
        </p>
      </div>
    </div>
  );
}

/**
 * Compact version for inline use.
 */
export function DemoModeInline({ className = "" }: DemoModeBannerProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 ${className}`}
    >
      <svg
        className="h-3 w-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      Simulated transaction
    </span>
  );
}
