import { describe, it, expect } from "vitest";
import { applySlippage } from "./quote";

describe("lib/swap/quote", () => {
  describe("applySlippage", () => {
    it("reduces amount by slippage bps", () => {
      // 10000 amount, 50 bps (0.5%) -> 9950
      expect(applySlippage(BigInt(10000), 50)).toBe(BigInt(9950));
    });

    it("returns 0 when slippage >= 10000", () => {
      expect(applySlippage(BigInt(10000), 10000)).toBe(BigInt(0));
      expect(applySlippage(BigInt(10000), 15000)).toBe(BigInt(0));
    });

    it("rounds down", () => {
      // 1000 * (10000 - 33) / 10000 = 996.7 -> 996
      expect(applySlippage(BigInt(1000), 33)).toBe(BigInt(996));
    });

    it("zero slippage returns same amount", () => {
      expect(applySlippage(BigInt(12345), 0)).toBe(BigInt(12345));
    });
  });
});
