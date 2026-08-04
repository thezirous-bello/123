import { beforeEach, describe, expect, it } from "vitest";
import { ensureTestStrategy, resetDb } from "./testUtils.js";
import { Decimal } from "../src/lib/decimal.js";
import { assessEntryRisk } from "../src/engine/riskEngine.js";
import { saveRiskLimits, RiskLimitsSchema } from "../src/lib/settings.js";
import { triggerEmergencyStop, resumeFromEmergencyStop } from "../src/engine/emergency.js";
import { applyExit, createPosition } from "../src/engine/positionRepository.js";

function baseInput(overrides: Partial<Parameters<typeof assessEntryRisk>[0]> = {}) {
  return {
    mode: "paper" as const,
    strategyId: "strat-1",
    tradeUsd: new Decimal(10),
    accountEquityUsd: new Decimal(1000),
    slippagePercentage: 2,
    priceImpactPercentage: 1,
    tokenRiskLevel: "low" as const,
    sellSimulationOk: true,
    requireSellSimulation: true,
    quoteAgeSeconds: 1,
    strategyDailyTradeLimit: 20,
    ...overrides,
  };
}

beforeEach(() => {
  resetDb();
  ensureTestStrategy("strat-1");
  saveRiskLimits(
    RiskLimitsSchema.parse({
      maxTradeUsd: 10,
      maxWalletPercentagePerTrade: 5,
      maxOpenPositions: 3,
      maxTradesPerHour: 10,
      maxTradesPerDay: 20,
      maxDailyLossPercentage: 5,
      maxSlippagePercentage: 3,
      maxPriceImpactPercentage: 2,
      minimumLiquidityUsd: 20_000,
      minimumSolReserve: 0.03,
      maxTokenRiskLevel: "high",
      cooldownMinutesAfterLoss: 15,
      consecutiveLossesBeforeCooldown: 3,
      consecutiveLossCooldownMinutes: 60,
      maxQuoteAgeSeconds: 20,
    }),
  );
});

describe("assessEntryRisk", () => {
  it("approves a compliant trade against a clean account", () => {
    const result = assessEntryRisk(baseInput());
    expect(result.approved).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it("blocks a trade that exceeds the global maximum trade size", () => {
    const result = assessEntryRisk(baseInput({ tradeUsd: new Decimal(50) }));
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /max/i.test(r))).toBe(true);
  });

  it("blocks when the account is at the maximum open positions", () => {
    for (let i = 0; i < 3; i++) {
      createPosition({
        mint: `Mint${i}111111111111111111111111111111111`,
        symbol: "T",
        decimals: 6,
        mode: "paper",
        strategyId: "strat-1",
        entryPriceUsd: new Decimal(1),
        entryAmountUsd: new Decimal(10),
        tokenAmount: new Decimal(10),
        costBasisUsd: new Decimal(10),
        stopLossPercentage: 20,
        takeProfits: [],
        trailingStopPercentage: null,
        maxHoldingPeriodMinutes: null,
        entryReason: {},
        entryTxSignature: null,
      });
    }
    const result = assessEntryRisk(baseInput());
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /open position/i.test(r))).toBe(true);
  });

  it("blocks new entries once the daily loss limit is breached", () => {
    const position = createPosition({
      mint: "MintLoss1111111111111111111111111111111111",
      symbol: "L",
      decimals: 6,
      mode: "paper",
      strategyId: "strat-1",
      entryPriceUsd: new Decimal(1),
      entryAmountUsd: new Decimal(100),
      tokenAmount: new Decimal(100),
      costBasisUsd: new Decimal(100),
      stopLossPercentage: 20,
      takeProfits: [],
      trailingStopPercentage: null,
      maxHoldingPeriodMinutes: null,
      entryReason: {},
      entryTxSignature: null,
    });
    // Realize an $80 loss against a $1000 account (8% > 5% daily loss limit).
    applyExit(position.id, { soldTokenAmount: new Decimal(100), proceedsUsd: new Decimal(20), closeReason: "stop_loss" });

    const result = assessEntryRisk(baseInput());
    expect(result.approved).toBe(false);
    const dailyLossCheck = result.checks.find((c) => c.name === "max_daily_loss");
    expect(dailyLossCheck?.passed).toBe(false);
  });

  it("blocks all new entries while the emergency stop is active", () => {
    triggerEmergencyStop("test", "unit test");
    const result = assessEntryRisk(baseInput());
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /emergency/i.test(r))).toBe(true);
    resumeFromEmergencyStop("test");
  });

  it("blocks live trades when LIVE_TRADING_ENABLED is not true", () => {
    const result = assessEntryRisk(baseInput({ mode: "live", solBalanceAfterTradeSol: new Decimal(1) }));
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /LIVE_TRADING_ENABLED/i.test(r))).toBe(true);
  });

  it("always blocks critical token risk regardless of the configured maximum", () => {
    saveRiskLimits(RiskLimitsSchema.parse({ maxTokenRiskLevel: "high" }));
    const result = assessEntryRisk(baseInput({ tokenRiskLevel: "critical" }));
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /critical/i.test(r))).toBe(true);
  });

  it("blocks when sell simulation is required but failed", () => {
    const result = assessEntryRisk(baseInput({ sellSimulationOk: false }));
    expect(result.approved).toBe(false);
  });

  it("blocks when the strategy has already hit its own daily trade limit", () => {
    const result = assessEntryRisk(baseInput({ strategyDailyTradeLimit: 0 }));
    expect(result.approved).toBe(false);
    expect(result.blockingReasons.some((r) => /strategy/i.test(r))).toBe(true);
  });
});
