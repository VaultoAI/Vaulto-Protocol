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
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-[8vh] sm:pt-0 pb-[8vh] sm:pb-[14vh] lg:pb-[17vh]">
      {/* Mobile radial gradient backdrop */}
      <div className="sm:hidden absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.15)_0%,transparent_70%)]" />

      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="animate-gradient-shift absolute -inset-[100%] opacity-30 sm:opacity-30">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-blue-400/20 to-cyan-500/20 blur-3xl" />
        </div>
      </div>

      {/* Floating orbs - more visible on mobile */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="animate-float-1 absolute left-[10%] top-[20%] h-40 w-40 sm:h-48 sm:w-48 md:h-64 md:w-64 rounded-full bg-gradient-to-br from-blue-500/20 sm:from-blue-500/10 to-blue-400/20 sm:to-blue-400/10 blur-3xl" />
        <div className="animate-float-2 absolute right-[10%] top-[55%] h-52 w-52 sm:h-64 sm:w-64 md:h-96 md:w-96 rounded-full bg-gradient-to-br from-blue-400/20 sm:from-blue-400/10 to-cyan-500/20 sm:to-cyan-500/10 blur-3xl" />
        <div className="animate-float-3 absolute bottom-[25%] left-[50%] h-44 w-44 sm:h-48 sm:w-48 md:h-72 md:w-72 rounded-full bg-gradient-to-br from-cyan-500/15 sm:from-cyan-500/10 to-blue-500/15 sm:to-blue-500/10 blur-3xl" />
      </div>

      {/* Decorative rings - mobile only */}
      <div className="sm:hidden absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute w-[280px] h-[280px] rounded-full border border-blue-500/10 animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute w-[380px] h-[380px] rounded-full border border-cyan-500/5" />
        <div className="absolute w-[480px] h-[480px] rounded-full border border-blue-400/5" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="hidden sm:block absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px),
                           linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div className="animate-fade-in-up relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center max-w-7xl mx-auto w-full">
        {/* Left: Text content */}
        <div className="text-center lg:text-left pt-4 sm:pt-4 lg:pt-0">
          {/* Badge - above logo */}
          <div className="animate-fade-in-up animation-delay-100 mb-4 sm:mb-5 flex justify-center lg:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
              </span>
              Pre-IPO Access
            </span>
          </div>

          {/* Logo */}
          <div className="animate-scale-in mb-6 sm:mb-8 flex justify-center lg:justify-start">
            <Image
              src="/vaulto-logo-light.png"
              alt="Vaulto"
              width={180}
              height={48}
              priority
              className="h-10 sm:h-12 w-auto"
            />
          </div>

          {/* Tagline */}
          <h1 className="animate-fade-in-up animation-delay-200 -mb-1 sm:-mb-2 text-[1.75rem] sm:text-4xl md:text-5xl lg:text-6xl font-medium sm:font-light tracking-tight text-[var(--foreground)] whitespace-nowrap">
            Trade Private Companies
          </h1>
          <h1 className="animate-fade-in-up animation-delay-300 mb-6 bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-500 bg-clip-text text-[1.75rem] sm:text-4xl md:text-5xl lg:text-6xl font-bold sm:font-semibold tracking-tight text-transparent pb-1 whitespace-nowrap">
            Before They Go Public
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-in-up animation-delay-400 mb-10 max-w-[280px] sm:max-w-md lg:max-w-xl text-sm sm:text-lg text-[var(--muted)] mx-auto lg:mx-0">
            Access pre-IPO tokens of the world's most valuable private companies.
            Trade SpaceX, Anthropic, OpenAI, and more with real-time pricing
            powered by prediction markets.
          </p>

          {/* CTA Buttons */}
          <div className="animate-fade-in-up animation-delay-500 flex flex-col gap-4 sm:flex-row items-center lg:items-start justify-center lg:justify-start">
            <button
              onClick={onJoinWaitlist}
              className="group relative w-fit rounded-lg bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-500 px-8 py-3.5 sm:py-3 min-h-[48px] text-sm font-medium text-white shadow-lg shadow-blue-500/20 sm:shadow-none transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25"
            >
              Join Waitlist
              <div className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-500 opacity-30 sm:opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-50" />
            </button>
            <button
              onClick={scrollToFeatures}
              className="hidden sm:block rounded-lg border border-[var(--border)] bg-[var(--background)] px-6 sm:px-8 py-3.5 sm:py-3 min-h-[48px] text-sm font-medium text-[var(--foreground)] transition-all duration-300 hover:border-[var(--foreground)]/20 hover:shadow-lg"
            >
              Learn More
            </button>
          </div>

          {/* Trust indicator - mobile */}
          <div className="sm:hidden animate-fade-in-up animation-delay-600 mt-6 flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
            <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>No credit card required</span>
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
