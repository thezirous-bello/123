import { describe, expect, it } from "vitest";
import { generatePost, type PostContext } from "../src/telegram/postGenerator.js";

function ctx(overrides: Partial<PostContext> = {}): PostContext {
  return {
    productName: "Wireless Headphones",
    brand: "Sony",
    currentPrice: "249.00",
    currency: "EUR",
    referencePrice: "349.00",
    discountPct: 28.6,
    absoluteSaving: "100.00",
    rating: 4.7,
    reviewCount: 2140,
    affiliateUrl: "https://dealbot.example/r/abc123",
    ...overrides,
  };
}

describe("generatePost", () => {
  it("includes the real price, discount, and affiliate link — never a placeholder", () => {
    const text = generatePost(ctx(), 0);
    expect(text).toContain("249.00");
    expect(text).toContain("349.00");
    expect(text).toContain("29%"); // rounded from 28.6
    expect(text).toContain("https://dealbot.example/r/abc123");
    expect(text).toContain("Sony Wireless Headphones");
  });

  it("never invents scarcity or countdown language not present in the context", () => {
    const text = generatePost(ctx(), 1).toLowerCase();
    expect(text).not.toMatch(/only \d+ left/);
    expect(text).not.toMatch(/hurry/);
    expect(text).not.toMatch(/ends in/);
    expect(text).not.toMatch(/limited time/);
  });

  it("varies the template by seed without changing the actual data", () => {
    const a = generatePost(ctx(), 0);
    const b = generatePost(ctx(), 2);
    expect(a).not.toBe(b);
    // Same real price in both variants regardless of template.
    expect(a).toContain("249.00");
    expect(b).toContain("249.00");
  });

  it("omits the reference-price line entirely when no reference price is known, rather than fabricating one", () => {
    const text = generatePost(ctx({ referencePrice: null, discountPct: null, absoluteSaving: null }), 0);
    expect(text).not.toContain("→");
    expect(text).not.toContain("You save");
  });
});
