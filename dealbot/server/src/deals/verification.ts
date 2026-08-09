import type { OfferRow } from "./repository.js";

export interface VerificationResult {
  confidence: number; // 0-100
  discountPct: number | null;
  absoluteSaving: string | null;
  evidence: {
    hasReferencePrice: boolean;
    historicalObservations: number;
    observedPriceDrop: boolean;
    suspiciousDiscount: boolean;
  };
}

/** Verifies a claimed discount using the offer's reference price AND — more
 * trustworthy, because we recorded it ourselves — our own price_history for
 * this exact offer. A merchant-supplied "was €349" is treated as weaker
 * evidence than "we've watched this offer for a while and it really did
 * just drop." A large discount with neither kind of evidence is penalized,
 * not rejected outright — the caller's posting_rules threshold decides
 * whether the resulting confidence is good enough to act on. */
export function verifyDeal(offer: OfferRow, priceHistory: Array<{ price: string }>): VerificationResult {
  const current = Number(offer.current_price);
  const reference = offer.reference_price != null ? Number(offer.reference_price) : null;
  const hasReferencePrice = reference != null && Number.isFinite(reference) && reference > current;
  const discountPct = hasReferencePrice ? ((reference! - current) / reference!) * 100 : null;

  const historicalPrices = priceHistory.map((p) => Number(p.price)).filter((p) => Number.isFinite(p));
  const priorPrices = historicalPrices.slice(0, -1); // exclude the just-recorded current price
  const historicalObservations = priorPrices.length;
  const maxObserved = priorPrices.length > 0 ? Math.max(...priorPrices) : null;
  const observedPriceDrop = maxObserved != null && current < maxObserved * 0.98;

  let confidence = 30; // baseline: we at least have a live, real current price
  if (hasReferencePrice) confidence += 25;
  if (observedPriceDrop) confidence += 30;
  else if (historicalObservations >= 3) confidence -= 10; // watched a while, price never actually moved

  const suspiciousDiscount = discountPct != null && discountPct > 70 && !observedPriceDrop;
  if (suspiciousDiscount) confidence -= 25;

  if (!hasReferencePrice && !observedPriceDrop) confidence = Math.min(confidence, 20);

  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  return {
    confidence,
    discountPct: discountPct != null ? Math.round(discountPct * 10) / 10 : null,
    absoluteSaving: hasReferencePrice ? (reference! - current).toFixed(2) : null,
    evidence: { hasReferencePrice, historicalObservations, observedPriceDrop, suspiciousDiscount },
  };
}
