/** One product offer as reported by a source adapter, before any
 * verification/scoring happens. Every field here must come from the
 * source's real response — adapters must never invent a value (e.g. a
 * fabricated "reference price" to manufacture a discount). Leave a field
 * undefined when the source genuinely doesn't supply it. */
export interface RawOffer {
  externalProductId: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  currentPrice: string;
  referencePrice?: string;
  currency: string;
  productUrl: string;
  merchant: string;
  country?: string;
  rating?: number;
  reviewCount?: number;
  availability?: "in_stock" | "out_of_stock" | "unknown";
  shippingInfo?: string;
}

export interface SourceScanResult {
  offers: RawOffer[];
  /** True if the call to the upstream API/feed succeeded, even if it
   * returned zero offers — distinguishes "nothing new" from "the source is
   * down", which matters for the source's api_status. */
  ok: boolean;
  error?: string;
}

/** Every deal source (spec section 1) implements this. Kept intentionally
 * small: fetch a batch of real offers, or report why you couldn't. */
export interface DealSourceAdapter {
  kind: string;
  scan(config: Record<string, unknown>): Promise<SourceScanResult>;
}
