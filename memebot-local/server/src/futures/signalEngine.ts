import { getKlines, getOrderbook, getLatestFundingRate, getOpenInterestHistory, getTicker, type Candle } from "../bybit/marketData.js";
import type { BybitMode } from "../bybit/client.js";
import {
  atr,
  ema,
  hasBearishRsiDivergence,
  hasBullishRsiDivergence,
  isBullishConfirmationCandle,
  isEmaFlatteningOrUpward,
  isMakingLowerHighsLowerLows,
  last,
  rollingLow,
  rsi,
  stddevOfReturns,
  stochRsi,
} from "./indicators.js";
import { checkBtcVolatilityShock } from "./btcRisk.js";
import { getFearGreedIndex } from "./fearGreed.js";
import type { FuturesStrategyConfig } from "./schema.js";
import type { TakeProfitPlan, SignalSide } from "./repository.js";

export interface Stage1Candidate {
  symbol: string;
  side: SignalSide;
  entryPrice: number;
  stopLoss: number;
  takeProfits: TakeProfitPlan[];
  score: number;
  details: Record<string, unknown>;
}

export interface Stage1Rejection {
  symbol: string;
  reason: string;
}

const MIN_CANDLES_FOR_EMA200 = 210;

/**
 * Stage 1 for a single symbol: every filter is a direct translation of one
 * numbered line from the user's strategy spec. Returns null (with a logged
 * reason via the caller) if any hard filter fails — this function never
 * throws for "just didn't qualify", only for real fetch failures.
 */
