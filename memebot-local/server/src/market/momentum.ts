import type { MomentumConfig } from "../lib/settings.js";
import type { TokenSnapshot } from "./types.js";

export type TrendDirection = "bullish" | "bearish" | "neutral";

export interface MomentumScoreInput {
  snapshot: TokenSnapshot;
  /** Nominal-trade-size price impact from a real Jupiter quote/sell-route
   * check. Null skips the execution-quality component entirely rather than
   * guessing a value — see the "never fabricate" engineering requirement. */
  priceImpactPct: number | null;
  /** Highest price this app has observed for this mint in its own stored
   * history. Null if there isn't enough history yet. */
  recentHighUsd: number | null;
}

export interface MomentumComponents {
  priceMomentum: number | null;
  volumeAcceleration: number | null;
  buyPressure: number | null;
  txAcceleration: number | null;
  liquidityQuality: number | null;
  trendStrength: number | null;
  executionQuality: number | null;
}

export interface MomentumScoreResult {
  /** 0-100, weighted average of whichever components had data — weights are
   * renormalized over the available subset, never padded with a fabricated
   * neutral value for missing data. */
  totalScore: number;
  components: MomentumComponents;
  trendDirection: TrendDirection;
  /** True only when at least two timeframe segments were comparable and the
   * more recent one is moving faster than the older one — e.g. +2% (older
   * segment) accelerating into +11% (most recent segment), as opposed to
   * +18% decelerating into +6% (still positive, but dying). */
  momentumAccelerating: boolean;
  /** A large cumulative gain whose most recent segment has clearly slowed
   * or reversed — the "don't become exit liquidity" signal. */
  exhaustionWarning: boolean;
  volumeAccelerating: boolean;
  buyPressureDominant: boolean;
  txAccelerating: boolean;
  /** Share of buys among buys+sells (0-1) at the shortest available window. */
  buySellRatio: number | null;
  distanceFromHighPct: number | null;
  reasons: string[];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

interface NullableTimeWindow {
  minutes: number;
  pct: number | null;
}

interface TimeWindow {
  minutes: number;
  pct: number;
}

/** Every available cumulative-from-now price-change window, shortest
 * first. Windows with no data are dropped, not treated as zero. */
function availableWindows(s: TokenSnapshot): TimeWindow[] {
  const all: NullableTimeWindow[] = [
    { minutes: 1, pct: s.priceChange1mPct },
    { minutes: 5, pct: s.priceChange5mPct },
    { minutes: 15, pct: s.priceChange15mPct },
    { minutes: 60, pct: s.priceChange1hPct },
    { minutes: 360, pct: s.priceChange6hPct },
    { minutes: 1440, pct: s.priceChange24hPct },
  ];
  return all.filter((w): w is TimeWindow => w.pct !== null);
}

/** Average per-minute pace of each available cumulative-from-now window
 * (its own % change divided by its own duration) — comparing the shortest
 * window's pace against a longer window's pace is what lets us tell
 * "accelerating" (recent pace faster than the longer-run average) apart
 * from "decelerating" (recent pace has fallen well behind the longer-run
 * average, even though the cumulative total is still positive), instead of
 * just reading the raw cumulative percentage on its own. */
function windowRatesPerMinute(windows: TimeWindow[]): number[] {
  return windows.map((w) => w.pct / w.minutes); // windows sorted shortest-first, so rates[0] is the most recent/shortest window
}

const SCALE_BY_WINDOW: Record<number, number> = { 1: 25, 5: 10, 15: 5, 60: 2, 360: 0.6, 1440: 0.25 };

function priceMomentumComponent(s: TokenSnapshot, recentHighUsd: number | null): {
  score: number | null;
  trendDirection: TrendDirection;
  momentumAccelerating: boolean;
  exhaustionWarning: boolean;
  distanceFromHighPct: number | null;
  reasons: string[];
} {
  const windows = availableWindows(s);
  const reasons: string[] = [];

  if (windows.length === 0) {
    return { score: null, trendDirection: "neutral", momentumAccelerating: false, exhaustionWarning: false, distanceFromHighPct: null, reasons: ["No price-change data available."] };
  }

  const shortest = windows[0] as TimeWindow;
  const scale = SCALE_BY_WINDOW[shortest.minutes] ?? 1;
  let score = clamp(50 + shortest.pct * scale, 0, 100);
  reasons.push(`Shortest-window (${shortest.minutes}m) change is ${shortest.pct.toFixed(2)}%.`);

  const rates = windowRatesPerMinute(windows);
  let momentumAccelerating = false;
  let exhaustionWarning = false;
  if (rates.length >= 2) {
    const recentRate = rates[0] as number;
    const olderRate = rates[rates.length - 1] as number;
    if (recentRate > olderRate && recentRate > 0) {
      momentumAccelerating = true;
      score = clamp(score + 15, 0, 100);
      reasons.push(`Accelerating: recent pace (${recentRate.toFixed(3)}%/min) is faster than the longer-run average pace (${olderRate.toFixed(3)}%/min).`);
    } else if (olderRate > 0 && recentRate < olderRate * 0.5) {
      score = clamp(score - 15, 0, 100);
      reasons.push(`Decelerating: recent pace (${recentRate.toFixed(3)}%/min) has slowed well below the longer-run average pace (${olderRate.toFixed(3)}%/min).`);
      const cumulativeLongest = windows[windows.length - 1] as TimeWindow;
      if (cumulativeLongest.pct > 40 && recentRate <= olderRate * 0.3) {
        exhaustionWarning = true;
        score = clamp(score - 20, 0, 100);
        reasons.push(`Exhaustion warning: cumulative ${cumulativeLongest.minutes}m gain is ${cumulativeLongest.pct.toFixed(0)}% but momentum has nearly stalled — risk of becoming exit liquidity for an earlier move.`);
      }
    }
  }

  let distanceFromHighPct: number | null = null;
  if (recentHighUsd !== null && recentHighUsd > 0 && s.priceUsd !== null) {
    distanceFromHighPct = ((s.priceUsd - recentHighUsd) / recentHighUsd) * 100;
    if (distanceFromHighPct >= -0.5) {
      score = clamp(score + 8, 0, 100);
      reasons.push("Trading at or near its recent high — breakout/continuation, not a bounce off a fading peak.");
    }
  }

  const trendDirection: TrendDirection = shortest.pct > 0.5 ? "bullish" : shortest.pct < -0.5 ? "bearish" : "neutral";

  return { score, trendDirection, momentumAccelerating, exhaustionWarning, distanceFromHighPct, reasons };
}

/** Rate-of-accumulation acceleration for a metric (volume USD or tx count)
 * that DexScreener reports as cumulative-from-now totals per window (not
 * deltas) — same nested-segment technique as price, but for a summable
 * quantity instead of a percentage. */
function accelerationRatio(fastTotal: number, fastMinutes: number, slowTotal: number, slowMinutes: number): number | null {
  if (slowMinutes <= fastMinutes || slowTotal < fastTotal) return null;
  const fastRate = fastTotal / fastMinutes;
  const olderSegmentTotal = slowTotal - fastTotal;
  const olderSegmentMinutes = slowMinutes - fastMinutes;
  const olderRate = olderSegmentTotal / olderSegmentMinutes;
  if (olderRate <= 0) return fastRate > 0 ? 2 : null; // no older activity at all but recent activity exists — treat as strongly accelerating
  return fastRate / olderRate;
}

function volumeAccelerationComponent(s: TokenSnapshot): { score: number | null; accelerating: boolean; reasons: string[] } {
  const pairs: Array<[number, number, number, number]> = [];
  if (s.volume5mUsd !== null && s.volume1hUsd !== null) pairs.push([s.volume5mUsd, 5, s.volume1hUsd, 60]);
  if (s.volume1hUsd !== null && s.volume6hUsd !== null) pairs.push([s.volume1hUsd, 60, s.volume6hUsd, 360]);
  if (s.volume6hUsd !== null && s.volume24hUsd !== null) pairs.push([s.volume6hUsd, 360, s.volume24hUsd, 1440]);

  const weights = [0.6, 0.3, 0.1];
  let weightedRatioSum = 0;
  let weightUsed = 0;
  const reasons: string[] = [];
  pairs.forEach(([fastTotal, fastMin, slowTotal, slowMin], i) => {
    const ratio = accelerationRatio(fastTotal, fastMin, slowTotal, slowMin);
    if (ratio === null) return;
    const w = weights[i] ?? 0.1;
    weightedRatioSum += ratio * w;
    weightUsed += w;
    reasons.push(`Volume pace ${fastMin}m-vs-${slowMin}m ratio: ${ratio.toFixed(2)}x.`);
  });

  if (weightUsed === 0) return { score: null, accelerating: false, reasons: ["No comparable volume windows available."] };
  const ratio = weightedRatioSum / weightUsed;
  const score = clamp(50 + (ratio - 1) * 50, 0, 100);
  return { score, accelerating: ratio > 1.2, reasons };
}

function buyPressureComponent(s: TokenSnapshot): { score: number | null; ratio: number | null; dominant: boolean; reasons: string[] } {
  function ratioOf(buys: number | null, sells: number | null): number | null {
    if (buys === null || sells === null || buys + sells === 0) return null;
    return buys / (buys + sells);
  }
  const r5m = ratioOf(s.buys5m, s.sells5m);
  const r1h = ratioOf(s.buys1h, s.sells1h);

  let ratio: number | null = null;
  const reasons: string[] = [];
  if (r5m !== null && r1h !== null) {
    ratio = r5m * 0.7 + r1h * 0.3;
    reasons.push(`Buy ratio 5m=${(r5m * 100).toFixed(0)}%, 1h=${(r1h * 100).toFixed(0)}%.`);
  } else if (r5m !== null) {
    ratio = r5m;
    reasons.push(`Buy ratio 5m=${(r5m * 100).toFixed(0)}%.`);
  } else if (r1h !== null) {
    ratio = r1h;
    reasons.push(`Buy ratio 1h=${(r1h * 100).toFixed(0)}%.`);
  } else {
    reasons.push("No buy/sell transaction data available.");
  }

  if (ratio === null) return { score: null, ratio: null, dominant: false, reasons };
  return { score: clamp(ratio * 100, 0, 100), ratio, dominant: ratio > 0.55, reasons };
}

function txAccelerationComponent(s: TokenSnapshot): { score: number | null; accelerating: boolean; reasons: string[] } {
  const tx5m = s.buys5m !== null && s.sells5m !== null ? s.buys5m + s.sells5m : null;
  const tx1h = s.buys1h !== null && s.sells1h !== null ? s.buys1h + s.sells1h : null;
  const tx6h = s.buys6h !== null && s.sells6h !== null ? s.buys6h + s.sells6h : null;

  const pairs: Array<[number, number, number, number]> = [];
  if (tx5m !== null && tx1h !== null) pairs.push([tx5m, 5, tx1h, 60]);
  if (tx1h !== null && tx6h !== null) pairs.push([tx1h, 60, tx6h, 360]);

  const weights = [0.7, 0.3];
  let weightedSum = 0;
  let weightUsed = 0;
  const reasons: string[] = [];
  pairs.forEach(([fastTotal, fastMin, slowTotal, slowMin], i) => {
    const ratio = accelerationRatio(fastTotal, fastMin, slowTotal, slowMin);
    if (ratio === null) return;
    const w = weights[i] ?? 0.3;
    weightedSum += ratio * w;
    weightUsed += w;
    reasons.push(`Tx pace ${fastMin}m-vs-${slowMin}m ratio: ${ratio.toFixed(2)}x.`);
  });

  if (weightUsed === 0) return { score: null, accelerating: false, reasons: ["No comparable transaction-count windows available."] };
  const ratio = weightedSum / weightUsed;
  return { score: clamp(50 + (ratio - 1) * 50, 0, 100), accelerating: ratio > 1.2, reasons };
}

function liquidityQualityComponent(s: TokenSnapshot): { score: number | null; reasons: string[] } {
  if (s.liquidityUsd === null || s.liquidityUsd <= 0) return { score: null, reasons: ["No liquidity data available."] };
  let score = clamp((Math.log10(Math.max(s.liquidityUsd, 1)) - 3) * 25, 0, 100);
  const reasons = [`Liquidity is $${Math.round(s.liquidityUsd).toLocaleString()}.`];

  if (s.marketCapUsd !== null && s.marketCapUsd > 0) {
    const ratio = s.liquidityUsd / s.marketCapUsd;
    if (ratio < 0.02) {
      score = clamp(score - 15, 0, 100);
      reasons.push(`Liquidity is only ${(ratio * 100).toFixed(1)}% of market cap — thin relative to float.`);
    } else if (ratio > 0.15) {
      score = clamp(score + 10, 0, 100);
      reasons.push(`Liquidity is a healthy ${(ratio * 100).toFixed(1)}% of market cap.`);
    }
  }
  return { score, reasons };
}

function trendStrengthComponent(s: TokenSnapshot): { score: number | null; reasons: string[] } {
  const windows = availableWindows(s);
  if (windows.length === 0) return { score: null, reasons: ["No price-change data available."] };
  if (windows.length === 1) return { score: 50, reasons: ["Only one timeframe available — not enough to confirm trend consistency."] };

  const shortestSign = Math.sign((windows[0] as TimeWindow).pct);
  const agree = windows.filter((w) => Math.sign(w.pct) === shortestSign || w.pct === 0).length;
  const score = clamp((agree / windows.length) * 100, 0, 100);
  return { score, reasons: [`${agree}/${windows.length} available timeframes agree with the current direction.`] };
}

function executionQualityComponent(priceImpactPct: number | null): { score: number | null; reasons: string[] } {
  if (priceImpactPct === null) return { score: null, reasons: ["No fresh price-impact check available."] };
  const score = clamp(100 - priceImpactPct * 15, 0, 100);
  return { score, reasons: [`Estimated price impact for a nominal trade: ${priceImpactPct.toFixed(2)}%.`] };
}

/**
 * Computes the 0-100 momentum opportunity score from already-fetched market
 * data. Pure function — no network calls — so it's deterministic and
 * unit-testable like the rest of the entry/exit evaluators. Any component
 * whose underlying data is unavailable is excluded from the score entirely
 * (weights renormalized over what's left) rather than defaulted to a
 * fabricated neutral value.
 */
export function computeMomentumScore(input: MomentumScoreInput, config: MomentumConfig): MomentumScoreResult {
  const { snapshot } = input;
  const price = priceMomentumComponent(snapshot, input.recentHighUsd);
  const volume = volumeAccelerationComponent(snapshot);
  const buyPressure = buyPressureComponent(snapshot);
  const tx = txAccelerationComponent(snapshot);
  const liquidity = liquidityQualityComponent(snapshot);
  const trend = trendStrengthComponent(snapshot);
  const execution = executionQualityComponent(input.priceImpactPct);

  const weighted: Array<[number | null, number]> = [
    [price.score, config.weightPriceMomentum],
    [volume.score, config.weightVolumeAcceleration],
    [buyPressure.score, config.weightBuyPressure],
    [tx.score, config.weightTxAcceleration],
    [liquidity.score, config.weightLiquidityQuality],
    [trend.score, config.weightTrendStrength],
    [execution.score, config.weightExecutionQuality],
  ];
  let weightSum = 0;
  let scoreSum = 0;
  for (const [score, weight] of weighted) {
    if (score === null) continue;
    weightSum += weight;
    scoreSum += score * weight;
  }
  const totalScore = weightSum > 0 ? clamp(scoreSum / weightSum, 0, 100) : 0;

  const reasons = [...price.reasons, ...volume.reasons, ...buyPressure.reasons, ...tx.reasons, ...liquidity.reasons, ...trend.reasons, ...execution.reasons];

  return {
    totalScore: Math.round(totalScore * 10) / 10,
    components: {
      priceMomentum: price.score,
      volumeAcceleration: volume.score,
      buyPressure: buyPressure.score,
      txAcceleration: tx.score,
      liquidityQuality: liquidity.score,
      trendStrength: trend.score,
      executionQuality: execution.score,
    },
    trendDirection: price.trendDirection,
    momentumAccelerating: price.momentumAccelerating,
    exhaustionWarning: price.exhaustionWarning,
    volumeAccelerating: volume.accelerating,
    buyPressureDominant: buyPressure.dominant,
    txAccelerating: tx.accelerating,
    buySellRatio: buyPressure.ratio,
    distanceFromHighPct: price.distanceFromHighPct,
    reasons,
  };
}

/** Highest observed price for a mint from its stored snapshot history —
 * real observations only, used for distance-from-high / exhaustion
 * detection. Null when there's no history yet. */
export function computeRecentHigh(history: Array<{ priceUsd: number | null }>): number | null {
  let high: number | null = null;
  for (const point of history) {
    if (point.priceUsd === null) continue;
    if (high === null || point.priceUsd > high) high = point.priceUsd;
  }
  return high;
}
