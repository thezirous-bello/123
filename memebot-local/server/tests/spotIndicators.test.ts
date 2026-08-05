import { describe, expect, it } from "vitest";
import {
  atr,
  ema,
  hasBearishRsiDivergence,
  hasBullishRsiDivergence,
  isBullishConfirmationCandle,
  isEmaFlatteningOrUpward,
  isMakingHigherHighsHigherLows,
  isMakingLowerHighsLowerLows,
  rollingHigh,
  rollingLow,
  rsi,
  secondLast,
  sma,
  stddevOfReturns,
  stochRsi,
  stochRsiCrossedDown,
  stochRsiCrossedUp,
  vwap,
} from "../src/ta/indicators.js";
import type { Candle } from "../src/bybit/marketData.js";

function candle(i: number, partial: Partial<Candle>): Candle {
  return { startTime: i, open: 100, high: 101, low: 99, close: 100, volume: 1000, turnover: 100_000, ...partial };
}

describe("sma / ema", () => {
  it("sma is the plain average once the window is full", () => {
    const values = [1, 2, 3, 4, 5];
    const result = sma(values, 3);
    expect(result[1]).toBeNaN();
    expect(result[2]).toBeCloseTo(2); // (1+2+3)/3
    expect(result[4]).toBeCloseTo(4); // (3+4+5)/3
  });

  it("ema seeds from the SMA of the first `period` values", () => {
    const values = [10, 10, 10, 10, 20, 20, 20];
    const result = ema(values, 4);
    expect(result[3]).toBeCloseTo(10); // SMA seed
    expect(result[6]).toBeGreaterThan(10); // pulled up by the later 20s
  });
});

describe("atr", () => {
  it("converges to the constant true range when every candle has the same range and no gaps", () => {
    const candles = Array.from({ length: 20 }, (_, i) => candle(i, { open: 100, close: 100, high: 102, low: 100 }));
    const series = atr(candles, 14);
    expect(series[13]).toBeCloseTo(2, 5);
    expect(series[19]).toBeCloseTo(2, 5);
  });

  it("reacts to a wide-range shock candle", () => {
    const candles = Array.from({ length: 20 }, (_, i) => candle(i, { open: 100, close: 100, high: 101, low: 99 }));
    candles[19] = candle(19, { open: 100, close: 100, high: 120, low: 80 });
    const series = atr(candles, 14);
    expect(series[19]).toBeGreaterThan(series[18]!);
  });
});

describe("rsi", () => {
  it("approaches 100 on a strictly rising series", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const series = rsi(closes, 14);
    expect(series[29]).toBeGreaterThan(95);
  });

  it("approaches 0 on a strictly falling series", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 200 - i);
    const series = rsi(closes, 14);
    expect(series[29]).toBeLessThan(5);
  });

  it("reads 100 on a perfectly flat series (avgLoss=0 convention, matches Wilder's RSI)", () => {
    const closes = new Array(30).fill(100);
    const series = rsi(closes, 14);
    expect(series[29]).toBe(100);
  });
});

describe("stddevOfReturns", () => {
  it("is zero when every return is identical", () => {
    const closes = Array.from({ length: 35 }, (_, i) => 100 * 1.01 ** i);
    const series = stddevOfReturns(closes, 30);
    expect(series[34]).toBeCloseTo(0, 6);
  });

  it("is positive when returns vary", () => {
    const closes = [100];
    for (let i = 1; i < 35; i++) closes.push(closes[i - 1]! * (i % 2 === 0 ? 1.05 : 0.98));
    const series = stddevOfReturns(closes, 30);
    expect(series[34]).toBeGreaterThan(0);
  });
});

describe("rollingLow / rollingHigh", () => {
  it("tracks the min/max over the trailing window", () => {
    const candles = [10, 5, 8, 3, 9, 12].map((low, i) => candle(i, { low, high: low + 50 }));
    const lows = rollingLow(candles, 3);
    const highs = rollingHigh(candles, 3);
    expect(lows[5]).toBe(3); // min(3, 9, 12) over indices 3-5
    expect(highs[5]).toBe(62); // max(53, 59, 62)
  });
});

describe("stochRsi", () => {
  it("produces values within [0, 100] once warmed up", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 10);
    const { k, d } = stochRsi(closes, 14, 14, 3, 3);
    const lastK = k[k.length - 1]!;
    const lastD = d[d.length - 1]!;
    expect(lastK).toBeGreaterThanOrEqual(0);
    expect(lastK).toBeLessThanOrEqual(100);
    expect(lastD).toBeGreaterThanOrEqual(0);
    expect(lastD).toBeLessThanOrEqual(100);
  });

  it("reads higher for a noisy rally than for a noisy decline", () => {
    // Small periodic pullbacks keep RSI off the 0/100 rails so StochRSI's
    // own rolling window isn't degenerate (a perfectly monotonic series
    // pins RSI at 100 the whole way, which isn't a realistic market anyway).
    const rally = Array.from({ length: 60 }, (_, i) => 100 + i * 1.5 - (i % 4 === 0 ? 3 : 0));
    const decline = Array.from({ length: 60 }, (_, i) => 200 - i * 1.5 + (i % 4 === 0 ? 3 : 0));
    const rallyK = stochRsi(rally, 14, 14, 3, 3).k;
    const declineK = stochRsi(decline, 14, 14, 3, 3).k;
    expect(rallyK[rallyK.length - 1]).toBeGreaterThan(declineK[declineK.length - 1]!);
  });
});

