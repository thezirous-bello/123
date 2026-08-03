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

const PAPER_STARTING_BALANCE_KEY = "paper_starting_balance_usd";

export function getPaperStartingBalanceDefault(): number {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(PAPER_STARTING_BALANCE_KEY) as
    | { value: string }
    | undefined;
  return row ? Number.parseFloat(row.value) : 1000;
}
