import { describe, expect, it } from "vitest";
import { SpotStrategyConfigSchema } from "../src/spot/schema.js";

describe("SpotStrategyConfigSchema", () => {
  it("parses to sane defaults matching the user's strategy spec", () => {
    const config = SpotStrategyConfigSchema.parse({});
    expect(config.tp1Pct).toBe(2);
    expect(config.tp2Pct).toBe(4);
    expect(config.dailyMaxLossPct).toBe(8);
    expect(config.stopAfterConsecutiveLosses).toBe(3);
  });

  it("has no leverage field — spot is always fully cash-funded", () => {
    const config = SpotStrategyConfigSchema.parse({});
    expect("leverage" in config).toBe(false);
    expect("maxLeverage" in config).toBe(false);
  });

  it("rejects tp1ClosePct + tp2ClosePct over 100%", () => {
    const result = SpotStrategyConfigSchema.safeParse({ tp1ClosePct: 70, tp2ClosePct: 40 });
    expect(result.success).toBe(false);
  });

  it("requires manualSymbols to be non-empty when symbolUniverse is manual", () => {
    const result = SpotStrategyConfigSchema.safeParse({ symbolUniverse: "manual", manualSymbols: [] });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields (strict schema)", () => {
    const result = SpotStrategyConfigSchema.safeParse({ notARealField: 1 });
    expect(result.success).toBe(false);
  });
});
