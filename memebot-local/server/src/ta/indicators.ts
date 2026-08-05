import type { Candle } from "../bybit/marketData.js";

// Pure, dependency-free technical-indicator functions. Every function takes
// plain number arrays (or Candle[]) and returns plain number arrays aligned
// to the same length as the input (padded with NaN where a value can't yet
// be computed), so callers always index by the same position as the source
// candles. No indicator here calls out to the network — see signalEngine.ts
// for how candles are fetched and fed in.

export function sma(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (prev === null) {
      if (i >= period - 1) {
        prev = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        out[i] = prev;
      }
    } else {
      prev = values[i]! * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

/** Population standard deviation of the trailing `period` close-to-close
 * percentage returns, expressed as a ratio (0.025 = 2.5%) — this is what the
 * strategy's "30-period Standard Deviation > 0.025" check compares against. */
export function stddevOfReturns(closes: number[], period: number): number[] {
  const returns: number[] = [NaN];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i]! - closes[i - 1]!) / closes[i - 1]!);
  }
  const out = new Array(closes.length).fill(NaN);
  for (let i = 0; i < returns.length; i++) {
    if (i < period) continue;
    const window = returns.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    out[i] = Math.sqrt(variance);
  }
  return out;
}

function trueRange(candles: Candle[], i: number): number {
  if (i === 0) return candles[0]!.high - candles[0]!.low;
  const cur = candles[i]!;
  const prevClose = candles[i - 1]!.close;
  return Math.max(cur.high - cur.low, Math.abs(cur.high - prevClose), Math.abs(cur.low - prevClose));
}

/** Wilder's ATR — the standard smoothing method (matches TradingView's
 * default ATR), not a plain SMA of true range. */
export function atr(candles: Candle[], period = 14): number[] {
  const out = new Array(candles.length).fill(NaN);
  let prevAtr: number | null = null;
  const trs = candles.map((_, i) => trueRange(candles, i));
  for (let i = 0; i < candles.length; i++) {
    if (i === period - 1) {
      prevAtr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
      out[i] = prevAtr;
    } else if (i >= period && prevAtr !== null) {
      prevAtr = (prevAtr * (period - 1) + trs[i]!) / period;
      out[i] = prevAtr;
    }
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(closes: number[], period = 14): number[] {
  const out = new Array(closes.length).fill(NaN);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i]! - closes[i - 1]!;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        out[i] = rsiFromAvg(avgGain, avgLoss);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      out[i] = rsiFromAvg(avgGain, avgLoss);
    }
  }
  return out;
}

function rsiFromAvg(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export interface StochRsiResult {
  k: number[];
  d: number[];
}

/** Stochastic RSI: %K = smoothed stochastic of RSI over `stochPeriod`, %D =
 * SMA of %K. Standard 14/14/3/3 settings unless the strategy config says
 * otherwise. Values are 0-100 (not 0-1). */
export function stochRsi(closes: number[], rsiPeriod = 14, stochPeriod = 14, kSmoothing = 3, dSmoothing = 3): StochRsiResult {
  const rsiValues = rsi(closes, rsiPeriod);
  const rawK = new Array(closes.length).fill(NaN);
  for (let i = 0; i < rsiValues.length; i++) {
    if (i < rsiPeriod + stochPeriod - 1) continue;
    const window = rsiValues.slice(i - stochPeriod + 1, i + 1).filter((v) => !Number.isNaN(v));
    if (window.length < stochPeriod) continue;
    const lo = Math.min(...window);
    const hi = Math.max(...window);
    rawK[i] = hi === lo ? 50 : ((rsiValues[i]! - lo) / (hi - lo)) * 100;
  }
  const k = smoothIgnoringNaN(rawK, kSmoothing);
  const d = smoothIgnoringNaN(k, dSmoothing);
  return { k, d };
}

function smoothIgnoringNaN(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  for (let i = 0; i < values.length; i++) {
    const window = values.slice(Math.max(0, i - period + 1), i + 1).filter((v) => !Number.isNaN(v));
    if (window.length < period) continue;
    out[i] = window.reduce((a, b) => a + b, 0) / period;
  }
  return out;
}

/** Rolling minimum of `low` over the trailing `period` candles, inclusive of
 * the current candle — used for the entry-zone check against recent support. */
export function rollingLow(candles: Candle[], period: number): number[] {
  const out = new Array(candles.length).fill(NaN);
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    out[i] = Math.min(...candles.slice(i - period + 1, i + 1).map((c) => c.low));
  }
  return out;
}

