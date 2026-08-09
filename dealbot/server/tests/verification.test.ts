import { describe, expect, it } from "vitest";
import { verifyDeal } from "../src/deals/verification.js";
import type { OfferRow } from "../src/deals/repository.js";

function makeOffer(overrides: Partial<OfferRow>): OfferRow {
  return {
    id: "offer-1",
    product_id: "product-1",
    source_id: "source-1",
    external_product_id: "ext-1",
    merchant: "Test Merchant",
    country: "AL",
    currency: "EUR",
    current_price: "100",
    reference_price: null,
    discount_pct: null,
    product_url: "https://example.com/p/1",
    availability: "in_stock",
    shipping_info: null,
    status: "discovered",
    reject_reason: null,
    first_discovered_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    last_posted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("verifyDeal", () => {
  it("gives low confidence when there is no reference price and no price history", () => {
    const offer = makeOffer({ current_price: "100", reference_price: null });
    const result = verifyDeal(offer, []);
    expect(result.confidence).toBeLessThanOrEqual(30);
    expect(result.discountPct).toBeNull();
    expect(result.evidence.hasReferencePrice).toBe(false);
  });

  it("boosts confidence when we've personally observed the price drop", () => {
    const offer = makeOffer({ current_price: "80", reference_price: "100" });
    const history = [{ price: "100" }, { price: "100" }, { price: "80" }];
    const result = verifyDeal(offer, history);
    expect(result.evidence.observedPriceDrop).toBe(true);
    expect(result.confidence).toBeGreaterThan(70);
    expect(result.discountPct).toBeCloseTo(20, 1);
    expect(result.absoluteSaving).toBe("20.00");
  });

  it("penalizes a suspiciously large discount with no corroborating history", () => {
    const offer = makeOffer({ current_price: "10", reference_price: "100" });
    const result = verifyDeal(offer, [{ price: "10" }]);
    expect(result.evidence.suspiciousDiscount).toBe(true);
    expect(result.discountPct).toBe(90);
    // Reference price alone still counts for something, but the
    // suspicious-discount penalty must keep this well below a
    // confidently-verified deal.
    expect(result.confidence).toBeLessThan(50);
  });

  it("does not treat a merchant reference price equal to current price as a real discount", () => {
    const offer = makeOffer({ current_price: "100", reference_price: "100" });
    const result = verifyDeal(offer, [{ price: "100" }]);
    expect(result.discountPct).toBeNull();
    expect(result.evidence.hasReferencePrice).toBe(false);
  });

  it("lowers confidence over time when a claimed reference price never actually moves", () => {
    const offer = makeOffer({ current_price: "349", reference_price: "349" });
    const longHistory = [{ price: "349" }, { price: "349" }, { price: "349" }, { price: "349" }];
    const result = verifyDeal(offer, longHistory);
    expect(result.confidence).toBeLessThan(30);
  });
});
