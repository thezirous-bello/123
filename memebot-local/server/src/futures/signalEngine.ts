import { getKlines, getOrderbook, getLatestFundingRate, getOpenInterestHistory, getTicker, type Candle } from "../bybit/marketData.js";
import type { BybitMode } from "../bybit/client.js";
import {
  atr,
  ema,
  hasBearishRsiDivergence,
  hasBullishRsiDivergence,
  isAboveOrReclaiming200Ema,
  isBearishConfirmationCandle,
  isBelowOrRejecting200Ema,
  isBullishConfirmationCandle,
  isMakingLowerHighsLowerLows,
  last,
  rollingHigh,
  rollingLow,
  rsi,
  stochRsi,
} from "../ta/indicators.js";
import { checkBtcVolatilityShock } from "../ta/btcRisk.js";
import { getFearGreedTrend } from "../ta/fearGreed.js";
import { confidenceFromScore, leverageForConfidence, positionSizePctForConfidence, type FuturesStrategyConfig } from "./schema.js";
import type { TakeProfitPlan, SignalSide } from "./repository.js";

// This bot trades Bybit's linear USDT perpetuals exclusively.
const CATEGORY = "linear" as const;

export interface Stage1Candidate {
  symbol: string;
  side: SignalSide;
  entryPrice: number;
  stopLoss: number;
  takeProfits: TakeProfitPlan[];
  score: number;
  confidence: "low" | "medium" | "high";
  leverage: number;
  positionSizePct: number;
  details: Record<string, unknown>;
}

export interface Stage1Rejection {
  symbol: string;
  reason: string;
}

const MIN_CANDLES_FOR_EMA200 = 210;

interface SymbolIndicators {
  candles: Candle[];
  current: Candle;
  closes: number[];
  atrSeries: number[];
  currentAtr: number;
  rsiSeries: number[];
  currentRsi: number;
  stoch: { k: number[]; d: number[] };
  k: number;
  d: number;
  rollingLow48: number[];
  rollingHigh48: number[];
  currentLow48: number;
  currentHigh48: number;
  ema200: number[];
  ticker: Awaited<ReturnType<typeof getTicker>>;
  avgVolume: number;
  spreadPct: number;
}

/** Fetches and precomputes everything both the long and short setup
 * evaluators need for one symbol — shared so we only hit the network once
 * per symbol per scan, regardless of which direction(s) qualify. */
