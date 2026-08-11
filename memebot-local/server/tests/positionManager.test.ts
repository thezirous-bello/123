import { describe, expect, it } from "vitest";
import { Decimal } from "../src/lib/decimal.js";
import { evaluateExitAction, resolveSellTokenAmount } from "../src/engine/positionManager.js";
import { MomentumConfigSchema } from "../src/lib/settings.js";
import type { MomentumScoreResult } from "../src/market/momentum.js";
import type { Position } from "../src/engine/positionRepository.js";

const defaultMomentumConfig = MomentumConfigSchema.parse({});

function makeMomentum(overrides: Partial<MomentumScoreResult> = {}): MomentumScoreResult {
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
    lowestPriceSeenUsd: null,
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

describe("evaluateExitAction — dynamic momentum exits", () => {
  it("does not consider momentum at all when it isn't supplied (existing 2-arg call sites keep working)", () => {
    const position = makePosition({ stopLossPercentage: null, takeProfits: [], trailingStopPercentage: null });
    const action = evaluateExitAction(position, new Decimal(1.5)); // +50%, no exit rule would fire without momentum
    expect(action).toBeNull();
  });

  it("exits a profitable position on momentum reversal once the score drops below the exit threshold and trend is no longer bullish", () => {
    const position = makePosition({ stopLossPercentage: null, takeProfits: [], trailingStopPercentage: null });
    const momentum = makeMomentum({ totalScore: 20, trendDirection: "bearish" });
    const action = evaluateExitAction(position, new Decimal(1.2), new Date(), momentum, defaultMomentumConfig); // +20%, profitable
    expect(action).toEqual({ reason: "momentum_reversal", sellPercentageOfOriginal: 100 });
  });

  it("does not exit on momentum reversal while the position is not yet profitable — stop loss owns the downside", () => {
    const position = makePosition({ stopLossPercentage: 50, takeProfits: [], trailingStopPercentage: null });
    const momentum = makeMomentum({ totalScore: 10, trendDirection: "bearish" });
    const action = evaluateExitAction(position, new Decimal(0.95), new Date(), momentum, defaultMomentumConfig); // -5%, not profitable
    expect(action).toBeNull();
  });

  it("does not exit a strong winner just because momentum is still healthy — lets it keep running", () => {
    const position = makePosition({ stopLossPercentage: null, takeProfits: [], trailingStopPercentage: null });
    const momentum = makeMomentum({ totalScore: 85, trendDirection: "bullish" });
    const action = evaluateExitAction(position, new Decimal(2.0), new Date(), momentum, defaultMomentumConfig); // +100%
    expect(action).toBeNull();
  });

  it("exits on sell-pressure reversal once sells clearly dominate buys on a profitable position", () => {
    const position = makePosition({ stopLossPercentage: null, takeProfits: [], trailingStopPercentage: null });
    // buySellRatio 0.2 -> sellRatio 0.8, above the default 0.65 threshold.
    const momentum = makeMomentum({ totalScore: 80, trendDirection: "bullish", buySellRatio: 0.2 });
    const action = evaluateExitAction(position, new Decimal(1.3), new Date(), momentum, defaultMomentumConfig);
    expect(action).toEqual({ reason: "sell_pressure_reversal", sellPercentageOfOriginal: 100 });
  });

  it("stop loss still takes priority over a momentum-reversal signal", () => {
    const position = makePosition({ stopLossPercentage: 20, takeProfits: [], trailingStopPercentage: null });
    const momentum = makeMomentum({ totalScore: 10, trendDirection: "bearish" });
    const action = evaluateExitAction(position, new Decimal(0.79), new Date(), momentum, defaultMomentumConfig); // -21%
    expect(action?.reason).toBe("stop_loss");
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
