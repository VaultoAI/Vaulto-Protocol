import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  highlights: string[];
  gradientFrom: string;
  gradientTo: string;
  link?: {
    text: string;
    href: string;
  };
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  highlights,
  gradientFrom,
  gradientTo,
  link,
}: FeatureCardProps) {
  return (
    <div className="group relative rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 transition-all duration-300 hover:border-[var(--foreground)]/10 hover:shadow-lg hover:shadow-blue-500/5">
      {/* Icon */}
      <div
        className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo}`}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>

      {/* Title */}
      <h3 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
        {title}
      </h3>

      {/* Description */}
      <p className="mb-4 text-sm text-[var(--muted)]">{description}</p>

      {/* Highlights */}
      <ul className="space-y-2">
        {highlights.map((highlight, index) => (
          <li
            key={index}
            className="flex items-start gap-2 text-sm text-[var(--muted)]"
          >
            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
            {highlight}
          </li>
        ))}
      </ul>

      {/* Link */}
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--foreground)] transition-colors hover:text-blue-500"
        >
          {link.text}
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      )}

      {/* Subtle hover gradient */}
      <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-blue-500/0 via-blue-400/0 to-cyan-500/0 opacity-0 blur-xl transition-opacity duration-300 group-hover:from-blue-500/5 group-hover:via-blue-400/5 group-hover:to-cyan-500/5 group-hover:opacity-100" />
    </div>
  );
}
