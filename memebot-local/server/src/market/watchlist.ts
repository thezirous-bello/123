import { db, nowIso } from "../db/index.js";
import { recordLog } from "../lib/auditLog.js";

export interface WatchlistEntry {
  mint: string;
  symbol: string | null;
  name: string | null;
  blocked: boolean;
  addedAt: string;
}

function rowToEntry(row: Record<string, unknown>): WatchlistEntry {
  return {
    mint: row.mint as string,
    symbol: (row.symbol as string) ?? null,
    name: (row.name as string) ?? null,
    blocked: row.blocked === 1,
    addedAt: row.added_at as string,
  };
}

export function listWatchlist(): WatchlistEntry[] {
  const rows = db.prepare("SELECT * FROM watchlist ORDER BY added_at DESC").all() as Record<string, unknown>[];
  return rows.map(rowToEntry);
}

export function addToWatchlist(mint: string, symbol: string | null, name: string | null): WatchlistEntry {
  db.prepare(
    `INSERT INTO watchlist (mint, symbol, name, blocked, added_at) VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(mint) DO UPDATE SET symbol = excluded.symbol, name = excluded.name`,
  ).run(mint, symbol, name, nowIso());
  recordLog("info", "watchlist", `Added ${symbol ?? mint} to watchlist`, { mint });
  return rowToEntry(db.prepare("SELECT * FROM watchlist WHERE mint = ?").get(mint) as Record<string, unknown>);
}

export function removeFromWatchlist(mint: string): void {
  db.prepare("DELETE FROM watchlist WHERE mint = ?").run(mint);
  recordLog("info", "watchlist", `Removed ${mint} from watchlist`, { mint });
}

export function setTokenBlocked(mint: string, blocked: boolean): void {
  const existing = db.prepare("SELECT mint FROM watchlist WHERE mint = ?").get(mint);
  if (!existing) {
    db.prepare("INSERT INTO watchlist (mint, symbol, name, blocked, added_at) VALUES (?, NULL, NULL, ?, ?)").run(
      mint,
      blocked ? 1 : 0,
      nowIso(),
    );
  } else {
    db.prepare("UPDATE watchlist SET blocked = ? WHERE mint = ?").run(blocked ? 1 : 0, mint);
  }
  recordLog("warn", "watchlist", `${blocked ? "Blocked" : "Unblocked"} token ${mint}`, { mint });
}

export function isTokenBlocked(mint: string): boolean {
  const row = db.prepare("SELECT blocked FROM watchlist WHERE mint = ?").get(mint) as
    | { blocked: number }
    | undefined;
  return row?.blocked === 1;
}
