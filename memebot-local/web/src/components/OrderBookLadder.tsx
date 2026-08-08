import type { OrderbookLevel } from "../api/client.js";

/** Real bid/ask depth ladder — fed by /spot/orderbook or
 * /futures/orderbook, which proxy Bybit's own public orderbook endpoint.
 * No synthetic levels: an empty side just renders no rows. */
export function OrderBookLadder({ bids, asks }: { bids: OrderbookLevel[]; asks: OrderbookLevel[] }) {
  const maxSize = Math.max(1, ...bids.map((b) => b.size), ...asks.map((a) => a.size));
  const rows = 8;

  return (
    <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
      <div className="space-y-0.5">
        <div className="mb-1 flex justify-between text-white/30">
          <span>BID</span>
          <span>SIZE</span>
        </div>
        {asks
          .slice(0, rows)
          .reverse()
          .map((a, i) => (
            <Row key={`ask-${i}`} price={a.price} size={a.size} maxSize={maxSize} color="#FF3B5C" align="left" />
          ))}
      </div>
      <div className="space-y-0.5">
        <div className="mb-1 flex justify-between text-white/30">
          <span>SIZE</span>
          <span>ASK</span>
        </div>
        {bids.slice(0, rows).map((b, i) => (
          <Row key={`bid-${i}`} price={b.price} size={b.size} maxSize={maxSize} color="#00FFC8" align="right" />
        ))}
      </div>
    </div>
  );
}

function Row({ price, size, maxSize, color, align }: { price: number; size: number; maxSize: number; color: string; align: "left" | "right" }) {
  const pct = Math.min(100, (size / maxSize) * 100);
  return (
    <div className="relative flex justify-between overflow-hidden rounded-[2px] px-1 py-0.5">
      <div
        className="absolute inset-y-0"
        style={{ [align === "left" ? "right" : "left"]: 0, width: `${pct}%`, background: color, opacity: 0.12 } as React.CSSProperties}
      />
      {align === "left" ? (
        <>
          <span className="relative z-10" style={{ color }}>
            {price.toPrecision(6)}
          </span>
          <span className="relative z-10 text-white/50">{size.toFixed(3)}</span>
        </>
      ) : (
        <>
          <span className="relative z-10 text-white/50">{size.toFixed(3)}</span>
          <span className="relative z-10" style={{ color }}>
            {price.toPrecision(6)}
          </span>
        </>
      )}
    </div>
  );
}
