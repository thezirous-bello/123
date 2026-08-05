import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "./testUtils.js";
import { Decimal } from "../src/lib/decimal.js";
import { assessSpotEntryRisk, computeSpotPositionSize } from "../src/spot/riskEngine.js";
import { SpotStrategyConfigSchema } from "../src/spot/schema.js";
import { createSpotPosition, applySpotExit } from "../src/spot/repository.js";
import { recordSpotTradeOutcome, triggerSpotEmergencyStop, resumeSpotFromEmergencyStop } from "../src/spot/state.js";

function baseInput(overrides: Partial<Parameters<typeof assessSpotEntryRisk>[0]> = {}) {
  return {
    mode: "testnet" as const,
    notionalUsd: new Decimal(100),
    availableBalanceUsd: new Decimal(1000),
    accountEquityUsd: new Decimal(1000),
    config: SpotStrategyConfigSchema.parse({}),
    ...overrides,
  };
}

beforeEach(() => {
  resetDb();
});

describe("assessSpotEntryRisk", () => {
  it("approves a well-formed testnet entry within all limits", () => {
    const result = assessSpotEntryRisk(baseInput());
    expect(result.approved).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it("blocks live trading when SPOT_LIVE_TRADING_ENABLED is off by default", () => {
    const result = assessSpotEntryRisk(baseInput({ mode: "live" }));
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /SPOT_LIVE_TRADING_ENABLED/.test(r))).toBe(true);
  });

  it("blocks when required cash exceeds available balance", () => {
    const result = assessSpotEntryRisk(baseInput({ notionalUsd: new Decimal(2000), availableBalanceUsd: new Decimal(1000) }));
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /cash/i.test(r))).toBe(true);
  });

  it("blocks when max active trades is already reached", () => {
    createSpotPosition({
      signalId: null,
      symbol: "BTCUSDT",
      side: "long",
      mode: "testnet",
      entryPrice: new Decimal(50000),
      qty: new Decimal(0.01),
      notionalUsd: new Decimal(500),
      stopLoss: new Decimal(49000),
      takeProfits: [],
      bybitOrderId: null,
    });
    const result = assessSpotEntryRisk(baseInput({ config: SpotStrategyConfigSchema.parse({ maxActiveTrades: 1 }) }));
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /open spot position/i.test(r))).toBe(true);
  });

  it("blocks once the daily loss limit has been breached", () => {
    const position = createSpotPosition({
      signalId: null,
      symbol: "ETHUSDT",
      side: "long",
      mode: "testnet",
      entryPrice: new Decimal(3000),
      qty: new Decimal(1),
      notionalUsd: new Decimal(3000),
      stopLoss: new Decimal(2900),
      takeProfits: [],
      bybitOrderId: null,
    });
    // Realize a big loss: exit at 2900 (down $100/unit * qty 1 = -$100), well within a
    // $1000 equity account that's an easy 10% — over the 8% default daily cap.
    applySpotExit(position.id, { closedQty: new Decimal(1), exitPrice: new Decimal(2900), closeReason: "stop_loss" });

    const result = assessSpotEntryRisk(baseInput());
    expect(result.approved).toBe(false);
    expect(result.checks.find((c) => c.name === "daily_max_loss")?.passed).toBe(false);
  });

  it("blocks after the consecutive-loss halt threshold and clears on emergency-stop resume", () => {
    recordSpotTradeOutcome(true);
    recordSpotTradeOutcome(true);
    recordSpotTradeOutcome(true); // 3 consecutive losses = default stopAfterConsecutiveLosses
    const result = assessSpotEntryRisk(baseInput());
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /consecutive loss/i.test(r))).toBe(true);
  });

  it("blocks all entries while the spot emergency stop is active", () => {
    triggerSpotEmergencyStop("test", "testing");
    expect(assessSpotEntryRisk(baseInput()).approved).toBe(false);
    resumeSpotFromEmergencyStop("test");
    expect(assessSpotEntryRisk(baseInput()).approved).toBe(true);
  });
});

describe("computeSpotPositionSize", () => {
  it("sizes qty so the loss at stop-loss equals riskPerTradePct of equity", () => {
    const result = computeSpotPositionSize({
      equityUsd: new Decimal(1000),
      entryPrice: new Decimal(100),
      stopLoss: new Decimal(98), // $2 stop distance
      riskPerTradePct: 2, // risk $20
      sizeMultiplier: 1,
      qtyStep: 0.01,
    });
    // qty * $2 stop distance should equal ~$20 risk
    expect(result.qty.times(2).toNumber()).toBeCloseTo(20, 0);
    expect(result.notionalUsd.toNumber()).toBeCloseTo(result.qty.times(100).toNumber(), 5);
  });

  it("halves the size when sizeMultiplier is 0.5 (Fear & Greed reduction)", () => {
    const full = computeSpotPositionSize({
      equityUsd: new Decimal(1000),
      entryPrice: new Decimal(100),
      stopLoss: new Decimal(98),
      riskPerTradePct: 2,
      sizeMultiplier: 1,
      qtyStep: 0.001,
    });
    const halved = computeSpotPositionSize({
      equityUsd: new Decimal(1000),
      entryPrice: new Decimal(100),
      stopLoss: new Decimal(98),
      riskPerTradePct: 2,
      sizeMultiplier: 0.5,
      qtyStep: 0.001,
    });
    expect(halved.qty.toNumber()).toBeCloseTo(full.qty.toNumber() / 2, 3);
  });

  it("returns zero size when stop-loss equals entry price (no risk distance)", () => {
    const result = computeSpotPositionSize({
      equityUsd: new Decimal(1000),
      entryPrice: new Decimal(100),
      stopLoss: new Decimal(100),
      riskPerTradePct: 2,
      sizeMultiplier: 1,
      qtyStep: 0.001,
    });
    expect(result.qty.toNumber()).toBe(0);
  });
});
