import { getKlines, getLatestFundingRate, getOpenInterestHistory, getTicker, type Candle } from "../bybit/marketData.js";
import type { BybitMode } from "../bybit/client.js";
import {
  atr,
  ema,
  isMakingHigherHighsHigherLows,
  isMakingLowerHighsLowerLows,
  last,
  rollingHigh,
  rollingLow,
  rsi,
  secondLast,
  stochRsi,
  stochRsiCrossedDown,
  stochRsiCrossedDownWithin,
  stochRsiCrossedUp,
  stochRsiCrossedUpWithin,
  vwap,
  type StochRsiResult,
} from "../ta/indicators.js";
import { checkBtcSuddenMove, checkBtcVolatilityShock } from "../ta/btcRisk.js";
import { getFearGreedIndex } from "../ta/fearGreed.js";
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

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

interface SymbolIndicators {
  entryCandles: Candle[]; // 15M — entry timeframe
  current: Candle;
  closes15m: number[];
  currentAtr: number;
  currentRsi: number;
  prevRsi: number;
  stoch: StochRsiResult;
  k: number;
  d: number;
  currentVwap: number;
  currentEma20: number;
  supportLevel: number;
  resistanceLevel: number;
  trendEma4hCurrent: number; // 4H — trend timeframe
  trendClose4hCurrent: number;
  avgVolume: number;
  volumeRatio: number; // confirmation: "Volume spike (1.5x+ average)"
  volumeIncreasing: boolean;
  ticker: Awaited<ReturnType<typeof getTicker>>;
  spreadPct: number;
}

/** Fetches and precomputes everything both the long and short setup
 * evaluators need for one symbol, across the strategy's three timeframes
 * (4H trend / 15M entry / 5M confirmation is folded into the 15M volume
 * spike check — a genuine spike shows up on the entry candle itself). Only
 * one network round-trip pair per symbol per scan regardless of which
 * direction(s) qualify. */
