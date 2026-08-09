import { beforeEach, describe, expect, it } from "vitest";
import { evaluatePostingRules, updatePostingRules } from "../src/rules/postingRules.js";
import { resetDb } from "./testUtils.js";

function baseInput() {
  return {
    dealScore: 90,
    dealConfidence: 90,
    discountPct: 30,
    rating: 4.5,
    reviewCount: 1000,
    estimatedCommission: "10.00",
    availability: "in_stock",
    hasAffiliateUrl: true,
    category: "Tech",
    country: "AL",
    isBlocked: false,
    lastPostedAgoHours: null,
  };
}

describe("evaluatePostingRules", () => {
  beforeEach(() => {
    resetDb();
  });

  it("passes a deal that clears every default threshold", () => {
    const result = evaluatePostingRules(baseInput());
    expect(result.passes).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("blocks a deal below the minimum deal score", () => {
    const result = evaluatePostingRules({ ...baseInput(), dealScore: 50 });
    expect(result.passes).toBe(false);
    expect(result.reasons.some((r) => r.includes("Deal score"))).toBe(true);
  });

  it("never lets a missing affiliate URL through, even with a perfect score", () => {
    const result = evaluatePostingRules({ ...baseInput(), hasAffiliateUrl: false });
    expect(result.passes).toBe(false);
    expect(result.reasons.some((r) => r.includes("AFFILIATE LINK ERROR"))).toBe(true);
  });

  it("blocks an already-blocked product regardless of how good the deal is", () => {
    const result = evaluatePostingRules({ ...baseInput(), isBlocked: true });
    expect(result.passes).toBe(false);
  });

  it("enforces the repost cooldown", () => {
    updatePostingRules({ repostCooldownHours: 48 });
    const result = evaluatePostingRules({ ...baseInput(), lastPostedAgoHours: 5 });
    expect(result.passes).toBe(false);
    expect(result.reasons.some((r) => r.includes("cooldown"))).toBe(true);
  });

  it("allows a repost once the cooldown has elapsed", () => {
    updatePostingRules({ repostCooldownHours: 48 });
    const result = evaluatePostingRules({ ...baseInput(), lastPostedAgoHours: 72 });
    expect(result.passes).toBe(true);
  });

  it("respects a configured category allowlist", () => {
    updatePostingRules({ allowedCategories: ["Gaming"] });
    const result = evaluatePostingRules({ ...baseInput(), category: "Tech" });
    expect(result.passes).toBe(false);
    expect(result.reasons.some((r) => r.includes("not in allowed list"))).toBe(true);
  });

  it("out-of-stock is blocked when require_in_stock is on", () => {
    const result = evaluatePostingRules({ ...baseInput(), availability: "out_of_stock" });
    expect(result.passes).toBe(false);
  });
});
