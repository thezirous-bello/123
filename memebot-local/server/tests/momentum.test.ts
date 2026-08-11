import { describe, expect, it } from "vitest";
import { computeMomentumScore, computeRecentHigh, type MomentumScoreInput } from "../src/market/momentum.js";
import { MomentumConfigSchema } from "../src/lib/settings.js";
import type { TokenSnapshot } from "../src/market/types.js";

const mint = "MintAddress111111111111111111111111111111";
const defaultConfig = MomentumConfigSchema.parse({});

function baseSnapshot(overrides: Partial<TokenSnapshot> = {}): TokenSnapshot {
  return {
    mint,
    symbol: "TEST",
    name: "Test Token",
    priceUsd: 1,
    liquidityUsd: null,
    marketCapUsd: null,
    fdvUsd: null,
    volume5mUsd: null,
    volume1hUsd: null,
    volume6hUsd: null,
    volume24hUsd: null,
    volume1mUsd: null,
    priceChange5mPct: null,
    priceChange1hPct: null,
    priceChange6hPct: null,
    priceChange24hPct: null,
    priceChange1mPct: null,
    priceChange15mPct: null,
    buys5m: null,
    sells5m: null,
    buys1h: null,
    sells1h: null,
    buys6h: null,
    sells6h: null,
    buys24h: null,
    sells24h: null,
    pairCreatedAt: null,
    dexId: "raydium",
    pairAddress: "Pair11111111111111111111111111111111111111",
    quoteSymbol: "SOL",
    source: "dexscreener",
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

function baseInput(overrides: Partial<MomentumScoreInput> = {}): MomentumScoreInput {
  return { snapshot: baseSnapshot(), priceImpactPct: null, recentHighUsd: null, ...overrides };
}

describe("computeMomentumScore — acceleration vs exhaustion", () => {
  it("detects accelerating momentum when the most recent segment moves faster than the older one (+2% -> +11% pattern)", () => {
    // 5m window (recent 5 minutes): +2%. 1h window (whole last hour): +11%.
    // The recent-5m segment (+2% over 5 min = 0.4%/min) vs the older
    // 5m-to-60m segment ((11-2)/(60-5) = 0.1636%/min) — accelerating.
    const result = computeMomentumScore(
      baseInput({ snapshot: baseSnapshot({ priceChange5mPct: 2, priceChange1hPct: 11 }) }),
      defaultConfig,
    );
    expect(result.momentumAccelerating).toBe(true);
    expect(result.exhaustionWarning).toBe(false);
  });

  it("flags exhaustion when a large cumulative gain has clearly stalled in the most recent segment (+18% -> dying into +6% total over 1h with a huge 24h move)", () => {
    // 5m window: -1% (recent pause/reversal). 1h window: +6%. 24h: +80%
    // (large cumulative gain). The recent segment has gone flat/negative
    // while the older segments carried the whole move — textbook dying pump.
    const result = computeMomentumScore(
      baseInput({
        snapshot: baseSnapshot({ priceChange5mPct: -1, priceChange1hPct: 6, priceChange24hPct: 80 }),
      }),
      defaultConfig,
    );
    expect(result.exhaustionWarning).toBe(true);
  });

  it("does not fabricate an acceleration/exhaustion verdict from a single available window", () => {
    const result = computeMomentumScore(baseInput({ snapshot: baseSnapshot({ priceChange5mPct: 12 }) }), defaultConfig);
    expect(result.momentumAccelerating).toBe(false);
    expect(result.exhaustionWarning).toBe(false);
  });
});

describe("computeMomentumScore — component scoring", () => {
  it("scores strong buy pressure and volume acceleration highly", () => {
    const result = computeMomentumScore(
      baseInput({
        snapshot: baseSnapshot({
          priceChange5mPct: 5,
          priceChange1hPct: 8,
          volume5mUsd: 50_000,
          volume1hUsd: 120_000,
          buys5m: 90,
          sells5m: 10,
          buys1h: 300,
          sells1h: 150,
        }),
      }),
      defaultConfig,
    );
    expect(result.buyPressureDominant).toBe(true);
    expect(result.buySellRatio).toBeGreaterThan(0.55);
    expect(result.components.buyPressure).not.toBeNull();
    expect(result.components.buyPressure as number).toBeGreaterThan(60);
  });

  it("flags sell-dominant activity as not buy-pressure-dominant", () => {
    const result = computeMomentumScore(
      baseInput({ snapshot: baseSnapshot({ buys5m: 10, sells5m: 90 }) }),
      defaultConfig,
    );
    expect(result.buyPressureDominant).toBe(false);
    expect(result.buySellRatio).toBeLessThan(0.5);
  });

  it("excludes components with no underlying data instead of fabricating a neutral value, and renormalizes the total over what's left", () => {
    const onlyPrice = computeMomentumScore(baseInput({ snapshot: baseSnapshot({ priceChange5mPct: 10 }) }), defaultConfig);
    expect(onlyPrice.components.volumeAcceleration).toBeNull();
    expect(onlyPrice.components.buyPressure).toBeNull();
    expect(onlyPrice.components.executionQuality).toBeNull();
    expect(onlyPrice.totalScore).toBeGreaterThan(0);
  });

  it("rewards trading at/near the recent high over the same cumulative % change further from it", () => {
    const atHigh = computeMomentumScore(
      baseInput({ snapshot: baseSnapshot({ priceChange5mPct: 1, priceUsd: 1 }), recentHighUsd: 1 }),
      defaultConfig,
    );
    const offHigh = computeMomentumScore(
      baseInput({ snapshot: baseSnapshot({ priceChange5mPct: 1, priceUsd: 1 }), recentHighUsd: 1.5 }),
      defaultConfig,
    );
    expect((atHigh.components.priceMomentum as number)).toBeGreaterThan(offHigh.components.priceMomentum as number);
  });

  it("maps tighter execution price impact to a higher execution-quality score", () => {
    const tight = computeMomentumScore(baseInput({ priceImpactPct: 0.2 }), defaultConfig);
    const wide = computeMomentumScore(baseInput({ priceImpactPct: 5 }), defaultConfig);
    expect(tight.components.executionQuality as number).toBeGreaterThan(wide.components.executionQuality as number);
  });

  it("scores deeper liquidity higher than thin liquidity", () => {
    const deep = computeMomentumScore(baseInput({ snapshot: baseSnapshot({ liquidityUsd: 500_000 }) }), defaultConfig);
    const thin = computeMomentumScore(baseInput({ snapshot: baseSnapshot({ liquidityUsd: 3_000 }) }), defaultConfig);
    expect(deep.components.liquidityQuality as number).toBeGreaterThan(thin.components.liquidityQuality as number);
  });
});

describe("computeRecentHigh", () => {
  it("returns the highest observed price, ignoring nulls", () => {
    const high = computeRecentHigh([{ priceUsd: 1 }, { priceUsd: null }, { priceUsd: 3 }, { priceUsd: 2 }]);
    expect(high).toBe(3);
  });

  it("returns null when there is no price history at all", () => {
    expect(computeRecentHigh([])).toBeNull();
    expect(computeRecentHigh([{ priceUsd: null }])).toBeNull();
  });
});