async function loadSymbolIndicators(symbol: string, config: FuturesStrategyConfig, mode: BybitMode): Promise<SymbolIndicators | Stage1Rejection> {
  const entryLimit = Math.max(config.minCompletedCandles + 10, config.entryEmaPeriod + 20, config.supportResistanceLookback + 10);
  const [entryCandles, trend4hCandles, ticker] = await Promise.all([
    getKlines(symbol, 15, entryLimit, mode, CATEGORY),
    getKlines(symbol, 240, config.trendEma4hPeriod + 10, mode, CATEGORY),
    getTicker(symbol, mode, CATEGORY),
  ]);

  if (entryCandles.length < config.minCompletedCandles) {
    return { symbol, reason: `Only ${entryCandles.length} completed 15m candles, need ${config.minCompletedCandles}.` };
  }
  if (!ticker) return { symbol, reason: "No ticker data." };

  // Coin selection: "Trade only highly volatile coins... at least 8-15%/day" + "Trade only liquid coins".
  if (ticker.turnover24h < config.min24hTurnoverUsd) {
    return { symbol, reason: `24h turnover $${ticker.turnover24h.toFixed(0)} below min $${config.min24hTurnoverUsd}.` };
  }
  if (Math.abs(ticker.price24hPct) < config.minDailyMovePct) {
    return { symbol, reason: `24h move ${ticker.price24hPct.toFixed(2)}% below the ${config.minDailyMovePct}% "highly volatile" floor.` };
  }
  const spreadPct = ticker.bid1Price > 0 ? ((ticker.ask1Price - ticker.bid1Price) / ticker.bid1Price) * 100 : Infinity;
  if (spreadPct > config.maxSpreadPct) {
    return { symbol, reason: `Spread ${spreadPct.toFixed(3)}% exceeds max ${config.maxSpreadPct}%.` };
  }

  const closes15m = entryCandles.map((c) => c.close);
  const atrSeries = atr(entryCandles, 14);
  const currentAtr = last(atrSeries);
  if (currentAtr === undefined || Number.isNaN(currentAtr) || currentAtr <= 0) {
    return { symbol, reason: "ATR not yet computable." };
  }
  const current = last(entryCandles) as Candle;
  const atrOverClose = currentAtr / current.close;
  if (atrOverClose > config.atrOverCloseMax) {
    return { symbol, reason: `ATR/Close ${atrOverClose.toFixed(4)} exceeds max ${config.atrOverCloseMax}.` };
  }

  const rsiSeries = rsi(closes15m, 14);
  const currentRsi = last(rsiSeries);
  const prevRsi = secondLast(rsiSeries);
  const stoch = stochRsi(closes15m, 14, 14, 3, 3);
  const k = last(stoch.k);
  const d = last(stoch.d);
  if ([currentRsi, prevRsi, k, d].some((v) => v === undefined || Number.isNaN(v))) {
    return { symbol, reason: "RSI/StochRSI not yet computable." };
  }

  const currentVwap = last(vwap(entryCandles, config.supportResistanceLookback));
  const currentEma20 = last(ema(closes15m, config.entryEmaPeriod));
  const supportLevel = last(rollingLow(entryCandles, config.supportResistanceLookback));
  const resistanceLevel = last(rollingHigh(entryCandles, config.supportResistanceLookback));
  if ([currentVwap, currentEma20, supportLevel, resistanceLevel].some((v) => v === undefined || Number.isNaN(v))) {
    return { symbol, reason: "VWAP/EMA20/support-resistance not yet computable." };
  }

  if (trend4hCandles.length < 20) {
    return { symbol, reason: `Only ${trend4hCandles.length} completed 4H candles, need at least 20 for a trend read.` };
  }
  const trend4hCloses = trend4hCandles.map((c) => c.close);
  const trendEma4hCurrent = last(ema(trend4hCloses, config.trendEma4hPeriod));
  const trendClose4hCurrent = last(trend4hCloses);
  if (trendEma4hCurrent === undefined || Number.isNaN(trendEma4hCurrent) || trendClose4hCurrent === undefined) {
    return { symbol, reason: "4H trend EMA not yet computable — not enough 4H history for this (likely newly-listed) symbol." };
  }

  const last20Volumes = entryCandles.slice(-21, -1).map((c) => c.volume);
  const avgVolume = avg(last20Volumes);
  const volumeRatio = avgVolume > 0 ? current.volume / avgVolume : 0;
  const recent3Avg = avg(entryCandles.slice(-3).map((c) => c.volume));
  const prior3Avg = avg(entryCandles.slice(-6, -3).map((c) => c.volume));
  const volumeIncreasing = prior3Avg > 0 ? recent3Avg > prior3Avg : recent3Avg > 0;

  return {
    entryCandles,
    current,
    closes15m,
    currentAtr,
    currentRsi: currentRsi as number,
    prevRsi: prevRsi as number,
    stoch,
    k: k as number,
    d: d as number,
    currentVwap: currentVwap as number,
    currentEma20: currentEma20 as number,
    supportLevel: supportLevel as number,
    resistanceLevel: resistanceLevel as number,
    trendEma4hCurrent,
    trendClose4hCurrent,
    avgVolume,
    volumeRatio,
    volumeIncreasing,
    ticker,
    spreadPct,
  };
}

function isIndicatorRejection(x: SymbolIndicators | Stage1Rejection): x is Stage1Rejection {
  return (x as Stage1Rejection).reason !== undefined;
}

/** True if `price` sits within `maxDistPct` of `level` — the shared test
 * behind "pulls back to VWAP/EMA20/support" (LONG) and "rejects VWAP/EMA20/
 * resistance" (SHORT): both are really the same "price is right at this
 * reference level" condition, direction is then confirmed by RSI/StochRSI. */
function nearLevel(price: number, level: number, maxDistPct: number): boolean {
  if (!(level > 0) || Number.isNaN(level)) return false;
  return (Math.abs(price - level) / level) * 100 <= maxDistPct;
}

function buildTradeSetup(side: SignalSide, ind: SymbolIndicators, config: FuturesStrategyConfig): { stopLoss: number; slPct: number; riskReward: number; takeProfits: TakeProfitPlan[] } | null {
  const isLong = side === "long";
  const entry = ind.current.close;
  // Hard stop-loss fixed at 3-4% per the spec (not ATR-derived) — scaled
  // within that band by the symbol's own volatility so a calmer mover sits
  // closer to 3% and a wilder one closer to 4%, never outside the band.
  const atrPct = (ind.currentAtr / entry) * 100;
  const slPct = Math.min(config.slMaxPct, Math.max(config.slMinPct, atrPct * 1.5));
  const stopLoss = isLong ? entry * (1 - slPct / 100) : entry * (1 + slPct / 100);
  const tp1Price = isLong ? entry * (1 + config.tp1Pct / 100) : entry * (1 - config.tp1Pct / 100);
  const tp2Price = isLong ? entry * (1 + config.tp2Pct / 100) : entry * (1 - config.tp2Pct / 100);
  const riskReward = config.tp1Pct / slPct;
  if (riskReward < config.minRiskReward) return null;
  // TP3 has no fixed price — it trails at trailingStopPct once TP2 fills.
  // This is a display-only projection for the signal record.
  const tp3Price = isLong ? tp2Price * (1 + config.trailingStopPct / 100) : tp2Price * (1 - config.trailingStopPct / 100);

  return {
    stopLoss,
    slPct,
    riskReward,
    takeProfits: [
      { label: "tp1", price: tp1Price, closePct: config.tp1ClosePct },
      { label: "tp2", price: tp2Price, closePct: config.tp2ClosePct },
      { label: "tp3", price: tp3Price, closePct: 100 - config.tp1ClosePct - config.tp2ClosePct },
    ],
  };
}

