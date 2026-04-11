"use client";

import { useEffect, useState } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";

// =============================================================================
// TOKEN TICKER - Shows animated token prices with actual company logos
// =============================================================================

const mockTokens = [
  { symbol: "vSPACEX", companyName: "SpaceX", price: 142.5, change: 3.2 },
  { symbol: "vANTHROPIC", companyName: "Anthropic", price: 89.75, change: 5.8 },
  { symbol: "vOPENAI", companyName: "OpenAI", price: 215.0, change: -1.4 },
  { symbol: "vANDURIL", companyName: "Anduril", price: 67.25, change: 2.1 },
  { symbol: "vPOLYMARKET", companyName: "Polymarket", price: 48.9, change: 8.5 },
  { symbol: "vKALSHI", companyName: "Kalshi", price: 23.4, change: 1.2 },
];

export function TokenTicker() {
  const [prices, setPrices] = useState(mockTokens);
  const [pulseIndex, setPulseIndex] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * prices.length);
      setPulseIndex(randomIndex);

      setPrices((prev) =>
        prev.map((token, i) => {
          if (i === randomIndex) {
            const changeAmount = (Math.random() - 0.5) * 2;
            return {
              ...token,
              price: Math.max(1, token.price + changeAmount),
              change: token.change + (Math.random() - 0.5) * 0.5,
            };
          }
          return token;
        })
      );

      setTimeout(() => setPulseIndex(null), 500);
    }, 2000);

    return () => clearInterval(interval);
  }, [prices.length]);

  return (
    <div className="space-y-3">
      <div className="mb-4 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>Token</span>
        <div className="flex gap-8">
          <span>Price</span>
          <span className="w-16 text-right">24h</span>
        </div>
      </div>
      {prices.map((token, index) => (
        <div
          key={token.symbol}
          className={`flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 transition-all duration-300 ${
            pulseIndex === index ? "border-blue-500/50 shadow-lg shadow-blue-500/10" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <CompanyLogo name={token.companyName} size={32} />
            <span className="font-medium text-[var(--foreground)]">
              {token.symbol}
            </span>
          </div>
          <div className="flex items-center gap-8">
            <span
              className={`font-mono text-[var(--foreground)] transition-all ${
                pulseIndex === index ? "scale-105" : ""
              }`}
            >
              ${token.price.toFixed(2)}
            </span>
            <span
              className={`w-16 text-right font-mono text-sm ${
                token.change >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {token.change >= 0 ? "+" : ""}
              {token.change.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// CODE BLOCK - Shows AMM contract interface
// =============================================================================

const codeSnippet = `interface IPriceOracleAMM {
  // Get current token price from oracle
  function getPrice(
    address token
  ) external view returns (uint256);

  // Swap tokens with oracle-adjusted pricing
  function swap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) external returns (uint256 amountOut);

  // Add concentrated liquidity
  function addLiquidity(
    address token,
    uint256 amount,
    int24 tickLower,
    int24 tickUpper
  ) external returns (uint256 liquidity);
}`;

export function CodeBlock() {
  return (
    <div className="overflow-hidden rounded-lg bg-[#0d1117] font-mono text-sm">
      {/* Window controls */}
      <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-red-500/80" />
        <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
        <div className="h-3 w-3 rounded-full bg-green-500/80" />
        <span className="ml-3 text-xs text-gray-500">IPriceOracleAMM.sol</span>
      </div>

      {/* Code content */}
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed sm:text-sm">
        <code>
          {codeSnippet.split("\n").map((line, i) => (
            <div key={i} className="flex">
              <span className="mr-4 inline-block w-6 select-none text-right text-gray-600">
                {i + 1}
              </span>
              <span>
                {highlightSolidity(line)}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

function highlightSolidity(line: string) {
  // Simple syntax highlighting
  return line
    .split(/(\b(?:interface|function|external|view|returns|address|uint256|int24)\b|\/\/.*$)/g)
    .map((part, i) => {
      if (/^(interface|function|external|view|returns)$/.test(part)) {
        return (
          <span key={i} className="text-purple-400">
            {part}
          </span>
        );
      }
      if (/^(address|uint256|int24)$/.test(part)) {
        return (
          <span key={i} className="text-cyan-400">
            {part}
          </span>
        );
      }
      if (part.startsWith("//")) {
        return (
          <span key={i} className="text-gray-500">
            {part}
          </span>
        );
      }
      return (
        <span key={i} className="text-gray-300">
          {part}
        </span>
      );
    });
}

// =============================================================================
// CHAIN DIAGRAM - Shows cross-chain bridge flow with real company logos
// =============================================================================

const bridgeTokens = [
  { symbol: "vSPACEX", companyName: "SpaceX" },
  { symbol: "vANTHROPIC", companyName: "Anthropic" },
  { symbol: "vOPENAI", companyName: "OpenAI" },
  { symbol: "vANDURIL", companyName: "Anduril" },
  { symbol: "vKALSHI", companyName: "Kalshi" },
  { symbol: "vPOLYMARKET", companyName: "Polymarket" },
];

export function ChainDiagram() {
  const [activeToken, setActiveToken] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setActiveToken((prev) => (prev + 1) % bridgeTokens.length);
        setAnimating(false);
      }, 1000);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-8 py-4">
      {/* Chain icons */}
      <div className="flex w-full items-center justify-between">
        {/* Solana */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black shadow-lg">
            <svg viewBox="0 0 397.7 311.7" className="h-9 w-9" fill="none">
              <linearGradient id="solana-grad-1" x1="360.879" y1="351.455" x2="141.213" y2="-69.294" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1 0 0 -1 0 314)">
                <stop offset="0" stopColor="#00FFA3"/>
                <stop offset="1" stopColor="#DC1FFF"/>
              </linearGradient>
              <linearGradient id="solana-grad-2" x1="264.829" y1="401.601" x2="45.163" y2="-19.148" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1 0 0 -1 0 314)">
                <stop offset="0" stopColor="#00FFA3"/>
                <stop offset="1" stopColor="#DC1FFF"/>
              </linearGradient>
              <linearGradient id="solana-grad-3" x1="312.548" y1="376.688" x2="92.882" y2="-44.061" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1 0 0 -1 0 314)">
                <stop offset="0" stopColor="#00FFA3"/>
                <stop offset="1" stopColor="#DC1FFF"/>
              </linearGradient>
              <path fill="url(#solana-grad-1)" d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
              <path fill="url(#solana-grad-2)" d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
              <path fill="url(#solana-grad-3)" d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
            </svg>
          </div>
          <span className="text-sm font-medium text-[var(--foreground)]">Solana</span>
        </div>

        {/* Bridge arrow */}
        <div className="relative flex flex-1 items-center justify-center px-4">
          <div className="h-0.5 w-full bg-gradient-to-r from-[#9945FF] via-cyan-500 to-[#8247E5]" />

          {/* Animated token with real logo */}
          <div
            className={`absolute flex h-10 w-10 items-center justify-center rounded-full bg-[var(--card-bg)] shadow-lg ring-2 ring-cyan-500/50 transition-all duration-1000 ${
              animating ? "translate-x-16 scale-110" : "-translate-x-16"
            }`}
          >
            <CompanyLogo name={bridgeTokens[activeToken].companyName} size={32} />
          </div>

          {/* Wormhole logo in center */}
          <div className="absolute flex h-12 w-12 items-center justify-center rounded-full border-2 border-cyan-500/30 bg-[var(--card-bg)]">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600" />
          </div>
        </div>

        {/* Polygon */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#8247E5] shadow-lg">
            <svg viewBox="0 0 38.4 33.5" className="h-8 w-8" fill="white">
              <path d="M29 10.2c-.7-.4-1.6-.4-2.4 0L21 13.5l-3.8 2.1-5.5 3.3c-.7.4-1.6.4-2.4 0l-4.3-2.6c-.7-.4-1.2-1.2-1.2-2.1V10c0-.8.4-1.6 1.2-2.1l4.3-2.5c.7-.4 1.6-.4 2.4 0l4.3 2.6c.7.4 1.2 1.2 1.2 2.1v3.3l3.8-2.2V8c0-.8-.4-1.6-1.2-2.1l-8-4.7c-.7-.4-1.6-.4-2.4 0L1.2 5.9C.4 6.3 0 7.1 0 7.9v9.4c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l5.5-3.2 3.8-2.2 5.5-3.2c.7-.4 1.6-.4 2.4 0l4.3 2.5c.7.4 1.2 1.2 1.2 2.1v4.2c0 .8-.4 1.6-1.2 2.1l-4.3 2.5c-.7.4-1.6.4-2.4 0l-4.3-2.5c-.7-.4-1.2-1.2-1.2-2.1V21l-3.8 2.2v3.3c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l8.1-4.7c.7-.4 1.2-1.2 1.2-2.1V17c0-.8-.4-1.6-1.2-2.1L29 10.2z"/>
            </svg>
          </div>
          <span className="text-sm font-medium text-[var(--foreground)]">Polygon</span>
        </div>
      </div>

    </div>
  );
}
