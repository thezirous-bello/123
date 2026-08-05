import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "./testUtils.js";
import { db, nowIso } from "../src/db/index.js";
import { getSpotStrategyConfig } from "../src/spot/configStore.js";
import { getFuturesStrategyConfig } from "../src/futures/configStore.js";

function seedLegacyConfig(key: string, overrides: Record<string, unknown> = {}) {
  const legacy = { enabled: true, symbolUniverse: "auto", autoTopNByVolume: 30, manualSymbols: [], ...overrides };
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, JSON.stringify(legacy), nowIso());
}

beforeEach(() => {
  resetDb();
});

describe("legacy symbolUniverse auto-upgrade", () => {
  it("upgrades a spot config saved with the old auto+30 default to 'all'", () => {
    // A config saved before "all" existed only has the fields that existed
    // then — getSpotStrategyConfig has to merge it against current Zod
    // defaults for the rest, same as it always does for old settings rows.
    seedLegacyConfig("spot_strategy_config");
    const config = getSpotStrategyConfig();
    expect(config.symbolUniverse).toBe("all");

    // The upgrade should also have been persisted, not just returned once.
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("spot_strategy_config") as { value: string };
    expect(JSON.parse(row.value).symbolUniverse).toBe("all");
  });

  it("leaves a deliberately-chosen manual universe untouched", () => {
    seedLegacyConfig("spot_strategy_config", { symbolUniverse: "manual", manualSymbols: ["BTCUSDT"] });
    const config = getSpotStrategyConfig();
    expect(config.symbolUniverse).toBe("manual");
    expect(config.manualSymbols).toEqual(["BTCUSDT"]);
  });
});

describe("futures config reset on schema mismatch", () => {
  // The futures strategy was fully replaced (old ATR-based zone/leverage
  // fields -> the new VWAP/EMA20/support-pullback, fixed % SL/TP spec) —
  // getFuturesStrategyConfig can't sensibly merge an old-shape settings row
  // into the new .strict() schema, so it resets to the new defaults instead
  // of crashing on startup.
  it("resets a settings row saved under the old (pre-rewrite) futures schema to the new defaults", () => {
    seedLegacyConfig("futures_strategy_config", {
      entryZoneNearPct: 0.8,
      entryZoneFarPct: 2,
      trendEmaPeriod: 200,
      stochRsiLongKMax: 45,
      slAtrMultiplier: 1.8,
      tp3AtrTrailMultiplier: 1.2,
      trailingAtrMultiplier: 1.2,
    });
    const config = getFuturesStrategyConfig();
    expect(config.symbolUniverse).toBe("all");
    expect(config.slMinPct).toBe(3);
    expect(config.slMaxPct).toBe(4);
    expect(config.trailingStopPct).toBe(2);
    expect((config as unknown as Record<string, unknown>).entryZoneNearPct).toBeUndefined();

    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("futures_strategy_config") as { value: string };
    expect(JSON.parse(row.value).entryZoneNearPct).toBeUndefined();
    expect(JSON.parse(row.value).slMinPct).toBe(3);
  });

  it("leaves a config already saved under the current schema untouched", () => {
    seedLegacyConfig("futures_strategy_config", { symbolUniverse: "auto", autoTopNByVolume: 50 });
    const config = getFuturesStrategyConfig();
    expect(config.symbolUniverse).toBe("auto");
    expect(config.autoTopNByVolume).toBe(50);
  });
});