function scoreCandidate(params: {
  volumeRatio: number;
  atrOverClose: number;
  atrOverCloseMax: number;
  price24hMovePct: number;
  breakoutConfirmed: boolean;
  stochSpread: number;
  riskReward: number;
  minRiskReward: number;
}): number {
  // Weighted toward volume/movement/breakout structure, matching the
  // spec's own emphasis on volatile movers and "prioritize breakout and
  // breakdown setups over ranging markets."
  const volumeScore = Math.min(2, params.volumeRatio) * 20;
  const movementScore = Math.min(1, Math.abs(params.price24hMovePct) / 15) * 20; // 15% is the top of the spec's preferred daily-move range
  const breakoutScore = params.breakoutConfirmed ? 20 : 0;
  const stochScore = Math.min(1, params.stochSpread / 20) * 10;
  const rrScore = Math.min(2, params.riskReward / params.minRiskReward) * 10;
  const volatilityScore = Math.min(1, params.atrOverClose / params.atrOverCloseMax) * 10;
  return volumeScore + movementScore + breakoutScore + stochScore + rrScore + volatilityScore;
}

function evaluateLongSetup(ind: SymbolIndicators, config: FuturesStrategyConfig, symbol: string): Stage1Candidate | Stage1Rejection {
  const { current, currentVwap, currentEma20, supportLevel, k, d, currentRsi, prevRsi, stoch, volumeRatio, ticker } = ind;

  const pulledBack =
    nearLevel(current.close, currentVwap, config.pullbackMaxDistancePct) ||
    nearLevel(current.close, currentEma20, config.pullbackMaxDistancePct) ||
    nearLevel(current.close, supportLevel, config.pullbackMaxDistancePct);
  if (!pulledBack) {
    return { symbol, reason: `LONG: price ${current.close} is not within ${config.pullbackMaxDistancePct}% of VWAP (${currentVwap.toFixed(6)}), EMA20 (${currentEma20.toFixed(6)}), or support (${supportLevel.toFixed(6)}).` };
  }
  if (currentRsi < config.rsiLongMin || currentRsi > config.rsiLongMax) {
    return { symbol, reason: `LONG: RSI ${currentRsi.toFixed(1)} outside [${config.rsiLongMin}, ${config.rsiLongMax}].` };
  }
  if (!(currentRsi > prevRsi)) {
    return { symbol, reason: `LONG: RSI ${currentRsi.toFixed(1)} is not turning up (was ${prevRsi.toFixed(1)}).` };
  }
  if (!stochRsiCrossedUpWithin(stoch, config.stochRsiCrossoverLookback)) {
    return { symbol, reason: `LONG: no bullish StochRSI crossover within the last ${config.stochRsiCrossoverLookback} candles (K=${k.toFixed(1)}, D=${d.toFixed(1)}).` };
  }
  if (!(volumeRatio >= config.volumeSpikeMultiplier)) {
    return { symbol, reason: `LONG: volume ${volumeRatio.toFixed(2)}x average, needs >= ${config.volumeSpikeMultiplier}x spike.` };
  }

  const setup = buildTradeSetup("long", ind, config);
  if (!setup) return { symbol, reason: "LONG: stop-loss distance or risk:reward failed trade-setup rules." };

  const breakoutConfirmed = config.breakoutPreferenceEnabled && isMakingHigherHighsHigherLows(ind.entryCandles, 30);
  const atrOverClose = ind.currentAtr / current.close;
  const score = scoreCandidate({
    volumeRatio,
    atrOverClose,
    atrOverCloseMax: config.atrOverCloseMax,
    price24hMovePct: ticker!.price24hPct,
    breakoutConfirmed,
    stochSpread: Math.abs(k - d),
    riskReward: setup.riskReward,
    minRiskReward: config.minRiskReward,
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
    details: {
      atrOverClose,
      slPct: setup.slPct,
      rsi: currentRsi,
      stochK: k,
      stochD: d,
      volumeRatio,
      volumeIncreasing: ind.volumeIncreasing,
      breakoutConfirmed,
      riskReward: setup.riskReward,
      spreadPct: ind.spreadPct,
      turnover24h: ticker!.turnover24h,
      price24hPct: ticker!.price24hPct,
      pullbackReference: nearLevel(current.close, currentVwap, config.pullbackMaxDistancePct) ? "vwap" : nearLevel(current.close, currentEma20, config.pullbackMaxDistancePct) ? "ema20" : "support",
    },
  };
}

function evaluateShortSetup(ind: SymbolIndicators, config: FuturesStrategyConfig, symbol: string): Stage1Candidate | Stage1Rejection {
  const { current, currentVwap, currentEma20, resistanceLevel, k, d, currentRsi, prevRsi, stoch, volumeRatio, ticker } = ind;

  const rejected =
    nearLevel(current.close, currentVwap, config.pullbackMaxDistancePct) ||
    nearLevel(current.close, currentEma20, config.pullbackMaxDistancePct) ||
    nearLevel(current.close, resistanceLevel, config.pullbackMaxDistancePct);
  if (!rejected) {
    return { symbol, reason: `SHORT: price ${current.close} is not within ${config.pullbackMaxDistancePct}% of VWAP (${currentVwap.toFixed(6)}), EMA20 (${currentEma20.toFixed(6)}), or resistance (${resistanceLevel.toFixed(6)}).` };
  }
  if (currentRsi < config.rsiShortMin || currentRsi > config.rsiShortMax) {
    return { symbol, reason: `SHORT: RSI ${currentRsi.toFixed(1)} outside [${config.rsiShortMin}, ${config.rsiShortMax}].` };
  }
  if (!(currentRsi < prevRsi)) {
    return { symbol, reason: `SHORT: RSI ${currentRsi.toFixed(1)} is not turning down (was ${prevRsi.toFixed(1)}).` };
  }
  if (!stochRsiCrossedDownWithin(stoch, config.stochRsiCrossoverLookback)) {
    return { symbol, reason: `SHORT: no bearish StochRSI crossover within the last ${config.stochRsiCrossoverLookback} candles (K=${k.toFixed(1)}, D=${d.toFixed(1)}).` };
  }
  if (!(volumeRatio >= config.volumeSpikeMultiplier)) {
    return { symbol, reason: `SHORT: volume ${volumeRatio.toFixed(2)}x average, needs >= ${config.volumeSpikeMultiplier}x spike.` };
  }

  const setup = buildTradeSetup("short", ind, config);
  if (!setup) return { symbol, reason: "SHORT: stop-loss distance or risk:reward failed trade-setup rules." };

  const breakoutConfirmed = config.breakoutPreferenceEnabled && isMakingLowerHighsLowerLows(ind.entryCandles, 30);
  const atrOverClose = ind.currentAtr / current.close;
  const score = scoreCandidate({
    volumeRatio,
    atrOverClose,
    atrOverCloseMax: config.atrOverCloseMax,
    price24hMovePct: ticker!.price24hPct,
    breakoutConfirmed,
    stochSpread: Math.abs(k - d),
    riskReward: setup.riskReward,
    minRiskReward: config.minRiskReward,
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
    details: {
      atrOverClose,
      slPct: setup.slPct,
      rsi: currentRsi,
      stochK: k,
      stochD: d,
      volumeRatio,
      volumeIncreasing: ind.volumeIncreasing,
      breakoutConfirmed,
      riskReward: setup.riskReward,
      spreadPct: ind.spreadPct,
      turnover24h: ticker!.turnover24h,
      price24hPct: ticker!.price24hPct,
      pullbackReference: nearLevel(current.close, currentVwap, config.pullbackMaxDistancePct) ? "vwap" : nearLevel(current.close, currentEma20, config.pullbackMaxDistancePct) ? "ema20" : "resistance",
    },
  };
}

/**
 * Stage 1 for a single symbol: evaluates BOTH a long and a short setup and
 * returns whichever qualifies with the higher score (or a rejection
 * explaining why neither did). Every filter is a direct translation of one
 * line from the user's LONG & SHORT strategy spec's own entry conditions —
 * external/market-wide checks (BTC trend, Fear & Greed, funding, open
 * interest) live in Stage 2 below.
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
 * setup (long or short) across the whole universe. */
export function pickBestCandidate(results: Array<Stage1Candidate | Stage1Rejection>): Stage1Candidate | null {
  const candidates = results.filter((r): r is Stage1Candidate => !isRejection(r));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.score > best.score ? c : best));
}

