"use client";

import Image from "next/image";
import { CompanyMarquee } from "@/components/landing/CompanyMarquee";

interface HeroSectionProps {
  onJoinWaitlist: () => void;
}

export function HeroSection({ onJoinWaitlist }: HeroSectionProps) {
  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 sm:px-6 pb-[12vh] sm:pb-[14vh] lg:pb-[17vh]">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="animate-gradient-shift absolute -inset-[100%] opacity-30">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-blue-400/20 to-cyan-500/20 blur-3xl" />
        </div>
      </div>

      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="animate-float-1 absolute left-[10%] top-[20%] h-32 w-32 sm:h-48 sm:w-48 md:h-64 md:w-64 rounded-full bg-gradient-to-br from-blue-500/10 to-blue-400/10 blur-3xl" />
        <div className="animate-float-2 absolute right-[15%] top-[60%] h-48 w-48 sm:h-64 sm:w-64 md:h-96 md:w-96 rounded-full bg-gradient-to-br from-blue-400/10 to-cyan-500/10 blur-3xl" />
        <div className="animate-float-3 absolute bottom-[20%] left-[60%] h-36 w-36 sm:h-48 sm:w-48 md:h-72 md:w-72 rounded-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 blur-3xl" />
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
      <div className="animate-fade-in-up relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center max-w-7xl mx-auto w-full">
        {/* Left: Text content */}
        <div className="text-center lg:text-left pt-8 sm:pt-4 lg:pt-0">
          {/* Logo */}
          <div className="animate-scale-in mb-8 flex justify-center lg:justify-start">
            <Image
              src="/vaulto-logo-light.png"
              alt="Vaulto"
              width={180}
              height={48}
              priority
              className="h-12 w-auto"
            />
          </div>

          {/* Tagline */}
          <h1 className="animate-fade-in-up animation-delay-200 mb-1 text-[1.7rem] sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-[var(--foreground)] whitespace-nowrap">
            Trade Private Companies
          </h1>
          <h1 className="animate-fade-in-up animation-delay-300 mb-6 bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-500 bg-clip-text text-[1.7rem] sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-transparent pb-1 whitespace-nowrap">
            Before They Go Public
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-in-up animation-delay-400 mb-10 max-w-xl text-base sm:text-lg text-[var(--muted)] mx-auto lg:mx-0">
            Access synthetic pre-IPO tokens of unicorn companies. Trade SpaceX,
            Anthropic, OpenAI, and more with real-time pricing.
          </p>

          {/* CTA Buttons */}
          <div className="animate-fade-in-up animation-delay-500 flex flex-col gap-4 sm:flex-row justify-center lg:justify-start">
            <button
              onClick={onJoinWaitlist}
              className="group relative rounded-lg bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-500 px-6 sm:px-8 py-3.5 sm:py-3 min-h-[48px] text-sm font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25"
            >
              Join Waitlist
              <div className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-500 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-50" />
            </button>
            <button
              onClick={scrollToFeatures}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-6 sm:px-8 py-3.5 sm:py-3 min-h-[48px] text-sm font-medium text-[var(--foreground)] transition-all duration-300 hover:border-[var(--foreground)]/20 hover:shadow-lg"
            >
              Learn More
            </button>
          </div>
        </div>

        {/* Right: Demo image - Desktop only */}
        <div className="hidden lg:block animate-fade-in-up animation-delay-400 relative -ml-24">
          <Image
            src="/demo-light.png"
            alt="Vaulto Platform"
            width={1400}
            height={1176}
            priority
            className="w-[130%] max-w-none"
          />
        </div>
      </div>

      {/* Company Logo Marquee */}
      <CompanyMarquee />

      {/* Corner accents */}
      <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-1/2 translate-y-1/2 rounded-full bg-gradient-to-br from-blue-400/5 to-blue-500/5 blur-3xl" />
      <div className="absolute left-0 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-cyan-500/5 to-blue-400/5 blur-3xl" />
    </section>
  );
}
