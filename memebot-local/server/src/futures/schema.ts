import { z } from "zod";

// This mirrors the exact "HIGH-RISK FUTURES SIGNAL STRATEGY" the user
// supplied, as editable/tunable parameters rather than a hardcoded
// constant — every threshold below is a direct translation of one line of
// that spec. Two checks from the original spec (economic-event calendar,
// market-wide news sentiment) have no honest free data source; per the
// user's explicit choice they are approximated by real BTC volatility
// detection (see btcRisk.ts) instead of being silently skipped or faked.
// Kept separate from FuturesStrategyConfigSchema (below) specifically so
// the config PATCH route can call `.partial()` on it — Zod does not allow
// `.partial()` on a schema that already carries `.superRefine()` checks,
// same reason strategy/schema.ts splits StrategyRulesObjectSchema out.
export const FuturesStrategyConfigObjectSchema = z
  .object({
    enabled: z.boolean().default(false),

    // Symbol universe
    symbolUniverse: z.enum(["auto", "manual"]).default("auto"),
    autoTopNByVolume: z.number().int().gt(0).max(100).default(30),
    manualSymbols: z.array(z.string()).default([]),

    // Stage 1 — signal generation
    minCompletedCandles: z.number().int().gte(20).default(100),
    atrOverCloseMax: z.number().gt(0).default(0.06),
    stddev30Max: z.number().gt(0).default(0.025),
    latestRangeAtrMultMax: z.number().gt(0).default(2.5),
    min24hTurnoverUsd: z.number().gte(0).default(5_000_000),
    volumeSpikeMultiplier: z.number().gt(0).default(1.2),
    maxSpreadPct: z.number().gt(0).default(0.2),
    entryZoneUpperMult: z.number().gt(1).default(1.02),
    entryZoneLowerMult: z.number().gt(1).default(1.008),
    trendEmaPeriod: z.number().int().gt(0).default(200),
    stochRsiKMax: z.number().gte(0).lte(100).default(45),
    stochRsiCrossoverBelow: z.number().gte(0).lte(100).default(30),
    rsiMin: z.number().gte(0).lte(100).default(28),
    rsiMax: z.number().gte(0).lte(100).default(55),
    slAtrMultiplier: z.number().gt(0).default(1.8),
    maxStopLossDistancePct: z.number().gt(0).default(3),
    tp1Pct: z.number().gt(0).default(2),
    tp2Pct: z.number().gt(0).default(4),
    tp3AtrTrailMultiplier: z.number().gt(0).default(1.2),
    minRiskReward: z.number().gt(0).default(1.5),

    // Stage 2 — signal validation
    maxPendingSignals: z.number().int().gt(0).default(3),
    maxActiveTrades: z.number().int().gt(0).default(2),
    btcVolatilityShockCheckEnabled: z.boolean().default(true),
    fearGreedRejectBelow: z.number().gte(0).lte(100).default(50),
    fearGreedReduceSizeAbove: z.number().gte(0).lte(100).default(80),
    fearGreedSizeReductionFactor: z.number().gt(0).lte(1).default(0.5),
    btcStochRsiOverboughtReject: z.number().gte(0).lte(100).default(90),
    btcOrderbookAskBidRatioMax: z.number().gt(0).default(1.4),
    btcRsiOverboughtMax: z.number().gte(0).lte(100).default(75),
    fundingRateMinPct: z.number().default(-0.05),
    fundingRateMaxPct: z.number().default(0.05),
    openInterestVs100dAvgMaxPct: z.number().gt(0).default(105),
    entryPriceMaxDriftPct: z.number().gt(0).default(0.4),
    signalExpiryMinutes: z.number().gt(0).default(15),

    // Trade management
    riskPerTradePct: z.number().gt(0).max(10).default(2.5),
    leverage: z.number().int().gte(1).max(20).default(5),
    maxLeverage: z.number().int().gte(1).max(20).default(8),
    tp1ClosePct: z.number().gt(0).max(100).default(40),
    tp2ClosePct: z.number().gt(0).max(100).default(35),
    moveSlToBreakevenAtTp1: z.boolean().default(true),
    trailingAtrMultiplier: z.number().gt(0).default(1.2),
    stopAfterConsecutiveLosses: z.number().int().gt(0).default(3),
    dailyMaxLossPct: z.number().gt(0).max(100).default(8),
  })
  .strict();

export const FuturesStrategyConfigSchema = FuturesStrategyConfigObjectSchema.superRefine((cfg, ctx) => {
    if (cfg.tp1ClosePct + cfg.tp2ClosePct > 100) {
      ctx.addIssue({ code: "custom", path: ["tp2ClosePct"], message: "tp1ClosePct + tp2ClosePct cannot exceed 100%." });
    }
    if (cfg.leverage > cfg.maxLeverage) {
      ctx.addIssue({ code: "custom", path: ["leverage"], message: "leverage cannot exceed maxLeverage." });
    }
    if (cfg.symbolUniverse === "manual" && cfg.manualSymbols.length === 0) {
      ctx.addIssue({ code: "custom", path: ["manualSymbols"], message: "manualSymbols cannot be empty when symbolUniverse is \"manual\"." });
    }
  });

export type FuturesStrategyConfig = z.infer<typeof FuturesStrategyConfigSchema>;

export const TakeProfitTargetSchema = z.object({
  label: z.enum(["tp1", "tp2", "tp3"]),
  price: z.number().gt(0),
  closePct: z.number().gt(0).max(100),
});
export type TakeProfitTarget = z.infer<typeof TakeProfitTargetSchema>;
