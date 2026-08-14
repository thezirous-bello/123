import { fetchJson } from "./httpHelper.js";
import type { ExchangeAdapter, TickerQuote } from "./types.js";

// Bitstamp, unlike every other exchange in this app, has no single "all
// tickers" endpoint — its public ticker API is one call per pair
// (/api/v2/ticker/{pair}/). Calling that individually for a 500-symbol
// watchlist every scan would be ~500 requests per cycle, which is neither
// realistic for Bitstamp's public rate limit nor in keeping with this
// app's "one call regardless of list size" design. Bitstamp's own listing
// is also historically much smaller than the other 7 exchanges here
// (well under 100 pairs, almost entirely large/major-cap coins), so instead
// of guessing which of the ~500 configured symbols it might list, this
// adapter only checks a fixed shortlist of coins Bitstamp realistically
// carries — real per-pair calls, just bounded in count rather than
// attempted for the whole watchlist.
const BITSTAMP_SHORTLIST = [
  "BTC", "ETH", "SOL", "XRP", "LTC", "BCH", "ADA", "DOT", "LINK", "UNI",
  "AAVE", "ALGO", "AVAX", "MATIC", "ATOM", "XLM", "XTZ", "ETC", "EOS", "FIL",
  "COMP", "MKR", "SNX", "YFI", "GRT", "BAT", "ENJ", "MANA", "SAND", "CRV",
  "DOGE", "SHIB", "NEAR", "APT", "ARB", "OP", "SUI", "PEPE", "USDT", "PAXG",
];

interface BitstampTickerResponse {
  bid?: string;
  ask?: string;
}

export const bitstampAdapter: ExchangeAdapter = {
  id: "bitstamp",
  label: "BITSTAMP",
  defaultTakerFeePct: 0.3,
  async fetchTickers(symbols) {
    const wanted = new Set(symbols.map((s) => s.toUpperCase()));
    const toCheck = BITSTAMP_SHORTLIST.filter((s) => wanted.has(s));
    if (toCheck.length === 0) return null;

    const out = new Map<string, TickerQuote>();
    const results = await Promise.all(
      toCheck.map(async (symbol) => {
        const pair = `${symbol.toLowerCase()}usd`;
        const data = await fetchJson<BitstampTickerResponse>("bitstamp", `https://www.bitstamp.net/api/v2/ticker/${pair}/`);
        return [symbol, data] as const;
      }),
    );
    for (const [symbol, data] of results) {
      if (!data) continue;
      const bid = Number(data.bid);
      const ask = Number(data.ask);
      if (!(bid > 0) || !(ask > 0)) continue;
      out.set(symbol, { bid, ask });
    }
    return out.size > 0 ? out : null;
  },
};
