import { db, nowIso } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../lib/providerHealth.js";
import { waitForCoinGeckoSlot, backOffAfterRateLimit } from "./coingeckoRateLimit.js";
import { fetchCmcMarketCaps, isCoinMarketCapConfigured } from "./coinmarketcap.js";
import { resolveCoinId } from "./identity.js";
import type { ExchangeId } from "./exchanges/index.js";

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";
// Market cap moves faster than "which coin is this ticker," but still
// doesn't need per-scan freshness — a few times a day is plenty for a
// >=$X-cap gate, and keeps this well within CoinGecko/CMC free-tier budgets.
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const COINGECKO_IDS_PER_CALL = 250; // CoinGecko /coins/markets max per_page
const CMC_IDS_PER_CALL = 100; // stays well under CMC's per-call and credit limits
const USER_AGENT = "memebot-local/1.0 (+https://github.com)";

let lastFullRefreshAtMs = 0;
let refreshInFlight: Promise<void> | null = null;
// Coin ids already covered by a market-cap lookup (either full or
// catch-up), keyed "source:id" — lets a brand-new coin id (identity data
// that only just resolved, e.g. from an exchange identity.ts hasn't
// finished paginating through yet) get its market cap looked up promptly
// instead of waiting for the next REFRESH_INTERVAL_MS window.
const knownCoinIds = new Set<string>();

/** Test-only: resets the module-level refresh state (this module's timers
 * and known-ids set persist across the whole process, so tests exercising
 * refreshMarketCapIfStale need a clean slate between cases). */
export function _resetMarketCapRefreshStateForTests(): void {
  lastFullRefreshAtMs = 0;
  refreshInFlight = null;
  knownCoinIds.clear();
}

function upsertMarketCap(source: "coingecko" | "cmc", coinId: string, marketCapUsd: number | null): void {
  db.prepare(
    `INSERT INTO coin_market_cap_cache (source, coin_id, market_cap_usd, checked_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(source, coin_id) DO UPDATE SET market_cap_usd = excluded.market_cap_usd, checked_at = excluded.checked_at`,
  ).run(source, coinId, marketCapUsd === null ? null : String(marketCapUsd), nowIso());
}

/** Every distinct coin id this app currently knows about, from whichever
 * identity source resolved it — the universe worth refreshing market caps
 * for (no point fetching a cap for a coin nothing is currently comparing). */
function distinctCachedCoinIds(): { coingeckoIds: string[]; cmcIds: string[] } {
  const rows = db.prepare("SELECT DISTINCT coingecko_id, cmc_id FROM coin_identity_cache").all() as Array<{
    coingecko_id: string | null;
    cmc_id: string | null;
  }>;
  const coingeckoIds = new Set<string>();
  const cmcIds = new Set<string>();
  for (const r of rows) {
    if (r.coingecko_id) coingeckoIds.add(r.coingecko_id);
    if (r.cmc_id) cmcIds.add(r.cmc_id);
  }
  return { coingeckoIds: [...coingeckoIds], cmcIds: [...cmcIds] };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface CoinGeckoMarketEntry {
  id?: string;
  market_cap?: number;
}

async function fetchCoinGeckoMarketCapBatch(ids: string[]): Promise<CoinGeckoMarketEntry[] | null> {
  await waitForCoinGeckoSlot();
  const startedAt = performance.now();
  try {
    const res = await fetch(`${COINGECKO_API_URL}/coins/markets?vs_currency=usd&ids=${ids.join(",")}&per_page=${ids.length}&page=1`, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
    });
    if (res.status === 429) {
      recordProviderFailure("coingecko", "HTTP 429 on coins/markets");
      const backoffMs = backOffAfterRateLimit(res.headers.get("retry-after"));
      logger.warn({ backoffMs }, "CoinGecko rate-limited the market-cap refresh — backing off before the next request");
      return null;
    }
    if (!res.ok) {
      const bodyPreview = await res.text().then((t) => t.slice(0, 300)).catch(() => "");
      recordProviderFailure("coingecko", `HTTP ${res.status} on coins/markets${bodyPreview ? `: ${bodyPreview}` : ""}`);
      logger.warn({ status: res.status, body: bodyPreview }, "CoinGecko market-cap refresh request failed");
      return null;
    }
    const data = (await res.json()) as CoinGeckoMarketEntry[];
    recordProviderSuccess("coingecko", performance.now() - startedAt);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    recordProviderFailure("coingecko", (err as Error).message);
    return null;
  }
}

