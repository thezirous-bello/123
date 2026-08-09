export interface BuildLinkInput {
  productUrl: string;
  affiliateTag: string | null;
  /** Query param name the provider expects (Amazon Associates uses "tag";
   * others vary) — configurable per source, defaults to "tag". */
  affiliateParam?: string;
  campaignId?: string | null;
}

export interface BuildLinkResult {
  ok: boolean;
  affiliateUrl: string | null;
  error: string | null;
}

/** Generic tag-appending affiliate link builder — the mechanism behind
 * Amazon Associates and many other programs: the outbound product URL,
 * with your tracking tag appended as a query param. This is a real,
 * working provider requiring nothing but an affiliate tag string, not a
 * placeholder — richer providers (AWIN/CJ/Rakuten deep-link APIs) can
 * register alongside it later without changing the pipeline. Per the
 * spec: if we can't produce a real affiliate URL, we say so and the
 * caller must not post. */
export function buildAffiliateUrl(input: BuildLinkInput): BuildLinkResult {
  if (!input.affiliateTag) {
    return { ok: false, affiliateUrl: null, error: "No affiliate tag configured for this source." };
  }
  let url: URL;
  try {
    url = new URL(input.productUrl);
  } catch {
    return { ok: false, affiliateUrl: null, error: "Product URL is not a valid absolute URL." };
  }
  url.searchParams.set(input.affiliateParam ?? "tag", input.affiliateTag);
  if (input.campaignId) url.searchParams.set("campaign", input.campaignId);
  return { ok: true, affiliateUrl: url.toString(), error: null };
}
