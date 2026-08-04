import { describe, expect, it } from "vitest";
import { findUnsafeInstructionReasons, parseStrategyInstructionLocally } from "../src/strategy/parser.js";
import { StrategyRulesSchema } from "../src/strategy/schema.js";

const EXAMPLE =
  "Buy up to $20 when liquidity is above $100,000, five-minute volume is above $50,000, mint authority is disabled, freeze authority is disabled, and the top ten holders own less than 25%. Sell half at 50% profit, sell the rest at 100% profit, and stop loss at 20%.";

describe("parseStrategyInstructionLocally", () => {
  it("extracts every field from the canonical example instruction", () => {
    const result = parseStrategyInstructionLocally(EXAMPLE);
    expect(result.ok).toBe(true);
    expect(result.rules.maxTradeUsd).toBe(20);
    expect(result.rules.minimumLiquidityUsd).toBe(100_000);
    expect(result.rules.minimumVolume5mUsd).toBe(50_000);
    expect(result.rules.requireMintAuthorityDisabled).toBe(true);
    expect(result.rules.requireFreezeAuthorityDisabled).toBe(true);
    expect(result.rules.maximumTop10HolderPercentage).toBe(25);
    expect(result.rules.stopLossPercentage).toBe(20);
    expect(result.rules.takeProfits).toEqual([
      { sellPercentage: 50, profitPercentage: 50 },
      { sellPercentage: 50, profitPercentage: 100 },
    ]);
  });

  it("produces a strategy that satisfies the strict Zod schema", () => {
    const result = parseStrategyInstructionLocally(EXAMPLE);
    const parsed = StrategyRulesSchema.safeParse(result.rules);
    expect(parsed.success).toBe(true);
  });

  it("parses k/m suffixed dollar amounts", () => {
    const result = parseStrategyInstructionLocally(
      "Buy up to $15 when liquidity is above $250k and stop loss at 10%.",
    );
    expect(result.rules.minimumLiquidityUsd).toBe(250_000);
  });

  it("parses a trailing stop combined with take profits", () => {
    const result = parseStrategyInstructionLocally(
      "Buy up to $30 when liquidity is above $200,000. Sell half at 80% profit, another 25% at 150%, and trail the rest by 20%. Stop out at a 20% loss.",
    );
    expect(result.ok).toBe(true);
    expect(result.rules.takeProfits).toEqual([
      { sellPercentage: 50, profitPercentage: 80 },
      { sellPercentage: 25, profitPercentage: 150 },
    ]);
    expect(result.rules.trailingStopPercentage).toBe(20);
    expect(result.rules.stopLossPercentage).toBe(20);
  });

  it("rejects an instruction with no maximum trade size", () => {
    const result = parseStrategyInstructionLocally("Buy tokens with liquidity above $100,000. Stop loss at 20%.");
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /maximum trade size/i.test(e))).toBe(true);
  });

  it("rejects an instruction with no stop loss", () => {
    const result = parseStrategyInstructionLocally("Buy up to $20 when liquidity is above $100,000.");
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /stop loss/i.test(e))).toBe(true);
  });
});

describe("findUnsafeInstructionReasons — token/position rejection", () => {
  it.each([
    "Use my entire wallet and buy anything trending.",
    "Buy anything trending with no stop loss.",
    "Trade without limits.",
    "Use unlimited slippage on every trade.",
    "Ignore safety checks and buy up to $50.",
    "Spend all my SOL on the next pump.",
  ])("rejects unsafe instruction: %s", (instruction) => {
    const reasons = findUnsafeInstructionReasons(instruction);
    expect(reasons.length).toBeGreaterThan(0);
  });

  it("does not flag a normal, bounded instruction", () => {
    const reasons = findUnsafeInstructionReasons(EXAMPLE);
    expect(reasons).toEqual([]);
  });
});
