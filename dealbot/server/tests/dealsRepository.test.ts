import { beforeEach, describe, expect, it } from "vitest";
import { createSource } from "../src/sources/repository.js";
import { getPriceHistory, listOffersForProduct, upsertOffer } from "../src/deals/repository.js";
import type { RawOffer } from "../src/sources/types.js";
import { resetDb } from "./testUtils.js";

function rawOffer(overrides: Partial<RawOffer> = {}): RawOffer {
  return {
    externalProductId: "prod-1",
    name: "Test Headphones",
    brand: "TestBrand",
    category: "Tech",
    currentPrice: "100.00",
    referencePrice: "150.00",
    currency: "EUR",
    productUrl: "https://example.com/p/1",
    merchant: "Merchant A",
    country: "AL",
    rating: 4.5,
    reviewCount: 100,
    availability: "in_stock",
    ...overrides,
  };
}

describe("deals repository", () => {
  let sourceId: string;

  beforeEach(() => {
    resetDb();
    sourceId = createSource({ name: "Test Source", kind: "demo" }).id;
  });

  it("dedups the same real-world product from two different merchants into one product with two comparable offers", () => {
    const first = upsertOffer(sourceId, rawOffer({ merchant: "Merchant A", currentPrice: "100.00" }));
    const second = upsertOffer(sourceId, rawOffer({ merchant: "Merchant B", currentPrice: "95.00" }));

    expect(first.offer.product_id).toBe(second.offer.product_id);
    expect(first.offer.id).not.toBe(second.offer.id);

    const siblings = listOffersForProduct(first.offer.product_id);
    expect(siblings).toHaveLength(2);
  });

  it("records a new price_history point only when the price actually changes", () => {
    const r1 = upsertOffer(sourceId, rawOffer({ currentPrice: "100.00" }));
    expect(r1.priceChanged).toBe(true);

    const r2 = upsertOffer(sourceId, rawOffer({ currentPrice: "100.00" }));
    expect(r2.priceChanged).toBe(false);
    expect(r2.isNew).toBe(false);

    const r3 = upsertOffer(sourceId, rawOffer({ currentPrice: "89.00" }));
    expect(r3.priceChanged).toBe(true);

    const history = getPriceHistory(r3.offer.id, 10);
    expect(history.map((h) => h.price)).toEqual(["100.00", "89.00"]);
  });

  it("does not treat a discount as real when current price already equals the reference price", () => {
    const result = upsertOffer(sourceId, rawOffer({ currentPrice: "150.00", referencePrice: "150.00" }));
    expect(result.offer.discount_pct).toBeNull();
  });
});
