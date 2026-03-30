import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Ignore optional @farcaster/mini-app-solana module from @privy-io/react-auth
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@farcaster/mini-app-solana": false,
    };
    return config;
  },
};

export default nextConfig;