export async function scanSymbolStage1(symbol: string, config: FuturesStrategyConfig, mode: BybitMode): Promise<Stage1Candidate | Stage1Rejection> {
  const candles = await getKlines(symbol, 30, Math.max(config.minCompletedCandles + 10, MIN_CANDLES_FOR_EMA200), mode);
  if (candles.length < config.minCompletedCandles) {
    return { symbol, reason: `Only ${candles.length} completed 30m candles, need ${config.minCompletedCandles}.` };
  }

  const closes = candles.map((c) => c.close);
  const atrSeries = atr(candles, 14);
  const rsiSeries = rsi(closes, 14);
  const stoch = stochRsi(closes, 14, 14, 3, 3);
  const stddevSeries = stddevOfReturns(closes, 30);
  const rollingLow48 = rollingLow(candles, 48);
  const ema200 = candles.length >= 200 ? ema(closes, 200) : new Array(candles.length).fill(NaN);

  const current = last(candles) as Candle;
  const currentAtr = last(atrSeries);
  const currentRsi = last(rsiSeries);
  const currentStddev = last(stddevSeries);
  const currentLow48 = last(rollingLow48);
  const currentEma200 = last(ema200);
  const k = last(stoch.k);
  const d = last(stoch.d);

  if (currentAtr === undefined || Number.isNaN(currentAtr) || currentAtr <= 0) {
    return { symbol, reason: "ATR not yet computable." };
  }

  // 2. Skip conditions
  const atrOverClose = currentAtr / current.close;
  if (atrOverClose > config.atrOverCloseMax) {
    return { symbol, reason: `ATR/Close ${atrOverClose.toFixed(4)} exceeds max ${config.atrOverCloseMax}.` };
  }
  if (currentStddev !== undefined && !Number.isNaN(currentStddev) && currentStddev > config.stddev30Max) {
    return { symbol, reason: `30-period stddev ${currentStddev.toFixed(4)} exceeds max ${config.stddev30Max}.` };
  }
  const latestRange = current.high - current.low;
  if (latestRange > currentAtr * config.latestRangeAtrMultMax) {
    return { symbol, reason: `Latest candle range ${latestRange.toFixed(4)} exceeds ${config.latestRangeAtrMultMax}x ATR.` };
  }

  // 3. Liquidity filters
  const ticker = await getTicker(symbol, mode);
  if (!ticker) return { symbol, reason: "No ticker data." };
  if (ticker.turnover24h < config.min24hTurnoverUsd) {
    return { symbol, reason: `24h turnover $${ticker.turnover24h.toFixed(0)} below min $${config.min24hTurnoverUsd}.` };
  }
  const last20Volumes = candles.slice(-21, -1).map((c) => c.volume);
  const avgVolume = last20Volumes.length > 0 ? last20Volumes.reduce((a, b) => a + b, 0) / last20Volumes.length : 0;
  if (avgVolume <= 0 || current.volume < avgVolume * config.volumeSpikeMultiplier) {
    return { symbol, reason: `30m volume ${current.volume.toFixed(2)} below ${config.volumeSpikeMultiplier}x 20-candle average ${avgVolume.toFixed(2)}.` };
  }
  const spreadPct = ticker.bid1Price > 0 ? ((ticker.ask1Price - ticker.bid1Price) / ticker.bid1Price) * 100 : Infinity;
  if (spreadPct > config.maxSpreadPct) {
    return { symbol, reason: `Spread ${spreadPct.toFixed(3)}% exceeds max ${config.maxSpreadPct}%.` };
  }

  // 4. Entry zone
  if (currentLow48 === undefined || Number.isNaN(currentLow48)) {
    return { symbol, reason: "48-period rolling low not yet computable." };
  }
  const zoneUpper = currentLow48 * config.entryZoneUpperMult;
  const zoneLower = currentLow48 * config.entryZoneLowerMult;
  if (!(current.close <= zoneUpper && current.close >= zoneLower)) {
    return { symbol, reason: `Close ${current.close} outside entry zone [${zoneLower.toFixed(6)}, ${zoneUpper.toFixed(6)}].` };
  }

  // 5. Trend filter
  const aboveEma200 = currentEma200 !== undefined && !Number.isNaN(currentEma200) && current.close > currentEma200;
  const emaFlatteningUp = isEmaFlatteningOrUpward(ema200, 5);
  if (!aboveEma200 && !emaFlatteningUp) {
    return { symbol, reason: "Price below 200 EMA and 200 EMA is not flattening/upward." };
  }
  const hourlyCandles = await getKlines(symbol, 60, 60, mode);
  if (isMakingLowerHighsLowerLows(hourlyCandles, 30)) {
    return { symbol, reason: "1H market structure making lower highs and lower lows." };
  }

  // 6. Stochastic RSI
  if (k === undefined || d === undefined || Number.isNaN(k) || Number.isNaN(d)) {
    return { symbol, reason: "Stochastic RSI not yet computable." };
  }
  if (!(k >= d)) return { symbol, reason: `StochRSI K (${k.toFixed(1)}) below D (${d.toFixed(1)}).` };
  if (k > config.stochRsiKMax) return { symbol, reason: `StochRSI K (${k.toFixed(1)}) exceeds max ${config.stochRsiKMax}.` };
  const prevK = stoch.k[stoch.k.length - 2];
  const bullishCrossoverBelow30 = prevK !== undefined && !Number.isNaN(prevK) && prevK < d && k >= d && k <= config.stochRsiCrossoverBelow;

  // 7. RSI confirmation
  if (currentRsi === undefined || Number.isNaN(currentRsi) || currentRsi < config.rsiMin || currentRsi > config.rsiMax) {
    return { symbol, reason: `RSI ${currentRsi?.toFixed(1) ?? "n/a"} outside [${config.rsiMin}, ${config.rsiMax}].` };
  }
  const bullishDivergence = hasBullishRsiDivergence(candles, rsiSeries, 20);
  const bullishCandle = isBullishConfirmationCandle(current);
  if (!bullishDivergence && !bullishCandle) {
    return { symbol, reason: "No bullish RSI divergence and no bullish confirmation candle." };
  }

  // 8. Trade setup
  const recentSwingLow = Math.min(...candles.slice(-10).map((c) => c.low));
  const atrStop = current.close - currentAtr * config.slAtrMultiplier;
  const stopLoss = Math.min(recentSwingLow, atrStop); // whichever is wider (further from entry)
  const slDistancePct = ((current.close - stopLoss) / current.close) * 100;
  if (slDistancePct > config.maxStopLossDistancePct) {
    return { symbol, reason: `Stop-loss distance ${slDistancePct.toFixed(2)}% exceeds max ${config.maxStopLossDistancePct}%.` };
  }
  const tp1Price = current.close * (1 + config.tp1Pct / 100);
  const tp2Price = current.close * (1 + config.tp2Pct / 100);
  const tp3InitialPrice = current.close + currentAtr * config.tp3AtrTrailMultiplier * 2; // display-only initial estimate; real TP3 trails
  const riskReward = (tp1Price - current.close) / (current.close - stopLoss);
  if (riskReward < config.minRiskReward) {
    return { symbol, reason: `Risk:Reward ${riskReward.toFixed(2)} below minimum ${config.minRiskReward}.` };
  }

  // 9. Score
  const distanceFromSupportScore = Math.max(0, 1 - (current.close - currentLow48) / currentLow48 / 0.02) * 20;
  const volumeStrengthScore = Math.min(2, current.volume / avgVolume) * 15;
  const divergenceScore = bullishDivergence ? 20 : 0;
  const stochQualityScore = bullishCrossoverBelow30 ? 20 : k <= config.stochRsiCrossoverBelow ? 10 : 5;
  const spreadScore = Math.max(0, (config.maxSpreadPct - spreadPct) / config.maxSpreadPct) * 10;
  const rrScore = Math.min(2, riskReward / config.minRiskReward) * 15;
  const score = distanceFromSupportScore + volumeStrengthScore + divergenceScore + stochQualityScore + spreadScore + rrScore;

  const takeProfits: TakeProfitPlan[] = [
    { label: "tp1", price: tp1Price, closePct: config.tp1ClosePct },
    { label: "tp2", price: tp2Price, closePct: config.tp2ClosePct },
    { label: "tp3", price: tp3InitialPrice, closePct: 100 - config.tp1ClosePct - config.tp2ClosePct },
  ];

  return {
    symbol,
    side: "long",
    entryPrice: current.close,
    stopLoss,
    takeProfits,
    score,
    details: {
      atr: currentAtr,
      atrOverClose,
      stddev30: currentStddev,
      rsi: currentRsi,
      stochK: k,
      stochD: d,
      bullishCrossoverBelow30,
      bullishDivergence,
      bullishCandle,
      riskReward,
      spreadPct,
      turnover24h: ticker.turnover24h,
      volumeRatio: current.volume / avgVolume,
    },
  };
}