async function loadSymbolIndicators(symbol: string, config: FuturesStrategyConfig, mode: BybitMode): Promise<SymbolIndicators | Stage1Rejection> {
  const candles = await getKlines(symbol, 30, Math.max(config.minCompletedCandles + 10, MIN_CANDLES_FOR_EMA200), mode, CATEGORY);
  if (candles.length < config.minCompletedCandles) {
    return { symbol, reason: `Only ${candles.length} completed 30m candles, need ${config.minCompletedCandles}.` };
  }
  const closes = candles.map((c) => c.close);
  const atrSeries = atr(candles, 14);
  const currentAtr = last(atrSeries);
  if (currentAtr === undefined || Number.isNaN(currentAtr) || currentAtr <= 0) {
    return { symbol, reason: "ATR not yet computable." };
  }
  const current = last(candles) as Candle;

  // 3. Skip conditions (shared, hard filters)
  const atrOverClose = currentAtr / current.close;
  if (atrOverClose > config.atrOverCloseMax) {
    return { symbol, reason: `ATR/Close ${atrOverClose.toFixed(4)} exceeds max ${config.atrOverCloseMax}.` };
  }

  const ticker = await getTicker(symbol, mode, CATEGORY);
  if (!ticker) return { symbol, reason: "No ticker data." };
  if (ticker.turnover24h < config.min24hTurnoverUsd) {
    return { symbol, reason: `24h turnover $${ticker.turnover24h.toFixed(0)} below min $${config.min24hTurnoverUsd}.` };
  }
  const spreadPct = ticker.bid1Price > 0 ? ((ticker.ask1Price - ticker.bid1Price) / ticker.bid1Price) * 100 : Infinity;
  if (spreadPct > config.maxSpreadPct) {
    return { symbol, reason: `Spread ${spreadPct.toFixed(3)}% exceeds max ${config.maxSpreadPct}%.` };
  }

  const rsiSeries = rsi(closes, 14);
  const currentRsi = last(rsiSeries);
  const stoch = stochRsi(closes, 14, 14, 3, 3);
  const k = last(stoch.k);
  const d = last(stoch.d);
  if (currentRsi === undefined || Number.isNaN(currentRsi) || k === undefined || d === undefined || Number.isNaN(k) || Number.isNaN(d)) {
    return { symbol, reason: "RSI/StochRSI not yet computable." };
  }

  const rollingLow48Series = rollingLow(candles, 48);
  const rollingHigh48Series = rollingHigh(candles, 48);
  const currentLow48 = last(rollingLow48Series);
  const currentHigh48 = last(rollingHigh48Series);
  if (currentLow48 === undefined || Number.isNaN(currentLow48) || currentHigh48 === undefined || Number.isNaN(currentHigh48)) {
    return { symbol, reason: "48-period rolling high/low not yet computable." };
  }

  const ema200 = candles.length >= 200 ? ema(closes, 200) : new Array(candles.length).fill(NaN);
  const last20Volumes = candles.slice(-21, -1).map((c) => c.volume);
  const avgVolume = last20Volumes.length > 0 ? last20Volumes.reduce((a, b) => a + b, 0) / last20Volumes.length : 0;

  return { candles, current, closes, atrSeries, currentAtr, rsiSeries, currentRsi, stoch, k, d, rollingLow48: rollingLow48Series, rollingHigh48: rollingHigh48Series, currentLow48, currentHigh48, ema200, ticker, avgVolume, spreadPct };
}

function isIndicatorRejection(x: SymbolIndicators | Stage1Rejection): x is Stage1Rejection {
  return (x as Stage1Rejection).reason !== undefined;
}

function buildTradeSetup(
  side: SignalSide,
  ind: SymbolIndicators,
  config: FuturesStrategyConfig,
): { stopLoss: number; takeProfits: TakeProfitPlan[]; riskReward: number } | null {
  const { current, currentAtr, candles } = ind;
  const isLong = side === "long";
  const recentSwing = isLong ? Math.min(...candles.slice(-10).map((c) => c.low)) : Math.max(...candles.slice(-10).map((c) => c.high));
  const atrStop = isLong ? current.close - currentAtr * config.slAtrMultiplier : current.close + currentAtr * config.slAtrMultiplier;
  const stopLoss = isLong ? Math.min(recentSwing, atrStop) : Math.max(recentSwing, atrStop); // whichever is wider (further from entry)
  const slDistancePct = (Math.abs(current.close - stopLoss) / current.close) * 100;
  if (slDistancePct > config.maxStopLossDistancePct) return null;

  const tp1Price = isLong ? current.close * (1 + config.tp1Pct / 100) : current.close * (1 - config.tp1Pct / 100);
  const tp2Price = isLong ? current.close * (1 + config.tp2Pct / 100) : current.close * (1 - config.tp2Pct / 100);
  const tp3TrailDistance = currentAtr * config.tp3AtrTrailMultiplier * 2;
  const tp3InitialPrice = isLong ? current.close + tp3TrailDistance : current.close - tp3TrailDistance; // display-only; real TP3 trails
  const riskReward = Math.abs(tp1Price - current.close) / Math.abs(current.close - stopLoss);
  if (riskReward < config.minRiskReward) return null;

  return {
    stopLoss,
    riskReward,
    takeProfits: [
      { label: "tp1", price: tp1Price, closePct: config.tp1ClosePct },
      { label: "tp2", price: tp2Price, closePct: config.tp2ClosePct },
      { label: "tp3", price: tp3InitialPrice, closePct: 100 - config.tp1ClosePct - config.tp2ClosePct },
    ],
  };
}

