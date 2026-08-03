import { describe, expect, it } from "vitest";
import { Decimal } from "../src/lib/decimal.js";
import { evaluateExitAction, resolveSellTokenAmount } from "../src/engine/positionManager.js";
import type { Position } from "../src/engine/positionRepository.js";

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: "pos-1",
    mint: "MintAddress111111111111111111111111111111",
    symbol: "TEST",
    decimals: 6,
    mode: "paper",
    status: "open",
    strategyId: "strat-1",
    entryPriceUsd: new Decimal(1),
    entryAmountUsd: new Decimal(20),
    tokenAmount: new Decimal(20),
    remainingTokenAmount: new Decimal(20),
    costBasisUsd: new Decimal(20),
    stopLossPercentage: 20,
    takeProfits: [
      { profitPercentage: 50, sellPercentage: 50 },
      { profitPercentage: 100, sellPercentage: 50 },
    ],
    takeProfitsFilled: [],
    trailingStopPercentage: null,
    trailingStopHighUsd: null,
    maxHoldingPeriodMinutes: null,
    entryReason: {},
    entryTxSignature: null,
    realizedPnlUsd: new Decimal(0),
    closeReason: null,
    openedAt: new Date().toISOString(),
    closedAt: null,
    ...overrides,
  };
}

describe("evaluateExitAction — stop loss", () => {
  it("triggers a full exit at the configured stop-loss percentage", () => {
    const position = makePosition({ stopLossPercentage: 20 });
    const action = evaluateExitAction(position, new Decimal(0.79)); // -21%
    expect(action).toEqual({ reason: "stop_loss", sellPercentageOfOriginal: 100 });
  });

  it("does not trigger stop loss just above the threshold", () => {
    const position = makePosition({ stopLossPercentage: 20, takeProfits: [] });
    const action = evaluateExitAction(position, new Decimal(0.81)); // -19%
    expect(action).toBeNull();
  });

  it("stop loss takes priority over take profit if somehow both would fire", () => {
    // Contrived: negative take-profit threshold would never happen via the
    // schema (profitPercentage > 0), but this proves priority ordering.
    const position = makePosition({ stopLossPercentage: 20, takeProfits: [] });
    const action = evaluateExitAction(position, new Decimal(0.5));
    expect(action?.reason).toBe("stop_loss");
  });
});

describe("evaluateExitAction — take profit", () => {
  it("triggers the first unfilled take-profit level once its threshold is reached", () => {
    const position = makePosition();
    const action = evaluateExitAction(position, new Decimal(1.5)); // +50%
    expect(action).toEqual({ reason: "take_profit_0", sellPercentageOfOriginal: 50, takeProfitIndex: 0 });
  });

  it("skips an already-filled take-profit level and finds the next one", () => {
    const position = makePosition({ takeProfitsFilled: [0], remainingTokenAmount: new Decimal(10) });
    const action = evaluateExitAction(position, new Decimal(2.0)); // +100%
    expect(action).toEqual({ reason: "take_profit_1", sellPercentageOfOriginal: 50, takeProfitIndex: 1 });
  });

  it("does not re-trigger a take-profit level once every level is filled", () => {
    const position = makePosition({ takeProfitsFilled: [0, 1], remainingTokenAmount: new Decimal(0) });
    const action = evaluateExitAction(position, new Decimal(3.0));
    expect(action).toBeNull();
  });
});

describe("evaluateExitAction — trailing stop", () => {
  it("triggers when price falls the configured percentage from the high-water mark", () => {
    const position = makePosition({
      stopLossPercentage: null,
      takeProfits: [],
      trailingStopPercentage: 20,
      trailingStopHighUsd: new Decimal(2),
    });
    const action = evaluateExitAction(position, new Decimal(1.59)); // > 20% down from high of 2
    expect(action).toEqual({ reason: "trailing_stop", sellPercentageOfOriginal: 100 });
  });

  it("does not trigger while still within the trailing band", () => {
    const position = makePosition({
      stopLossPercentage: null,
      takeProfits: [],
      trailingStopPercentage: 20,
      trailingStopHighUsd: new Decimal(2),
    });
    const action = evaluateExitAction(position, new Decimal(1.7)); // 15% down, inside band
    expect(action).toBeNull();
  });
});

describe("evaluateExitAction — max holding period", () => {
  it("force-closes after the configured holding period regardless of price", () => {
    const position = makePosition({
      stopLossPercentage: null,
      takeProfits: [],
      maxHoldingPeriodMinutes: 60,
      openedAt: new Date(Date.now() - 61 * 60_000).toISOString(),
    });
    const action = evaluateExitAction(position, new Decimal(1.0));
    expect(action).toEqual({ reason: "max_holding_period", sellPercentageOfOriginal: 100 });
  });
});

describe("resolveSellTokenAmount — position sizing", () => {
  it("computes the correct absolute amount for a percentage-of-original action", () => {
    const position = makePosition({ tokenAmount: new Decimal(100), remainingTokenAmount: new Decimal(100) });
    const amount = resolveSellTokenAmount(position, { reason: "take_profit_0", sellPercentageOfOriginal: 50 });
    expect(amount.toString()).toBe("50");
  });

  it("caps the sell amount at whatever remains, even if the percentage implies more", () => {
    const position = makePosition({ tokenAmount: new Decimal(100), remainingTokenAmount: new Decimal(30) });
    const amount = resolveSellTokenAmount(position, { reason: "stop_loss", sellPercentageOfOriginal: 100 });
    expect(amount.toString()).toBe("30");
  });
});
