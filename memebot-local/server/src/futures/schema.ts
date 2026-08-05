import { z } from "zod";

// This mirrors the user's "HIGH-RISK FUTURES STRATEGY (LONG & SHORT)" spec —
// trend on 4H, entry on 15M, confirmation on 5M, trading only highly
// volatile/meme/newly-listed coins, a VWAP/EMA20/support-resistance pullback
// entry confirmed by RSI + StochRSI crossover + a volume spike, fixed
// percentage stop-loss/take-profit/trailing-stop (not ATR-based), and the
// same 15-30x leverage / 20-50% position sizing risk profile as before. Every
// field below is a direct translation of one line of that spec. The one
// check with no honest free data source (economic-event calendar) is
// approximated by the existing BTC-volatility-shock detection, same
// precedent already accepted for spot and the prior futures strategy.
export const FuturesStrategyConfigObjectSchema = z
  .object({
    enabled: z.boolean().default(false),

    // Symbol universe
    symbolUniverse: z.enum(["auto", "all", "manual"]).default("all"),
    autoTopNByVolume: z.number().int().gt(0).max(1000).default(30),
    manualSymbols: z.array(z.string()).default([]),

    // Coin selection — "Trade only highly volatile coins... Prefer coins
    // moving at least 8-15% per day" and "Trade only liquid coins".
    // Turnover floor is deliberately lower than a blue-chip strategy's would
    // be, since this spec explicitly wants meme coins / newly listed coins.
    min24hTurnoverUsd: z.number().gte(0).default(1_000_000),
    minDailyMovePct: z.number().gte(0).default(8),
    maxSpreadPct: z.number().gt(0).default(0.5),
    atrOverCloseMax: z.number().gt(0).default(0.15),

    // Timeframes: Trend=4H, Entry=15M, Confirmation=5M
    minCompletedCandles: z.number().int().gte(20).default(50), // 15M entry series; low on purpose so newly-listed coins qualify
    trendEma4hPeriod: z.number().int().gt(0).default(50),
    entryEmaPeriod: z.number().int().gt(0).default(20),
    supportResistanceLookback: z.number().int().gt(0).default(20),

    // LONG/SHORT entry — shared shape, mirrored either side of price
    pullbackMaxDistancePct: z.number().gt(0).default(1.5), // max distance from VWAP/EMA20/support-resistance to count as "pulled back to" it
    rsiLongMin: z.number().gte(0).lte(100).default(35),
    rsiLongMax: z.number().gte(0).lte(100).default(50),
    rsiShortMin: z.number().gte(0).lte(100).default(50),
    rsiShortMax: z.number().gte(0).lte(100).default(65),
    volumeSpikeMultiplier: z.number().gt(0).default(1.5),
    breakoutPreferenceEnabled: z.boolean().default(true), // "Prioritize breakout and breakdown setups over ranging markets" — scoring bonus, not a hard filter

    // Trade setup — fixed percentages per the spec, not ATR-derived
    slMinPct: z.number().gt(0).default(3),
    slMaxPct: z.number().gt(0).default(4),
    tp1Pct: z.number().gt(0).default(5),
    tp2Pct: z.number().gt(0).default(10),
    trailingStopPct: z.number().gt(0).default(2), // TP3: trail remaining position with a 2% trailing stop
    minRiskReward: z.number().gt(0).default(1.2),

    // Stage 2 — signal validation
    maxPendingSignals: z.number().int().gt(0).default(3),
    maxActiveTrades: z.number().int().gt(0).default(3),
    btcVolatilityShockCheckEnabled: z.boolean().default(true), // "Avoid Trading: High-impact economic news" proxy
    btcSuddenMoveMaxPct: z.number().gt(0).default(3), // "Avoid Trading: Sudden BTC moves larger than 3%"
    fundingLongMaxPct: z.number().default(0.05),
    fundingShortMinPct: z.number().default(-0.05),
    oiIncreasingRequired: z.boolean().default(true), // "Open Interest increasing" (entry) + "Prefer increasing Open Interest" (extra filter)
    volumeIncreasingRequired: z.boolean().default(true), // "Prefer... increasing Volume" (extra filter)
    entryPriceMaxDriftPct: z.number().gt(0).default(0.4),
    signalExpiryMinutes: z.number().gt(0).default(15),

    // Market Direction — Fear & Greed
    fearGreedLongThreshold: z.number().gte(0).lte(100).default(60), // > 60 -> prefer longs
    fearGreedShortThreshold: z.number().gte(0).lte(100).default(40), // < 40 -> prefer shorts; 40-60 -> both, all confirmations required (already the case — every check below is a hard gate)

    // Confidence scoring → dynamic leverage / position size tiers
    confidenceHighScoreMin: z.number().gte(0).default(75),
    confidenceMediumScoreMin: z.number().gte(0).default(55),

    // Risk management — intentionally HIGH RISK, per the strategy's own
    // stated goal. minLeverage/maxLeverage are the hard absolute bounds;
    // nothing (including the confidence tiers below) may exceed them. The
    // controller additionally clamps the chosen leverage so the fixed 3-4%
    // stop-loss stays inside the liquidation safety buffer (see riskEngine's
    // maxSafeLeverageForStopDistance) — at a 4% SL that caps effective
    // leverage below 30x even though the tier below targets 28x.
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
    exitOnSetupInvalidation: z.boolean().default(true), // "Exit immediately if the setup becomes invalid"
    stopAfterConsecutiveLosses: z.number().int().gt(0).default(3),
    dailyMaxLossPct: z.number().gt(0).max(100).default(8),
  })
  .strict();

export const FuturesStrategyConfigSchema = FuturesStrategyConfigObjectSchema.superRefine((cfg, ctx) => {
  if (cfg.tp1ClosePct + cfg.tp2ClosePct > 100) {
    ctx.addIssue({ code: "custom", path: ["tp2ClosePct"], message: "tp1ClosePct + tp2ClosePct cannot exceed 100%." });
  }
  if (cfg.slMinPct > cfg.slMaxPct) {
    ctx.addIssue({ code: "custom", path: ["slMinPct"], message: "slMinPct cannot exceed slMaxPct." });
  }
  if (cfg.fearGreedShortThreshold > cfg.fearGreedLongThreshold) {
    ctx.addIssue({ code: "custom", path: ["fearGreedShortThreshold"], message: "fearGreedShortThreshold cannot exceed fearGreedLongThreshold." });
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