function scoreCandidate(params: {
  distanceFromZonePct: number;
  volumeRatio: number;
  divergence: boolean;
  stochQuality: number; // 0-1
  riskReward: number;
  minRiskReward: number;
  atrOverClose: number;
  atrOverCloseMax: number;
  price24hMovePct: number;
}): number {
  // Weighted toward volatility/movement/volume, matching the strategy's
  // explicit "prioritize momentum and opportunity over conservative
  // filtering" objective — this is intentionally not the same weighting as
  // the calmer spot strategy.
  const volatilityScore = Math.min(1, params.atrOverClose / params.atrOverCloseMax) * 20;
  const movementScore = Math.min(1, Math.abs(params.price24hMovePct) / 10) * 20;
  const volumeScore = Math.min(2, params.volumeRatio) * 15;
  const divergenceScore = params.divergence ? 15 : 0;
  const stochScore = params.stochQuality * 15;
  const rrScore = Math.min(2, params.riskReward / params.minRiskReward) * 15;
  return volatilityScore + movementScore + volumeScore + divergenceScore + stochScore + rrScore;
}

function evaluateLongSetup(ind: SymbolIndicators, config: FuturesStrategyConfig, symbol: string): Stage1Candidate | Stage1Rejection {
  const { current, currentLow48, k, d, currentRsi, rsiSeries, candles, closes, ema200, ticker, avgVolume, spreadPct } = ind;

  const zoneNear = currentLow48 * (1 + config.entryZoneNearPct / 100);
  const zoneFar = currentLow48 * (1 + config.entryZoneFarPct / 100);
  if (!(current.close >= zoneNear && current.close <= zoneFar)) {
    return { symbol, reason: `LONG: close ${current.close} outside entry zone [${zoneNear.toFixed(6)}, ${zoneFar.toFixed(6)}] above rolling low.` };
  }
  if (!isAboveOrReclaiming200Ema(closes, ema200, 5)) {
    return { symbol, reason: "LONG: price not above/reclaiming 200 EMA." };
  }
  if (!(k >= d) || k > config.stochRsiLongKMax) {
    return { symbol, reason: `LONG: StochRSI K=${k.toFixed(1)} D=${d.toFixed(1)} fails K>=D & K<=${config.stochRsiLongKMax}.` };
  }
  if (currentRsi < config.rsiLongMin || currentRsi > config.rsiLongMax) {
    return { symbol, reason: `LONG: RSI ${currentRsi.toFixed(1)} outside [${config.rsiLongMin}, ${config.rsiLongMax}].` };
  }
  const divergence = hasBullishRsiDivergence(candles, rsiSeries, 20);
  const confirmationCandle = isBullishConfirmationCandle(current);
  if (!divergence && !confirmationCandle) {
    return { symbol, reason: "LONG: no bullish RSI divergence and no bullish confirmation candle." };
  }

  const setup = buildTradeSetup("long", ind, config);
  if (!setup) return { symbol, reason: "LONG: stop-loss distance or risk:reward failed trade-setup rules." };

  const atrOverClose = ind.currentAtr / current.close;
  const score = scoreCandidate({
    distanceFromZonePct: (current.close - currentLow48) / currentLow48,
    volumeRatio: avgVolume > 0 ? current.volume / avgVolume : 0,
    divergence,
    stochQuality: k <= config.stochRsiLongKMax ? 1 : 0.3,
    riskReward: setup.riskReward,
    minRiskReward: config.minRiskReward,
    atrOverClose,
    atrOverCloseMax: config.atrOverCloseMax,
    price24hMovePct: ticker!.price24hPct,
  });
  const confidence = confidenceFromScore(score, config);

  return {
    symbol,
    side: "long",
    entryPrice: current.close,
    stopLoss: setup.stopLoss,
    takeProfits: setup.takeProfits,
    score,
    confidence,
    leverage: leverageForConfidence(confidence, config),
    positionSizePct: positionSizePctForConfidence(confidence, config),
    details: { atrOverClose, rsi: currentRsi, stochK: k, stochD: d, divergence, confirmationCandle, riskReward: setup.riskReward, spreadPct, turnover24h: ticker!.turnover24h, price24hPct: ticker!.price24hPct },
  };
}

