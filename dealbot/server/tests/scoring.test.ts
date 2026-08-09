import { describe, expect, it } from "vitest";
import { labelForScore, scoreOffer } from "../src/deals/scoring.js";

describe("scoreOffer", () => {
  it("scores a strong, well-corroborated deal as very good or excellent", () => {
    const result = scoreOffer({
      discountPct: 29,
      dealConfidence: 94,
      rating: 4.7,
      reviewCount: 2140,
      availability: "in_stock",
      competingOfferCount: 1,
      isPriceLowestAmongOffers: true,
      commissionPct: 5,
      currentPrice: 249,
    });
    expect(result.dealScore).toBeGreaterThanOrEqual(75);
    expect(["very_good", "excellent"]).toContain(result.statusLabel);
    expect(result.estimatedCommission).toBe("12.45");
  });

  it("scores a weak, low-confidence, no-discount item as reject", () => {
    const result = scoreOffer({
      discountPct: null,
      dealConfidence: 20,
      rating: null,
      reviewCount: null,
      availability: "unknown",
      competingOfferCount: 0,
      isPriceLowestAmongOffers: true,
      commissionPct: null,
      currentPrice: 50,
    });
    expect(result.dealScore).toBeLessThan(50);
    expect(result.statusLabel).toBe("reject");
    expect(result.estimatedCommission).toBeNull();
  });

  it("prioritizes profit score for a high-ticket item with real commission over a cheap low-commission item", () => {
    const expensive = scoreOffer({
      discountPct: 20,
      dealConfidence: 80,
      rating: 4.5,
      reviewCount: 500,
      availability: "in_stock",
      competingOfferCount: 0,
      isPriceLowestAmongOffers: true,
      commissionPct: 5,
      currentPrice: 900,
    });
    const cheap = scoreOffer({
      discountPct: 20,
      dealConfidence: 80,
      rating: 4.5,
      reviewCount: 500,
      availability: "in_stock",
      competingOfferCount: 0,
      isPriceLowestAmongOffers: true,
      commissionPct: 1.5,
      currentPrice: 20,
    });
    // Spec's own example: a €900 product paying real commission should
    // outrank a €20 product paying a few cents, on profit — not deal —
    // score.
    expect(Number(expensive.estimatedCommission)).toBeGreaterThan(Number(cheap.estimatedCommission));
    expect(expensive.profitScore).toBeGreaterThan(cheap.profitScore);
  });

  it("never fabricates a commission figure when the source reports no commission rate", () => {
    const result = scoreOffer({
      discountPct: 40,
      dealConfidence: 90,
      rating: 4.9,
      reviewCount: 10000,
      availability: "in_stock",
      competingOfferCount: 2,
      isPriceLowestAmongOffers: true,
      commissionPct: null,
      currentPrice: 500,
    });
    expect(result.estimatedCommission).toBeNull();
  });
});

describe("labelForScore", () => {
  it("respects the spec's default score ranges", () => {
    expect(labelForScore(30)).toBe("reject");
    expect(labelForScore(55)).toBe("weak");
    expect(labelForScore(70)).toBe("good");
    expect(labelForScore(80)).toBe("very_good");
    expect(labelForScore(90)).toBe("excellent");
  });
});
