import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "./testUtils.js";
import { Decimal } from "../src/lib/decimal.js";
import { assessFuturesEntryRisk, computeFuturesPositionSize } from "../src/futures/riskEngine.js";
import { FuturesStrategyConfigSchema } from "../src/futures/schema.js";
import { createFuturesPosition, applyFuturesExit } from "../src/futures/repository.js";
import { recordFuturesTradeOutcome, triggerFuturesEmergencyStop, resumeFuturesFromEmergencyStop } from "../src/futures/state.js";

function baseInput(overrides: Partial<Parameters<typeof assessFuturesEntryRisk>[0]> = {}) {
  return {
    mode: "testnet" as const,
    leverage: 5,
    maxInstrumentLeverage: 50,
    marginUsd: new Decimal(100),
    availableBalanceUsd: new Decimal(1000),
    accountEquityUsd: new Decimal(1000),
    config: FuturesStrategyConfigSchema.parse({}),
    ...overrides,
  };
}

beforeEach(() => {
  resetDb();
});

describe("assessFuturesEntryRisk", () => {
  it("approves a well-formed testnet entry within all limits", () => {
    const result = assessFuturesEntryRisk(baseInput());
    expect(result.approved).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it("blocks live trading when FUTURES_LIVE_TRADING_ENABLED is off by default", () => {
    const result = assessFuturesEntryRisk(baseInput({ mode: "live" }));
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /FUTURES_LIVE_TRADING_ENABLED/.test(r))).toBe(true);
  });

  it("blocks when leverage exceeds the configured cap", () => {
    const result = assessFuturesEntryRisk(baseInput({ leverage: 20, config: FuturesStrategyConfigSchema.parse({ maxLeverage: 8, leverage: 5 }) }));
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /leverage/i.test(r))).toBe(true);
  });

  it("blocks when leverage exceeds the instrument's own max leverage", () => {
    const result = assessFuturesEntryRisk(baseInput({ leverage: 10, maxInstrumentLeverage: 5 }));
    expect(result.approved).toBe(false);
  });

  it("blocks when required margin exceeds available balance", () => {
    const result = assessFuturesEntryRisk(baseInput({ marginUsd: new Decimal(2000), availableBalanceUsd: new Decimal(1000) }));
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /margin/i.test(r))).toBe(true);
  });

  it("blocks when max active trades is already reached", () => {
    createFuturesPosition({
      signalId: null,
      symbol: "BTCUSDT",
      side: "long",
      mode: "testnet",
      leverage: 5,
      entryPrice: new Decimal(50000),
      qty: new Decimal(0.01),
      notionalUsd: new Decimal(500),
      marginUsd: new Decimal(100),
      stopLoss: new Decimal(49000),
      takeProfits: [],
      bybitOrderId: null,
    });
    const result = assessFuturesEntryRisk(baseInput({ config: FuturesStrategyConfigSchema.parse({ maxActiveTrades: 1 }) }));
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /open futures position/i.test(r))).toBe(true);
  });

  it("blocks once the daily loss limit has been breached", () => {
    const position = createFuturesPosition({
      signalId: null,
      symbol: "ETHUSDT",
      side: "long",
      mode: "testnet",
      leverage: 5,
      entryPrice: new Decimal(3000),
      qty: new Decimal(1),
      notionalUsd: new Decimal(3000),
      marginUsd: new Decimal(600),
      stopLoss: new Decimal(2900),
      takeProfits: [],
      bybitOrderId: null,
    });
    // Realize a big loss: exit at 2900 (down $100/unit * qty 1 = -$100), well within a
    // $1000 equity account that's an easy 10% — over the 8% default daily cap.
    applyFuturesExit(position.id, { closedQty: new Decimal(1), exitPrice: new Decimal(2900), closeReason: "stop_loss" });

    const result = assessFuturesEntryRisk(baseInput());
    expect(result.approved).toBe(false);
    expect(result.checks.find((c) => c.name === "daily_max_loss")?.passed).toBe(false);
  });

  it("blocks after the consecutive-loss halt threshold and clears on emergency-stop resume", () => {
    recordFuturesTradeOutcome(true);
    recordFuturesTradeOutcome(true);
    recordFuturesTradeOutcome(true); // 3 consecutive losses = default stopAfterConsecutiveLosses
    const result = assessFuturesEntryRisk(baseInput());
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /consecutive loss/i.test(r))).toBe(true);
  });

  it("blocks all entries while the futures emergency stop is active", () => {
    triggerFuturesEmergencyStop("test", "testing");
    expect(assessFuturesEntryRisk(baseInput()).approved).toBe(false);
    resumeFuturesFromEmergencyStop("test");
    expect(assessFuturesEntryRisk(baseInput()).approved).toBe(true);
  });
});

describe("computeFuturesPositionSize", () => {
  it("sizes qty so the loss at stop-loss equals riskPerTradePct of equity", () => {
    const result = computeFuturesPositionSize({
      equityUsd: new Decimal(1000),
      entryPrice: new Decimal(100),
      stopLoss: new Decimal(98), // $2 stop distance
      riskPerTradePct: 2, // risk $20
      leverage: 5,
      sizeMultiplier: 1,
      qtyStep: 0.01,
    });
    // qty * $2 stop distance should equal ~$20 risk
    expect(result.qty.times(2).toNumber()).toBeCloseTo(20, 0);
    expect(result.marginUsd.toNumber()).toBeCloseTo(result.notionalUsd.div(5).toNumber(), 5);
  });

  it("halves the size when sizeMultiplier is 0.5 (Fear & Greed reduction)", () => {
    const full = computeFuturesPositionSize({
      equityUsd: new Decimal(1000),
      entryPrice: new Decimal(100),
      stopLoss: new Decimal(98),
      riskPerTradePct: 2,
      leverage: 5,
      sizeMultiplier: 1,
      qtyStep: 0.001,
    });
    const halved = computeFuturesPositionSize({
      equityUsd: new Decimal(1000),
      entryPrice: new Decimal(100),
      stopLoss: new Decimal(98),
      riskPerTradePct: 2,
      leverage: 5,
      sizeMultiplier: 0.5,
      qtyStep: 0.001,
    });
    expect(halved.qty.toNumber()).toBeCloseTo(full.qty.toNumber() / 2, 3);
  });

  it("returns zero size when stop-loss equals entry price (no risk distance)", () => {
    const result = computeFuturesPositionSize({
      equityUsd: new Decimal(1000),
      entryPrice: new Decimal(100),
      stopLoss: new Decimal(100),
      riskPerTradePct: 2,
      leverage: 5,
      sizeMultiplier: 1,
      qtyStep: 0.001,
    });
    expect(result.qty.toNumber()).toBe(0);
  });
});