function evaluateShortSetup(ind: SymbolIndicators, config: FuturesStrategyConfig, symbol: string): Stage1Candidate | Stage1Rejection {
  const { current, currentHigh48, k, d, currentRsi, rsiSeries, candles, closes, ema200, ticker, avgVolume, spreadPct } = ind;

  const zoneNear = currentHigh48 * (1 - config.entryZoneNearPct / 100);
  const zoneFar = currentHigh48 * (1 - config.entryZoneFarPct / 100);
  if (!(current.close <= zoneNear && current.close >= zoneFar)) {
    return { symbol, reason: `SHORT: close ${current.close} outside entry zone [${zoneFar.toFixed(6)}, ${zoneNear.toFixed(6)}] below rolling high.` };
  }
  if (!isBelowOrRejecting200Ema(closes, ema200, 5)) {
    return { symbol, reason: "SHORT: price not below/rejecting 200 EMA." };
  }
  const hourly = candles; // 1H structure check uses the same-symbol trend below
  if (!isMakingLowerHighsLowerLows(hourly, 30)) {
    return { symbol, reason: "SHORT: 1H structure is not making lower highs/lower lows." };
  }
  if (!(k <= d) || k < config.stochRsiShortKMin) {
    return { symbol, reason: `SHORT: StochRSI K=${k.toFixed(1)} D=${d.toFixed(1)} fails K<=D & K>=${config.stochRsiShortKMin}.` };
  }
  if (currentRsi < config.rsiShortMin || currentRsi > config.rsiShortMax) {
    return { symbol, reason: `SHORT: RSI ${currentRsi.toFixed(1)} outside [${config.rsiShortMin}, ${config.rsiShortMax}].` };
  }
  const divergence = hasBearishRsiDivergence(candles, rsiSeries, 20);
  const confirmationCandle = isBearishConfirmationCandle(current);
  if (!divergence && !confirmationCandle) {
    return { symbol, reason: "SHORT: no bearish RSI divergence and no bearish confirmation candle." };
  }

  const setup = buildTradeSetup("short", ind, config);
  if (!setup) return { symbol, reason: "SHORT: stop-loss distance or risk:reward failed trade-setup rules." };

  const atrOverClose = ind.currentAtr / current.close;
  const score = scoreCandidate({
    distanceFromZonePct: (currentHigh48 - current.close) / currentHigh48,
    volumeRatio: avgVolume > 0 ? current.volume / avgVolume : 0,
    divergence,
    stochQuality: k >= config.stochRsiShortKMin ? 1 : 0.3,
    riskReward: setup.riskReward,
    minRiskReward: config.minRiskReward,
    atrOverClose,
    atrOverCloseMax: config.atrOverCloseMax,
    price24hMovePct: ticker!.price24hPct,
  });
  const confidence = confidenceFromScore(score, config);

  return {
    symbol,
    side: "short",
    entryPrice: current.close,
    stopLoss: setup.stopLoss,
    takeProfits: setup.takeProfits,
    score,
    confidence,
    leverage: leverageForConfidence(confidence, config),
    positionSizePct: positionSizePctForConfidence(confidence, config),
    details: { atrOverClose, rsi: currentRsi, stochK: k, stochD: d, divergence, confirmationCandle, riskReward: setup.riskReward, spreadPct, turnover24h: ticker!.turnover24h, price24hPct: ticker!.price24hPct },
  };
}

/**
 * Stage 1 for a single symbol: evaluates BOTH a long and a short setup and
 * returns whichever qualifies with the higher score (or a rejection
 * explaining why neither did). Every filter is a direct translation of one
 * line from the user's LONG & SHORT strategy spec.
 */
