import { db, nowIso } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { FuturesStrategyConfigSchema, type FuturesStrategyConfig } from "./schema.js";

const SETTINGS_KEY = "futures_strategy_config";

export function getFuturesStrategyConfig(): FuturesStrategyConfig {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row) {
    const defaults = FuturesStrategyConfigSchema.parse({});
    saveFuturesStrategyConfig(defaults);
    return defaults;
  }
  const result = FuturesStrategyConfigSchema.safeParse(JSON.parse(row.value));
  if (result.success) return result.data;
  // A saved config from a previous strategy version (the schema is
  // .strict(), so field-set changes always fail here) — reset to the
  // current strategy's defaults rather than crash the bot on startup.
  logger.warn({ issues: result.error.issues }, "Saved futures strategy config no longer matches the current schema — resetting to defaults.");
  const defaults = FuturesStrategyConfigSchema.parse({});
  return saveFuturesStrategyConfig(defaults);
}

export function saveFuturesStrategyConfig(config: FuturesStrategyConfig): FuturesStrategyConfig {
  const validated = FuturesStrategyConfigSchema.parse(config);
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(SETTINGS_KEY, JSON.stringify(validated), nowIso());
  return validated;
}

export function updateFuturesStrategyConfig(partial: Partial<FuturesStrategyConfig>): FuturesStrategyConfig {
  const current = getFuturesStrategyConfig();
  return saveFuturesStrategyConfig(FuturesStrategyConfigSchema.parse({ ...current, ...partial }));
}
