import { db, nowIso } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { ArbStrategyConfigSchema, type ArbStrategyConfig } from "./schema.js";

const SETTINGS_KEY = "arb_strategy_config";

export function getArbStrategyConfig(): ArbStrategyConfig {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row) {
    const defaults = ArbStrategyConfigSchema.parse({});
    saveArbStrategyConfig(defaults);
    return defaults;
  }
  const result = ArbStrategyConfigSchema.safeParse(JSON.parse(row.value));
  if (result.success) return result.data;
  logger.warn({ issues: result.error.issues }, "Saved arb strategy config no longer matches the current schema — resetting to defaults.");
  const defaults = ArbStrategyConfigSchema.parse({});
  return saveArbStrategyConfig(defaults);
}

export function saveArbStrategyConfig(config: ArbStrategyConfig): ArbStrategyConfig {
  const validated = ArbStrategyConfigSchema.parse(config);
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(SETTINGS_KEY, JSON.stringify(validated), nowIso());
  return validated;
}

export function updateArbStrategyConfig(partial: Partial<ArbStrategyConfig>): ArbStrategyConfig {
  const current = getArbStrategyConfig();
  return saveArbStrategyConfig(ArbStrategyConfigSchema.parse({ ...current, ...partial }));
}
