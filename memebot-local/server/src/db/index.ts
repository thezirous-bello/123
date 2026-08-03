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

function runMigrations() {
  const sql = readFileSync(join(__dirname, "migrations.sql"), "utf-8");
  db.exec(sql);

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

  logger.info({ dbPath }, "database ready");
}

runMigrations();

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}
