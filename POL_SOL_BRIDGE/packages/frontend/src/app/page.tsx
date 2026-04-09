"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import type { WormholeConnectConfig } from "@wormhole-foundation/wormhole-connect";

// Dynamically import Wormhole Connect to avoid SSR issues
const WormholeConnect = dynamic(
  () => import("@wormhole-foundation/wormhole-connect").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[600px]">
        <div className="animate-pulse text-vaulto-accent">Loading bridge...</div>
      </div>
    ),
  }
);

// PreStock token configurations for Wormhole Connect
const PRESTOCK_TOKENS = [
  { key: "vSPACEX", symbol: "vSPACEX", name: "Vaulted Prestock SpaceX", solanaMint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh" },
  { key: "vANTHROPIC", symbol: "vANTHROPIC", name: "Vaulted Prestock Anthropic", solanaMint: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw" },
  { key: "vOPENAI", symbol: "vOPENAI", name: "Vaulted Prestock OpenAI", solanaMint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF" },
  { key: "vANDURIL", symbol: "vANDURIL", name: "Vaulted Prestock Anduril", solanaMint: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB" },
  { key: "vKALSHI", symbol: "vKALSHI", name: "Vaulted Prestock Kalshi", solanaMint: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua" },
  { key: "vPOLYMARKET", symbol: "vPOLYMARKET", name: "Vaulted Prestock Polymarket", solanaMint: "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP" },
  { key: "vXAI", symbol: "vXAI", name: "Vaulted Prestock xAI", solanaMint: "PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx" },
];

// Wormhole Connect configuration
// Note: routes property removed - NTT routes require proper RouteConstructor setup
// which will be added after NTT deployment is complete
const wormholeConfig: WormholeConnectConfig = {
  network: "Mainnet",
  chains: ["Solana", "Polygon"],
  ui: {
    title: "PreStock Bridge",
    defaultInputs: {
      fromChain: "Solana",
      toChain: "Polygon",
    },
  },
};

export default function BridgePage() {
  return (
    <div className="min-h-screen bg-vaulto-background">
      {/* Header */}
      <header className="border-b border-vaulto-border bg-vaulto-surface/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-vaulto-primary to-vaulto-secondary" />
              <div>
                <h1 className="text-xl font-bold text-white">PreStock Bridge</h1>
                <p className="text-sm text-gray-400">Powered by Wormhole NTT</p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              <a
                href="https://vaulto.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Vaulto Protocol
              </a>
              <a
                href="https://wormhole.com/ntt"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Wormhole NTT
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Info Banner */}
        <div className="mb-8 p-4 rounded-lg bg-vaulto-primary/10 border border-vaulto-primary/30">
          <h2 className="text-lg font-semibold text-vaulto-accent mb-2">
            Bridge PreStock Tokens
          </h2>
          <p className="text-gray-300 text-sm">
            Transfer your PreStock synthetic tokens between Solana and Polygon using
            Wormhole Native Token Transfers. Tokens are locked on Solana and minted on
            Polygon (and vice versa).
          </p>
        </div>

        {/* Token List */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Supported Tokens</h3>
          <div className="flex flex-wrap gap-2">
            {PRESTOCK_TOKENS.map((token) => (
              <span
                key={token.key}
                className="px-3 py-1 text-sm rounded-full bg-vaulto-surface border border-vaulto-border text-gray-300"
              >
                {token.symbol}
              </span>
            ))}
          </div>
        </div>

        {/* Wormhole Connect Widget */}
        <div className="max-w-lg mx-auto">
          <div className="rounded-2xl bg-vaulto-surface border border-vaulto-border p-6 shadow-xl">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-[600px]">
                  <div className="animate-pulse text-vaulto-accent">Loading bridge...</div>
                </div>
              }
            >
              <WormholeConnect config={wormholeConfig} />
            </Suspense>
          </div>
        </div>

        {/* Safety Notice */}
        <div className="mt-8 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <h3 className="text-sm font-semibold text-yellow-400 mb-1">Safety Notice</h3>
          <p className="text-gray-300 text-sm">
            Bridge transfers typically complete within 3-5 minutes. Supply invariants are
            monitored continuously to ensure security. For large transfers, consider
            splitting into smaller amounts.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-vaulto-border mt-auto py-6">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>
            &copy; {new Date().getFullYear()} Vaulto Protocol. Bridge powered by{" "}
            <a
              href="https://wormhole.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-vaulto-accent hover:underline"
            >
              Wormhole
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
