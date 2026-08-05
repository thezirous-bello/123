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
    leverage: 5,
    entryPrice: new Decimal(100),
    qty: new Decimal(10),
    remainingQty: new Decimal(10),
    notionalUsd: new Decimal(1000),
    marginUsd: new Decimal(200),
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

describe("evaluateFuturesExit", () => {
  it("triggers a full stop-loss exit when price drops to or below the stop", () => {
    const position = basePosition();
    const decision = evaluateFuturesExit(position, new Decimal(96.5), config);
    expect(decision?.action).toBe("stop_loss");
    expect(decision?.closeQty.toNumber()).toBe(10);
  });

  it("does nothing between stop and TP1", () => {
    const position = basePosition();
    const decision = evaluateFuturesExit(position, new Decimal(101), config);
    expect(decision).toBeNull();
  });

  it("closes tp1ClosePct at TP1 and requests a breakeven move", () => {
    const position = basePosition();
    const decision = evaluateFuturesExit(position, new Decimal(102.5), config);
    expect(decision?.action).toBe("tp1");
    expect(decision?.closeQty.toNumber()).toBeCloseTo(4, 5); // 40% of qty 10
    expect(decision?.moveToBreakeven).toBe(true);
  });

  it("does not re-trigger TP1 once already filled, and fires TP2 instead", () => {
    const position = basePosition({ takeProfitsFilled: ["tp1"], remainingQty: new Decimal(6) });
    const decision = evaluateFuturesExit(position, new Decimal(104.5), config);
    expect(decision?.action).toBe("tp2");
    expect(decision?.closeQty.toNumber()).toBeCloseTo(3.5, 5); // 35% of original qty 10
  });

  it("treats a breached trailing stop as a trailing_stop exit once trailing is active", () => {
    const position = basePosition({
      takeProfitsFilled: ["tp1", "tp2"],
      remainingQty: new Decimal(2.5),
      trailingActive: true,
      trailingStopPrice: new Decimal(105),
    });
    const decision = evaluateFuturesExit(position, new Decimal(104.9), config);
    expect(decision?.action).toBe("trailing_stop");
    expect(decision?.closeQty.toNumber()).toBeCloseTo(2.5, 5);
  });

  it("mirrors the same logic for a short position (inverted direction)", () => {
    const position = basePosition({
      side: "short",
      entryPrice: new Decimal(100),
      stopLoss: new Decimal(103),
      takeProfits: [{ label: "tp1", price: 98, closePct: 40 }],
    });
    expect(evaluateFuturesExit(position, new Decimal(103.5), config)?.action).toBe("stop_loss");
    expect(evaluateFuturesExit(position, new Decimal(97.5), config)?.action).toBe("tp1");
  });
});

describe("computeTrailingStopUpdate", () => {
  it("is null until TP2 has filled", () => {
    const position = basePosition({ takeProfitsFilled: ["tp1"] });
    expect(computeTrailingStopUpdate(position, new Decimal(110), 2, config)).toBeNull();
  });

  it("seeds the trailing stop the first time after TP2 fills", () => {
    const position = basePosition({ takeProfitsFilled: ["tp1", "tp2"], trailingStopPrice: null });
    const result = computeTrailingStopUpdate(position, new Decimal(110), 2, config);
    expect(result).not.toBeNull();
    expect(result!.toNumber()).toBeCloseTo(110 - 2 * config.trailingAtrMultiplier, 5);
  });

  it("only ratchets upward for a long position, never loosens", () => {
    const position = basePosition({ takeProfitsFilled: ["tp1", "tp2"], trailingStopPrice: new Decimal(108) });
    const improved = computeTrailingStopUpdate(position, new Decimal(115), 2, config);
    expect(improved).not.toBeNull();
    expect(improved!.toNumber()).toBeGreaterThan(108);

    const worse = computeTrailingStopUpdate(position, new Decimal(109), 2, config);
    expect(worse).toBeNull(); // price pulled back — stop must not loosen
  });
});
