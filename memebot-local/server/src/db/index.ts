import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "..", "data");
mkdirSync(dataDir, { recursive: true });

// Tests get their own throwaway database file so they never read or mutate
// real trading history on disk.
const dbFileName = process.env.NODE_ENV === "test" ? "memebot.test.sqlite" : "memebot.sqlite";
const dbPath = join(dataDir, dbFileName);
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/** CREATE TABLE IF NOT EXISTS never adds a column to a table that already
 * exists from an earlier version of this app (e.g. anyone who ran the bot
 * before the futures_* tables gained confidence/leverage/position-sizing
 * columns) — this is the additive-migration escape hatch for that. Table
 * names are always our own hardcoded strings, never user input. */
function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function runMigrations() {
  const sql = readFileSync(join(__dirname, "migrations.sql"), "utf-8");
  db.exec(sql);

  // Additive migrations for anyone upgrading from a version of this app
  // where futures_signals/futures_positions had a different shape (that
  // shape is now the spot_* tables) — see ensureColumn's comment.
  ensureColumn("futures_signals", "confidence", "TEXT NOT NULL DEFAULT 'medium'");
  ensureColumn("futures_signals", "leverage", "INTEGER NOT NULL DEFAULT 20");
  ensureColumn("futures_signals", "position_size_pct", "TEXT NOT NULL DEFAULT '30'");
  ensureColumn("futures_positions", "confidence", "TEXT NOT NULL DEFAULT 'medium'");

  // Expanded market-data windows for anyone upgrading from a version of
  // this app that only tracked 5m/1h. See market/types.ts TokenSnapshot.
  ensureColumn("token_snapshots", "volume_6h_usd", "TEXT");
  ensureColumn("token_snapshots", "volume_24h_usd", "TEXT");
  ensureColumn("token_snapshots", "price_change_6h_pct", "TEXT");
  ensureColumn("token_snapshots", "price_change_24h_pct", "TEXT");
  ensureColumn("token_snapshots", "buys_1h", "INTEGER");
  ensureColumn("token_snapshots", "sells_1h", "INTEGER");
  ensureColumn("token_snapshots", "buys_6h", "INTEGER");
  ensureColumn("token_snapshots", "sells_6h", "INTEGER");
  ensureColumn("token_snapshots", "buys_24h", "INTEGER");
  ensureColumn("token_snapshots", "sells_24h", "INTEGER");
  // Low-water-mark counterpart to trailing_stop_high_usd, for max-adverse-
  // excursion (MAE) logging alongside the existing max-favorable-excursion
  // (trailing high).
  ensureColumn("positions", "lowest_price_seen_usd", "TEXT");

  const account = db.prepare("SELECT id FROM paper_account WHERE id = 1").get();
  if (!account) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO paper_account (id, starting_balance_usd, cash_balance_usd, created_at, updated_at)
       VALUES (1, '1000', '1000', ?, ?)`,
    ).run(now, now);
  }

  const state = db.prepare("SELECT id FROM bot_state WHERE id = 1").get();
  if (!state) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO bot_state (id, running, mode, emergency_stopped, updated_at)
       VALUES (1, 0, 'paper', 0, ?)`,
    ).run(now);
  }

  const spotState = db.prepare("SELECT id FROM spot_bot_state WHERE id = 1").get();
  if (!spotState) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO spot_bot_state (id, running, mode, emergency_stopped, consecutive_losses, updated_at)
       VALUES (1, 0, 'testnet', 0, 0, ?)`,
    ).run(now);
  }

  const futuresState = db.prepare("SELECT id FROM futures_bot_state WHERE id = 1").get();
  if (!futuresState) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO futures_bot_state (id, running, mode, emergency_stopped, consecutive_losses, updated_at)
       VALUES (1, 0, 'testnet', 0, 0, ?)`,
    ).run(now);
  }

  const arbAccount = db.prepare("SELECT id FROM arb_paper_account WHERE id = 1").get();
  if (!arbAccount) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO arb_paper_account (id, starting_balance_usd, cash_balance_usd, created_at, updated_at)
       VALUES (1, '10000', '10000', ?, ?)`,
    ).run(now, now);
  }

  const arbState = db.prepare("SELECT id FROM arb_bot_state WHERE id = 1").get();
  if (!arbState) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO arb_bot_state (id, running, emergency_stopped, total_scans, updated_at)
       VALUES (1, 0, 0, 0, ?)`,
    ).run(now);
  }

  logger.info({ dbPath }, "database ready");
}

runMigrations();

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}
