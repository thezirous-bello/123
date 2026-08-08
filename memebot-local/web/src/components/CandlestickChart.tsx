import { useMemo } from "react";
import type { Candle } from "../api/client.js";

/** Dependency-free SVG candlestick chart. Real OHLC data only — fed by
 * /spot/candles or /futures/candles, which proxy Bybit's own kline
 * endpoint (already used server-side for indicator calc); this component
 * never invents bars. */
export function CandlestickChart({ candles, height = 220 }: { candles: Candle[]; height?: number }) {
  const width = 700;
  const { bars, minPrice, maxPrice } = useMemo(() => {
    if (candles.length === 0) return { bars: [], minPrice: 0, maxPrice: 1 };
    const min = Math.min(...candles.map((c) => c.low));
    const max = Math.max(...candles.map((c) => c.high));
    return { bars: candles, minPrice: min, maxPrice: max };
  }, [candles]);

  if (bars.length === 0) {
    return (
      <div className="flex items-center justify-center font-mono text-xs text-white/30" style={{ height }}>
        Waiting for market data…
      </div>
    );
  }

  const pad = (maxPrice - minPrice) * 0.08 || maxPrice * 0.01 || 1;
  const lo = minPrice - pad;
  const hi = maxPrice + pad;
  const y = (price: number) => height - ((price - lo) / (hi - lo)) * height;
  const slotW = width / bars.length;
  const bodyW = Math.max(1.5, slotW * 0.55);

  const last = bars[bars.length - 1]!;
  const first = bars[0]!;
  const up = last.close >= first.open;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke="#ffffff" strokeOpacity={0.05} strokeWidth={1} />
      ))}
      {bars.map((c, i) => {
        const cx = i * slotW + slotW / 2;
        const bullish = c.close >= c.open;
        const color = bullish ? "#00FFC8" : "#FF3B5C";
        const bodyTop = y(Math.max(c.open, c.close));
        const bodyBottom = y(Math.min(c.open, c.close));
        return (
          <g key={c.startTime}>
            <line x1={cx} x2={cx} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1} strokeOpacity={0.8} />
            <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={Math.max(1, bodyBottom - bodyTop)} fill={color} fillOpacity={0.85} />
          </g>
        );
      })}
      <line x1={0} x2={width} y1={y(last.close)} y2={y(last.close)} stroke={up ? "#00FFC8" : "#FF3B5C"} strokeOpacity={0.35} strokeDasharray="2 4" />
    </svg>
  );
}
