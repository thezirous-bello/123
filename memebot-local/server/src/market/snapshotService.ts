import { db, newId } from "../db/index.js";
import { fetchTokenSnapshotByMint, searchTokens } from "./dexscreener.js";
import { fetchHeliusAssetMetadata } from "./heliusMetadata.js";
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
      volume_5m_usd, volume_1h_usd, price_change_5m_pct, price_change_1h_pct,
      buys_5m, sells_5m, pair_created_at, dex_id, pair_address, quote_symbol,
      source, fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    snapshot.priceChange5mPct,
    snapshot.priceChange1hPct,
    snapshot.buys5m,
    snapshot.sells5m,
    snapshot.pairCreatedAt,
    snapshot.dexId,
    snapshot.pairAddress,
    snapshot.quoteSymbol,
    snapshot.source,
    snapshot.fetchedAt,
  );
}

/** Fetches a fresh snapshot for a mint, enriches missing name/symbol from
 * Helius if configured, and persists it for history/analytics. Returns null
 * (never throws) if no market data could be found at all — callers must
 * treat that as "cannot trade this token", not retry blindly. */
export async function getFreshTokenSnapshot(mint: string): Promise<TokenSnapshot | null> {
  const snapshot = await fetchTokenSnapshotByMint(mint);
  if (!snapshot) return null;

  if (!snapshot.name || !snapshot.symbol) {
    const fallback = await fetchHeliusAssetMetadata(mint);
    if (fallback) {
      snapshot.name = snapshot.name ?? fallback.name;
      snapshot.symbol = snapshot.symbol ?? fallback.symbol;
    }
  }

  persistSnapshot(snapshot);
  return snapshot;
}

export function isSnapshotFresh(snapshot: TokenSnapshot, maxAgeSeconds = MAX_SNAPSHOT_AGE_SECONDS): boolean {
  const ageMs = Date.now() - new Date(snapshot.fetchedAt).getTime();
  return ageMs <= maxAgeSeconds * 1000;
}

export function latestPersistedSnapshot(mint: string): TokenSnapshot | null {
  const row = db
    .prepare("SELECT * FROM token_snapshots WHERE mint = ? ORDER BY fetched_at DESC LIMIT 1")
    .get(mint) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    mint: row.mint as string,
    symbol: (row.symbol as string) ?? null,
    name: (row.name as string) ?? null,
    priceUsd: row.price_usd !== null ? Number(row.price_usd) : null,
    liquidityUsd: row.liquidity_usd !== null ? Number(row.liquidity_usd) : null,
    marketCapUsd: row.market_cap_usd !== null ? Number(row.market_cap_usd) : null,
    fdvUsd: row.fdv_usd !== null ? Number(row.fdv_usd) : null,
    volume5mUsd: row.volume_5m_usd !== null ? Number(row.volume_5m_usd) : null,
    volume1hUsd: row.volume_1h_usd !== null ? Number(row.volume_1h_usd) : null,
    priceChange5mPct: row.price_change_5m_pct !== null ? Number(row.price_change_5m_pct) : null,
    priceChange1hPct: row.price_change_1h_pct !== null ? Number(row.price_change_1h_pct) : null,
    buys5m: row.buys_5m !== null ? Number(row.buys_5m) : null,
    sells5m: row.sells_5m !== null ? Number(row.sells_5m) : null,
    pairCreatedAt: (row.pair_created_at as string) ?? null,
    dexId: (row.dex_id as string) ?? null,
    pairAddress: (row.pair_address as string) ?? null,
    quoteSymbol: (row.quote_symbol as string) ?? null,
    source: row.source as string,
    fetchedAt: row.fetched_at as string,
  };
}

export function tokenAgeMinutes(snapshot: TokenSnapshot): number | null {
  if (!snapshot.pairCreatedAt) return null;
  return (Date.now() - new Date(snapshot.pairCreatedAt).getTime()) / 60_000;
}
