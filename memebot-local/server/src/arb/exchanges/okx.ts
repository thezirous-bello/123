import { fetchJson } from "./httpHelper.js";
import type { ExchangeAdapter, TickerQuote } from "./types.js";

interface OkxTickerRow {
  instId: string; // "BTC-USDT"
  bidPx: string;
  askPx: string;
}

interface OkxTickersResult {
  code: string;
  data: OkxTickerRow[];
}

export const okxAdapter: ExchangeAdapter = {
  id: "okx",
  label: "OKX",
  defaultTakerFeePct: 0.1,
  async fetchTickers(symbols) {
    const result = await fetchJson<OkxTickersResult>("okx", "https://www.okx.com/api/v5/market/tickers?instType=SPOT");
    if (!result) return null;
    const wanted = new Set(symbols.map((s) => `${s}-USDT`));
    const out = new Map<string, TickerQuote>();
    for (const row of result.data) {
      if (!wanted.has(row.instId)) continue;
      const bid = Number(row.bidPx);
      const ask = Number(row.askPx);
      if (!(bid > 0) || !(ask > 0)) continue;
      out.set(row.instId.split("-")[0]!, { bid, ask });
    }
    return out;
  },
};
