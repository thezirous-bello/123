import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { getPaperAccount } from "../engine/paperAccount.js";

interface EquityPoint {
  t: string;
  balance: number;
}

/** Reconstructs the paper account's cash balance over time by replaying
 * trades in order — a genuine equity curve from real trade history, not a
 * synthetic chart. Live-mode equity isn't reconstructed this way since a
 * wallet's SOL/token holdings fluctuate outside of trades too (price
 * movement on unsold positions); this is scoped to paper, which is also
 * what's active by default. */
function buildPaperEquityCurve(hours: number): EquityPoint[] {
  const account = getPaperAccount();
  const since = new Date(Date.now() - hours * 60 * 60_000).toISOString();

  const trades = db
    .prepare(
      `SELECT side, amount_usd, created_at FROM trades
       WHERE mode = 'paper' AND status = 'simulated' AND created_at >= ?
       ORDER BY created_at ASC`,
    )
    .all(since) as Array<{ side: "buy" | "sell"; amount_usd: string; created_at: string }>;

  // Walk backward from the current balance to the start of the window so
  // the curve ends exactly at today's real cash balance.
  let balance = Number(account.cashBalanceUsd.toFixed());
  const points: EquityPoint[] = [{ t: new Date().toISOString(), balance }];
  for (let i = trades.length - 1; i >= 0; i--) {
    const trade = trades[i];
    if (!trade) continue;
    const amount = Number(trade.amount_usd);
    balance = trade.side === "buy" ? balance + amount : balance - amount;
    points.push({ t: trade.created_at, balance });
  }
  points.reverse();
  return points;
}

export default async function analyticsRoutes(app: FastifyInstance) {
  app.get("/analytics/equity-curve", async (request) => {
    const { hours } = request.query as { hours?: string };
    const windowHours = hours ? Math.min(720, Math.max(1, Number.parseInt(hours, 10))) : 24;
    return buildPaperEquityCurve(windowHours);
  });
}
