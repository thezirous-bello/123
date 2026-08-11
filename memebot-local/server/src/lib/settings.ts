import { z } from "zod";
import { db, nowIso } from "../db/index.js";

// These are the global, account-level ceilings. A strategy may set stricter
// (safer) per-trade values than these, but nothing in the app — not the
// strategy parser, not the API, not a hand-edited strategy JSON — is allowed
// to exceed them. They are what actually caps worst-case loss.
export const RiskLimitsSchema = z
  .object({
    maxTradeUsd: z.number().gt(0).max(1_000_000).default(10),
    maxWalletPercentagePerTrade: z.number().gt(0).max(100).default(2),
    maxOpenPositions: z.number().int().gt(0).max(50).default(3),
    maxTradesPerHour: z.number().int().gt(0).max(500).default(10),
    maxTradesPerDay: z.number().int().gt(0).max(2000).default(20),
    maxDailyLossPercentage: z.number().gt(0).max(100).default(5),
    maxSlippagePercentage: z.number().gt(0).max(50).default(3),
    maxPriceImpactPercentage: z.number().gt(0).max(50).default(2),
    minimumLiquidityUsd: z.number().gte(0).default(20_000),
    minimumSolReserve: z.number().gte(0).default(0.03),
    maxTokenRiskLevel: z.enum(["low", "medium", "high"]).default("high"),
    cooldownMinutesAfterLoss: z.number().gte(0).max(1440).default(15),
    consecutiveLossesBeforeCooldown: z.number().int().gt(0).max(20).default(3),
    consecutiveLossCooldownMinutes: z.number().gte(0).max(1440).default(60),
    maxQuoteAgeSeconds: z.number().gt(0).max(300).default(20),
  })
  .strict();

export type RiskLimits = z.infer<typeof RiskLimitsSchema>;

const SETTINGS_KEY = "risk_limits";

export function getRiskLimits(): RiskLimits {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(SETTINGS_KEY) as
    | { value: string }
    | undefined;
  if (!row) {
    const defaults = RiskLimitsSchema.parse({});
    saveRiskLimits(defaults);
    return defaults;
  }
  return RiskLimitsSchema.parse(JSON.parse(row.value));
}

export function saveRiskLimits(limits: RiskLimits): RiskLimits {
  const validated = RiskLimitsSchema.parse(limits);
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(SETTINGS_KEY, JSON.stringify(validated), nowIso());
  return validated;
}

export function updateRiskLimits(partial: Partial<RiskLimits>): RiskLimits {
  const current = getRiskLimits();
  return saveRiskLimits(RiskLimitsSchema.parse({ ...current, ...partial }));
}

// Weights for the seven momentum-score components (see market/momentum.ts).
// Stored as configurable settings rather than hardcoded, per the "make
// thresholds/weights configurable" requirement — tune these if live results
// show a different mix predicts continuing momentum better. Weights are
// normalized (don't need to sum to exactly 100) whenever a component's data
// is unavailable and has to be excluded from the score.
export const MomentumConfigSchema = z
  .object({
    weightPriceMomentum: z.number().gte(0).max(100).default(25),
    weightVolumeAcceleration: z.number().gte(0).max(100).default(20),
    weightBuyPressure: z.number().gte(0).max(100).default(15),
    weightTxAcceleration: z.number().gte(0).max(100).default(15),
    weightLiquidityQuality: z.number().gte(0).max(100).default(10),
    weightTrendStrength: z.number().gte(0).max(100).default(10),
    weightExecutionQuality: z.number().gte(0).max(100).default(5),

    // Entry gating defaults — a strategy may override these per-strategy
    // (see strategy/schema.ts), these are what a strategy gets if it
    // doesn't specify its own.
    minMomentumScoreToEnter: z.number().gte(0).max(100).default(60),
    requireVolumeAccelerating: z.boolean().default(true),
    requireBuyPressureDominant: z.boolean().default(true),
    requireTxAccelerating: z.boolean().default(false),
    requireTrendBullish: z.boolean().default(true),

    // Dynamic-exit gating — evaluated continuously against open positions.
    exitOnMomentumReversal: z.boolean().default(true),
    exitMomentumScoreThreshold: z.number().gte(0).max(100).default(35),
    exitOnSellPressureReversal: z.boolean().default(true),
    /** Sell/buy ratio (0-1, sells as a fraction of buys+sells) at which a
     * profitable position is considered to have flipped to net sell
     * pressure and eligible for the sell_pressure_reversal exit. */
    sellPressureReversalRatio: z.number().gt(0.5).lt(1).default(0.65),
  })
  .strict();

export type MomentumConfig = z.infer<typeof MomentumConfigSchema>;

const MOMENTUM_CONFIG_KEY = "momentum_config";

export function getMomentumConfig(): MomentumConfig {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(MOMENTUM_CONFIG_KEY) as
    | { value: string }
    | undefined;
  if (!row) {
    const defaults = MomentumConfigSchema.parse({});
    saveMomentumConfig(defaults);
    return defaults;
  }
  return MomentumConfigSchema.parse(JSON.parse(row.value));
}

export function saveMomentumConfig(config: MomentumConfig): MomentumConfig {
  const validated = MomentumConfigSchema.parse(config);
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(MOMENTUM_CONFIG_KEY, JSON.stringify(validated), nowIso());
  return validated;
}

export function updateMomentumConfig(partial: Partial<MomentumConfig>): MomentumConfig {
  const current = getMomentumConfig();
  return saveMomentumConfig(MomentumConfigSchema.parse({ ...current, ...partial }));
}

const PAPER_STARTING_BALANCE_KEY = "paper_starting_balance_usd";

export function getPaperStartingBalanceDefault(): number {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(PAPER_STARTING_BALANCE_KEY) as
    | { value: string }
    | undefined;
  return row ? Number.parseFloat(row.value) : 1000;
}