describe("isEmaFlatteningOrUpward", () => {
  it("is true when the EMA is higher than it was `lookback` candles ago", () => {
    const series = [10, 11, 12, 13, 14, 15, 16];
    expect(isEmaFlatteningOrUpward(series, 3)).toBe(true);
  });

  it("is false when the EMA has declined", () => {
    const series = [16, 15, 14, 13, 12, 11, 10];
    expect(isEmaFlatteningOrUpward(series, 3)).toBe(false);
  });
});

describe("isMakingLowerHighsLowerLows", () => {
  // A zigzag with three clean, decreasing swing peaks (100, 95, 85) and
  // three clean, decreasing swing troughs (90, 85, 75), each a local
  // extremum over its own 5-candle window — the shape the function looks for.
  const downtrendPath = [100, 95, 90, 95, 100, 92, 85, 90, 95, 80, 75, 80, 85, 70, 65];

  it("detects a clean downtrend structure (lower highs and lower lows)", () => {
    const candles = downtrendPath.map((p, i) => candle(i, { high: p + 2, low: p - 2 }));
    expect(isMakingLowerHighsLowerLows(candles, 15)).toBe(true);
  });

  it("is false for the time-reversed (uptrend) version of the same path", () => {
    const uptrendPath = downtrendPath.slice().reverse();
    const candles = uptrendPath.map((p, i) => candle(i, { high: p + 2, low: p - 2 }));
    expect(isMakingLowerHighsLowerLows(candles, 15)).toBe(false);
  });
});

describe("bullish / bearish RSI divergence", () => {
  it("detects bullish divergence: lower price low but higher RSI low", () => {
    const lows = [50, 48, 52, 44, 49, 46, 43, 41, 45, 42, 40];
    const candles = lows.map((low, i) => candle(i, { low, high: low + 10, close: low + 5 }));
    const rsiValues = [40, 35, 45, 20, 38, 40, 42, 30, 41, 39, 33]; // higher low at the second swing (30 > 20)
    expect(hasBullishRsiDivergence(candles, rsiValues, 11)).toBe(true);
  });

  it("detects bearish divergence: higher price high but lower RSI high", () => {
    const highs = [50, 55, 52, 60, 54, 57, 62, 58, 56, 59, 65];
    const candles = highs.map((high, i) => candle(i, { high, low: high - 10, close: high - 5 }));
    const rsiValues = [55, 70, 58, 65, 60, 62, 55, 61, 59, 60, 50]; // lower RSI high at the second swing (55 < 65)
    expect(hasBearishRsiDivergence(candles, rsiValues, 11)).toBe(true);
  });
});

describe("isBullishConfirmationCandle", () => {
  it("is true for a strong green candle closing near its high", () => {
    expect(isBullishConfirmationCandle(candle(0, { open: 100, close: 105, high: 106, low: 99 }))).toBe(true);
  });

  it("is false for a red candle", () => {
    expect(isBullishConfirmationCandle(candle(0, { open: 105, close: 100, high: 106, low: 99 }))).toBe(false);
  });
});

describe("secondLast", () => {
  it("returns the second-to-last element", () => {
    expect(secondLast([1, 2, 3])).toBe(2);
  });

  it("is undefined for arrays shorter than 2", () => {
    expect(secondLast([1])).toBeUndefined();
  });
});

describe("vwap", () => {
  it("equals the typical price when volume is constant and price is flat", () => {
    const candles = Array.from({ length: 10 }, (_, i) => candle(i, { high: 102, low: 98, close: 100, volume: 500 }));
    const series = vwap(candles, 5);
    expect(series[9]).toBeCloseTo(100, 5);
  });

  it("weights toward the higher-volume candle's typical price", () => {
    const candles = [candle(0, { high: 102, low: 98, close: 100, volume: 100 }), candle(1, { high: 202, low: 198, close: 200, volume: 10_000 })];
    const series = vwap(candles, 2);
    expect(series[1]).toBeGreaterThan(150); // pulled heavily toward the ~200 candle's huge volume
  });
});

describe("isMakingHigherHighsHigherLows", () => {
  // Mirror of the downtrend fixture in isMakingLowerHighsLowerLows above.
  const uptrendPath = [65, 70, 75, 80, 85, 90, 95, 80, 92, 100, 95, 90, 95, 105, 100];

  it("detects a clean uptrend/breakout structure (higher highs and higher lows)", () => {
    const candles = uptrendPath.map((p, i) => candle(i, { high: p + 2, low: p - 2 }));
    expect(isMakingHigherHighsHigherLows(candles, 15)).toBe(true);
  });

  it("is false for the time-reversed (downtrend) version of the same path", () => {
    const downtrendPath = uptrendPath.slice().reverse();
    const candles = downtrendPath.map((p, i) => candle(i, { high: p + 2, low: p - 2 }));
    expect(isMakingHigherHighsHigherLows(candles, 15)).toBe(false);
  });
});

describe("stochRsiCrossedUp / stochRsiCrossedDown", () => {
  it("detects a bullish crossover: K was <= D and is now > D", () => {
    const stoch = { k: [10, 20, 40], d: [30, 25, 25] }; // K: 20<=25 -> 40>25
    expect(stochRsiCrossedUp(stoch)).toBe(true);
    expect(stochRsiCrossedDown(stoch)).toBe(false);
  });

  it("detects a bearish crossover: K was >= D and is now < D", () => {
    const stoch = { k: [40, 30, 10], d: [20, 25, 25] }; // K: 30>=25 -> 10<25
    expect(stochRsiCrossedDown(stoch)).toBe(true);
    expect(stochRsiCrossedUp(stoch)).toBe(false);
  });

  it("is false when K and D move together with no crossover", () => {
    const stoch = { k: [40, 45, 50], d: [20, 25, 30] };
    expect(stochRsiCrossedUp(stoch)).toBe(false);
    expect(stochRsiCrossedDown(stoch)).toBe(false);
  });
});
