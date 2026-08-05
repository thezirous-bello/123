import { db, nowIso } from "../db/index.js";
import { SpotStrategyConfigSchema, type SpotStrategyConfig } from "./schema.js";

const SETTINGS_KEY = "spot_strategy_config";

export function getSpotStrategyConfig(): SpotStrategyConfig {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row) {
    const defaults = SpotStrategyConfigSchema.parse({});
    saveSpotStrategyConfig(defaults);
    return defaults;
  }
  return SpotStrategyConfigSchema.parse(JSON.parse(row.value));
}

export function saveSpotStrategyConfig(config: SpotStrategyConfig): SpotStrategyConfig {
  const validated = SpotStrategyConfigSchema.parse(config);
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(SETTINGS_KEY, JSON.stringify(validated), nowIso());
  return validated;
}

export function updateSpotStrategyConfig(partial: Partial<SpotStrategyConfig>): SpotStrategyConfig {
  const current = getSpotStrategyConfig();
  return saveSpotStrategyConfig(SpotStrategyConfigSchema.parse({ ...current, ...partial }));
}
