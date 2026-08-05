import { describe, expect, it } from "vitest";
import { Decimal } from "../src/lib/decimal.js";
import { computeTrailingStopUpdate, evaluateFuturesExit } from "../src/futures/tradeManager.js";
import { FuturesStrategyConfigSchema } from "../src/futures/schema.js";
import type { FuturesPosition } from "../src/futures/repository.js";

function basePosition(overrides: Partial<FuturesPosition> = {}): FuturesPosition {
  return {
    id: "pos-1",
    signalId: "sig-1",
    symbol: "BTCUSDT",
    side: "long",
    mode: "testnet",
    status: "open",
    leverage: 20,
    confidence: "medium",
    entryPrice: new Decimal(100),
    qty: new Decimal(10),
    remainingQty: new Decimal(10),
    notionalUsd: new Decimal(20000),
    marginUsd: new Decimal(1000),
    stopLoss: new Decimal(97),
    takeProfits: [
      { label: "tp1", price: 102, closePct: 40 },
      { label: "tp2", price: 104, closePct: 35 },
      { label: "tp3", price: 108, closePct: 25 },
    ],
    takeProfitsFilled: [],
    breakevenMoved: false,
    trailingActive: false,
    trailingStopPrice: null,
    bybitOrderId: "order-1",
    realizedPnlUsd: new Decimal(0),
    closeReason: null,
    openedAt: new Date().toISOString(),
    closedAt: null,
    ...overrides,
  };
}

const config = FuturesStrategyConfigSchema.parse({});

describe("evaluateFuturesExit — long", () => {
  it("triggers a full stop-loss exit when price drops to or below the stop", () => {
    const decision = evaluateFuturesExit(basePosition(), new Decimal(96.5), config);
    expect(decision?.action).toBe("stop_loss");
    expect(decision?.closeQty.toNumber()).toBe(10);
  });

  it("does nothing between stop and TP1", () => {
    expect(evaluateFuturesExit(basePosition(), new Decimal(101), config)).toBeNull();
  });

  it("closes tp1ClosePct at TP1 and requests a breakeven move", () => {
    const decision = evaluateFuturesExit(basePosition(), new Decimal(102.5), config);
    expect(decision?.action).toBe("tp1");
    expect(decision?.closeQty.toNumber()).toBeCloseTo(4, 5);
    expect(decision?.moveToBreakeven).toBe(true);
  });

  it("fires TP2 once TP1 is already filled", () => {
    const position = basePosition({ takeProfitsFilled: ["tp1"], remainingQty: new Decimal(6) });
    const decision = evaluateFuturesExit(position, new Decimal(104.5), config);
    expect(decision?.action).toBe("tp2");
    expect(decision?.closeQty.toNumber()).toBeCloseTo(3.5, 5);
  });
});

describe("evaluateFuturesExit — short (mirrored direction)", () => {
  function shortPosition(overrides: Partial<FuturesPosition> = {}) {
    return basePosition({
      side: "short",
      entryPrice: new Decimal(100),
      stopLoss: new Decimal(103),
      takeProfits: [
        { label: "tp1", price: 98, closePct: 40 },
        { label: "tp2", price: 96, closePct: 35 },
        { label: "tp3", price: 92, closePct: 25 },
      ],
      ...overrides,
    });
  }

  it("triggers stop-loss when price rises to or above the stop", () => {
    const decision = evaluateFuturesExit(shortPosition(), new Decimal(103.5), config);
    expect(decision?.action).toBe("stop_loss");
    expect(decision?.closeQty.toNumber()).toBe(10);
  });

  it("does nothing between stop and TP1", () => {
    expect(evaluateFuturesExit(shortPosition(), new Decimal(99), config)).toBeNull();
  });

  it("closes tp1ClosePct when price falls to TP1 and requests a breakeven move", () => {
    const decision = evaluateFuturesExit(shortPosition(), new Decimal(97.5), config);
    expect(decision?.action).toBe("tp1");
    expect(decision?.closeQty.toNumber()).toBeCloseTo(4, 5);
    expect(decision?.moveToBreakeven).toBe(true);
  });

  it("fires TP2 once TP1 is already filled", () => {
    const position = shortPosition({ takeProfitsFilled: ["tp1"], remainingQty: new Decimal(6) });
    const decision = evaluateFuturesExit(position, new Decimal(95.5), config);
    expect(decision?.action).toBe("tp2");
    expect(decision?.closeQty.toNumber()).toBeCloseTo(3.5, 5);
  });

  it("treats a breached trailing stop as a trailing_stop exit once trailing is active", () => {
    const position = shortPosition({
      takeProfitsFilled: ["tp1", "tp2"],
      remainingQty: new Decimal(2.5),
      trailingActive: true,
      trailingStopPrice: new Decimal(94),
    });
    const decision = evaluateFuturesExit(position, new Decimal(94.5), config);
    expect(decision?.action).toBe("trailing_stop");
    expect(decision?.closeQty.toNumber()).toBeCloseTo(2.5, 5);
  });
});

describe("computeTrailingStopUpdate", () => {
  it("is null until TP2 has filled", () => {
    const position = basePosition({ takeProfitsFilled: ["tp1"] });
    expect(computeTrailingStopUpdate(position, new Decimal(110), 2, config)).toBeNull();
  });

  it("seeds the trailing stop below price for a long, ratchets upward only", () => {
    const position = basePosition({ takeProfitsFilled: ["tp1", "tp2"], trailingStopPrice: null });
    const seeded = computeTrailingStopUpdate(position, new Decimal(110), 2, config);
    expect(seeded).not.toBeNull();
    expect(seeded!.toNumber()).toBeCloseTo(110 - 2 * config.trailingAtrMultiplier, 5);

    const better = computeTrailingStopUpdate({ ...position, trailingStopPrice: seeded }, new Decimal(120), 2, config);
    expect(better!.toNumber()).toBeGreaterThan(seeded!.toNumber());

    const worse = computeTrailingStopUpdate({ ...position, trailingStopPrice: seeded }, new Decimal(109), 2, config);
    expect(worse).toBeNull();
  });

  it("seeds the trailing stop above price for a short, ratchets downward only", () => {
    const position = basePosition({ side: "short", takeProfitsFilled: ["tp1", "tp2"], trailingStopPrice: null });
    const seeded = computeTrailingStopUpdate(position, new Decimal(90), 2, config);
    expect(seeded).not.toBeNull();
    expect(seeded!.toNumber()).toBeCloseTo(90 + 2 * config.trailingAtrMultiplier, 5);

    const better = computeTrailingStopUpdate({ ...position, trailingStopPrice: seeded }, new Decimal(80), 2, config);
    expect(better!.toNumber()).toBeLessThan(seeded!.toNumber());

    const worse = computeTrailingStopUpdate({ ...position, trailingStopPrice: seeded }, new Decimal(91), 2, config);
    expect(worse).toBeNull();
  });
});
