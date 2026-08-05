import { db } from "../src/db/index.js";

const TABLES = [
  "trades",
  "positions",
  "security_checks",
  "token_snapshots",
  "watchlist",
  "strategy_versions",
  "strategies",
  "risk_events",
  "bot_logs",
  "settings",
  "futures_trades",
  "futures_positions",
  "futures_signals",
];

/** Wipes all rows (schema stays) so each test starts from a clean, known
 * state in the throwaway test database. */
export function resetDb(): void {
  for (const table of TABLES) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
  const now = new Date().toISOString();
  db.prepare("UPDATE paper_account SET starting_balance_usd = '1000', cash_balance_usd = '1000', updated_at = ? WHERE id = 1").run(now);
  db.prepare(
    "UPDATE bot_state SET running = 0, mode = 'paper', active_strategy_id = NULL, emergency_stopped = 0, emergency_stopped_at = NULL, emergency_stopped_reason = NULL, updated_at = ? WHERE id = 1",
  ).run(now);
  db.prepare(
    "UPDATE futures_bot_state SET running = 0, mode = 'testnet', emergency_stopped = 0, emergency_stopped_at = NULL, emergency_stopped_reason = NULL, consecutive_losses = 0, trading_halted_until = NULL, updated_at = ? WHERE id = 1",
  ).run(now);
}

/** Inserts a minimal strategy row so tests can reference it as a foreign
 * key from positions/trades without going through the full strategy
 * creation flow. */
export function ensureTestStrategy(id = "strat-1"): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO strategies (id, name, raw_instruction, payload_json, version, enabled, archived, created_at, updated_at)
     VALUES (?, 'Test strategy', 'buy up to $10, stop loss at 20%', '{}', 1, 1, 0, ?, ?)`,
  ).run(id, now, now);
}
