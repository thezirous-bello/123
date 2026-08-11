import { db, newId } from "../db/index.js";
import { fetchTokenSnapshotByMint, searchTokens } from "./dexscreener.js";
import { fetchHeliusAssetMetadata } from "./heliusMetadata.js";
import { fetchJupiterPriceOnly } from "./jupiterPrice.js";
import type { TokenSnapshot } from "./types.js";

export { searchTokens };

/** Maximum age a snapshot may have and still be used to approve a trade.
 * Anything older is treated as stale data, per the "never execute a trade
 * using stale data" requirement. */
export const MAX_SNAPSHOT_AGE_SECONDS = 90;

function persistSnapshot(snapshot: TokenSnapshot): void {
  db.prepare(
    `INSERT INTO token_snapshots (
      id, mint, symbol, name, price_usd, liquidity_usd, market_cap_usd, fdv_usd,
      volume_5m_usd, volume_1h_usd, volume_6h_usd, volume_24h_usd,
      price_change_5m_pct, price_change_1h_pct, price_change_6h_pct, price_change_24h_pct,
      buys_5m, sells_5m, buys_1h, sells_1h, buys_6h, sells_6h, buys_24h, sells_24h,
      pair_created_at, dex_id, pair_address, quote_symbol, source, fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    snapshot.mint,
    snapshot.symbol,
    snapshot.name,
    snapshot.priceUsd,
    snapshot.liquidityUsd,
    snapshot.marketCapUsd,
    snapshot.fdvUsd,
    snapshot.volume5mUsd,
    snapshot.volume1hUsd,
    snapshot.volume6hUsd,
    snapshot.volume24hUsd,
    snapshot.priceChange5mPct,
    snapshot.priceChange1hPct,
    snapshot.priceChange6hPct,
    snapshot.priceChange24hPct,
    snapshot.buys5m,
    snapshot.sells5m,
    snapshot.buys1h,
    snapshot.sells1h,
    snapshot.buys6h,
    snapshot.sells6h,
    snapshot.buys24h,
    snapshot.sells24h,
    snapshot.pairCreatedAt,
    snapshot.dexId,
    snapshot.pairAddress,
    snapshot.quoteSymbol,
    snapshot.source,
    snapshot.fetchedAt,
  );
}

/** Fetches a fresh snapshot for a mint, enriches missing name/symbol from
 * Helius if configured, fills in 1m/15m price change from our own stored
 * history (DexScreener doesn't provide those windows at all), and persists
 * the result for history/analytics/ranking. Returns null (never throws) if
 * no market data could be found at all — callers must treat that as
 * "cannot trade this token", not retry blindly.
 *
 * Falls back to Jupiter's price API for a bare price when DexScreener has
 * no pair for this mint yet — thin coverage (price only, no volume/liquidity)
 * but keeps a token visible instead of going fully dark on one provider's
 * outage or a token that hasn't been indexed there yet. */
export async function getFreshTokenSnapshot(mint: string): Promise<TokenSnapshot | null> {
  let snapshot = await fetchTokenSnapshotByMint(mint);

  if (!snapshot) {
    const fallbackPrice = await fetchJupiterPriceOnly(mint);
    if (fallbackPrice === null) return null;
    snapshot = {
      mint,
      symbol: null,
      name: null,
      priceUsd: fallbackPrice,
      liquidityUsd: null,
      marketCapUsd: null,
      fdvUsd: null,
      volume5mUsd: null,
      volume1hUsd: null,
      volume6hUsd: null,
      volume24hUsd: null,
      volume1mUsd: null,
      priceChange5mPct: null,
      priceChange1hPct: null,
      priceChange6hPct: null,
      priceChange24hPct: null,
      priceChange1mPct: null,
      priceChange15mPct: null,
      buys5m: null,
      sells5m: null,
      buys1h: null,
      sells1h: null,
      buys6h: null,
      sells6h: null,
      buys24h: null,
      sells24h: null,
      pairCreatedAt: null,
      dexId: null,
      pairAddress: null,
      quoteSymbol: null,
      source: "jupiter-price-fallback",
      fetchedAt: new Date().toISOString(),
    };
  }

  if (!snapshot.name || !snapshot.symbol) {
    const fallback = await fetchHeliusAssetMetadata(mint);
    if (fallback) {
      snapshot.name = snapshot.name ?? fallback.name;
      snapshot.symbol = snapshot.symbol ?? fallback.symbol;
    }
  }

  if (snapshot.priceUsd !== null) {
    const derived = deriveShortTermChanges(mint, snapshot.priceUsd);
    snapshot.priceChange1mPct = derived.priceChange1mPct;
    snapshot.priceChange15mPct = derived.priceChange15mPct;
  }

  persistSnapshot(snapshot);
  return snapshot;
}

export function isSnapshotFresh(snapshot: TokenSnapshot, maxAgeSeconds = MAX_SNAPSHOT_AGE_SECONDS): boolean {
  const ageMs = Date.now() - new Date(snapshot.fetchedAt).getTime();
  return ageMs <= maxAgeSeconds * 1000;
}

function rowToSnapshot(row: Record<string, unknown>): TokenSnapshot {
  const num = (v: unknown): number | null => (v !== null && v !== undefined ? Number(v) : null);
  const int = (v: unknown): number | null => (v !== null && v !== undefined ? Number.parseInt(String(v), 10) : null);
  return {
    mint: row.mint as string,
    symbol: (row.symbol as string) ?? null,
    name: (row.name as string) ?? null,
    priceUsd: num(row.price_usd),
    liquidityUsd: num(row.liquidity_usd),
    marketCapUsd: num(row.market_cap_usd),
    fdvUsd: num(row.fdv_usd),
    volume5mUsd: num(row.volume_5m_usd),
    volume1hUsd: num(row.volume_1h_usd),
    volume6hUsd: num(row.volume_6h_usd),
    volume24hUsd: num(row.volume_24h_usd),
    volume1mUsd: null,
    priceChange5mPct: num(row.price_change_5m_pct),
    priceChange1hPct: num(row.price_change_1h_pct),
    priceChange6hPct: num(row.price_change_6h_pct),
    priceChange24hPct: num(row.price_change_24h_pct),
    priceChange1mPct: null,
    priceChange15mPct: null,
    buys5m: int(row.buys_5m),
    sells5m: int(row.sells_5m),
    buys1h: int(row.buys_1h),
    sells1h: int(row.sells_1h),
    buys6h: int(row.buys_6h),
    sells6h: int(row.sells_6h),
    buys24h: int(row.buys_24h),
    sells24h: int(row.sells_24h),
    pairCreatedAt: (row.pair_created_at as string) ?? null,
    dexId: (row.dex_id as string) ?? null,
    pairAddress: (row.pair_address as string) ?? null,
    quoteSymbol: (row.quote_symbol as string) ?? null,
    source: row.source as string,
    fetchedAt: row.fetched_at as string,
  };
}

export function latestPersistedSnapshot(mint: string): TokenSnapshot | null {
  const row = db
    .prepare("SELECT * FROM token_snapshots WHERE mint = ? ORDER BY fetched_at DESC LIMIT 1")
    .get(mint) as Record<string, unknown> | undefined;
  return row ? rowToSnapshot(row) : null;
}

export function tokenAgeMinutes(snapshot: TokenSnapshot): number | null {
  if (!snapshot.pairCreatedAt) return null;
  return (Date.now() - new Date(snapshot.pairCreatedAt).getTime()) / 60_000;
}

export interface PricePoint {
  fetchedAt: string;
  priceUsd: number | null;
}

/** Recent price history for a mint, built from the snapshots the bot has
 * actually collected while scanning — not a real candlestick feed, but a
 * genuine record of what price this app observed and when. */
export function listRecentSnapshots(mint: string, limit = 60): PricePoint[] {
  const rows = db
    .prepare("SELECT price_usd, fetched_at FROM token_snapshots WHERE mint = ? ORDER BY fetched_at DESC LIMIT ?")
    .all(mint, limit) as Array<{ price_usd: string | null; fetched_at: string }>;
  return rows.reverse().map((r) => ({ fetchedAt: r.fetched_at, priceUsd: r.price_usd !== null ? Number(r.price_usd) : null }));
}

export interface ShortTermChanges {
  priceChange1mPct: number | null;
  priceChange15mPct: number | null;
}

/** Finds the observation closest to (but not after) `now - windowMinutes`
 * and returns the % change from that observed price to `currentPriceUsd`.
 * Returns null when no observation old enough exists yet (e.g. a token the
 * bot only just started watching) — never interpolated or guessed. */
export function computeChangeOverWindow(history: PricePoint[], currentPriceUsd: number, windowMinutes: number, nowMs = Date.now()): number | null {
  const cutoffMs = nowMs - windowMinutes * 60_000;
  let reference: PricePoint | null = null;
  for (const point of history) {
    const pointMs = new Date(point.fetchedAt).getTime();
    if (pointMs > cutoffMs) break; // history is ascending by fetchedAt
    reference = point;
  }
  if (!reference || reference.priceUsd === null || reference.priceUsd === 0) return null;
  // Require the reference point to actually be reasonably close to the
  // target window (within 3x), otherwise a sparse-history token would
  // silently report a "1m change" that's actually from 40 minutes ago.
  const referenceMs = new Date(reference.fetchedAt).getTime();
  const ageMinutes = (nowMs - referenceMs) / 60_000;
  if (ageMinutes > windowMinutes * 3 + 2) return null;
  return ((currentPriceUsd - reference.priceUsd) / reference.priceUsd) * 100;
}

/** 1m/15m price change computed from this app's own stored snapshot
 * history — DexScreener does not expose either window directly, so per the
 * "calculate it from available historical observations when possible"
 * requirement, we derive it from real observed prices instead of leaving it
 * unavailable whenever we have close-enough history to do so honestly. */
export function deriveShortTermChanges(mint: string, currentPriceUsd: number, nowMs = Date.now()): ShortTermChanges {
  const history = listRecentSnapshots(mint, 120);
  return {
    priceChange1mPct: computeChangeOverWindow(history, currentPriceUsd, 1, nowMs),
    priceChange15mPct: computeChangeOverWindow(history, currentPriceUsd, 15, nowMs),
  };
}
