import { db, nowIso } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../lib/providerHealth.js";
import type { ExchangeId } from "./exchanges/index.js";

/**
 * CoinGecko's own per-exchange slug (see GET /exchanges/list) — not
 * guessed at random, but CoinGecko does occasionally rename these, and this
 * app has no way to verify them against live docs. If the logs show
 * "CoinGecko identity refresh found 0 USDT tickers" for a given exchange,
 * that exchange's slug below is the first thing to check/correct.
 */
const COINGECKO_EXCHANGE_SLUG: Record<ExchangeId, string> = {
  binance: "binance",
  bybit: "bybit_spot",
  okx: "okx",
  kucoin: "kucoin",
  gateio: "gate",
  mexc: "mxc",
  kraken: "kraken",
  bitstamp: "bitstamp",
};

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";
// ~100 tickers/page on CoinGecko's exchange-tickers endpoint; covers even
// Binance's several-hundred USDT pairs without assuming an exact count.
const MAX_PAGES_PER_EXCHANGE = 8;
// Identity metadata (which coin a ticker actually is) essentially never
// changes minute to minute, so this only needs to run a couple of times a
// day — not on every 10s scan tick.
const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const PAGE_DELAY_MS = 1500; // stay well inside CoinGecko's free-tier rate limit

interface CoinGeckoTicker {
  base?: string;
  target?: string;
  coin_id?: string;
}
interface CoinGeckoTickersResponse {
  tickers?: CoinGeckoTicker[];
}

let lastRefreshAtMs = 0;
let refreshInFlight: Promise<void> | null = null;

function upsertIdentity(exchange: ExchangeId, symbol: string, coinGeckoId: string): void {
  db.prepare(
    `INSERT INTO coin_identity_cache (exchange_id, symbol, coingecko_id, checked_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(exchange_id, symbol) DO UPDATE SET coingecko_id = excluded.coingecko_id, checked_at = excluded.checked_at`,
  ).run(exchange, symbol, coinGeckoId, nowIso());
}

async function fetchExchangeTickerPage(slug: string, page: number): Promise<CoinGeckoTicker[] | null> {
  const startedAt = performance.now();
  try {
    const res = await fetch(`${COINGECKO_API_URL}/exchanges/${slug}/tickers?page=${page}&depth=false`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      recordProviderFailure("coingecko", `HTTP ${res.status} on exchanges/${slug}/tickers`);
      return null;
    }
    const data = (await res.json()) as CoinGeckoTickersResponse;
    recordProviderSuccess("coingecko", performance.now() - startedAt);
    return Array.isArray(data.tickers) ? data.tickers : [];
  } catch (err) {
    recordProviderFailure("coingecko", (err as Error).message);
    return null;
  }
}

async function refreshExchangeIdentity(exchange: ExchangeId): Promise<number> {
  const slug = COINGECKO_EXCHANGE_SLUG[exchange];
  let found = 0;
  for (let page = 1; page <= MAX_PAGES_PER_EXCHANGE; page++) {
    const tickers = await fetchExchangeTickerPage(slug, page);
    if (!tickers || tickers.length === 0) break; // no more pages, or the slug/exchange is unreachable
    for (const t of tickers) {
      if (t.target !== "USDT" || !t.coin_id || !t.base) continue;
      upsertIdentity(exchange, t.base.toUpperCase(), t.coin_id);
      found += 1;
    }
    if (page < MAX_PAGES_PER_EXCHANGE) await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
  }
  if (found === 0) {
    logger.warn({ exchange, slug }, "CoinGecko identity refresh found 0 USDT tickers for this exchange — check COINGECKO_EXCHANGE_SLUG in arb/identity.ts");
  }
  return found;
}

/**
 * Refreshes the coin-identity cache for every configured exchange, at most
 * once per REFRESH_INTERVAL_MS — safe to call on every scan tick, it no-ops
 * between refreshes and coalesces concurrent calls into one in-flight
 * refresh. Deliberately not awaited on the scan hot path (see arb/controller.ts)
 * since a full refresh can take well over a minute across 8 exchanges.
 */
export function refreshCoinIdentityIfStale(exchanges: ExchangeId[]): Promise<void> {
  const now = Date.now();
  if (now - lastRefreshAtMs < REFRESH_INTERVAL_MS) return Promise.resolve();
  if (refreshInFlight) return refreshInFlight;
  lastRefreshAtMs = now;
  refreshInFlight = (async () => {
    for (const exchange of exchanges) {
      await refreshExchangeIdentity(exchange);
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export type IdentityCheckResult = "match" | "mismatch" | "unverifiable";

/**
 * Whether `symbol` refers to the same underlying coin on both exchanges,
 * per CoinGecko's own per-exchange ticker->coin mapping — this is the fix
 * for "same ticker symbol, different actual coin" (a real risk once the
 * watchlist covers hundreds of small/mid-cap symbols, where ticker
 * collisions genuinely happen). "unverifiable" (no cached data yet for one
 * or both sides) is deliberately NOT treated as a pass: callers must skip
 * the trade rather than assume it's safe just because we haven't checked.
 */
export function isSameCoinAcrossExchanges(symbol: string, exchangeA: ExchangeId, exchangeB: ExchangeId): IdentityCheckResult {
  const upper = symbol.toUpperCase();
  const a = db.prepare("SELECT coingecko_id FROM coin_identity_cache WHERE exchange_id = ? AND symbol = ?").get(exchangeA, upper) as
    | { coingecko_id: string }
    | undefined;
  const b = db.prepare("SELECT coingecko_id FROM coin_identity_cache WHERE exchange_id = ? AND symbol = ?").get(exchangeB, upper) as
    | { coingecko_id: string }
    | undefined;
  if (!a || !b) return "unverifiable";
  return a.coingecko_id === b.coingecko_id ? "match" : "mismatch";
}

export function hasIdentityDataFor(exchange: ExchangeId): boolean {
  const row = db.prepare("SELECT 1 FROM coin_identity_cache WHERE exchange_id = ? LIMIT 1").get(exchange);
  return !!row;
}
