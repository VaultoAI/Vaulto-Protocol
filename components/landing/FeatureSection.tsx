"use client";

import { ReactNode } from "react";

interface FeatureSectionProps {
  id: string;
  badge: string;
  headline: string;
  subheadline: string;
  features: {
    title: string;
    description: string;
  }[];
  visual: ReactNode;
  theme: "blue" | "cyan";
  reversed?: boolean;
  link?: { text: string; href: string };
}

const themeColors = {
  blue: {
    badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    accent: "from-blue-500 to-blue-600",
    glow: "from-blue-500/10 to-blue-600/5",
    bullet: "bg-blue-500",
  },
  cyan: {
    badge: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    accent: "from-cyan-500 to-cyan-600",
    glow: "from-cyan-500/10 to-cyan-600/5",
    bullet: "bg-cyan-500",
  },
};

export function FeatureSection({
  id,
  badge,
  headline,
  subheadline,
  features,
  visual,
  theme,
  reversed = false,
  link,
}: FeatureSectionProps) {
  const colors = themeColors[theme];

  return (
    <section
      id={id}
      className="relative flex min-h-[90vh] items-center overflow-hidden py-24"
    >
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={`absolute ${reversed ? "right-0" : "left-0"} top-1/2 h-[600px] w-[600px] -translate-y-1/2 ${reversed ? "translate-x-1/4" : "-translate-x-1/4"} rounded-full bg-gradient-to-br ${colors.glow} blur-3xl`}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
        <div
          className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-20 ${reversed ? "lg:grid-flow-dense" : ""}`}
        >
          {/* Text Content */}
          <div className={reversed ? "lg:col-start-2" : ""}>
            {/* Badge */}
            <span
              className={`inline-block rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ${colors.badge}`}
            >
              {badge}
            </span>

            {/* Headline */}
            <h2 className="mt-6 text-4xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl lg:text-6xl">
              {headline}
            </h2>

            {/* Subheadline */}
            <p className="mt-6 text-xl text-[var(--muted)]">{subheadline}</p>

            {/* Features List */}
            <ul className="mt-10 space-y-4">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-4">
                  <div
                    className={`mt-2 h-2 w-2 flex-shrink-0 rounded-full ${colors.bullet}`}
                  />
                  <div>
                    <span className="font-medium text-[var(--foreground)]">
                      {feature.title}
                    </span>
                    {feature.description && (
                      <span className="text-[var(--muted)]">
                        {" "}
                        — {feature.description}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {/* Link */}
            {link && (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-8 inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80`}
                style={{
                  color: theme === "blue" ? "#3b82f6" : "#06b6d4",
                }}
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
          </div>

          {/* Visual Content */}
          <div
            className={`relative ${reversed ? "lg:col-start-1" : ""}`}
          >
            <div className="relative">
              {visual}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
