import { fetchJson } from "./httpHelper.js";
import type { ExchangeAdapter, TickerQuote } from "./types.js";

interface BookTickerRow {
  symbol: string;
  bidPrice: string;
  askPrice: string;
}

/** Same bookTicker shape as Binance's — MEXC's API is Binance-compatible
 * for this endpoint. */
export const mexcAdapter: ExchangeAdapter = {
  id: "mexc",
  label: "MEXC",
  defaultTakerFeePct: 0.1,
  async fetchTickers(symbols) {
    const rows = await fetchJson<BookTickerRow[]>("mexc", "https://api.mexc.com/api/v3/ticker/bookTicker");
    if (!rows) return null;
    const wanted = new Set(symbols.map((s) => `${s}USDT`));
    const out = new Map<string, TickerQuote>();
    for (const row of rows) {
      if (!wanted.has(row.symbol)) continue;
      const bid = Number(row.bidPrice);
      const ask = Number(row.askPrice);
      if (!(bid > 0) || !(ask > 0)) continue;
      out.set(row.symbol.slice(0, -4), { bid, ask });
    }
    return out;
  },
};
