import { db } from "../db/index.js";
import { Decimal } from "../lib/decimal.js";

export type Mode = "paper" | "live";

export function countOpenPositions(mode: Mode): number {
  const row = db
    .prepare("SELECT COUNT(*) as n FROM positions WHERE status = 'open' AND mode = ?")
    .get(mode) as { n: number };
  return row.n;
}

export function countTradesSince(mode: Mode, sinceIso: string): number {
  const row = db
    .prepare("SELECT COUNT(*) as n FROM trades WHERE mode = ? AND side = 'buy' AND created_at >= ? AND status IN ('confirmed','simulated')")
    .get(mode, sinceIso) as { n: number };
  return row.n;
}

export function countStrategyTradesSince(strategyId: string, mode: Mode, sinceIso: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) as n FROM trades t JOIN positions p ON t.position_id = p.id
       WHERE p.strategy_id = ? AND t.mode = ? AND t.side = 'buy' AND t.created_at >= ? AND t.status IN ('confirmed','simulated')`,
    )
    .get(strategyId, mode, sinceIso) as { n: number };
  return row.n;
}

/** Realized PnL (USD) across closed positions since a given ISO timestamp,
 * for a given mode. Used for the daily-loss-limit check. */
export function realizedPnlSince(mode: Mode, sinceIso: string): Decimal {
  const rows = db
    .prepare("SELECT realized_pnl_usd FROM positions WHERE mode = ? AND status = 'closed' AND closed_at >= ?")
    .all(mode, sinceIso) as Array<{ realized_pnl_usd: string }>;
  return rows.reduce((sum, r) => sum.plus(new Decimal(r.realized_pnl_usd)), new Decimal(0));
}

/** Most recent N closed positions for a strategy, most recent first —
 * used to detect a losing streak for the consecutive-loss cooldown. */
export function recentClosedPositionOutcomes(strategyId: string | null, mode: Mode, limit: number): boolean[] {
  const rows = strategyId
    ? (db
        .prepare(
          "SELECT realized_pnl_usd FROM positions WHERE mode = ? AND status = 'closed' AND strategy_id = ? ORDER BY closed_at DESC LIMIT ?",
        )
        .all(mode, strategyId, limit) as Array<{ realized_pnl_usd: string }>)
    : (db
        .prepare("SELECT realized_pnl_usd FROM positions WHERE mode = ? AND status = 'closed' ORDER BY closed_at DESC LIMIT ?")
        .all(mode, limit) as Array<{ realized_pnl_usd: string }>);
  return rows.map((r) => new Decimal(r.realized_pnl_usd).lt(0));
}

export function lastLossTimeForStrategy(strategyId: string, mode: Mode): string | null {
  const row = db
    .prepare(
      `SELECT closed_at FROM positions WHERE mode = ? AND strategy_id = ? AND status = 'closed' AND CAST(realized_pnl_usd AS REAL) < 0
       ORDER BY closed_at DESC LIMIT 1`,
    )
    .get(mode, strategyId) as { closed_at: string } | undefined;
  return row?.closed_at ?? null;
}

export function openPositionForMint(mint: string, mode: Mode) {
  return db.prepare("SELECT * FROM positions WHERE mint = ? AND mode = ? AND status = 'open'").get(mint, mode) as
    | Record<string, unknown>
    | undefined;
}

export function totalOpenExposureUsd(mode: Mode): Decimal {
  const rows = db.prepare("SELECT cost_basis_usd FROM positions WHERE status = 'open' AND mode = ?").all(mode) as Array<{
    cost_basis_usd: string;
  }>;
  return rows.reduce((sum, r) => sum.plus(new Decimal(r.cost_basis_usd)), new Decimal(0));
}
