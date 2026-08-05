import { describe, expect, it } from "vitest";
import { FuturesStrategyConfigSchema } from "../src/futures/schema.js";

describe("FuturesStrategyConfigSchema", () => {
  it("parses to sane defaults matching the user's strategy spec", () => {
    const config = FuturesStrategyConfigSchema.parse({});
    expect(config.leverage).toBe(5);
    expect(config.maxLeverage).toBe(8);
    expect(config.tp1Pct).toBe(2);
    expect(config.tp2Pct).toBe(4);
    expect(config.dailyMaxLossPct).toBe(8);
    expect(config.stopAfterConsecutiveLosses).toBe(3);
  });

  it("rejects tp1ClosePct + tp2ClosePct over 100%", () => {
    const result = FuturesStrategyConfigSchema.safeParse({ tp1ClosePct: 70, tp2ClosePct: 40 });
    expect(result.success).toBe(false);
  });

  it("rejects leverage greater than maxLeverage", () => {
    const result = FuturesStrategyConfigSchema.safeParse({ leverage: 10, maxLeverage: 8 });
    expect(result.success).toBe(false);
  });

  it("requires manualSymbols to be non-empty when symbolUniverse is manual", () => {
    const result = FuturesStrategyConfigSchema.safeParse({ symbolUniverse: "manual", manualSymbols: [] });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields (strict schema)", () => {
    const result = FuturesStrategyConfigSchema.safeParse({ notARealField: 1 });
    expect(result.success).toBe(false);
  });
});
