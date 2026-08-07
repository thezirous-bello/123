import { db, nowIso } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { FuturesStrategyConfigSchema, type FuturesStrategyConfig } from "./schema.js";

const SETTINGS_KEY = "futures_strategy_config";

/** The entry-gate defaults from before Stage 1 was loosened (RSI band +
 * StochRSI crossover-on-the-exact-candle + pullback + volume spike, all
 * AND'd together — see signalEngine.ts's history). A saved settings row
 * still parses fine against the current schema even after that change
 * (every field has a Zod default, so nothing here is a *required* key) —
 * which means an existing installation's old, overly-strict values would
 * otherwise persist forever and the loosening would never actually take
 * effect for anyone who already ran the bot once. */
function matchesPreLooseningEntryGateDefaults(cfg: FuturesStrategyConfig): boolean {
  return (
    cfg.rsiLongMin === 35 &&
    cfg.rsiLongMax === 50 &&
    cfg.rsiShortMin === 50 &&
    cfg.rsiShortMax === 65 &&
    cfg.minDailyMovePct === 8 &&
    cfg.oiIncreasingRequired === true &&
    cfg.volumeIncreasingRequired === true
  );
}

export function getFuturesStrategyConfig(): FuturesStrategyConfig {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row) {
    const defaults = FuturesStrategyConfigSchema.parse({});
    saveFuturesStrategyConfig(defaults);
    return defaults;
  }
  const result = FuturesStrategyConfigSchema.safeParse(JSON.parse(row.value));
  if (result.success) {
    if (matchesPreLooseningEntryGateDefaults(result.data)) {
      const fresh = FuturesStrategyConfigSchema.parse({});
      logger.warn("Futures strategy config was still at the old, overly-strict entry-gate defaults — relaxing to the new defaults so Stage 1 can actually qualify setups.");
      return saveFuturesStrategyConfig({
        ...result.data,
        rsiLongMin: fresh.rsiLongMin,
        rsiLongMax: fresh.rsiLongMax,
        rsiShortMin: fresh.rsiShortMin,
        rsiShortMax: fresh.rsiShortMax,
        minDailyMovePct: fresh.minDailyMovePct,
        oiIncreasingRequired: fresh.oiIncreasingRequired,
        volumeIncreasingRequired: fresh.volumeIncreasingRequired,
      });
    }
    return result.data;
  }
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
