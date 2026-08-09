import { describe, expect, it } from "vitest";
import { buildAffiliateUrl } from "../src/affiliate/linkBuilder.js";

describe("buildAffiliateUrl", () => {
  it("refuses to build a link without an affiliate tag", () => {
    const result = buildAffiliateUrl({ productUrl: "https://example.com/product/1", affiliateTag: null });
    expect(result.ok).toBe(false);
    expect(result.affiliateUrl).toBeNull();
    expect(result.error).toMatch(/no affiliate tag/i);
  });

  it("appends the tag as a query param by default", () => {
    const result = buildAffiliateUrl({ productUrl: "https://example.com/product/1?ref=x", affiliateTag: "my-tag-20" });
    expect(result.ok).toBe(true);
    const url = new URL(result.affiliateUrl!);
    expect(url.searchParams.get("tag")).toBe("my-tag-20");
    expect(url.searchParams.get("ref")).toBe("x"); // existing query params are preserved
  });

  it("supports a custom param name for providers that don't use 'tag'", () => {
    const result = buildAffiliateUrl({ productUrl: "https://example.com/p/1", affiliateTag: "abc123", affiliateParam: "aff_id" });
    const url = new URL(result.affiliateUrl!);
    expect(url.searchParams.get("aff_id")).toBe("abc123");
  });

  it("rejects a malformed product URL instead of producing a broken link", () => {
    const result = buildAffiliateUrl({ productUrl: "not-a-url", affiliateTag: "tag" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/valid absolute url/i);
  });
});
