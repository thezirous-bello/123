import { db } from "../db/index.js";

export interface PostingRulesRow {
  id: 1;
  min_deal_score: number;
  min_deal_confidence: number;
  min_discount_pct: number;
  min_rating: number;
  min_reviews: number;
  min_estimated_commission: string;
  require_in_stock: number;
  require_affiliate_url: number;
  allowed_categories_json: string;
  allowed_countries_json: string;
  repost_cooldown_hours: number;
  updated_at: string;
}

export function getPostingRules(): PostingRulesRow {
  return db.prepare("SELECT * FROM posting_rules WHERE id = 1").get() as PostingRulesRow;
}

export function updatePostingRules(
  patch: Partial<{
    minDealScore: number;
    minDealConfidence: number;
    minDiscountPct: number;
    minRating: number;
    minReviews: number;
    minEstimatedCommission: string;
    requireInStock: boolean;
    requireAffiliateUrl: boolean;
    allowedCategories: string[];
    allowedCountries: string[];
    repostCooldownHours: number;
  }>,
): PostingRulesRow {
  const existing = getPostingRules();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE posting_rules SET
       min_deal_score = ?, min_deal_confidence = ?, min_discount_pct = ?, min_rating = ?, min_reviews = ?,
       min_estimated_commission = ?, require_in_stock = ?, require_affiliate_url = ?,
       allowed_categories_json = ?, allowed_countries_json = ?, repost_cooldown_hours = ?, updated_at = ?
     WHERE id = 1`,
  ).run(
    patch.minDealScore ?? existing.min_deal_score,
    patch.minDealConfidence ?? existing.min_deal_confidence,
    patch.minDiscountPct ?? existing.min_discount_pct,
    patch.minRating ?? existing.min_rating,
    patch.minReviews ?? existing.min_reviews,
    patch.minEstimatedCommission ?? existing.min_estimated_commission,
    patch.requireInStock != null ? (patch.requireInStock ? 1 : 0) : existing.require_in_stock,
    patch.requireAffiliateUrl != null ? (patch.requireAffiliateUrl ? 1 : 0) : existing.require_affiliate_url,
    patch.allowedCategories ? JSON.stringify(patch.allowedCategories) : existing.allowed_categories_json,
    patch.allowedCountries ? JSON.stringify(patch.allowedCountries) : existing.allowed_countries_json,
    patch.repostCooldownHours ?? existing.repost_cooldown_hours,
    now,
  );
  return getPostingRules();
}

export interface RuleCheckInput {
  dealScore: number;
  dealConfidence: number;
  discountPct: number | null;
  rating: number | null;
  reviewCount: number | null;
  estimatedCommission: string | null;
  availability: string;
  hasAffiliateUrl: boolean;
  category: string | null;
  country: string | null;
  isBlocked: boolean;
  lastPostedAgoHours: number | null;
}

export interface RuleCheckResult {
  passes: boolean;
  reasons: string[];
}

/** The single gate every offer passes through before it's allowed to
 * queue for Telegram — every condition here is one the operator
 * explicitly configured (spec section 6), nothing implicit. */
export function evaluatePostingRules(input: RuleCheckInput): RuleCheckResult {
  const rules = getPostingRules();
  const reasons: string[] = [];

  if (input.isBlocked) reasons.push("Product or brand is blocked.");
  if (input.dealScore < rules.min_deal_score) reasons.push(`Deal score ${input.dealScore} below minimum ${rules.min_deal_score}.`);
  if (input.dealConfidence < rules.min_deal_confidence) reasons.push(`Deal confidence ${input.dealConfidence} below minimum ${rules.min_deal_confidence}.`);
  if ((input.discountPct ?? 0) < rules.min_discount_pct) reasons.push(`Discount ${(input.discountPct ?? 0).toFixed(1)}% below minimum ${rules.min_discount_pct}%.`);
  if (rules.min_rating > 0 && (input.rating ?? 0) < rules.min_rating) reasons.push(`Rating below minimum ${rules.min_rating}.`);
  if (rules.min_reviews > 0 && (input.reviewCount ?? 0) < rules.min_reviews) reasons.push(`Review count below minimum ${rules.min_reviews}.`);
  if (Number(rules.min_estimated_commission) > 0 && Number(input.estimatedCommission ?? 0) < Number(rules.min_estimated_commission)) {
    reasons.push("Estimated commission below minimum.");
  }
  if (rules.require_in_stock && input.availability !== "in_stock") reasons.push("Not in stock.");
  if (rules.require_affiliate_url && !input.hasAffiliateUrl) reasons.push("AFFILIATE LINK ERROR — no valid affiliate URL.");

  const allowedCategories: string[] = JSON.parse(rules.allowed_categories_json);
  if (allowedCategories.length > 0 && input.category && !allowedCategories.includes(input.category)) {
    reasons.push(`Category "${input.category}" not in allowed list.`);
  }

  const allowedCountries: string[] = JSON.parse(rules.allowed_countries_json);
  if (allowedCountries.length > 0 && input.country && !allowedCountries.includes(input.country)) {
    reasons.push(`Country "${input.country}" not in allowed list.`);
  }

  if (input.lastPostedAgoHours != null && input.lastPostedAgoHours < rules.repost_cooldown_hours) {
    reasons.push(`Reposted too recently (${input.lastPostedAgoHours.toFixed(1)}h ago, cooldown ${rules.repost_cooldown_hours}h).`);
  }

  return { passes: reasons.length === 0, reasons };
}
