import { fetchJson } from "./httpHelper.js";
import type { ExchangeAdapter, TickerQuote } from "./types.js";

interface KucoinTickerRow {
  symbol: string; // "BTC-USDT"
  buy: string; // best bid
  sell: string; // best ask
}

interface KucoinTickersResult {
  code: string;
  data: { ticker: KucoinTickerRow[] };
}

export const kucoinAdapter: ExchangeAdapter = {
  id: "kucoin",
  label: "KUCOIN",
  defaultTakerFeePct: 0.1,
  async fetchTickers(symbols) {
    const result = await fetchJson<KucoinTickersResult>("kucoin", "https://api.kucoin.com/api/v1/market/allTickers");
    if (!result) return null;
    const wanted = new Set(symbols.map((s) => `${s}-USDT`));
    const out = new Map<string, TickerQuote>();
    for (const row of result.data.ticker) {
      if (!wanted.has(row.symbol)) continue;
      const bid = Number(row.buy);
      const ask = Number(row.sell);
      if (!(bid > 0) || !(ask > 0)) continue;
      out.set(row.symbol.split("-")[0]!, { bid, ask });
    }
    return out;
  },
};
