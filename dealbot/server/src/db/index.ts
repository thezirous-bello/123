import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "..", "data");
mkdirSync(dataDir, { recursive: true });

// Tests get their own throwaway database file so they never read or mutate
// real data on disk.
const dbFileName = process.env.NODE_ENV === "test" ? "dealbot.test.sqlite" : "dealbot.sqlite";
const dbPath = join(dataDir, dbFileName);
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function runMigrations() {
  const sql = readFileSync(join(__dirname, "migrations.sql"), "utf-8");
  db.exec(sql);

  const state = db.prepare("SELECT id FROM bot_state WHERE id = 1").get();
  if (!state) {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO bot_state (id, running, paused, updated_at) VALUES (1, 0, 0, ?)`).run(now);
  }

  const rules = db.prepare("SELECT id FROM posting_rules WHERE id = 1").get();
  if (!rules) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO posting_rules (id, min_deal_score, min_deal_confidence, min_discount_pct, updated_at)
       VALUES (1, 75, 80, 15, ?)`,
    ).run(now);
  }
}

runMigrations();
