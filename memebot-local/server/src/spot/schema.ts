import { z } from "zod";

// This mirrors the user's original "HIGH-RISK FUTURES SIGNAL STRATEGY"
// spec, now repurposed as the Bybit SPOT bot (their later instruction:
// "the first one let it for spot trade"), as editable/tunable parameters
// rather than a hardcoded constant. Adapted for spot: no leverage/margin
// (every position is a plain cash buy), and no funding-rate/open-interest
// checks (those only exist for perpetual futures contracts). Two checks
// from the original spec (economic-event calendar, market-wide news
// sentiment) have no honest free data source; per the user's explicit
// choice they are approximated by real BTC volatility detection (see
// ../ta/btcRisk.ts) instead of being silently skipped or faked.
// Kept separate from SpotStrategyConfigSchema (below) specifically so
// the config PATCH route can call `.partial()` on it — Zod does not allow
// `.partial()` on a schema that already carries `.superRefine()` checks,
// same reason strategy/schema.ts splits StrategyRulesObjectSchema out.
export const SpotStrategyConfigObjectSchema = z
  .object({
    enabled: z.boolean().default(false),

    // Symbol universe
    symbolUniverse: z.enum(["auto", "all", "manual"]).default("all"),
    autoTopNByVolume: z.number().int().gt(0).max(1000).default(30),
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
    entryPriceMaxDriftPct: z.number().gt(0).default(0.4),
    signalExpiryMinutes: z.number().gt(0).default(15),

    // Trade management (no leverage — spot is always fully cash-funded)
    riskPerTradePct: z.number().gt(0).max(10).default(2.5),
    tp1ClosePct: z.number().gt(0).max(100).default(40),
    tp2ClosePct: z.number().gt(0).max(100).default(35),
    moveSlToBreakevenAtTp1: z.boolean().default(true),
    trailingAtrMultiplier: z.number().gt(0).default(1.2),
    stopAfterConsecutiveLosses: z.number().int().gt(0).default(3),
    dailyMaxLossPct: z.number().gt(0).max(100).default(8),
  })
  .strict();

export const SpotStrategyConfigSchema = SpotStrategyConfigObjectSchema.superRefine((cfg, ctx) => {
    if (cfg.tp1ClosePct + cfg.tp2ClosePct > 100) {
      ctx.addIssue({ code: "custom", path: ["tp2ClosePct"], message: "tp1ClosePct + tp2ClosePct cannot exceed 100%." });
    }
    if (cfg.symbolUniverse === "manual" && cfg.manualSymbols.length === 0) {
      ctx.addIssue({ code: "custom", path: ["manualSymbols"], message: "manualSymbols cannot be empty when symbolUniverse is \"manual\"." });
    }
  });

export type SpotStrategyConfig = z.infer<typeof SpotStrategyConfigSchema>;

export const TakeProfitTargetSchema = z.object({
  label: z.enum(["tp1", "tp2", "tp3"]),
  price: z.number().gt(0),
  closePct: z.number().gt(0).max(100),
});
export type TakeProfitTarget = z.infer<typeof TakeProfitTargetSchema>;