export function rollingHigh(candles: Candle[], period: number): number[] {
  const out = new Array(candles.length).fill(NaN);
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    out[i] = Math.max(...candles.slice(i - period + 1, i + 1).map((c) => c.high));
  }
  return out;
}

/** True if the most recent EMA reading is above where it was `lookback`
 * candles ago (flat or rising), rather than declining. */
export function isEmaFlatteningOrUpward(emaSeries: number[], lookback = 5): boolean {
  const last = emaSeries[emaSeries.length - 1];
  const prior = emaSeries[emaSeries.length - 1 - lookback];
  if (last === undefined || prior === undefined || Number.isNaN(last) || Number.isNaN(prior)) return false;
  return last >= prior;
}

/** Simple swing-based market-structure check: compares the two most recent
 * swing highs and swing lows (local extrema over a 3-candle window) — true
 * if structure is making lower highs AND lower lows, i.e. a real downtrend. */
export function isMakingLowerHighsLowerLows(candles: Candle[], lookback = 30): boolean {
  const recent = candles.slice(-lookback);
  if (recent.length < 10) return false;
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = 2; i < recent.length - 2; i++) {
    const c = recent[i]!;
    const window = recent.slice(i - 2, i + 3);
    if (c.high === Math.max(...window.map((w) => w.high))) swingHighs.push(c.high);
    if (c.low === Math.min(...window.map((w) => w.low))) swingLows.push(c.low);
  }
  if (swingHighs.length < 2 || swingLows.length < 2) return false;
  const lowerHighs = swingHighs[swingHighs.length - 1]! < swingHighs[swingHighs.length - 2]!;
  const lowerLows = swingLows[swingLows.length - 1]! < swingLows[swingLows.length - 2]!;
  return lowerHighs && lowerLows;
}

/** Bullish RSI divergence: price makes a lower low between two recent swing
 * lows while RSI makes a higher low at the same points — a classic reversal
 * signal. Compares the last two swing lows found within `lookback` candles. */
export function hasBullishRsiDivergence(candles: Candle[], rsiValues: number[], lookback = 20): boolean {
  const start = Math.max(2, candles.length - lookback);
  const swingLowIndices: number[] = [];
  for (let i = start; i < candles.length - 2; i++) {
    const window = candles.slice(i - 2, i + 3);
    if (candles[i]!.low === Math.min(...window.map((w) => w.low))) swingLowIndices.push(i);
  }
  if (swingLowIndices.length < 2) return false;
  const [prevIdx, lastIdx] = swingLowIndices.slice(-2) as [number, number];
  const priceLowerLow = candles[lastIdx]!.low < candles[prevIdx]!.low;
  const rsiAtPrev = rsiValues[prevIdx];
  const rsiAtLast = rsiValues[lastIdx];
  if (rsiAtPrev === undefined || rsiAtLast === undefined || Number.isNaN(rsiAtPrev) || Number.isNaN(rsiAtLast)) return false;
  const rsiHigherLow = rsiAtLast > rsiAtPrev;
  return priceLowerLow && rsiHigherLow;
}

/** Bearish RSI divergence: price makes a higher high between two recent
 * swing highs while RSI makes a lower high at the same points. */
export function hasBearishRsiDivergence(candles: Candle[], rsiValues: number[], lookback = 20): boolean {
  const start = Math.max(2, candles.length - lookback);
  const swingHighIndices: number[] = [];
  for (let i = start; i < candles.length - 2; i++) {
    const window = candles.slice(i - 2, i + 3);
    if (candles[i]!.high === Math.max(...window.map((w) => w.high))) swingHighIndices.push(i);
  }
  if (swingHighIndices.length < 2) return false;
  const [prevIdx, lastIdx] = swingHighIndices.slice(-2) as [number, number];
  const priceHigherHigh = candles[lastIdx]!.high > candles[prevIdx]!.high;
  const rsiAtPrev = rsiValues[prevIdx];
  const rsiAtLast = rsiValues[lastIdx];
  if (rsiAtPrev === undefined || rsiAtLast === undefined || Number.isNaN(rsiAtPrev) || Number.isNaN(rsiAtLast)) return false;
  const rsiLowerHigh = rsiAtLast < rsiAtPrev;
  return priceHigherHigh && rsiLowerHigh;
}

/** A "bullish confirmation candle": current candle closes green and above
 * its own midpoint, i.e. buyers controlled the close, not just the open. */
export function isBullishConfirmationCandle(candle: Candle): boolean {
  const mid = (candle.high + candle.low) / 2;
  return candle.close > candle.open && candle.close >= mid;
}

/** A "bearish confirmation candle": mirror of the bullish check — closes
 * red and below its own midpoint, i.e. sellers controlled the close. */
