import { beforeEach, describe, expect, it } from "vitest";
import { recordMomentumScore, listLatestMomentumScores } from "../src/market/momentumRepository.js";
import type { MomentumScoreResult } from "../src/market/momentum.js";
import { resetDb } from "./testUtils.js";

const mint = "MintAddress111111111111111111111111111111";

function momentumWithNullComponents(): MomentumScoreResult {
  return {
    // Only the price-momentum component has data — every other component is
    // null, which is the normal, common case for a thin/new/quiet token
    // (no liquidity figure, no volume-window pair, no buy/sell tx counts,
    // only one available price-change window). A previous version of the
    // momentum_scores schema incorrectly required these to be non-null and
    // threw on every insert like this one.
    totalScore: 55,
    components: {
      priceMomentum: 55,
      volumeAcceleration: null,
      buyPressure: null,
      txAcceleration: null,
      liquidityQuality: null,
      trendStrength: null,
      executionQuality: null,
    },
    trendDirection: "neutral",
    momentumAccelerating: false,
    exhaustionWarning: false,
    volumeAccelerating: false,
    buyPressureDominant: false,
    txAccelerating: false,
    buySellRatio: null,
    distanceFromHighPct: null,
    reasons: [],
  };
}

describe("recordMomentumScore", () => {
  beforeEach(() => {
    resetDb();
  });

  it("does not throw when every non-price component is null (the common case for thin/new tokens)", () => {
    expect(() =>
      recordMomentumScore({
        mint,
        symbol: "TEST",
        score: momentumWithNullComponents(),
        liquidityUsd: null,
        priceImpactPct: null,
        tradeStatus: "watching",
        rejectionReason: null,
      }),
    ).not.toThrow();
  });

  it("persists a null component as null, not a fabricated fallback", () => {
    recordMomentumScore({
      mint,
      symbol: "TEST",
      score: momentumWithNullComponents(),
      liquidityUsd: null,
      priceImpactPct: null,
      tradeStatus: "watching",
      rejectionReason: null,
    });
    const rows = listLatestMomentumScores();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.liquidityUsd).toBeNull();
  });
});
