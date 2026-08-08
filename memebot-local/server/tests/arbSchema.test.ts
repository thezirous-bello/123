import { describe, expect, it } from "vitest";
import { ArbStrategyConfigSchema } from "../src/arb/schema.js";

describe("ArbStrategyConfigSchema", () => {
  it("parses to sane defaults with at least 2 exchanges and no API keys required", () => {
    const config = ArbStrategyConfigSchema.parse({});
    expect(config.enabled).toBe(false);
    expect(config.exchanges.length).toBeGreaterThanOrEqual(2);
    expect(config.symbols.length).toBeGreaterThan(0);
    expect(config.positionSizeUsd).toBeGreaterThan(0);
    expect(config.minNetSpreadPct).toBeGreaterThanOrEqual(0);
    expect(config.takerFeePctOverride).toBeNull();
  });

  it("rejects fewer than 2 exchanges", () => {
    const result = ArbStrategyConfigSchema.safeParse({ exchanges: ["binance"] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown exchange id", () => {
    const result = ArbStrategyConfigSchema.safeParse({ exchanges: ["binance", "coinbase"] });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate exchanges", () => {
    const result = ArbStrategyConfigSchema.safeParse({ exchanges: ["binance", "binance"] });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate symbols (case-insensitive)", () => {
    const result = ArbStrategyConfigSchema.safeParse({ symbols: ["BTC", "btc"] });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields (strict schema)", () => {
    const result = ArbStrategyConfigSchema.safeParse({ notARealField: 1 });
    expect(result.success).toBe(false);
  });

  it("accepts an explicit taker fee override", () => {
    const config = ArbStrategyConfigSchema.parse({ takerFeePctOverride: 0.15 });
    expect(config.takerFeePctOverride).toBe(0.15);
  });
});
