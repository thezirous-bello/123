import { getProduct, getPriceHistory, type OfferRow } from "./repository.js";
import { getLatestAnalysis, getLatestScore } from "./analysisRepository.js";
import { getLatestLinkForOffer } from "../affiliate/repository.js";
import { listPostsForOffer, getChannel } from "../telegram/repository.js";
import { getClicksForOffer, getConversionsForOffer, getRevenueForOffer } from "../tracking/repository.js";
import { getSource } from "../sources/repository.js";

/** Assembles the dashboard-facing shape of one offer by joining its
 * product, latest analysis/score, latest post, and real tracking counts —
 * kept here so routes stay thin and every view of an offer (feed row vs.
 * detail page) stays consistent. */
export function offerToFeedRow(offer: OfferRow) {
  const product = getProduct(offer.product_id)!;
  const analysis = getLatestAnalysis(offer.id);
  const score = getLatestScore(offer.id);
  const posts = listPostsForOffer(offer.id);
  const latestPost = posts[0];
  const channel = latestPost ? getChannel(latestPost.channel_id) : undefined;
  const source = getSource(offer.source_id);

  return {
    id: offer.id,
    productId: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    imageUrl: product.image_url,
    rating: product.rating,
    reviewCount: product.review_count,
    merchant: offer.merchant,
    sourceName: source?.name ?? offer.source_id,
    country: offer.country,
    currency: offer.currency,
    currentPrice: offer.current_price,
    referencePrice: offer.reference_price,
    discountPct: analysis?.discount_pct ?? offer.discount_pct,
    dealConfidence: analysis?.deal_confidence ?? null,
    dealScore: score?.deal_score ?? null,
    profitScore: score?.profit_score ?? null,
    estimatedCommission: score?.estimated_commission ?? null,
    statusLabel: score?.status_label ?? null,
    availability: offer.availability,
    status: offer.status,
    rejectReason: offer.reject_reason,
    channelName: channel?.name ?? null,
    clicks: getClicksForOffer(offer.id),
    conversions: getConversionsForOffer(offer.id),
    revenue: getRevenueForOffer(offer.id),
    firstDiscoveredAt: offer.first_discovered_at,
    lastSeenAt: offer.last_seen_at,
    lastPostedAt: offer.last_posted_at,
  };
}

export function offerToDetail(offer: OfferRow) {
  const feedRow = offerToFeedRow(offer);
  const analysis = getLatestAnalysis(offer.id);
  const score = getLatestScore(offer.id);
  const link = getLatestLinkForOffer(offer.id);
  const posts = listPostsForOffer(offer.id).map((p) => ({ ...p, channelName: getChannel(p.channel_id)?.name ?? null }));
  const priceHistory = getPriceHistory(offer.id, 60);

  return {
    ...feedRow,
    productUrl: offer.product_url,
    evidence: analysis ? JSON.parse(analysis.evidence_json) : null,
    scoreBreakdown: score ? JSON.parse(score.breakdown_json) : null,
    affiliateLink: link
      ? { provider: link.provider, affiliateUrl: link.affiliate_url, status: link.status, error: link.error, trackingSlug: link.tracking_slug }
      : null,
    posts,
    priceHistory,
  };
}
