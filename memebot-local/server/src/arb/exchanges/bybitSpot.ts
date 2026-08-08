import { getAllTickers } from "../../bybit/marketData.js";
import type { ExchangeAdapter, TickerQuote } from "./types.js";

/** Reuses the same Bybit client the spot/futures bots use, but always
 * against mainnet ("live" mode) regardless of which mode those bots are
 * currently set to — arbitrage price comparisons need real prices,
 * testnet's simulated/fake prices would produce meaningless spreads
 * against the other five real exchanges. This is a public, unauthenticated
 * read (getAllTickers never signs a request), so it carries none of the
 * real-money risk "live mode" implies for the spot/futures bots. */
export const bybitSpotAdapter: ExchangeAdapter = {
  id: "bybit",
  label: "BYBIT",
  defaultTakerFeePct: 0.1,
  async fetchTickers(symbols) {
    const wanted = new Set(symbols.map((s) => `${s}USDT`));
    try {
      const tickers = await getAllTickers("live", "spot");
      const out = new Map<string, TickerQuote>();
      for (const t of tickers) {
        if (!wanted.has(t.symbol)) continue;
        if (!(t.bid1Price > 0) || !(t.ask1Price > 0)) continue;
        out.set(t.symbol.slice(0, -4), { bid: t.bid1Price, ask: t.ask1Price });
      }
      return out;
    } catch {
      return null; // getAllTickers/bybitGetPublic already record provider health on failure
    }
  },
};
