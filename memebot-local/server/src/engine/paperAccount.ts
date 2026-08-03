import { db, nowIso } from "../db/index.js";
import { Decimal } from "../lib/decimal.js";
import { recordLog } from "../lib/auditLog.js";
import { botEvents } from "../lib/events.js";

export interface PaperAccount {
  startingBalanceUsd: Decimal;
  cashBalanceUsd: Decimal;
  createdAt: string;
  updatedAt: string;
}

export function getPaperAccount(): PaperAccount {
  const row = db.prepare("SELECT * FROM paper_account WHERE id = 1").get() as Record<string, unknown>;
  return {
    startingBalanceUsd: new Decimal(row.starting_balance_usd as string),
    cashBalanceUsd: new Decimal(row.cash_balance_usd as string),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function adjustPaperCash(deltaUsd: Decimal): PaperAccount {
  const current = getPaperAccount();
  const next = current.cashBalanceUsd.plus(deltaUsd);
  db.prepare("UPDATE paper_account SET cash_balance_usd = ?, updated_at = ? WHERE id = 1").run(next.toFixed(), nowIso());
  const account = getPaperAccount();
  botEvents.emitEvent("wallet_balance_changed", { paper: true, cashBalanceUsd: account.cashBalanceUsd.toFixed() });
  return account;
}

/** Resets the paper account to a new starting balance and wipes paper
 * positions/trades so PnL reporting stays meaningful. Live trades and
 * positions are never touched by this. */
export function resetPaperAccount(startingBalanceUsd: Decimal): PaperAccount {
  const now = nowIso();
  db.prepare("UPDATE paper_account SET starting_balance_usd = ?, cash_balance_usd = ?, updated_at = ? WHERE id = 1").run(
    startingBalanceUsd.toFixed(),
    startingBalanceUsd.toFixed(),
    now,
  );
  db.prepare("DELETE FROM trades WHERE mode = 'paper'").run();
  db.prepare("DELETE FROM positions WHERE mode = 'paper'").run();
  recordLog("info", "paper_account", `Paper account reset to $${startingBalanceUsd.toFixed(2)}`);
  return getPaperAccount();
}
