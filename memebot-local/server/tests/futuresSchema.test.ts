import { describe, expect, it } from "vitest";
import { confidenceFromScore, FuturesStrategyConfigSchema, leverageForConfidence, positionSizePctForConfidence } from "../src/futures/schema.js";

describe("FuturesStrategyConfigSchema", () => {
  it("parses to defaults matching the LONG & SHORT strategy spec's stated risk profile", () => {
    const config = FuturesStrategyConfigSchema.parse({});
    expect(config.minLeverage).toBe(15);
    expect(config.maxLeverage).toBe(30);
    expect(config.minPositionSizePct).toBe(20);
    expect(config.maxPositionSizePct).toBe(50);
    expect(config.tp1Pct).toBe(2);
    expect(config.tp2Pct).toBe(4);
    expect(config.dailyMaxLossPct).toBe(8);
  });

  it("rejects a confidence-tier leverage value outside [minLeverage, maxLeverage]", () => {
    const result = FuturesStrategyConfigSchema.safeParse({ minLeverage: 15, maxLeverage: 30, leverageHighConfidence: 35 });
    expect(result.success).toBe(false);
  });

  it("rejects a confidence-tier position-size value outside [minPositionSizePct, maxPositionSizePct]", () => {
    const result = FuturesStrategyConfigSchema.safeParse({ minPositionSizePct: 20, maxPositionSizePct: 50, positionSizeLowConfidencePct: 10 });
    expect(result.success).toBe(false);
  });

  it("rejects minLeverage greater than maxLeverage", () => {
    const result = FuturesStrategyConfigSchema.safeParse({ minLeverage: 30, maxLeverage: 15 });
    expect(result.success).toBe(false);
  });

  it("rejects tp1ClosePct + tp2ClosePct over 100%", () => {
    const result = FuturesStrategyConfigSchema.safeParse({ tp1ClosePct: 70, tp2ClosePct: 40 });
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

describe("confidence tiers", () => {
  const config = FuturesStrategyConfigSchema.parse({});

  it("buckets score into low/medium/high using the configured thresholds", () => {
    expect(confidenceFromScore(80, config)).toBe("high");
    expect(confidenceFromScore(60, config)).toBe("medium");
    expect(confidenceFromScore(30, config)).toBe("low");
  });

  it("maps confidence to leverage strictly within [minLeverage, maxLeverage], increasing with confidence", () => {
    const low = leverageForConfidence("low", config);
    const medium = leverageForConfidence("medium", config);
    const high = leverageForConfidence("high", config);
    expect(low).toBeGreaterThanOrEqual(config.minLeverage);
    expect(high).toBeLessThanOrEqual(config.maxLeverage);
    expect(low).toBeLessThan(medium);
    expect(medium).toBeLessThan(high);
  });

  it("maps confidence to position size strictly within [minPositionSizePct, maxPositionSizePct], increasing with confidence", () => {
    const low = positionSizePctForConfidence("low", config);
    const medium = positionSizePctForConfidence("medium", config);
    const high = positionSizePctForConfidence("high", config);
    expect(low).toBeGreaterThanOrEqual(config.minPositionSizePct);
    expect(high).toBeLessThanOrEqual(config.maxPositionSizePct);
    expect(low).toBeLessThan(medium);
    expect(medium).toBeLessThan(high);
  });

  it("clamps an out-of-tier-bounds config value into the hard min/max at read time", () => {
    // Schema validation already rejects this at write time (tested above);
    // the clamp is a second, defense-in-depth line for any config that
    // somehow bypasses validation (e.g. an old settings row).
    const weird = { ...config, leverageHighConfidence: 999 };
    expect(leverageForConfidence("high", weird)).toBe(config.maxLeverage);
  });
});
