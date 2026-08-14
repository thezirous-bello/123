import { fetchJson } from "./httpHelper.js";
import type { ExchangeAdapter, TickerQuote } from "./types.js";

// Kraken's public Ticker endpoint takes a comma-separated `pair` param and
// returns all of them in one call — batched here rather than one call per
// symbol, same "one call regardless of watchlist size" principle as the
// other adapters, just chunked because Kraken's URL/param-count limits are
// less generous than a single request for 500 pairs.
const BATCH_SIZE = 60;

// Kraken renames a handful of legacy assets (most famously BTC -> XBT).
// Only the common ones are covered — an unmapped symbol is sent through
// unchanged, correct for the great majority of assets.
const SYMBOL_ALIASES: Record<string, string> = { BTC: "XBT", DOGE: "XDG" };

interface KrakenTickerRow {
  a?: string[]; // ask [price, wholeLotVolume, lotVolume]
  b?: string[]; // bid
}
interface KrakenTickerResponse {
  error?: string[];
  result?: Record<string, KrakenTickerRow>;
}

export const krakenAdapter: ExchangeAdapter = {
  id: "kraken",
  label: "KRAKEN",
  defaultTakerFeePct: 0.26,
  async fetchTickers(symbols) {
    const out = new Map<string, TickerQuote>();
    const withAlias = symbols.map((s) => ({ original: s, krakenAsset: SYMBOL_ALIASES[s] ?? s }));

    for (let i = 0; i < withAlias.length; i += BATCH_SIZE) {
      const batch = withAlias.slice(i, i + BATCH_SIZE);
      const pairParam = batch.map((b) => `${b.krakenAsset}USD`).join(",");
      const data = await fetchJson<KrakenTickerResponse>("kraken", `https://api.kraken.com/0/public/Ticker?pair=${encodeURIComponent(pairParam)}`);
      if (!data?.result) continue;

      for (const { original, krakenAsset } of batch) {
        // Kraken frequently returns the pair under a differently-prefixed
        // result key than requested (e.g. asking for XBTUSD can come back
        // keyed "XXBTZUSD") — match defensively by finding any result key
        // that contains the asset code and ends in USD, rather than
        // requiring an exact key match.
        const matchKey = Object.keys(data.result).find(
          (k) => k.toUpperCase().includes(krakenAsset.toUpperCase()) && k.toUpperCase().endsWith("USD"),
        );
        if (!matchKey) continue;
        const row = data.result[matchKey];
        const bid = Number(row?.b?.[0]);
        const ask = Number(row?.a?.[0]);
        if (!(bid > 0) || !(ask > 0)) continue;
        out.set(original, { bid, ask });
      }
    }
    return out.size > 0 ? out : null;
  },
};
