"use client";

import { CheckCircle2, ArrowRight, Rocket } from "lucide-react";
import Link from "next/link";

interface OnboardingCompleteProps {
  compliancePeriod?: {
    startDate: string;
    endDate: string;
    daysRemaining: number;
  };
}

export function OnboardingComplete({ compliancePeriod }: OnboardingCompleteProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 animate-scale-in">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>

        <h1 className="mb-2 text-3xl font-bold text-foreground animate-fade-in-up">
          Welcome to Vaulto!
        </h1>

        <p className="mb-6 text-muted animate-fade-in-up animation-delay-200">
          Your account is now active. You have full access to trade, mint, and
          earn on the platform.
        </p>

        {compliancePeriod && (
          <div className="mb-6 rounded-lg border border-border p-4 animate-fade-in-up animation-delay-300">
            <div className="flex items-center justify-center gap-2 text-sm text-muted">
              <span>Compliance period:</span>
              <span className="font-medium text-foreground">
                {compliancePeriod.daysRemaining} days remaining
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{
                  width: `${((40 - compliancePeriod.daysRemaining) / 40) * 100}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              Full transfer capabilities after{" "}
              {new Date(compliancePeriod.endDate).toLocaleDateString()}
            </p>
          </div>
        )}

        <div className="space-y-4 animate-fade-in-up animation-delay-400">
          <h3 className="font-medium">Get started:</h3>

          <div className="grid gap-3">
            <Link
              href="/swap"
              className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-border/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Rocket className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Trade Tokens</p>
                  <p className="text-sm text-muted">
                    Swap synthetic private company tokens
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted" />
            </Link>

            <Link
              href="/mint"
              className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-border/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <span className="text-lg">+</span>
                </div>
                <div className="text-left">
                  <p className="font-medium">Mint Tokens</p>
                  <p className="text-sm text-muted">
                    Create synthetic equity positions
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted" />
            </Link>

            <Link
              href="/earn"
              className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-border/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <span className="text-lg">%</span>
                </div>
                <div className="text-left">
                  <p className="font-medium">Earn Yield</p>
                  <p className="text-sm text-muted">
                    Provide liquidity and earn fees
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted" />
            </Link>
          </div>
        </div>

        <p className="mt-8 text-xs text-muted animate-fade-in-up animation-delay-500">
          Questions? Contact us at{" "}
          <a href="mailto:support@vaulto.ai" className="text-foreground underline">
            support@vaulto.ai
          </a>
        </p>
      </div>
    </div>
  );
}
