"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

interface FeatureItem {
  title: string;
  description?: string;
  highlight?: boolean; // Mark as primary feature
}

interface FeatureSectionProps {
  id: string;
  badge: string;
  headline: string;
  subheadline: string;
  features: FeatureItem[];
  visual: ReactNode;
  theme: "blue" | "cyan";
  reversed?: boolean;
  link?: { text: string; href: string };
  actionButton?: { text: string; onClick: () => void };
}

const themeColors = {
  blue: {
    badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    accent: "from-blue-500 to-blue-600",
    glow: "from-blue-500/10 to-blue-600/5",
    bullet: "bg-blue-500",
    cardBg: "bg-blue-500/5 border-blue-500/20",
    cardAccent: "text-blue-500",
  },
  cyan: {
    badge: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    accent: "from-cyan-500 to-cyan-600",
    glow: "from-cyan-500/10 to-cyan-600/5",
    bullet: "bg-cyan-500",
    cardBg: "bg-cyan-500/5 border-cyan-500/20",
    cardAccent: "text-cyan-500",
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
  actionButton,
}: FeatureSectionProps) {
  const colors = themeColors[theme];
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Split features into highlighted (cards) and regular (compact list)
  const highlightedFeatures = features.filter((f) => f.highlight);
  const regularFeatures = features.filter((f) => !f.highlight);

  return (
    <section
      ref={sectionRef}
      id={id}
      className="relative flex min-h-[auto] sm:min-h-[80vh] lg:min-h-[90vh] items-center overflow-hidden py-16 sm:py-20 lg:py-24"
    >
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={`absolute ${reversed ? "right-0" : "left-0"} top-1/2 h-[600px] w-[600px] -translate-y-1/2 ${reversed ? "translate-x-1/4" : "-translate-x-1/4"} rounded-full bg-gradient-to-br ${colors.glow} blur-3xl`}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div
          className={`grid items-center gap-8 sm:gap-10 lg:gap-12 lg:grid-cols-2 lg:gap-20 ${reversed ? "lg:grid-flow-dense" : ""}`}
        >
          {/* Text Content */}
          <div className={reversed ? "lg:col-start-2" : ""}>
            {/* Badge */}
            <span
              className={`inline-block rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ${colors.badge} transition-all duration-700 ${
                isVisible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              {badge}
            </span>

            {/* Headline */}
            <h2
              className={`mt-6 text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-semibold leading-tight text-[var(--foreground)] transition-all duration-700 delay-100 ${
                isVisible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              {headline}
            </h2>

            {/* Subheadline */}
            <p
              className={`mt-6 text-base sm:text-lg md:text-xl text-[var(--muted)] transition-all duration-700 delay-200 ${
                isVisible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              {subheadline}
            </p>

            {/* Highlighted Features as Cards */}
            {highlightedFeatures.length > 0 && (
              <div className="mt-6 sm:mt-8 lg:mt-10 grid gap-3 sm:gap-4 sm:grid-cols-2">
                {highlightedFeatures.map((feature, index) => (
                  <div
                    key={index}
                    className={`rounded-xl border p-4 sm:p-5 ${colors.cardBg} transition-all duration-700 ${
                      isVisible
                        ? "translate-y-0 opacity-100"
                        : "translate-y-6 opacity-0"
                    }`}
                    style={{ transitionDelay: `${300 + index * 100}ms` }}
                  >
                    <h3
                      className={`text-lg font-semibold ${colors.cardAccent}`}
                    >
                      {feature.title}
                    </h3>
                    {feature.description && (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {feature.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Regular Features as Compact List */}
            {regularFeatures.length > 0 && (
              <div
                className={`mt-8 flex flex-wrap gap-x-6 gap-y-3 transition-all duration-700 ${
                  isVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-4 opacity-0"
                }`}
                style={{
                  transitionDelay: `${300 + highlightedFeatures.length * 100 + 100}ms`,
                }}
              >
                {regularFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${colors.bullet}`}
                    />
                    <span className="text-sm text-[var(--muted)]">
                      {feature.title}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Link */}
            {link &&
              (link.href.includes("github.com") ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-8 inline-flex items-center gap-2 rounded-lg bg-[#24292f] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#32383f] hover:shadow-lg duration-700 ${
                    isVisible
                      ? "translate-y-0 opacity-100"
                      : "translate-y-4 opacity-0"
                  }`}
                  style={{
                    transitionDelay: `${300 + highlightedFeatures.length * 100 + 200}ms`,
                  }}
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                    />
                  </svg>
                  {link.text}
                </a>
              ) : link.href.includes("wormhole.com") ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-8 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-cyan-600 hover:shadow-lg hover:shadow-cyan-500/25 duration-700 ${
                    isVisible
                      ? "translate-y-0 opacity-100"
                      : "translate-y-4 opacity-0"
                  }`}
                  style={{
                    transitionDelay: `${300 + highlightedFeatures.length * 100 + 200}ms`,
                  }}
                >
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
                  {link.text}
                </a>
              ) : (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-8 inline-flex items-center gap-2 text-sm font-medium transition-all hover:opacity-80 duration-700 ${
                    isVisible
                      ? "translate-y-0 opacity-100"
                      : "translate-y-4 opacity-0"
                  }`}
                  style={{
                    color: theme === "blue" ? "#3b82f6" : "#06b6d4",
                    transitionDelay: `${300 + highlightedFeatures.length * 100 + 200}ms`,
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
              ))}

            {/* Action Button */}
            {actionButton && (
              <button
                onClick={actionButton.onClick}
                className={`mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-3 sm:py-2.5 min-h-[48px] text-sm font-medium text-white transition-all hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/25 duration-700 ${
                  isVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-4 opacity-0"
                }`}
                style={{
                  transitionDelay: `${300 + highlightedFeatures.length * 100 + 200}ms`,
                }}
              >
                {actionButton.text}
              </button>
            )}
          </div>

          {/* Visual Content */}
          <div
            className={`relative ${reversed ? "lg:col-start-1" : ""} transition-all duration-1000 delay-300 ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-8 opacity-0"
            }`}
          >
            <div className="relative">{visual}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
