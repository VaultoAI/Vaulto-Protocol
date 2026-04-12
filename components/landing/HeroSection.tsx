"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";

const companies = [
  "SpaceX",
  "Anthropic",
  "OpenAI",
  "Anduril",
  "Databricks",
  "Stripe",
  "Kalshi",
  "Polymarket",
  "Figma",
  "Discord",
  "Canva",
  "Plaid",
];

interface HeroSectionProps {
  onJoinWaitlist: () => void;
}

export function HeroSection({ onJoinWaitlist }: HeroSectionProps) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="animate-gradient-shift absolute -inset-[100%] opacity-30">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 blur-3xl" />
        </div>
      </div>

      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="animate-float-1 absolute left-[10%] top-[20%] h-64 w-64 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl" />
        <div className="animate-float-2 absolute right-[15%] top-[60%] h-96 w-96 rounded-full bg-gradient-to-br from-purple-500/10 to-cyan-500/10 blur-3xl" />
        <div className="animate-float-3 absolute bottom-[20%] left-[60%] h-72 w-72 rounded-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px),
                           linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div className="animate-fade-in-up relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto w-full">
        {/* Left: Text content */}
        <div className="text-center lg:text-left">
          {/* Logo */}
          <div className="animate-scale-in mb-8 flex justify-center lg:justify-start">
            {mounted && (
              <Image
                src={isDark ? "/vaulto-logo-dark.png" : "/vaulto-logo-light.png"}
                alt="Vaulto"
                width={180}
                height={48}
                priority
                className="h-12 w-auto"
              />
            )}
          </div>

          {/* Tagline */}
          <h1 className="animate-fade-in-up animation-delay-200 mb-1 text-4xl font-light tracking-tight text-[var(--foreground)] sm:text-5xl md:text-6xl">
            Trade Private Companies
          </h1>
          <h1 className="animate-fade-in-up animation-delay-300 mb-6 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl md:text-6xl">
            Before They Go Public
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-in-up animation-delay-400 mb-10 max-w-xl text-lg text-[var(--muted)] mx-auto lg:mx-0">
            Access synthetic pre-IPO tokens of unicorn companies. Trade SpaceX,
            Anthropic, OpenAI, and more with real-time pricing.
          </p>

          {/* CTA Buttons */}
          <div className="animate-fade-in-up animation-delay-500 flex flex-col gap-4 sm:flex-row justify-center lg:justify-start">
            <button
              onClick={onJoinWaitlist}
              className="group relative rounded-lg bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 px-8 py-3 text-sm font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/25"
            >
              Join Waitlist
              <div className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-50" />
            </button>
            <button
              onClick={scrollToFeatures}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-8 py-3 text-sm font-medium text-[var(--foreground)] transition-all duration-300 hover:border-[var(--foreground)]/20 hover:shadow-lg"
            >
              Learn More
            </button>
          </div>
        </div>

        {/* Right: Demo image */}
        <div className="hidden lg:block animate-fade-in-up animation-delay-400">
          {mounted && (
            <Image
              src={isDark ? "/demo-dark.png" : "/demo-light.png"}
              alt="Vaulto Platform"
              width={1000}
              height={840}
              priority
              className="rounded-xl shadow-2xl"
            />
          )}
        </div>
      </div>

      {/* Company Logo Marquee */}
      <div className="animate-fade-in-up animation-delay-600 relative mt-16 left-0 right-0 z-10 w-full overflow-hidden">
        <div className="flex animate-marquee gap-16 whitespace-nowrap">
          {[...companies, ...companies, ...companies].map((company, i) => (
            <div
              key={`${company}-${i}`}
              className="flex items-center gap-3"
            >
              <CompanyLogo name={company} size={28} />
              <span className="text-base font-medium tracking-tight text-[var(--muted)]">
                {company}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Corner accents */}
      <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-1/2 translate-y-1/2 rounded-full bg-gradient-to-br from-purple-500/5 to-blue-500/5 blur-3xl" />
      <div className="absolute left-0 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-cyan-500/5 to-purple-500/5 blur-3xl" />
    </section>
  );
}
