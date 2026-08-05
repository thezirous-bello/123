import { z } from "zod";

// This mirrors the user's "HIGH-RISK FUTURES SIGNAL STRATEGY (LONG & SHORT)"
// spec — the more aggressive, dual-direction, dynamically-leveraged
// strategy that supersedes their original (now the Bybit SPOT bot). Every
// threshold below is a direct translation of one line of that spec.
// Funding rate and open interest ARE real, applicable checks here (unlike
// spot) since this trades perpetual futures. The two checks with no honest
// free data source (economic-event calendar, "positive vs negative news
// count") are approximated: the calendar/high-impact-news check reuses the
// same real BTC-volatility-shock detection as the spot bot; the
// positive-vs-negative bias is approximated with BTC's own recent momentum
// direction, per the same precedent the user already accepted for spot.
export const FuturesStrategyConfigObjectSchema = z
  .object({
    enabled: z.boolean().default(false),

    // Symbol universe
    symbolUniverse: z.enum(["auto", "all", "manual"]).default("all"),
    autoTopNByVolume: z.number().int().gt(0).max(1000).default(30),
    manualSymbols: z.array(z.string()).default([]),

    // Stage 1 — shared skip conditions
    minCompletedCandles: z.number().int().gte(20).default(100),
    atrOverCloseMax: z.number().gt(0).default(0.08),
    maxSpreadPct: z.number().gt(0).default(0.25),
    min24hTurnoverUsd: z.number().gte(0).default(5_000_000),

    // Long/short setup — shared shape, mirrored either side of price
    entryZoneNearPct: z.number().gt(0).default(0.8), // near edge of the zone (0.8%)
    entryZoneFarPct: z.number().gt(0).default(2), // far edge of the zone (2%)
    trendEmaPeriod: z.number().int().gt(0).default(200),
    stochRsiLongKMax: z.number().gte(0).lte(100).default(45),
    stochRsiShortKMin: z.number().gte(0).lte(100).default(55),
    rsiLongMin: z.number().gte(0).lte(100).default(28),
    rsiLongMax: z.number().gte(0).lte(100).default(55),
    rsiShortMin: z.number().gte(0).lte(100).default(45),
    rsiShortMax: z.number().gte(0).lte(100).default(72),

    // Trade setup
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

    // Fear & Greed direction bias (not a hard universe filter — only
    // applies to whichever direction a candidate already is)
    fearGreedLongPreferAbove: z.number().gte(0).lte(100).default(50),
    fearGreedLongStrongAbove: z.number().gte(0).lte(100).default(65),
    fearGreedShortPreferBelow: z.number().gte(0).lte(100).default(50),
    fearGreedShortStrongBelow: z.number().gte(0).lte(100).default(35),

    btcStochRsiOverboughtReject: z.number().gte(0).lte(100).default(90),
    btcRsiOverboughtMax: z.number().gte(0).lte(100).default(75),
    fundingLongMaxPct: z.number().default(0.05),
    fundingShortMinPct: z.number().default(-0.05),
    openInterestVs100dAvgMaxPct: z.number().gt(0).default(105),
    entryPriceMaxDriftPct: z.number().gt(0).default(0.4),
    signalExpiryMinutes: z.number().gt(0).default(15),

    // Confidence scoring → dynamic leverage / position size tiers
    confidenceHighScoreMin: z.number().gte(0).default(75),
    confidenceMediumScoreMin: z.number().gte(0).default(55),

    // Risk management — intentionally HIGH RISK, per the strategy's own
    // stated goal. minLeverage/maxLeverage are the hard absolute bounds;
    // nothing (including the confidence tiers below) may exceed them.
    minLeverage: z.number().int().gte(1).max(100).default(15),
    maxLeverage: z.number().int().gte(1).max(100).default(30),
    leverageHighConfidence: z.number().int().gte(1).max(100).default(28),
    leverageMediumConfidence: z.number().int().gte(1).max(100).default(22),
    leverageLowConfidence: z.number().int().gte(1).max(100).default(17),

    minPositionSizePct: z.number().gt(0).max(100).default(20),
    maxPositionSizePct: z.number().gt(0).max(100).default(50),
    positionSizeHighConfidencePct: z.number().gt(0).max(100).default(45),
    positionSizeMediumConfidencePct: z.number().gt(0).max(100).default(35),
    positionSizeLowConfidencePct: z.number().gt(0).max(100).default(25),

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
  if (cfg.minLeverage > cfg.maxLeverage) {
    ctx.addIssue({ code: "custom", path: ["minLeverage"], message: "minLeverage cannot exceed maxLeverage." });
  }
  for (const [key, value] of Object.entries({
    leverageHighConfidence: cfg.leverageHighConfidence,
    leverageMediumConfidence: cfg.leverageMediumConfidence,
    leverageLowConfidence: cfg.leverageLowConfidence,
  })) {
    if (value < cfg.minLeverage || value > cfg.maxLeverage) {
      ctx.addIssue({ code: "custom", path: [key], message: `${key} must be within [minLeverage, maxLeverage] = [${cfg.minLeverage}, ${cfg.maxLeverage}].` });
    }
  }
  if (cfg.minPositionSizePct > cfg.maxPositionSizePct) {
    ctx.addIssue({ code: "custom", path: ["minPositionSizePct"], message: "minPositionSizePct cannot exceed maxPositionSizePct." });
  }
  for (const [key, value] of Object.entries({
    positionSizeHighConfidencePct: cfg.positionSizeHighConfidencePct,
    positionSizeMediumConfidencePct: cfg.positionSizeMediumConfidencePct,
    positionSizeLowConfidencePct: cfg.positionSizeLowConfidencePct,
  })) {
    if (value < cfg.minPositionSizePct || value > cfg.maxPositionSizePct) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `${key} must be within [minPositionSizePct, maxPositionSizePct] = [${cfg.minPositionSizePct}, ${cfg.maxPositionSizePct}].`,
      });
    }
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

export type Confidence = "low" | "medium" | "high";

export function confidenceFromScore(score: number, config: FuturesStrategyConfig): Confidence {
  if (score >= config.confidenceHighScoreMin) return "high";
  if (score >= config.confidenceMediumScoreMin) return "medium";
  return "low";
}

export function leverageForConfidence(confidence: Confidence, config: FuturesStrategyConfig): number {
  const raw = confidence === "high" ? config.leverageHighConfidence : confidence === "medium" ? config.leverageMediumConfidence : config.leverageLowConfidence;
  return Math.min(config.maxLeverage, Math.max(config.minLeverage, raw));
}

export function positionSizePctForConfidence(confidence: Confidence, config: FuturesStrategyConfig): number {
  const raw =
    confidence === "high"
      ? config.positionSizeHighConfidencePct
      : confidence === "medium"
        ? config.positionSizeMediumConfidencePct
        : config.positionSizeLowConfidencePct;
  return Math.min(config.maxPositionSizePct, Math.max(config.minPositionSizePct, raw));
}