export function isBearishConfirmationCandle(candle: Candle): boolean {
  const mid = (candle.high + candle.low) / 2;
  return candle.close < candle.open && candle.close <= mid;
}

/** True if price is above its 200 EMA, or has just crossed above it
 * (reclaiming) within the last `lookback` candles. */
export function isAboveOrReclaiming200Ema(closes: number[], ema200: number[], lookback = 5): boolean {
  const lastClose = last(closes);
  const lastEma = last(ema200);
  if (lastClose === undefined || lastEma === undefined || Number.isNaN(lastEma)) return false;
  if (lastClose > lastEma) return true;
  for (let i = closes.length - lookback; i < closes.length - 1; i++) {
    const c = closes[i];
    const e = ema200[i];
    if (c === undefined || e === undefined || Number.isNaN(e)) continue;
    if (c < e && lastClose >= lastEma) return true;
  }
  return false;
}

/** True if price is below its 200 EMA, or has just crossed below it
 * (rejecting) within the last `lookback` candles. */
export function isBelowOrRejecting200Ema(closes: number[], ema200: number[], lookback = 5): boolean {
  const lastClose = last(closes);
  const lastEma = last(ema200);
  if (lastClose === undefined || lastEma === undefined || Number.isNaN(lastEma)) return false;
  if (lastClose < lastEma) return true;
  for (let i = closes.length - lookback; i < closes.length - 1; i++) {
    const c = closes[i];
    const e = ema200[i];
    if (c === undefined || e === undefined || Number.isNaN(e)) continue;
    if (c > e && lastClose <= lastEma) return true;
  }
  return false;
}

export function last<T>(values: T[]): T | undefined {
  return values[values.length - 1];
}

export function secondLast<T>(values: T[]): T | undefined {
  return values[values.length - 2];
}

/** Rolling VWAP over the trailing `period` candles (typical price weighted
 * by volume) — not a session-anchored VWAP, since these bots run
 * continuously with no natural session boundary. Used as one of the three
 * "pulled back to" reference levels (VWAP / EMA20 / support-resistance) in
 * the futures bot's entry logic. */
export function vwap(candles: Candle[], period: number): number[] {
  const out = new Array(candles.length).fill(NaN);
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    let pv = 0;
    let vol = 0;
    for (const c of candles.slice(i - period + 1, i + 1)) {
      pv += ((c.high + c.low + c.close) / 3) * c.volume;
      vol += c.volume;
    }
    out[i] = vol > 0 ? pv / vol : NaN;
  }
  return out;
}

/** Mirror of isMakingLowerHighsLowerLows: true if swing structure is making
 * higher highs AND higher lows, i.e. a real uptrend/breakout structure
 * rather than a range. */
export function isMakingHigherHighsHigherLows(candles: Candle[], lookback = 30): boolean {
  const recent = candles.slice(-lookback);
  if (recent.length < 10) return false;
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = 2; i < recent.length - 2; i++) {
    const c = recent[i]!;
    const window = recent.slice(i - 2, i + 3);
    if (c.high === Math.max(...window.map((w) => w.high))) swingHighs.push(c.high);
    if (c.low === Math.min(...window.map((w) => w.low))) swingLows.push(c.low);
  }
  if (swingHighs.length < 2 || swingLows.length < 2) return false;
  const higherHighs = swingHighs[swingHighs.length - 1]! > swingHighs[swingHighs.length - 2]!;
  const higherLows = swingLows[swingLows.length - 1]! > swingLows[swingLows.length - 2]!;
  return higherHighs && higherLows;
}

/** True if %K crossed above %D on the most recent candle (bullish StochRSI
 * crossover) — the prior candle had K<=D and the current one has K>D. */
export function stochRsiCrossedUp(stoch: StochRsiResult): boolean {
  const k0 = secondLast(stoch.k);
  const d0 = secondLast(stoch.d);
  const k1 = last(stoch.k);
  const d1 = last(stoch.d);
  if ([k0, d0, k1, d1].some((v) => v === undefined || Number.isNaN(v))) return false;
  return k0! <= d0! && k1! > d1!;
}

/** True if %K crossed below %D on the most recent candle (bearish StochRSI
 * crossover). */
export function stochRsiCrossedDown(stoch: StochRsiResult): boolean {
  const k0 = secondLast(stoch.k);
  const d0 = secondLast(stoch.d);
  const k1 = last(stoch.k);
  const d1 = last(stoch.d);
  if ([k0, d0, k1, d1].some((v) => v === undefined || Number.isNaN(v))) return false;
  return k0! >= d0! && k1! < d1!;
}