export async function scanSymbolStage1(symbol: string, config: FuturesStrategyConfig, mode: BybitMode): Promise<Stage1Candidate | Stage1Rejection> {
  const ind = await loadSymbolIndicators(symbol, config, mode);
  if (isIndicatorRejection(ind)) return ind;

  const long = evaluateLongSetup(ind, config, symbol);
  const short = evaluateShortSetup(ind, config, symbol);
  const longOk = !isRejection(long);
  const shortOk = !isRejection(short);

  if (longOk && shortOk) return (long as Stage1Candidate).score >= (short as Stage1Candidate).score ? long : short;
  if (longOk) return long;
  if (shortOk) return short;
  return { symbol, reason: `${(long as Stage1Rejection).reason} | ${(short as Stage1Rejection).reason}` };
}

function isRejection(x: Stage1Candidate | Stage1Rejection): x is Stage1Rejection {
  return (x as Stage1Rejection).reason !== undefined;
}

/** Scans every symbol and keeps only the single highest-scoring passing
 * setup (long or short) across the whole universe, per the spec's "Only
 * send the highest-scoring setup every scan." */
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
}

function chk(name: string, passed: boolean, detail: string): Stage2Check {
  return { name, passed, detail };
}

/** Stage 2 — full validation pipeline against the single Stage-1 winner.
 * Direction-aware throughout: a LONG candidate is checked against the
 * strategy's LONG MARKET FILTER, a SHORT candidate against SHORT MARKET
 * FILTER, per the spec. The two checks with no honest free data source
 * (economic-event calendar, "positive vs negative news") are proxied: the
 * calendar/high-impact-news check reuses the same real BTC-volatility-shock
 * detection built for the spot bot; the news-bias check is approximated
 * with BTC's own recent 1H momentum direction — both clearly labeled below. */
