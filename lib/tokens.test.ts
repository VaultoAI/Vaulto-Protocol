import { describe, it, expect } from "vitest";
import {
  buildTokenRegistryFromPools,
  buildPoolForPairMap,
  getTokenBySymbol,
  getPoolForPair,
  pairKey,
} from "./tokens";
import type { PoolWithTokens } from "./pools";

const mockPoolsWithTokens: PoolWithTokens[] = [
  {
    id: "0xpool1",
    feeTier: "3000",
    token0: { id: "0xusdc", symbol: "USDC", decimals: "6" },
    token1: { id: "0xnvda", symbol: "NVDAon", decimals: "18" },
  },
  {
    id: "0xpool2",
    feeTier: "3000",
    token0: { id: "0xspy", symbol: "SPYon", decimals: "18" },
    token1: { id: "0xusdc", symbol: "USDC", decimals: "6" },
  },
];

const mockCsvPools = [
  { pool: "USDC / NVDAon", address: "0xpool1" },
  { pool: "SPYon / USDC", address: "0xpool2" },
];

describe("lib/tokens", () => {
  describe("pairKey", () => {
    it("returns sorted pair key", () => {
      expect(pairKey("USDC", "NVDAon")).toBe("NVDAon-USDC");
      expect(pairKey("NVDAon", "USDC")).toBe("NVDAon-USDC");
      expect(pairKey("SPYon", "USDC")).toBe("SPYon-USDC");
    });
  });

  describe("buildTokenRegistryFromPools", () => {
    it("builds symbol to address and decimals", () => {
      const registry = buildTokenRegistryFromPools(mockPoolsWithTokens);
      expect(registry.USDC).toEqual({ address: "0xusdc", decimals: 6 });
      expect(registry.NVDAon).toEqual({ address: "0xnvda", decimals: 18 });
      expect(registry.SPYon).toEqual({ address: "0xspy", decimals: 18 });
    });

    it("overwrites same symbol from later pool", () => {
      const pools = [
        ...mockPoolsWithTokens,
        { ...mockPoolsWithTokens[0], token0: { id: "0xusdc2", symbol: "USDC", decimals: "6" } },
      ];
      const registry = buildTokenRegistryFromPools(pools);
      expect(registry.USDC?.address).toBe("0xusdc2");
    });
  });

  describe("buildPoolForPairMap", () => {
    it("returns pool address and fee for each pair", () => {
      const map = buildPoolForPairMap(mockCsvPools, mockPoolsWithTokens);
      expect(map["NVDAon-USDC"]).toEqual({ poolAddress: "0xpool1", feeTier: 3000 });
      expect(map["SPYon-USDC"]).toEqual({ poolAddress: "0xpool2", feeTier: 3000 });
    });
  });

  describe("getTokenBySymbol", () => {
    it("returns token info for known symbol", () => {
      const registry = buildTokenRegistryFromPools(mockPoolsWithTokens);
      expect(getTokenBySymbol(registry, "USDC")).toEqual({ address: "0xusdc", decimals: 6 });
      expect(getTokenBySymbol(registry, "UNKNOWN")).toBeNull();
    });
  });

  describe("getPoolForPair", () => {
    it("returns pool for pair symbols", () => {
      const map = buildPoolForPairMap(mockCsvPools, mockPoolsWithTokens);
      expect(getPoolForPair(map, "USDC", "NVDAon")).toEqual({ poolAddress: "0xpool1", feeTier: 3000 });
      expect(getPoolForPair(map, "NVDAon", "USDC")).toEqual({ poolAddress: "0xpool1", feeTier: 3000 });
      expect(getPoolForPair(map, "USDC", "WETH")).toBeNull();
    });
  });
});
