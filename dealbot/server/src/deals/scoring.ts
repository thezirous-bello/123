import { db } from "../db/index.js";

export type StatusLabel = "reject" | "weak" | "good" | "very_good" | "excellent";

export interface ScoreThresholds {
  reject: number;
  weak: number;
  good: number;
  veryGood: number;
  excellent: number;
}

const DEFAULT_THRESHOLDS: ScoreThresholds = { reject: 0, weak: 50, good: 65, veryGood: 75, excellent: 85 };

/** Configurable via the settings table (spec: "make thresholds
 * configurable") — falls back to the spec's own example ranges when unset. */
export function getScoreThresholds(): ScoreThresholds {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'score_thresholds'").get() as { value: string } | undefined;
  if (!row) return DEFAULT_THRESHOLDS;
  try {
    return { ...DEFAULT_THRESHOLDS, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export function labelForScore(score: number, thresholds = getScoreThresholds()): StatusLabel {
  if (score >= thresholds.excellent) return "excellent";
  if (score >= thresholds.veryGood) return "very_good";
  if (score >= thresholds.good) return "good";
  if (score >= thresholds.weak) return "weak";
  return "reject";
}

export interface ScoreInput {
  discountPct: number | null;
  dealConfidence: number;
  rating: number | null;
  reviewCount: number | null;
  availability: string;
  /** How many other merchant offers exist for the same product — 0 means
   * no comparison was possible. */
  competingOfferCount: number;
  isPriceLowestAmongOffers: boolean;
  commissionPct: number | null;
  currentPrice: number;
}

export interface ScoreResult {
  dealScore: number;
  profitScore: number;
  estimatedCommission: string | null;
  statusLabel: StatusLabel;
  breakdown: Record<string, number>;
}

/** Both scores are transparent weighted sums, not a black box — every
 * component in `breakdown` is a real input, nothing here is randomized or
 * invented. Deal Score answers "is this a good deal for the buyer";
 * Profit Score answers "is this worth prioritizing for revenue" — a
 * cheap product with high confidence can out-score-for-deal a pricier one,
 * while the pricier one with real commission still wins on profit, per
 * the spec's own €900/€40-commission example. */
export function scoreOffer(input: ScoreInput): ScoreResult {
  const discountComponent = (Math.min(input.discountPct ?? 0, 40) / 40) * 30;
  const confidenceComponent = (input.dealConfidence / 100) * 25;
  const ratingComponent = input.rating != null ? (Math.min(input.rating, 5) / 5) * 15 : 0;
  const reviewComponent = input.reviewCount != null ? (Math.min(input.reviewCount, 5000) / 5000) * 10 : 0;
  const priceCompetitivenessComponent =
    input.competingOfferCount === 0 ? 5 : input.isPriceLowestAmongOffers ? 10 : 2;
  const availabilityComponent = input.availability === "in_stock" ? 5 : input.availability === "unknown" ? 2 : 0;
  const commissionBonusComponent = input.commissionPct != null ? (Math.min(input.commissionPct, 10) / 10) * 5 : 0;

  const dealScore = Math.round(
    discountComponent + confidenceComponent + ratingComponent + reviewComponent + priceCompetitivenessComponent + availabilityComponent + commissionBonusComponent,
  );

  const estimatedCommissionAmount = input.commissionPct != null ? (input.currentPrice * input.commissionPct) / 100 : null;

  const commissionPctComponent = input.commissionPct != null ? (Math.min(input.commissionPct, 15) / 15) * 35 : 0;
  const commissionAmountComponent = estimatedCommissionAmount != null ? (Math.min(estimatedCommissionAmount, 50) / 50) * 30 : 0;
  const dealQualityCarryover = (dealScore / 100) * 15;
  // No performance-learning history exists yet in V1 (spec section 17) — a
  // neutral half-credit, not a fabricated "we've seen this convert well".
  const categoryHistoryComponent = 10;

  const profitScore = Math.round(commissionPctComponent + commissionAmountComponent + dealQualityCarryover + categoryHistoryComponent);

  return {
    dealScore: Math.max(0, Math.min(100, dealScore)),
    profitScore: Math.max(0, Math.min(100, profitScore)),
    estimatedCommission: estimatedCommissionAmount != null ? estimatedCommissionAmount.toFixed(2) : null,
    statusLabel: labelForScore(dealScore),
    breakdown: {
      discountComponent: round1(discountComponent),
      confidenceComponent: round1(confidenceComponent),
      ratingComponent: round1(ratingComponent),
      reviewComponent: round1(reviewComponent),
      priceCompetitivenessComponent: round1(priceCompetitivenessComponent),
      availabilityComponent: round1(availabilityComponent),
      commissionBonusComponent: round1(commissionBonusComponent),
      commissionPctComponent: round1(commissionPctComponent),
      commissionAmountComponent: round1(commissionAmountComponent),
      dealQualityCarryover: round1(dealQualityCarryover),
      categoryHistoryComponent: round1(categoryHistoryComponent),
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
