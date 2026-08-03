import { describe, expect, it } from "vitest";
import { StrategyRulesSchema } from "../src/strategy/schema.js";
import { enforceGlobalLimits, validateStrategyRules } from "../src/strategy/validator.js";
import { RiskLimitsSchema } from "../src/lib/settings.js";

const baseRules = {
  maxTradeUsd: 20,
  minimumLiquidityUsd: 100_000,
  maximumTop10HolderPercentage: 25,
  stopLossPercentage: 20,
  takeProfits: [{ profitPercentage: 50, sellPercentage: 100 }],
};

describe("StrategyRulesSchema", () => {
  it("accepts a valid, minimal rule set and fills in defaults", () => {
    const result = StrategyRulesSchema.safeParse(baseRules);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quoteToken).toBe("SOL");
      expect(result.data.requireSellSimulation).toBe(true);
      expect(result.data.maximumSlippagePercentage).toBe(3);
    }
  });

  it("rejects unknown fields (no executable code / smuggled fields)", () => {
    const result = StrategyRulesSchema.safeParse({ ...baseRules, evalCode: "process.exit(1)" });
    expect(result.success).toBe(false);
  });

  it("rejects take-profit sell percentages that add up to more than 100%", () => {
    const result = StrategyRulesSchema.safeParse({
      ...baseRules,
      takeProfits: [
        { profitPercentage: 50, sellPercentage: 70 },
        { profitPercentage: 100, sellPercentage: 40 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a maxTradeUsd of zero or negative", () => {
    expect(StrategyRulesSchema.safeParse({ ...baseRules, maxTradeUsd: 0 }).success).toBe(false);
    expect(StrategyRulesSchema.safeParse({ ...baseRules, maxTradeUsd: -5 }).success).toBe(false);
  });

  it("rejects a stop loss above 100%", () => {
    expect(StrategyRulesSchema.safeParse({ ...baseRules, stopLossPercentage: 150 }).success).toBe(false);
  });
});

describe("validateStrategyRules", () => {
  it("returns plain-English errors for an invalid candidate, not a crash", () => {
    const result = validateStrategyRules({ ...baseRules, maxTradeUsd: -1 });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("enforceGlobalLimits", () => {
  const limits = RiskLimitsSchema.parse({ maxTradeUsd: 10, maxSlippagePercentage: 3, maxPriceImpactPercentage: 2, minimumLiquidityUsd: 20_000 });

  it("clamps a trade size that exceeds the global maximum", () => {
    const rules = StrategyRulesSchema.parse(baseRules); // maxTradeUsd 20 > global 10
    const { rules: clamped, warnings } = enforceGlobalLimits(rules, limits);
    expect(clamped.maxTradeUsd).toBe(10);
    expect(warnings.some((w) => /exceeds your global maximum/i.test(w))).toBe(true);
  });

  it("raises a minimum-liquidity floor that is below the global floor", () => {
    const rules = StrategyRulesSchema.parse({ ...baseRules, minimumLiquidityUsd: 500 });
    const { rules: clamped, warnings } = enforceGlobalLimits(rules, limits);
    expect(clamped.minimumLiquidityUsd).toBe(20_000);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("never loosens sell-simulation requirement", () => {
    const rules = StrategyRulesSchema.parse({ ...baseRules, requireSellSimulation: false });
    const { rules: clamped } = enforceGlobalLimits(rules, limits);
    expect(clamped.requireSellSimulation).toBe(true);
  });

  it("leaves compliant values untouched", () => {
    const rules = StrategyRulesSchema.parse({ ...baseRules, maxTradeUsd: 5, minimumLiquidityUsd: 50_000 });
    const { rules: clamped, warnings } = enforceGlobalLimits(rules, limits);
    expect(clamped.maxTradeUsd).toBe(5);
    expect(clamped.minimumLiquidityUsd).toBe(50_000);
    expect(warnings).toEqual([]);
  });
});