export type BtcTrend = "bullish" | "bearish" | "neutral";

/** BTC's own 4H trend — "not bearish" gates LONGs, "not bullish" gates
 * SHORTs. Requires both a close on the right side of the trend EMA AND a
 * confirming swing structure, so a single wick through the EMA doesn't
 * flip the read. */
export async function getBtcTrend4h(mode: BybitMode): Promise<BtcTrend> {
  const candles = await getKlines("BTCUSDT", 240, 60, mode, CATEGORY);
  if (candles.length < 20) return "neutral";
  const closes = candles.map((c) => c.close);
  const period = Math.min(50, candles.length - 1);
  const currentEma = last(ema(closes, period));
  const currentClose = last(closes);
  if (currentEma === undefined || Number.isNaN(currentEma) || currentClose === undefined) return "neutral";
  if (currentClose > currentEma && isMakingHigherHighsHigherLows(candles, 30)) return "bullish";
  if (currentClose < currentEma && isMakingLowerHighsLowerLows(candles, 30)) return "bearish";
  return "neutral";
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

export interface Stage2Context {
  pendingSignalsCount: number;
  hasPendingForSymbol: boolean;
  hasOpenPositionForSymbol: boolean;
  activeTradesCount: number;
}

/** Stage 2 — external/market-wide validation against the single Stage-1
 * winner. Direction-aware throughout. The one check with no honest free
 * data source (high-impact economic news) is proxied by the existing
 * BTC-volatility-shock detection. */
export async function validateSignalStage2(candidate: Stage1Candidate, config: FuturesStrategyConfig, mode: BybitMode, context: Stage2Context): Promise<Stage2Result> {
  const checks: Stage2Check[] = [];
  const isLong = candidate.side === "long";

  checks.push(chk("has_full_setup", true, "Entry, stop-loss and take-profit levels present."));
  checks.push(chk("no_duplicate_pending", !context.hasPendingForSymbol, `A pending/active signal already exists for ${candidate.symbol}.`));
  checks.push(chk("no_existing_position", !context.hasOpenPositionForSymbol, `An open position already exists for ${candidate.symbol} — never average down into an existing trade.`));
  checks.push(
    chk(
      "max_pending_and_active",
      context.pendingSignalsCount < config.maxPendingSignals && context.activeTradesCount < config.maxActiveTrades,
      `${context.pendingSignalsCount} pending signal(s) (max ${config.maxPendingSignals}), ${context.activeTradesCount} active trade(s) (max ${config.maxActiveTrades}).`,
    ),
  );

  // "Avoid Trading: High-impact economic news" — proxied via BTC volatility shock.
  if (config.btcVolatilityShockCheckEnabled) {
    const shock = await checkBtcVolatilityShock(mode);
    checks.push(chk("market_risk_proxy", !shock.flagged, shock.detail));
  }

  // "Avoid Trading: Sudden BTC moves larger than 3%"
  const suddenMove = await checkBtcSuddenMove(mode, config.btcSuddenMoveMaxPct);
  checks.push(chk("btc_sudden_move", !suddenMove.flagged, suddenMove.detail));

  // "Market Direction: F&G > 60 -> prefer LONGS, F&G < 40 -> prefer SHORTS"
  const fng = await getFearGreedIndex();
  if (fng) {
    checks.push(
      isLong
        ? chk("fear_greed_direction", fng.value > config.fearGreedShortThreshold, `Fear & Greed is ${fng.value} (<= ${config.fearGreedShortThreshold} clearly favors SHORT) — rejecting LONG.`)
        : chk("fear_greed_direction", fng.value < config.fearGreedLongThreshold, `Fear & Greed is ${fng.value} (>= ${config.fearGreedLongThreshold} clearly favors LONG) — rejecting SHORT.`),
    );
  } else {
    checks.push(chk("fear_greed_direction", true, "Fear & Greed index unavailable — not blocking."));
  }

  // "BTC trend is not bearish" (LONG) / "BTC trend is not bullish" (SHORT)
  const btcTrend = await getBtcTrend4h(mode);
  checks.push(
    isLong
      ? chk("btc_trend", btcTrend !== "bearish", `BTC 4H trend is ${btcTrend} — LONG requires BTC trend not bearish.`)
      : chk("btc_trend", btcTrend !== "bullish", `BTC 4H trend is ${btcTrend} — SHORT requires BTC trend not bullish.`),
  );

  // "Funding Rate not extremely positive" (LONG) / "not extremely negative" (SHORT)
  const fundingRate = await getLatestFundingRate(candidate.symbol, mode);
  if (fundingRate !== null) {
    checks.push(
      isLong
        ? chk("funding_not_excessive", fundingRate <= config.fundingLongMaxPct, `Funding rate ${fundingRate.toFixed(4)}% exceeds LONG max ${config.fundingLongMaxPct}%.`)
        : chk("funding_not_excessive", fundingRate >= config.fundingShortMinPct, `Funding rate ${fundingRate.toFixed(4)}% below SHORT min ${config.fundingShortMinPct}%.`),
    );
  }

  // "Open Interest increasing" (entry, both directions) + "Prefer increasing Open Interest" (extra filter)
  if (config.oiIncreasingRequired) {
    const oiTrend = await getOpenInterestHistory(candidate.symbol, 8, mode, "15min");
    if (oiTrend.length >= 4) {
      const half = Math.floor(oiTrend.length / 2);
      const earlierAvg = avg(oiTrend.slice(0, half).map((r) => r.openInterest));
      const laterAvg = avg(oiTrend.slice(half).map((r) => r.openInterest));
      const increasing = earlierAvg > 0 ? laterAvg > earlierAvg : laterAvg > 0;
      checks.push(chk("open_interest_increasing", increasing, `Open interest is ${increasing ? "trending up" : "not trending up"} over the last ~2h (${earlierAvg.toFixed(0)} -> ${laterAvg.toFixed(0)}).`));
    } else {
      checks.push(chk("open_interest_increasing", true, "Not enough recent open-interest history to evaluate trend — not blocking."));
    }
  }

  // "Prefer... increasing Volume" (extra filter) — computed in Stage 1 from the same 15m candles.
  if (config.volumeIncreasingRequired) {
    const volumeIncreasing = candidate.details.volumeIncreasing === true;
    checks.push(chk("volume_increasing", volumeIncreasing, volumeIncreasing ? "15m volume is trending up." : "15m volume is not trending up."));
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

export interface SetupInvalidationResult {
  invalidated: boolean;
  reason: string;
}

/** "Exit immediately if the setup becomes invalid." Re-checks the same
 * EMA20 reference and StochRSI momentum an open position was entered on;
 * requires BOTH a decisive close through EMA20 (2x the original pullback
 * tolerance, so normal noise doesn't trip it) AND a fresh momentum reversal
 * confirming it, so a single wick doesn't force an exit. */
export async function checkSetupInvalidation(symbol: string, side: SignalSide, config: FuturesStrategyConfig, mode: BybitMode): Promise<SetupInvalidationResult> {
  if (!config.exitOnSetupInvalidation) return { invalidated: false, reason: "Setup invalidation exit is disabled." };

  const candles = await getKlines(symbol, 15, Math.max(config.entryEmaPeriod + 20, 30), mode, CATEGORY);
  if (candles.length < config.entryEmaPeriod + 5) return { invalidated: false, reason: "Not enough 15m history to evaluate invalidation." };

  const closes = candles.map((c) => c.close);
  const currentEma20 = last(ema(closes, config.entryEmaPeriod));
  const current = last(candles) as Candle;
  if (currentEma20 === undefined || Number.isNaN(currentEma20)) return { invalidated: false, reason: "EMA20 not yet computable." };

  const stoch = stochRsi(closes, 14, 14, 3, 3);
  const isLong = side === "long";
  const breakPct = ((current.close - currentEma20) / currentEma20) * 100;
  const decisiveBreak = isLong ? breakPct < -config.pullbackMaxDistancePct * 2 : breakPct > config.pullbackMaxDistancePct * 2;
  const momentumReversed = isLong ? stochRsiCrossedDown(stoch) : stochRsiCrossedUp(stoch);
  const invalidated = decisiveBreak && momentumReversed;

  return {
    invalidated,
    reason: invalidated
      ? `${side.toUpperCase()} setup invalidated: price closed ${Math.abs(breakPct).toFixed(2)}% ${isLong ? "below" : "above"} EMA20 with a confirmed StochRSI reversal.`
      : "Setup still valid.",
  };
}
