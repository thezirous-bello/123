import { useEffect, useState } from "react";
import { api, type Candle, type OrderbookLevel, type TickerSnapshot } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Badge } from "./Badge.js";
import { CandlestickChart } from "./CandlestickChart.js";
import { OrderBookLadder } from "./OrderBookLadder.js";

/** Real Bybit candles + order book for the bot's active symbol (its open
 * position if it has one, else BTCUSDT) — /spot or /futures candles,
 * orderbook and ticker routes simply proxy Bybit's own public market-data
 * endpoints, the same ones the strategy's indicators already read from. */
export function MarketChartPanel({ kind }: { kind: "spot" | "futures" }) {
  const tick = useRefreshSignal();
  const [symbol, setSymbol] = useState<string>("");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [book, setBook] = useState<{ bids: OrderbookLevel[]; asks: OrderbookLevel[] }>({ bids: [], asks: [] });
  const [ticker, setTicker] = useState<TickerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const candlesCall = kind === "spot" ? api.spotCandles() : api.futuresCandles();
    const bookCall = kind === "spot" ? api.spotOrderbook() : api.futuresOrderbook();
    const tickerCall = kind === "spot" ? api.spotTicker() : api.futuresTicker();

    candlesCall
      .then((r) => {
        setSymbol(r.symbol);
        setCandles(r.candles);
        setError(null);
      })
      .catch(() => setError("Bybit market data unavailable — check network/API config."));
    bookCall.then((r) => setBook({ bids: r.bids, asks: r.asks })).catch(() => {});
    tickerCall.then((r) => setTicker(r.ticker)).catch(() => {});
  }, [tick, kind]);

  const pct = ticker?.price24hPct ?? null;

  return (
    <Panel
      title={`Market Chart${symbol ? ` — ${symbol}` : ""}`}
      action={
        ticker && (
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="font-bold text-white">${ticker.lastPrice.toPrecision(6)}</span>
            {pct != null && <Badge tone={pct >= 0 ? "good" : "danger"}>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%</Badge>}
          </div>
        )
      }
    >
      {error ? (
        <p className="font-mono text-xs text-white/30">{error}</p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_200px]">
          <CandlestickChart candles={candles} height={160} />
          <OrderBookLadder bids={book.bids} asks={book.asks} rows={6} />
        </div>
      )}
    </Panel>
  );
}
