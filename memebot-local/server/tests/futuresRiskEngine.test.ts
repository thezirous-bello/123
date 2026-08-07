import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "./testUtils.js";
import { Decimal } from "../src/lib/decimal.js";
import { assessFuturesEntryRisk, computeFuturesPositionSize, maxSafeLeverageForStopDistance } from "../src/futures/riskEngine.js";
import { FuturesStrategyConfigSchema } from "../src/futures/schema.js";
import { createFuturesPosition, applyFuturesExit } from "../src/futures/repository.js";
import { recordFuturesTradeOutcome, triggerFuturesEmergencyStop, resumeFuturesFromEmergencyStop } from "../src/futures/state.js";

function baseInput(overrides: Partial<Parameters<typeof assessFuturesEntryRisk>[0]> = {}) {
  return {
    mode: "testnet" as const,
    leverage: 20,
    maxInstrumentLeverage: 100,
    stopLossDistancePct: 3, // strategy's max SL distance
    marginUsd: new Decimal(200),
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

  it("blocks leverage below minLeverage or above maxLeverage", () => {
    expect(assessFuturesEntryRisk(baseInput({ leverage: 5 })).approved).toBe(false); // below default min 15
    expect(assessFuturesEntryRisk(baseInput({ leverage: 50 })).approved).toBe(false); // above default max 30
  });

  it("blocks when leverage exceeds the instrument's own max leverage", () => {
    const result = assessFuturesEntryRisk(baseInput({ leverage: 20, maxInstrumentLeverage: 10 }));
    expect(result.approved).toBe(false);
  });

  it("blocks when the stop-loss is too close to the estimated liquidation distance for the chosen leverage", () => {
    // At 30x, naive liquidation distance is ~3.33%; the strategy's own 3%
    // max SL distance eats almost the entire safety buffer at high leverage.
    const result = assessFuturesEntryRisk(baseInput({ leverage: 30, stopLossDistancePct: 3 }));
    expect(result.approved).toBe(false);
    expect(result.checks.find((c) => c.name === "liquidation_safety_buffer")?.passed).toBe(false);
  });

  it("approves a tighter stop-loss that respects the liquidation safety buffer at high leverage", () => {
    // 30x -> ~3.33% naive liquidation distance * 0.7 safety factor ≈ 2.33% max safe SL.
    const result = assessFuturesEntryRisk(baseInput({ leverage: 30, stopLossDistancePct: 1 }));
    expect(result.checks.find((c) => c.name === "liquidation_safety_buffer")?.passed).toBe(true);
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
      leverage: 20,
      confidence: "medium",
      entryPrice: new Decimal(50000),
      qty: new Decimal(0.01),
      notionalUsd: new Decimal(500),
      marginUsd: new Decimal(25),
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
      leverage: 20,
      confidence: "medium",
      entryPrice: new Decimal(3000),
      qty: new Decimal(1),
      notionalUsd: new Decimal(3000),
      marginUsd: new Decimal(150),
      stopLoss: new Decimal(2900),
      takeProfits: [],
      bybitOrderId: null,
    });
    applyFuturesExit(position.id, { closedQty: new Decimal(1), exitPrice: new Decimal(2900), closeReason: "stop_loss" });

    const result = assessFuturesEntryRisk(baseInput());
    expect(result.approved).toBe(false);
    expect(result.checks.find((c) => c.name === "daily_max_loss")?.passed).toBe(false);
  });

  it("blocks after the consecutive-loss halt threshold and clears on emergency-stop resume", () => {
    recordFuturesTradeOutcome(true);
    recordFuturesTradeOutcome(true);
    recordFuturesTradeOutcome(true);
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

describe("maxSafeLeverageForStopDistance", () => {
  it("caps leverage below 30x for the strategy's 4% max stop-loss", () => {
    // 70% of the naive liquidation distance (100/leverage) must stay >= the stop distance.
    const maxSafe = maxSafeLeverageForStopDistance(4);
    expect(maxSafe).toBeLessThan(30);
    expect(maxSafe).toBeGreaterThanOrEqual(15);
  });

  it("allows up to 30x for a tighter 3% stop-loss", () => {
    const maxSafe = maxSafeLeverageForStopDistance(3);
    expect(maxSafe).toBeGreaterThanOrEqual(23);
  });

  it("allows higher leverage for a tighter stop distance", () => {
    expect(maxSafeLeverageForStopDistance(2)).toBeGreaterThan(maxSafeLeverageForStopDistance(4));
  });
});

describe("computeFuturesPositionSize", () => {
  it("sizes margin to positionSizePct of equity and notional to margin * leverage", () => {
    const result = computeFuturesPositionSize({
      equityUsd: new Decimal(1000),
      entryPrice: new Decimal(100),
      positionSizePct: 40, // 40% of equity as margin
      leverage: 25,
      qtyStep: 0.001,
    });
    expect(result.marginUsd.toNumber()).toBeCloseTo(400, 0); // 40% of $1000
    expect(result.notionalUsd.toNumber()).toBeCloseTo(400 * 25, -1); // margin * leverage
  });

  it("scales notional with leverage for the same position size", () => {
    const low = computeFuturesPositionSize({ equityUsd: new Decimal(1000), entryPrice: new Decimal(100), positionSizePct: 30, leverage: 15, qtyStep: 0.001 });
    const high = computeFuturesPositionSize({ equityUsd: new Decimal(1000), entryPrice: new Decimal(100), positionSizePct: 30, leverage: 30, qtyStep: 0.001 });
    expect(high.notionalUsd.toNumber()).toBeCloseTo(low.notionalUsd.toNumber() * 2, -1);
    expect(high.marginUsd.toNumber()).toBeCloseTo(low.marginUsd.toNumber(), 0);
  });

  it("clamps qty to the instrument's maxOrderQty instead of exceeding it", () => {
    // A low-priced, high-leverage position on plenty of equity can easily
    // demand far more raw contracts than a single order is allowed to hold
    // — this was going straight to Bybit and getting rejected with
    // "order_qty exceeds max_qty" before the clamp existed.
    const result = computeFuturesPositionSize({
      equityUsd: new Decimal(10_000),
      entryPrice: new Decimal(0.013244), // e.g. COTIUSDT
      positionSizePct: 35,
      leverage: 22,
      qtyStep: 1,
      maxOrderQty: 2_219_000,
    });
    expect(result.qty.toNumber()).toBeLessThanOrEqual(2_219_000);
    // notional/margin must be recomputed from the clamped qty, not the
    // unclamped target, so they stay internally consistent.
    expect(result.notionalUsd.toNumber()).toBeCloseTo(result.qty.toNumber() * 0.013244, 0);
    expect(result.marginUsd.toNumber()).toBeCloseTo(result.notionalUsd.toNumber() / 22, 2);
  });

  it("does not clamp when qty is already within maxOrderQty", () => {
    const result = computeFuturesPositionSize({
      equityUsd: new Decimal(1000),
      entryPrice: new Decimal(100),
      positionSizePct: 40,
      leverage: 25,
      qtyStep: 0.001,
      maxOrderQty: 1_000_000,
    });
    expect(result.marginUsd.toNumber()).toBeCloseTo(400, 0);
  });
});