function isRejection(x: Stage1Candidate | Stage1Rejection): x is Stage1Rejection {
  return (x as Stage1Rejection).reason !== undefined;
}

/** Scans every symbol in the universe and keeps only the single
 * highest-scoring passing setup, per the spec's "Keep only the
 * highest-scoring setup every scan." */
export function pickBestCandidate(results: Array<Stage1Candidate | Stage1Rejection>): Stage1Candidate | null {
  const candidates = results.filter((r): r is Stage1Candidate => !isRejection(r));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.score > best.score ? c : best));
}

export interface Stage2Check {
  name: string;
  passed: boolean;
  detail: string;
}

export interface Stage2Result {
  approved: boolean;
  checks: Stage2Check[];
  blockingReasons: string[];
  positionSizeMultiplier: number;
}

function chk(name: string, passed: boolean, detail: string): Stage2Check {
  return { name, passed, detail };
}

/** Stage 2 — full validation pipeline against the single Stage-1 winner.
 * Every numbered check in the user's "/signal Validation" spec maps to one
 * entry here, in the same order, including the two proxied checks
 * (BTC-volatility-shock standing in for the news/economic-calendar filters
 * the user asked to approximate rather than skip). */
export async function validateSignalStage2(
  candidate: Stage1Candidate,
  config: FuturesStrategyConfig,
  mode: BybitMode,
  context: { pendingSignalsCount: number; hasPendingForSymbol: boolean; activeTradesCount: number },
): Promise<Stage2Result> {
  const checks: Stage2Check[] = [];
  let positionSizeMultiplier = 1;

  checks.push(chk("has_full_setup", true, "Entry, stop-loss and take-profit levels present."));
  checks.push(chk("no_duplicate_pending", !context.hasPendingForSymbol, `A pending/active signal already exists for ${candidate.symbol}.`));
  checks.push(
    chk(
      "max_pending_and_active",
      context.pendingSignalsCount < config.maxPendingSignals && context.activeTradesCount < config.maxActiveTrades,
      `${context.pendingSignalsCount} pending signal(s) (max ${config.maxPendingSignals}), ${context.activeTradesCount} active trade(s) (max ${config.maxActiveTrades}).`,
    ),
  );

  if (config.btcVolatilityShockCheckEnabled) {
    const shock = await checkBtcVolatilityShock(mode);
    checks.push(chk("market_risk_proxy", !shock.flagged, shock.detail));
  }

  const fng = await getFearGreedIndex();
  if (fng) {
    checks.push(chk("fear_greed_floor", fng.value >= config.fearGreedRejectBelow, `Fear & Greed is ${fng.value} (${fng.classification}), reject floor is ${config.fearGreedRejectBelow}.`));
    if (fng.value > config.fearGreedReduceSizeAbove) {
      positionSizeMultiplier = config.fearGreedSizeReductionFactor;
    }
  } else {
    checks.push(chk("fear_greed_floor", true, "Fear & Greed index unavailable — not blocking."));
  }

  const [btc4h, btc1h, btc30m] = await Promise.all([getKlines("BTCUSDT", 240, 60, mode), getKlines("BTCUSDT", 60, 220, mode), getKlines("BTCUSDT", 30, 60, mode)]);

  if (btc4h.length > 20) {
    const btc4hCloses = btc4h.map((c) => c.close);
    const btc4hStoch = stochRsi(btc4hCloses, 14, 14, 3, 3);
    const k = last(btc4hStoch.k);
    const prevK = btc4hStoch.k[btc4hStoch.k.length - 2];
    const d = last(btc4hStoch.d);
    if (k !== undefined && d !== undefined && !Number.isNaN(k) && !Number.isNaN(d)) {
      checks.push(chk("btc_4h_stoch_rsi", k >= d, `BTC 4H StochRSI K (${k.toFixed(1)}) below D (${d.toFixed(1)}).`));
      const crossingDown = prevK !== undefined && !Number.isNaN(prevK) && prevK > config.btcStochRsiOverboughtReject && k < prevK;
      checks.push(chk("btc_4h_not_overbought_crossing_down", !(k > config.btcStochRsiOverboughtReject && crossingDown), `BTC 4H StochRSI K (${k.toFixed(1)}) is overbought and crossing down.`));
    }
    checks.push(chk("btc_4h_no_support_breakdown", !isMakingLowerHighsLowerLows(btc4h, 20), "BTC 4H making lower highs/lower lows — possible major support breakdown."));
    const rsi4h = rsi(btc4hCloses, 14);
    checks.push(chk("btc_4h_rsi_not_overbought", (last(rsi4h) ?? 0) < config.btcRsiOverboughtMax, `BTC 4H RSI ${(last(rsi4h) ?? 0).toFixed(1)} must be below ${config.btcRsiOverboughtMax}.`));
    checks.push(chk("btc_4h_no_bearish_divergence", !hasBearishRsiDivergence(btc4h, rsi4h, 20), "BTC 4H showing bearish RSI divergence."));
  }

  if (btc1h.length > 200) {
    const btc1hCloses = btc1h.map((c) => c.close);
    const ema200_1h = ema(btc1hCloses, 200);
    const ema200_4h = btc4h.length > 200 ? ema(btc4h.map((c) => c.close), 200) : [];
    const below1h = (last(ema200_1h) ?? 0) > 0 && (last(btc1hCloses) ?? 0) < (last(ema200_1h) ?? Infinity);
    const below4h = ema200_4h.length > 0 && (last(btc4h.map((c) => c.close)) ?? 0) < (last(ema200_4h) ?? Infinity);
    checks.push(chk("btc_not_below_both_200ema", !(below1h && below4h), "BTC is below both its 1H and 4H 200 EMA."));
    const rsi1h = rsi(btc1hCloses, 14);
    checks.push(chk("btc_1h_rsi_not_overbought", (last(rsi1h) ?? 0) < config.btcRsiOverboughtMax, `BTC 1H RSI ${(last(rsi1h) ?? 0).toFixed(1)} must be below ${config.btcRsiOverboughtMax}.`));
    checks.push(chk("btc_1h_no_bearish_divergence", !hasBearishRsiDivergence(btc1h, rsi1h, 20), "BTC 1H showing bearish RSI divergence."));
  }

  if (btc30m.length > 20) {
    const btc30mCloses = btc30m.map((c) => c.close);
    const rsi30m = rsi(btc30mCloses, 14);
    checks.push(chk("btc_30m_no_bearish_divergence", !hasBearishRsiDivergence(btc30m, rsi30m, 20), "BTC 30m showing bearish RSI divergence."));
  }

  // 7. Coin validation (re-verified with the freshest 30m data)
  const coinCandles = await getKlines(candidate.symbol, 30, 30, mode);
  if (coinCandles.length > 20) {
    const coinCloses = coinCandles.map((c) => c.close);
    const coinStoch = stochRsi(coinCloses, 14, 14, 3, 3);
    const k = last(coinStoch.k);
    const d = last(coinStoch.d);
    if (k !== undefined && d !== undefined && !Number.isNaN(k) && !Number.isNaN(d)) {
      checks.push(chk("coin_30m_stoch_rsi", k >= d, `${candidate.symbol} 30m StochRSI K below D.`));
    }
    checks.push(chk("coin_latest_candle_bullish", isBullishConfirmationCandle(last(coinCandles) as Candle), `${candidate.symbol} latest 30m candle is not bullish.`));
  }

  // 8. BTC order book
  const btcOrderbook = await getOrderbook("BTCUSDT", 25, mode);
  const bidDepth = btcOrderbook.bids.reduce((s, l) => s + l.size, 0);
  const askDepth = btcOrderbook.asks.reduce((s, l) => s + l.size, 0);
  const askBidRatio = bidDepth > 0 ? askDepth / bidDepth : Infinity;
  checks.push(chk("btc_orderbook_balance", askBidRatio < config.btcOrderbookAskBidRatioMax, `BTC ask/bid depth ratio ${askBidRatio.toFixed(2)} exceeds max ${config.btcOrderbookAskBidRatioMax}.`));

  // 10. Funding & open interest
  const fundingRate = await getLatestFundingRate(candidate.symbol, mode);
  if (fundingRate !== null) {
    checks.push(
      chk("funding_rate_range", fundingRate >= config.fundingRateMinPct && fundingRate <= config.fundingRateMaxPct, `Funding rate ${fundingRate.toFixed(4)}% outside [${config.fundingRateMinPct}%, ${config.fundingRateMaxPct}%].`),
    );
  }
  const oiHistory = await getOpenInterestHistory(candidate.symbol, 100, mode);
  if (oiHistory.length > 5) {
    const avgOi = oiHistory.reduce((s, r) => s + r.openInterest, 0) / oiHistory.length;
    const currentOi = last(oiHistory)?.openInterest ?? 0;
    const oiPctOfAvg = avgOi > 0 ? (currentOi / avgOi) * 100 : 0;
    checks.push(chk("open_interest_buildup", oiPctOfAvg <= config.openInterestVs100dAvgMaxPct, `Open interest is ${oiPctOfAvg.toFixed(1)}% of its ${oiHistory.length}-period average, max ${config.openInterestVs100dAvgMaxPct}%.`));
  }

  // 11. Final validation — entry drift, spread, RR against the current price
  const freshTicker = await getTicker(candidate.symbol, mode);
  if (freshTicker) {
    const driftPct = (Math.abs(freshTicker.lastPrice - candidate.entryPrice) / candidate.entryPrice) * 100;
    checks.push(chk("entry_price_drift", driftPct <= config.entryPriceMaxDriftPct, `Price has moved ${driftPct.toFixed(3)}% since signal, max allowed ${config.entryPriceMaxDriftPct}%.`));
    const freshSpreadPct = freshTicker.bid1Price > 0 ? ((freshTicker.ask1Price - freshTicker.bid1Price) / freshTicker.bid1Price) * 100 : Infinity;
    checks.push(chk("spread_still_acceptable", freshSpreadPct <= config.maxSpreadPct, `Spread widened to ${freshSpreadPct.toFixed(3)}%, max ${config.maxSpreadPct}%.`));
    const tp1 = candidate.takeProfits.find((t) => t.label === "tp1")!;
    const freshRr = (tp1.price - freshTicker.lastPrice) / (freshTicker.lastPrice - candidate.stopLoss);
    checks.push(chk("risk_reward_still_valid", freshRr >= config.minRiskReward, `Risk:Reward dropped to ${freshRr.toFixed(2)}, minimum is ${config.minRiskReward}.`));
  }

  const blockingReasons = checks.filter((c) => !c.passed).map((c) => c.detail);
  return { approved: blockingReasons.length === 0, checks, blockingReasons, positionSizeMultiplier };
}
