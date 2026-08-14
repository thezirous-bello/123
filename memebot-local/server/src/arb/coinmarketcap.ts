import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../lib/providerHealth.js";
import type { ExchangeId } from "./exchanges/index.js";

/**
 * CoinMarketCap's own per-exchange slug (see GET /v1/exchange/map) — best-
 * effort, not verified against live docs from this environment. If the logs
 * show "CoinMarketCap identity refresh found 0 USDT pairs" for a given
 * exchange, this is the first thing to check/correct.
 */
const CMC_EXCHANGE_SLUG: Record<ExchangeId, string> = {
  binance: "binance",
  bybit: "bybit",
  okx: "okx",
  kucoin: "kucoin",
  gateio: "gate-io",
  mexc: "mexc",
  kraken: "kraken",
  bitstamp: "bitstamp",
};

const CMC_API_URL = "https://pro-api.coinmarketcap.com";
// Independent second source: only worth calling when CoinGecko didn't
// already cover an exchange for this refresh cycle, so the free-tier
// monthly credit budget (10k) is barely touched even refreshing daily.
const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const REQUEST_DELAY_MS = 2200; // stay well inside CMC Basic's 30 req/min cap

interface CmcMarketPair {
  market_pair?: string;
  market_pair_base?: { currency_id?: number; currency_symbol?: string };
  quote?: { exchange_reported?: { quote_currency_symbol?: string } };
}
interface CmcMarketPairsResponse {
  data?: { market_pairs?: CmcMarketPair[] };
}

export function isCoinMarketCapConfigured(): boolean {
  return !!env.COINMARKETCAP_API_KEY;
}

let lastRefreshAtMs = 0;
let refreshInFlight: Promise<void> | null = null;

async function fetchExchangeMarketPairs(slug: string): Promise<CmcMarketPair[] | null> {
  if (!env.COINMARKETCAP_API_KEY) return null;
  const startedAt = performance.now();
  try {
    const res = await fetch(`${CMC_API_URL}/v1/exchange/market-pairs/latest?slug=${slug}&limit=5000`, {
      headers: { accept: "application/json", "X-CMC_PRO_API_KEY": env.COINMARKETCAP_API_KEY },
    });
    if (!res.ok) {
      recordProviderFailure("coinmarketcap", `HTTP ${res.status} on exchange/market-pairs/latest (slug=${slug})`);
      return null;
    }
    const data = (await res.json()) as CmcMarketPairsResponse;
    recordProviderSuccess("coinmarketcap", performance.now() - startedAt);
    return data.data?.market_pairs ?? [];
  } catch (err) {
    recordProviderFailure("coinmarketcap", (err as Error).message);
    return null;
  }
}

/** Returns symbol -> CMC numeric currency id for every USDT pair CMC reports
 * on this exchange, or null if CMC isn't configured / the call failed. */
export async function fetchCmcIdentityForExchange(exchange: ExchangeId): Promise<Map<string, string> | null> {
  const slug = CMC_EXCHANGE_SLUG[exchange];
  const pairs = await fetchExchangeMarketPairs(slug);
  if (!pairs) return null;
  const out = new Map<string, string>();
  for (const p of pairs) {
    const quoteSymbol = p.quote?.exchange_reported?.quote_currency_symbol;
    const baseSymbol = p.market_pair_base?.currency_symbol;
    const baseId = p.market_pair_base?.currency_id;
    if (quoteSymbol !== "USDT" || !baseSymbol || !baseId) continue;
    out.set(baseSymbol.toUpperCase(), String(baseId));
  }
  if (out.size === 0) {
    logger.warn({ exchange, slug }, "CoinMarketCap identity refresh found 0 USDT pairs for this exchange — check CMC_EXCHANGE_SLUG in arb/coinmarketcap.ts");
  }
  return out;
}

/**
 * Refreshes CMC identity data for exchanges CoinGecko couldn't cover this
 * cycle, at most once per REFRESH_INTERVAL_MS per call site — the caller
 * (identity.ts) decides which exchanges actually need it. No-ops entirely
 * if COINMARKETCAP_API_KEY isn't set. Not awaited on the scan hot path.
 */
export function refreshCmcIdentityForExchangesIfStale(
  exchanges: ExchangeId[],
  onResult: (exchange: ExchangeId, symbolToId: Map<string, string>) => void,
): Promise<void> {
  if (!isCoinMarketCapConfigured() || exchanges.length === 0) return Promise.resolve();
  const now = Date.now();
  if (now - lastRefreshAtMs < REFRESH_INTERVAL_MS) return Promise.resolve();
  if (refreshInFlight) return refreshInFlight;
  lastRefreshAtMs = now;
  refreshInFlight = (async () => {
    for (let i = 0; i < exchanges.length; i++) {
      const result = await fetchCmcIdentityForExchange(exchanges[i]!);
      if (result) onResult(exchanges[i]!, result);
      if (i < exchanges.length - 1) await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

interface CmcQuoteEntry {
  quote?: { USD?: { market_cap?: number } };
}
interface CmcQuotesResponse {
  data?: Record<string, CmcQuoteEntry>;
}

/** Batch market-cap lookup by CMC numeric id (up to 100 ids/call, well
 * inside Basic-plan limits). Returns null if CMC isn't configured or the
 * call failed — never a fabricated/guessed number. */
export async function fetchCmcMarketCaps(cmcIds: string[]): Promise<Map<string, number> | null> {
  if (!env.COINMARKETCAP_API_KEY || cmcIds.length === 0) return null;
  const startedAt = performance.now();
  try {
    const res = await fetch(`${CMC_API_URL}/v2/cryptocurrency/quotes/latest?id=${cmcIds.join(",")}&convert=USD`, {
      headers: { accept: "application/json", "X-CMC_PRO_API_KEY": env.COINMARKETCAP_API_KEY },
    });
    if (!res.ok) {
      recordProviderFailure("coinmarketcap", `HTTP ${res.status} on cryptocurrency/quotes/latest`);
      return null;
    }
    const data = (await res.json()) as CmcQuotesResponse;
    recordProviderSuccess("coinmarketcap", performance.now() - startedAt);
    const out = new Map<string, number>();
    for (const [id, entry] of Object.entries(data.data ?? {})) {
      const cap = entry.quote?.USD?.market_cap;
      if (typeof cap === "number") out.set(id, cap);
    }
    return out;
  } catch (err) {
    recordProviderFailure("coinmarketcap", (err as Error).message);
    return null;
  }
}
