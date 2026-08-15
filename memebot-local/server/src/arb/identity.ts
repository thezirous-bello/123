import { db, nowIso } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../lib/providerHealth.js";
import { refreshCmcIdentityForExchangesIfStale, isCoinMarketCapConfigured } from "./coinmarketcap.js";
import { waitForCoinGeckoSlot, backOffAfterRateLimit } from "./coingeckoRateLimit.js";
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
  // "okx" itself resolved 0 tickers in real-world testing while every
  // other exchange here resolved hundreds — CoinGecko still uses OKX's
  // pre-rebrand id from when it was OKEx.
  okx: "okex",
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
// Node's fetch sends no User-Agent by default; a plain, honest one avoids
// some APIs' bot-detection heuristics rejecting UA-less requests outright.
const USER_AGENT = "memebot-local/1.0 (+https://github.com)";

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

function upsertIdentity(exchange: ExchangeId, symbol: string, ids: { coingeckoId?: string; cmcId?: string }): void {
  db.prepare(
    `INSERT INTO coin_identity_cache (exchange_id, symbol, coingecko_id, cmc_id, checked_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(exchange_id, symbol) DO UPDATE SET
       coingecko_id = COALESCE(excluded.coingecko_id, coin_identity_cache.coingecko_id),
       cmc_id = COALESCE(excluded.cmc_id, coin_identity_cache.cmc_id),
       checked_at = excluded.checked_at`,
  ).run(exchange, symbol, ids.coingeckoId ?? null, ids.cmcId ?? null, nowIso());
}

/** Result also signals whether this exchange got rate-limited (vs. just
 * having no more pages), so the caller knows whether a CMC fallback attempt
 * is worthwhile for this exchange this cycle. */
async function fetchExchangeTickerPage(slug: string, page: number): Promise<{ tickers: CoinGeckoTicker[] | null; rateLimited: boolean }> {
  await waitForCoinGeckoSlot();
  const startedAt = performance.now();
  try {
    const res = await fetch(`${COINGECKO_API_URL}/exchanges/${slug}/tickers?page=${page}&depth=false`, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
    });
    if (res.status === 429) {
      recordProviderFailure("coingecko", `HTTP 429 on exchanges/${slug}/tickers`);
      const backoffMs = backOffAfterRateLimit(res.headers.get("retry-after"));
      logger.warn({ slug, page, backoffMs }, "CoinGecko rate-limited the identity refresh — backing off before the next request");
      return { tickers: null, rateLimited: true };
    }
    if (!res.ok) {
      const bodyPreview = await res.text().then((t) => t.slice(0, 300)).catch(() => "");
      recordProviderFailure("coingecko", `HTTP ${res.status} on exchanges/${slug}/tickers${bodyPreview ? `: ${bodyPreview}` : ""}`);
      logger.warn({ slug, page, status: res.status, body: bodyPreview }, "CoinGecko identity refresh request failed");
      return { tickers: null, rateLimited: false };
    }
    const data = (await res.json()) as CoinGeckoTickersResponse;
    recordProviderSuccess("coingecko", performance.now() - startedAt);
    return { tickers: Array.isArray(data.tickers) ? data.tickers : [], rateLimited: false };
  } catch (err) {
    recordProviderFailure("coingecko", (err as Error).message);
    return { tickers: null, rateLimited: false };
  }
}

/** Returns how many tickers were found and whether the exchange got
 * rate-limited partway through (worth a CMC fallback attempt) vs. simply
 * ran out of pages or errored non-429 (CMC likely won't do better either,
 * but it's cheap enough to still try if configured). */
async function refreshExchangeIdentity(exchange: ExchangeId): Promise<{ found: number; rateLimited: boolean }> {
  const slug = COINGECKO_EXCHANGE_SLUG[exchange];
  let found = 0;
  let rateLimited = false;
  for (let page = 1; page <= MAX_PAGES_PER_EXCHANGE; page++) {
    const { tickers, rateLimited: wasRateLimited } = await fetchExchangeTickerPage(slug, page);
    if (wasRateLimited) {
      rateLimited = true;
      break; // don't keep digging into the same limit with more pages this cycle
    }
    if (!tickers || tickers.length === 0) break; // no more pages, or the slug/exchange is unreachable
    for (const t of tickers) {
      if (t.target !== "USDT" || !t.coin_id || !t.base) continue;
      upsertIdentity(exchange, t.base.toUpperCase(), { coingeckoId: t.coin_id });
      found += 1;
    }
  }
  if (found === 0 && !rateLimited) {
    logger.warn({ exchange, slug }, "CoinGecko identity refresh found 0 USDT tickers for this exchange — check COINGECKO_EXCHANGE_SLUG in arb/identity.ts");
  } else if (found > 0) {
    logger.info({ exchange, slug, found }, "CoinGecko identity refresh resolved USDT tickers for this exchange");
  }
  return { found, rateLimited };
}

