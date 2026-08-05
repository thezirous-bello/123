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
  const parsed = SpotStrategyConfigSchema.parse(JSON.parse(row.value));
  // One-time upgrade: "auto" + top-30 was the hardcoded default before
  // "all" existed. Anyone who saved a config back then (or never touched
  // this setting) is silently stuck scanning only 30 symbols even after
  // upgrading the app, since a saved settings row is never overwritten by
  // a new code default. This narrowly targets the exact old default only —
  // a deliberately-chosen "auto"+30 after "all" existed would look
  // identical, but that's an acceptable, rare edge case against fixing the
  // much more common "still capped at 30 and I don't know why" complaint.
  if (parsed.symbolUniverse === "auto" && parsed.autoTopNByVolume === 30) {
    return saveSpotStrategyConfig({ ...parsed, symbolUniverse: "all" });
  }
  return parsed;
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
