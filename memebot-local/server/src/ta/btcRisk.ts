import { getKlines, type Candle } from "../bybit/marketData.js";
import { atr } from "./indicators.js";
import type { BybitMode } from "../bybit/client.js";

// The user's original strategy wanted two checks this app can't honestly
// implement: "no major economic event within ±30min" and "no urgent
// negative market-wide news in the past 2 hours" — both need a paid news/
// calendar API this project doesn't have. Per the user's explicit choice,
// this is a real substitute, not a fake pass-through: it flags a shock when
// BTC itself shows abnormal volatility (range or volume) in the last four
// 30-minute candles (2 hours), which is what a real macro/news event
// actually looks like on-chart, even though it can't name the cause.
const LOOKBACK_CANDLES = 4; // last 2 hours of 30m candles
const RANGE_SHOCK_MULTIPLIER = 2.5; // matches the strategy's own per-symbol shock check
const VOLUME_SHOCK_MULTIPLIER = 3;

export interface BtcVolatilityCheck {
  flagged: boolean;
  detail: string;
}

export async function checkBtcVolatilityShock(mode: BybitMode): Promise<BtcVolatilityCheck> {
  const candles = await getKlines("BTCUSDT", 30, 60, mode);
  if (candles.length < 20) {
    return { flagged: false, detail: "Not enough BTC candle history to evaluate — not blocking." };
  }
  const atrSeries = atr(candles, 14);
  const currentAtr = atrSeries[atrSeries.length - 1];
  const recentVolumes = candles.slice(-20, -LOOKBACK_CANDLES).map((c) => c.volume);
  const avgVolume = recentVolumes.length > 0 ? recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length : 0;

  const window = candles.slice(-LOOKBACK_CANDLES);
  for (const candle of window) {
    const range = candle.high - candle.low;
    if (currentAtr && !Number.isNaN(currentAtr) && range > currentAtr * RANGE_SHOCK_MULTIPLIER) {
      return {
        flagged: true,
        detail: `BTC 30m candle range ${range.toFixed(1)} is ${(range / currentAtr).toFixed(1)}x ATR(14) within the last 2h — proxy for a market-wide shock event.`,
      };
    }
    if (avgVolume > 0 && candle.volume > avgVolume * VOLUME_SHOCK_MULTIPLIER) {
      return {
        flagged: true,
        detail: `BTC 30m volume spiked to ${(candle.volume / avgVolume).toFixed(1)}x its 20-candle average within the last 2h — proxy for a market-wide shock event.`,
      };
    }
  }
  return { flagged: false, detail: "No abnormal BTC volatility in the last 2h." };
}

export function summarizeCandle(candle: Candle): string {
  return `O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close}`;
}