async function refreshCoinIds(coingeckoIds: string[], cmcIds: string[]): Promise<void> {
  for (const batch of chunk(coingeckoIds, COINGECKO_IDS_PER_CALL)) {
    const entries = await fetchCoinGeckoMarketCapBatch(batch);
    if (!entries) continue;
    for (const e of entries) {
      if (e.id) upsertMarketCap("coingecko", e.id, typeof e.market_cap === "number" ? e.market_cap : null);
    }
  }
  if (isCoinMarketCapConfigured()) {
    for (const batch of chunk(cmcIds, CMC_IDS_PER_CALL)) {
      const caps = await fetchCmcMarketCaps(batch);
      if (!caps) continue;
      for (const id of batch) upsertMarketCap("cmc", id, caps.get(id) ?? null);
    }
  }
}

/**
 * Refreshes cached market caps for every coin this app currently has
 * identity data for. Two triggers, so a coin never waits a full
 * REFRESH_INTERVAL_MS just because its identity happened to resolve after
 * the last full refresh already ran (very possible on a cold start, since
 * identity.ts's CoinGecko pagination is rate-limit-paced and can take
 * several minutes to cover all configured exchanges):
 *   1. A full refresh, at most once per REFRESH_INTERVAL_MS, covering
 *      every currently-known coin id.
 *   2. A cheap "catch-up" refresh for any coin id identity.ts has resolved
 *      since the last time THIS function saw it — runs every call,
 *      independent of the full-refresh interval, but is a no-op (just a
 *      DB query + Set diff) once nothing new has appeared.
 * Coalesces concurrent calls. Deliberately not awaited on the scan hot path
 * (see arb/controller.ts). Shares the same rate-limit gate as identity.ts's
 * CoinGecko calls (see coingeckoRateLimit.ts) so the two refreshers never
 * together exceed CoinGecko's actual limit.
 */
export function refreshMarketCapIfStale(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  const now = Date.now();
  const { coingeckoIds, cmcIds } = distinctCachedCoinIds();
  const dueForFullRefresh = now - lastFullRefreshAtMs >= REFRESH_INTERVAL_MS;

  const newCoingeckoIds = coingeckoIds.filter((id) => !knownCoinIds.has(`coingecko:${id}`));
  const newCmcIds = cmcIds.filter((id) => !knownCoinIds.has(`cmc:${id}`));
  const hasNewIds = newCoingeckoIds.length > 0 || newCmcIds.length > 0;

  if (!dueForFullRefresh && !hasNewIds) return Promise.resolve();

  const [refreshCoingeckoIds, refreshCmcIds] = dueForFullRefresh ? [coingeckoIds, cmcIds] : [newCoingeckoIds, newCmcIds];
  if (refreshCoingeckoIds.length === 0 && refreshCmcIds.length === 0) return Promise.resolve();

  if (dueForFullRefresh) lastFullRefreshAtMs = now;
  refreshInFlight = refreshCoinIds(refreshCoingeckoIds, refreshCmcIds).finally(() => {
    for (const id of refreshCoingeckoIds) knownCoinIds.add(`coingecko:${id}`);
    for (const id of refreshCmcIds) knownCoinIds.add(`cmc:${id}`);
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export type MarketCapCheckResult = "sufficient" | "insufficient" | "unverifiable";

/**
 * Whether `symbol`'s current market cap clears `minUsd` — tries resolving
 * the coin's identity via exchangeA first, then exchangeB, so this still
 * works even when only one side has cached identity data yet. Missing
 * identity or missing/stale cap data is "unverifiable", never assumed to
 * pass — same never-fabricate philosophy as the identity/deposit gates.
 */
export function checkMinMarketCap(symbol: string, exchangeA: ExchangeId, exchangeB: ExchangeId, minUsd: number): MarketCapCheckResult {
  const identity = resolveCoinId(exchangeA, symbol) ?? resolveCoinId(exchangeB, symbol);
  if (!identity) return "unverifiable";
  const row = db.prepare("SELECT market_cap_usd FROM coin_market_cap_cache WHERE source = ? AND coin_id = ?").get(identity.source, identity.id) as
    | { market_cap_usd: string | null }
    | undefined;
  if (!row || row.market_cap_usd === null) return "unverifiable";
  const cap = Number(row.market_cap_usd);
  if (!Number.isFinite(cap)) return "unverifiable";
  return cap >= minUsd ? "sufficient" : "insufficient";
}