/**
 * Refreshes the coin-identity cache for every configured exchange, at most
 * once per REFRESH_INTERVAL_MS — safe to call on every scan tick, it no-ops
 * between refreshes and coalesces concurrent calls into one in-flight
 * refresh. Deliberately not awaited on the scan hot path (see arb/controller.ts)
 * since a full refresh can take several minutes across 8 exchanges once
 * rate-limit-safe pacing is applied.
 *
 * CoinGecko is the primary source; any exchange that comes back rate-limited
 * or empty this cycle gets a CoinMarketCap fallback attempt afterward, if
 * COINMARKETCAP_API_KEY is configured (see coinmarketcap.ts) — the two
 * sources are never mixed for the same comparison (see
 * isSameCoinAcrossExchanges), only used independently per exchange.
 */
export function refreshCoinIdentityIfStale(exchanges: ExchangeId[]): Promise<void> {
  const now = Date.now();
  if (now - lastRefreshAtMs < REFRESH_INTERVAL_MS) return Promise.resolve();
  if (refreshInFlight) return refreshInFlight;
  lastRefreshAtMs = now;
  refreshInFlight = (async () => {
    const needsFallback: ExchangeId[] = [];
    for (const exchange of exchanges) {
      const { found, rateLimited } = await refreshExchangeIdentity(exchange);
      if (found === 0 && isCoinMarketCapConfigured()) needsFallback.push(exchange);
      else if (rateLimited) needsFallback.push(exchange);
    }
    if (needsFallback.length > 0) {
      logger.info({ exchanges: needsFallback }, "Falling back to CoinMarketCap identity data for exchanges CoinGecko couldn't cover this cycle");
      await refreshCmcIdentityForExchangesIfStale(needsFallback, (exchange, symbolToId) => {
        for (const [symbol, cmcId] of symbolToId) upsertIdentity(exchange, symbol, { cmcId });
      });
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export type IdentityCheckResult = "match" | "mismatch" | "unverifiable";

interface IdentityRow {
  coingecko_id: string | null;
  cmc_id: string | null;
}

/**
 * Whether `symbol` refers to the same underlying coin on both exchanges.
 * Compared via CoinGecko ids when both sides have one (primary source); if
 * either side lacks a CoinGecko id, falls back to comparing CMC ids when
 * both sides have one instead. The two id spaces are never cross-compared —
 * a CoinGecko id and a CMC id for the same real coin are different numbers,
 * so mixing them would produce false mismatches. "unverifiable" (no
 * comparable id pair from either source yet) is deliberately NOT treated as
 * a pass: callers must skip the trade rather than assume it's safe just
 * because we haven't checked.
 */
export function isSameCoinAcrossExchanges(symbol: string, exchangeA: ExchangeId, exchangeB: ExchangeId): IdentityCheckResult {
  const upper = symbol.toUpperCase();
  const a = db.prepare("SELECT coingecko_id, cmc_id FROM coin_identity_cache WHERE exchange_id = ? AND symbol = ?").get(exchangeA, upper) as
    | IdentityRow
    | undefined;
  const b = db.prepare("SELECT coingecko_id, cmc_id FROM coin_identity_cache WHERE exchange_id = ? AND symbol = ?").get(exchangeB, upper) as
    | IdentityRow
    | undefined;
  if (!a || !b) return "unverifiable";
  if (a.coingecko_id && b.coingecko_id) return a.coingecko_id === b.coingecko_id ? "match" : "mismatch";
  if (a.cmc_id && b.cmc_id) return a.cmc_id === b.cmc_id ? "match" : "mismatch";
  return "unverifiable";
}

export function hasIdentityDataFor(exchange: ExchangeId): boolean {
  const row = db.prepare("SELECT 1 FROM coin_identity_cache WHERE exchange_id = ? AND (coingecko_id IS NOT NULL OR cmc_id IS NOT NULL) LIMIT 1").get(exchange);
  return !!row;
}

/** How many symbols this exchange currently has identity data for — a
 * boolean "cached" badge can't tell you whether an exchange's CoinGecko
 * slug is actually resolving correctly (a handful of matches) vs. barely
 * working (e.g. one stray symbol) vs. genuinely covering the exchange
 * (hundreds); this makes that visible in the Exchange Health panel instead
 * of only in server logs. */
export function countIdentityDataFor(exchange: ExchangeId): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM coin_identity_cache WHERE exchange_id = ? AND (coingecko_id IS NOT NULL OR cmc_id IS NOT NULL)").get(
    exchange,
  ) as { c: number };
  return row.c;
}

/** Resolves the best-available canonical coin id for symbol@exchange —
 * CoinGecko id preferred, CMC id as fallback — for the market-cap gate
 * (see arb/marketCap.ts) to look up. Returns null if this exchange+symbol
 * has no identity data cached yet. */
export function resolveCoinId(exchange: ExchangeId, symbol: string): { source: "coingecko" | "cmc"; id: string } | null {
  const row = db.prepare("SELECT coingecko_id, cmc_id FROM coin_identity_cache WHERE exchange_id = ? AND symbol = ?").get(exchange, symbol.toUpperCase()) as
    | IdentityRow
    | undefined;
  if (!row) return null;
  if (row.coingecko_id) return { source: "coingecko", id: row.coingecko_id };
  if (row.cmc_id) return { source: "cmc", id: row.cmc_id };
  return null;
}
