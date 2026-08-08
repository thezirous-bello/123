import { fetchJson } from "./httpHelper.js";
import type { ExchangeAdapter, TickerQuote } from "./types.js";

interface GateioTickerRow {
  currency_pair: string; // "BTC_USDT"
  highest_bid: string;
  lowest_ask: string;
}

export const gateioAdapter: ExchangeAdapter = {
  id: "gateio",
  label: "GATE.IO",
  defaultTakerFeePct: 0.2,
  async fetchTickers(symbols) {
    const rows = await fetchJson<GateioTickerRow[]>("gateio", "https://api.gateio.ws/api/v4/spot/tickers");
    if (!rows) return null;
    const wanted = new Set(symbols.map((s) => `${s}_USDT`));
    const out = new Map<string, TickerQuote>();
    for (const row of rows) {
      if (!wanted.has(row.currency_pair)) continue;
      const bid = Number(row.highest_bid);
      const ask = Number(row.lowest_ask);
      if (!(bid > 0) || !(ask > 0)) continue;
      out.set(row.currency_pair.split("_")[0]!, { bid, ask });
    }
    return out;
  },
};
