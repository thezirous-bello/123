import { describe, expect, it } from "vitest";
import { evaluateMomentumConditions } from "../src/engine/strategyEvaluator.js";
import { StrategyRulesSchema } from "../src/strategy/schema.js";
import { MomentumConfigSchema } from "../src/lib/settings.js";
import type { MomentumScoreResult } from "../src/market/momentum.js";

const baseRules = StrategyRulesSchema.parse({
  maxTradeUsd: 20,
  stopLossPercentage: 20,
  takeProfits: [],
});
const defaultConfig = MomentumConfigSchema.parse({});

function baseMomentum(overrides: Partial<MomentumScoreResult> = {}): MomentumScoreResult {
  return {
    totalScore: 75,
    components: {
      priceMomentum: 75,
      volumeAcceleration: 75,
      buyPressure: 75,
      txAcceleration: 75,
      liquidityQuality: 75,
      trendStrength: 75,
      executionQuality: 75,
    },
    trendDirection: "bullish",
    momentumAccelerating: true,
    exhaustionWarning: false,
    volumeAccelerating: true,
    buyPressureDominant: true,
    txAccelerating: true,
    buySellRatio: 0.7,
    distanceFromHighPct: 0,
    reasons: [],
    ...overrides,
  };
}

describe("evaluateMomentumConditions", () => {
  it("passes a strong, accelerating, buy-dominant candidate against the account defaults", () => {
    const conditions = evaluateMomentumConditions(baseRules, defaultConfig, baseMomentum());
    expect(conditions.every((c) => c.passed)).toBe(true);
  });

  it("rejects a candidate below the account's default minimum momentum score", () => {
    const conditions = evaluateMomentumConditions(baseRules, defaultConfig, baseMomentum({ totalScore: 20 }));
    const scoreCheck = conditions.find((c) => c.name === "momentum_score");
    expect(scoreCheck?.passed).toBe(false);
  });

  it("a strategy's own minimumMomentumScore overrides the account default", () => {
    const strict = StrategyRulesSchema.parse({ ...baseRules, minimumMomentumScore: 90 });
    const conditions = evaluateMomentumConditions(strict, defaultConfig, baseMomentum({ totalScore: 80 }));
    const scoreCheck = conditions.find((c) => c.name === "momentum_score");
    expect(scoreCheck?.passed).toBe(false);
  });

  it("rejects a candidate whose volume is not accelerating (account default requires it)", () => {
    const conditions = evaluateMomentumConditions(baseRules, defaultConfig, baseMomentum({ volumeAccelerating: false }));
    expect(conditions.some((c) => c.name === "volume_accelerating" && !c.passed)).toBe(true);
  });

  it("rejects a candidate flagged as exhausted even if its raw score is high", () => {
    const conditions = evaluateMomentumConditions(baseRules, defaultConfig, baseMomentum({ totalScore: 95, exhaustionWarning: true }));
    expect(conditions.some((c) => c.name === "not_exhausted" && !c.passed)).toBe(true);
  });

  it("does not gate on transaction acceleration by default (account default has it off)", () => {
    const conditions = evaluateMomentumConditions(baseRules, defaultConfig, baseMomentum({ txAccelerating: false }));
    expect(conditions.some((c) => c.name === "tx_accelerating")).toBe(false);
  });

  it("a strategy can explicitly require transaction acceleration even though the account default doesn't", () => {
    const strict = StrategyRulesSchema.parse({ ...baseRules, requireTxAccelerating: true });
    const conditions = evaluateMomentumConditions(strict, defaultConfig, baseMomentum({ txAccelerating: false }));
    expect(conditions.some((c) => c.name === "tx_accelerating" && !c.passed)).toBe(true);
  });
});