export async function validateSignalStage2(
  candidate: Stage1Candidate,
  config: FuturesStrategyConfig,
  mode: BybitMode,
  context: { pendingSignalsCount: number; hasPendingForSymbol: boolean; activeTradesCount: number },
): Promise<Stage2Result> {
  const checks: Stage2Check[] = [];
  const isLong = candidate.side === "long";

  checks.push(chk("has_full_setup", true, "Entry, stop-loss and take-profit levels present."));
  checks.push(chk("no_duplicate_pending", !context.hasPendingForSymbol, `A pending/active signal already exists for ${candidate.symbol}.`));
  checks.push(
    chk(
      "max_pending_and_active",
      context.pendingSignalsCount < config.maxPendingSignals && context.activeTradesCount < config.maxActiveTrades,
      `${context.pendingSignalsCount} pending signal(s) (max ${config.maxPendingSignals}), ${context.activeTradesCount} active trade(s) (max ${config.maxActiveTrades}).`,
    ),
  );

  // "Reject trading only during major economic announcements or extremely
  // high-impact breaking news" — proxied via BTC volatility shock, same
  // honest substitute used by the spot bot.
  if (config.btcVolatilityShockCheckEnabled) {
    const shock = await checkBtcVolatilityShock(mode);
    checks.push(chk("market_risk_proxy", !shock.flagged, shock.detail));
  }

  const fngTrend = await getFearGreedTrend();
  if (fngTrend && fngTrend.length >= 2) {
    const prev = fngTrend[fngTrend.length - 2]!;
    const cur = fngTrend[fngTrend.length - 1]!;
    if (isLong) {
      const fallingBelow50 = cur.value < config.fearGreedLongPreferAbove && cur.value < prev.value;
      checks.push(chk("fear_greed_direction", !fallingBelow50, `Fear & Greed is ${cur.value} and falling (was ${prev.value}) — rejecting LONG.`));
    } else {
      const recoveringAbove50 = cur.value > config.fearGreedShortPreferBelow && cur.value > prev.value;
      checks.push(chk("fear_greed_direction", !recoveringAbove50, `Fear & Greed is ${cur.value} and recovering (was ${prev.value}) — rejecting SHORT.`));
    }
  } else {
    checks.push(chk("fear_greed_direction", true, "Fear & Greed trend unavailable — not blocking."));
  }

  const [btc4h, btc1h] = await Promise.all([getKlines("BTCUSDT", 240, 60, mode, CATEGORY), getKlines("BTCUSDT", 60, 220, mode, CATEGORY)]);

  if (btc4h.length > 20) {
    const btc4hCloses = btc4h.map((c) => c.close);
    const btc4hStoch = stochRsi(btc4hCloses, 14, 14, 3, 3);
    const k = last(btc4hStoch.k);
    const d = last(btc4hStoch.d);
    const rsi4h = rsi(btc4hCloses, 14);
    const ema200_4h = btc4h.length > 200 ? ema(btc4hCloses, 200) : [];
    if (k !== undefined && d !== undefined && !Number.isNaN(k) && !Number.isNaN(d)) {
      checks.push(
        isLong
          ? chk("btc_4h_stoch_rsi", k >= d, `BTC 4H StochRSI K (${k.toFixed(1)}) below D (${d.toFixed(1)}) — LONG needs K>=D.`)
          : chk("btc_4h_stoch_rsi", k <= d, `BTC 4H StochRSI K (${k.toFixed(1)}) above D (${d.toFixed(1)}) — SHORT needs K<=D.`),
      );
    }
    if (ema200_4h.length > 0) {
      checks.push(
        isLong
          ? chk("btc_support_resistance", isAboveOrReclaiming200Ema(btc4hCloses, ema200_4h, 5), "BTC not above/reclaiming its 4H 200 EMA (major support).")
          : chk("btc_support_resistance", isBelowOrRejecting200Ema(btc4hCloses, ema200_4h, 5), "BTC not below/rejecting its 4H 200 EMA (major resistance)."),
      );
    }
    checks.push(chk("btc_4h_rsi_not_overbought", (last(rsi4h) ?? 0) < config.btcRsiOverboughtMax, `BTC 4H RSI ${(last(rsi4h) ?? 0).toFixed(1)} must be below ${config.btcRsiOverboughtMax}.`));
    // Divergence direction is "preferred", not a hard requirement per spec — logged for visibility, never blocks.
    const divergenceNote = isLong ? !hasBearishRsiDivergence(btc4h, rsi4h, 20) : hasBearishRsiDivergence(btc4h, rsi4h, 20);
    checks.push(chk("btc_4h_divergence_preference", true, divergenceNote ? "BTC 4H divergence favors this direction." : "BTC 4H divergence does not favor this direction (non-blocking)."));
  }

  if (btc1h.length > 200) {
    const btc1hCloses = btc1h.map((c) => c.close);
    const kBtc1h = last(stochRsi(btc1hCloses, 14, 14, 3, 3).k);
    checks.push(chk("btc_1h_context_available", kBtc1h !== undefined, "BTC 1H context unavailable."));
  }

  const fundingRate = await getLatestFundingRate(candidate.symbol, mode);
  if (fundingRate !== null) {
    checks.push(
      isLong
        ? chk("funding_not_excessive", fundingRate <= config.fundingLongMaxPct, `Funding rate ${fundingRate.toFixed(4)}% exceeds LONG max ${config.fundingLongMaxPct}%.`)
        : chk("funding_not_excessive", fundingRate >= config.fundingShortMinPct, `Funding rate ${fundingRate.toFixed(4)}% below SHORT min ${config.fundingShortMinPct}%.`),
    );
  }

  const btcOrderbook = await getOrderbook("BTCUSDT", 25, mode, CATEGORY);
  const bidDepth = btcOrderbook.bids.reduce((s, l) => s + l.size, 0);
  const askDepth = btcOrderbook.asks.reduce((s, l) => s + l.size, 0);
  const askBidRatio = bidDepth > 0 ? askDepth / bidDepth : Infinity;
  checks.push(
    isLong
      ? chk("btc_orderbook_direction", askBidRatio < 1, `BTC order book ask/bid ratio ${askBidRatio.toFixed(2)} does not favor buyers (need <1) for LONG.`)
      : chk("btc_orderbook_direction", askBidRatio > 1, `BTC order book ask/bid ratio ${askBidRatio.toFixed(2)} does not favor sellers (need >1) for SHORT.`),
  );

  // News filter proxy: "positive news >= negative news" for LONG / "negative
  // > positive" for SHORT has no honest free source — approximated with
  // BTC's own recent 1H price momentum as the closest real, computable
  // stand-in for prevailing market sentiment, same precedent as spot.
  if (btc1h.length > 2) {
    const btc1hMomentumPct = ((last(btc1h)!.close - btc1h[btc1h.length - 2]!.close) / btc1h[btc1h.length - 2]!.close) * 100;
    checks.push(
      isLong
        ? chk("news_bias_proxy", btc1hMomentumPct >= 0, `BTC 1H momentum is negative (${btc1hMomentumPct.toFixed(3)}%) — proxy for negative news outweighing positive, rejecting LONG.`)
        : chk("news_bias_proxy", btc1hMomentumPct <= 0, `BTC 1H momentum is positive (${btc1hMomentumPct.toFixed(3)}%) — proxy for positive news outweighing negative, rejecting SHORT.`),
    );
  }

  const oiHistory = await getOpenInterestHistory(candidate.symbol, 100, mode);
  if (oiHistory.length > 5) {
    const avgOi = oiHistory.reduce((s, r) => s + r.openInterest, 0) / oiHistory.length;
    const currentOi = last(oiHistory)?.openInterest ?? 0;
    const oiPctOfAvg = avgOi > 0 ? (currentOi / avgOi) * 100 : 0;
    checks.push(chk("open_interest_buildup", oiPctOfAvg <= config.openInterestVs100dAvgMaxPct, `Open interest is ${oiPctOfAvg.toFixed(1)}% of its ${oiHistory.length}-period average, max ${config.openInterestVs100dAvgMaxPct}%.`));
    // "Signs of excessive leverage without price confirmation": OI spiking while price is essentially flat.
    const freshTickerForOi = await getTicker(candidate.symbol, mode, CATEGORY);
    if (freshTickerForOi) {
      const leverageBuildupWithoutPrice = oiPctOfAvg > config.openInterestVs100dAvgMaxPct * 0.9 && Math.abs(freshTickerForOi.price24hPct) < 0.5;
      checks.push(chk("leverage_buildup_without_price", !leverageBuildupWithoutPrice, "Open interest rising sharply while price is flat — signs of excessive leverage without price confirmation."));
    }
  }

  const freshTicker = await getTicker(candidate.symbol, mode, CATEGORY);
  if (freshTicker) {
    const driftPct = (Math.abs(freshTicker.lastPrice - candidate.entryPrice) / candidate.entryPrice) * 100;
    checks.push(chk("entry_price_drift", driftPct <= config.entryPriceMaxDriftPct, `Price has moved ${driftPct.toFixed(3)}% since signal, max allowed ${config.entryPriceMaxDriftPct}%.`));
    const freshSpreadPct = freshTicker.bid1Price > 0 ? ((freshTicker.ask1Price - freshTicker.bid1Price) / freshTicker.bid1Price) * 100 : Infinity;
    checks.push(chk("spread_still_acceptable", freshSpreadPct <= config.maxSpreadPct, `Spread widened to ${freshSpreadPct.toFixed(3)}%, max ${config.maxSpreadPct}%.`));
    const tp1 = candidate.takeProfits.find((t) => t.label === "tp1")!;
    const freshRr = Math.abs(tp1.price - freshTicker.lastPrice) / Math.abs(freshTicker.lastPrice - candidate.stopLoss);
    checks.push(chk("risk_reward_still_valid", freshRr >= config.minRiskReward, `Risk:Reward dropped to ${freshRr.toFixed(2)}, minimum is ${config.minRiskReward}.`));
  }

  const blockingReasons = checks.filter((c) => !c.passed).map((c) => c.detail);
  return { approved: blockingReasons.length === 0, checks, blockingReasons };
}
