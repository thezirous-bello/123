import { db, nowIso } from "../db/index.js";
import { FuturesStrategyConfigSchema, type FuturesStrategyConfig } from "./schema.js";

const SETTINGS_KEY = "futures_strategy_config";

export function getFuturesStrategyConfig(): FuturesStrategyConfig {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row) {
    const defaults = FuturesStrategyConfigSchema.parse({});
    saveFuturesStrategyConfig(defaults);
    return defaults;
  }
  return FuturesStrategyConfigSchema.parse(JSON.parse(row.value));
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
