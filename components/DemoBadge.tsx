"use client";

type DemoBadgeProps = {
  className?: string;
  size?: "sm" | "md";
};

/**
 * Small amber badge indicating demo/simulation mode.
 * Used next to demo token symbols in token selects and lists.
 */
export function DemoBadge({ className = "", size = "sm" }: DemoBadgeProps) {
  const sizeClasses = size === "sm"
    ? "text-[10px] px-1.5 py-0.5"
    : "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center rounded font-medium uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 ${sizeClasses} ${className}`}
    >
      Demo
    </span>
  );
}
