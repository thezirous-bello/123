import { binanceAdapter } from "./binance.js";
import { bitstampAdapter } from "./bitstamp.js";
import { bybitSpotAdapter } from "./bybitSpot.js";
import { gateioAdapter } from "./gateio.js";
import { krakenAdapter } from "./kraken.js";
import { kucoinAdapter } from "./kucoin.js";
import { mexcAdapter } from "./mexc.js";
import { okxAdapter } from "./okx.js";
import type { ExchangeAdapter, ExchangeId, TickerQuote } from "./types.js";

export type { ExchangeAdapter, ExchangeId, TickerQuote };

export const EXCHANGE_REGISTRY: Record<ExchangeId, ExchangeAdapter> = {
  binance: binanceAdapter,
  bybit: bybitSpotAdapter,
  okx: okxAdapter,
  kucoin: kucoinAdapter,
  gateio: gateioAdapter,
  mexc: mexcAdapter,
  kraken: krakenAdapter,
  bitstamp: bitstampAdapter,
};

export const ALL_EXCHANGE_IDS = Object.keys(EXCHANGE_REGISTRY) as ExchangeId[];

/** Fetches best bid/ask from every requested exchange in parallel. A given
 * exchange's entry is simply absent from the result if that exchange's
 * fetch failed — callers should treat "missing" as "skip this exchange for
 * this scan," not as an error for the whole scan. */
export async function fetchAllTickers(exchangeIds: ExchangeId[], symbols: string[]): Promise<Map<ExchangeId, Map<string, TickerQuote>>> {
  const results = await Promise.all(
    exchangeIds.map(async (id) => {
      const adapter = EXCHANGE_REGISTRY[id];
      const tickers = await adapter.fetchTickers(symbols).catch(() => null);
      return [id, tickers] as const;
    }),
  );
  const out = new Map<ExchangeId, Map<string, TickerQuote>>();
  for (const [id, tickers] of results) {
    if (tickers) out.set(id, tickers);
  }
  return out;
}
