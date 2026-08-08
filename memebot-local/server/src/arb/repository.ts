import { db, newId, nowIso } from "../db/index.js";
import { Decimal } from "../lib/decimal.js";
import { recordLog } from "../lib/auditLog.js";
import { botEvents } from "../lib/events.js";
import type { ExchangeId } from "./exchanges/index.js";

// ---- Paper account (separate pool from the meme-coin bot's) ----

export interface ArbPaperAccount {
  startingBalanceUsd: Decimal;
  cashBalanceUsd: Decimal;
  createdAt: string;
  updatedAt: string;
}

export function getArbPaperAccount(): ArbPaperAccount {
  const row = db.prepare("SELECT * FROM arb_paper_account WHERE id = 1").get() as Record<string, unknown>;
  return {
    startingBalanceUsd: new Decimal(row.starting_balance_usd as string),
    cashBalanceUsd: new Decimal(row.cash_balance_usd as string),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function adjustArbPaperCash(deltaUsd: Decimal): ArbPaperAccount {
  const current = getArbPaperAccount();
  const next = current.cashBalanceUsd.plus(deltaUsd);
  db.prepare("UPDATE arb_paper_account SET cash_balance_usd = ?, updated_at = ? WHERE id = 1").run(next.toFixed(), nowIso());
  const account = getArbPaperAccount();
  botEvents.emitEvent("wallet_balance_changed", { bot: "arb", paper: true, cashBalanceUsd: account.cashBalanceUsd.toFixed() });
  return account;
}

export function resetArbPaperAccount(startingBalanceUsd: Decimal): ArbPaperAccount {
  const now = nowIso();
  db.prepare("UPDATE arb_paper_account SET starting_balance_usd = ?, cash_balance_usd = ?, updated_at = ? WHERE id = 1").run(
    startingBalanceUsd.toFixed(),
    startingBalanceUsd.toFixed(),
    now,
  );
  db.prepare("DELETE FROM arb_trades").run();
  db.prepare("DELETE FROM arb_opportunities").run();
  recordLog("info", "arb_paper_account", `Arb paper account reset to $${startingBalanceUsd.toFixed(2)}`);
  return getArbPaperAccount();
}

// ---- Opportunities ----

export interface ArbOpportunity {
  id: string;
  symbol: string;
  buyExchange: ExchangeId;
  buyPrice: Decimal;
  sellExchange: ExchangeId;
  sellPrice: Decimal;
  grossSpreadPct: Decimal;
  netSpreadPct: Decimal;
  acted: boolean;
  skipReason: string | null;
  createdAt: string;
}

function rowToOpportunity(row: Record<string, unknown>): ArbOpportunity {
  return {
    id: row.id as string,
    symbol: row.symbol as string,
    buyExchange: row.buy_exchange as ExchangeId,
    buyPrice: new Decimal(row.buy_price as string),
    sellExchange: row.sell_exchange as ExchangeId,
    sellPrice: new Decimal(row.sell_price as string),
    grossSpreadPct: new Decimal(row.gross_spread_pct as string),
    netSpreadPct: new Decimal(row.net_spread_pct as string),
    acted: row.acted === 1,
    skipReason: (row.skip_reason as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export interface CreateOpportunityParams {
  symbol: string;
  buyExchange: ExchangeId;
  buyPrice: Decimal;
  sellExchange: ExchangeId;
  sellPrice: Decimal;
  grossSpreadPct: Decimal;
  netSpreadPct: Decimal;
  acted: boolean;
  skipReason: string | null;
}

export function createOpportunity(params: CreateOpportunityParams): ArbOpportunity {
  const id = newId();
  const now = nowIso();
  db.prepare(
    `INSERT INTO arb_opportunities (id, symbol, buy_exchange, buy_price, sell_exchange, sell_price, gross_spread_pct, net_spread_pct, acted, skip_reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.symbol,
    params.buyExchange,
    params.buyPrice.toFixed(),
    params.sellExchange,
    params.sellPrice.toFixed(),
    params.grossSpreadPct.toFixed(),
    params.netSpreadPct.toFixed(),
    params.acted ? 1 : 0,
    params.skipReason,
    now,
  );
  const row = db.prepare("SELECT * FROM arb_opportunities WHERE id = ?").get(id) as Record<string, unknown>;
  const opportunity = rowToOpportunity(row);
  botEvents.emitEvent("arb_opportunity_created", opportunity);
  return opportunity;
}

export function listOpportunities(limit = 100): ArbOpportunity[] {
  return (db.prepare("SELECT * FROM arb_opportunities ORDER BY created_at DESC LIMIT ?").all(limit) as Record<string, unknown>[]).map(rowToOpportunity);
}

export function countOpportunitiesForSymbolSince(symbol: string, sinceIso: string): number {
  const row = db.prepare("SELECT COUNT(*) as n FROM arb_opportunities WHERE symbol = ? AND acted = 1 AND created_at >= ?").get(symbol, sinceIso) as { n: number };
  return row.n;
}

export function lastActedOpportunityForSymbol(symbol: string): ArbOpportunity | null {
  const row = db.prepare("SELECT * FROM arb_opportunities WHERE symbol = ? AND acted = 1 ORDER BY created_at DESC LIMIT 1").get(symbol) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToOpportunity(row) : null;
}

// ---- Trades ----

export interface ArbTrade {
  id: string;
  opportunityId: string | null;
  symbol: string;
  buyExchange: ExchangeId;
  buyPrice: Decimal;
  sellExchange: ExchangeId;
  sellPrice: Decimal;
  qty: Decimal;
  notionalUsd: Decimal;
  grossProfitUsd: Decimal;
  feeUsd: Decimal;
  netProfitUsd: Decimal;
  createdAt: string;
}

function rowToTrade(row: Record<string, unknown>): ArbTrade {
  return {
    id: row.id as string,
    opportunityId: (row.opportunity_id as string) ?? null,
    symbol: row.symbol as string,
    buyExchange: row.buy_exchange as ExchangeId,
    buyPrice: new Decimal(row.buy_price as string),
    sellExchange: row.sell_exchange as ExchangeId,
    sellPrice: new Decimal(row.sell_price as string),
    qty: new Decimal(row.qty as string),
    notionalUsd: new Decimal(row.notional_usd as string),
    grossProfitUsd: new Decimal(row.gross_profit_usd as string),
    feeUsd: new Decimal(row.fee_usd as string),
    netProfitUsd: new Decimal(row.net_profit_usd as string),
    createdAt: row.created_at as string,
  };
}

export interface RecordArbTradeParams {
  opportunityId: string | null;
  symbol: string;
  buyExchange: ExchangeId;
  buyPrice: Decimal;
  sellExchange: ExchangeId;
  sellPrice: Decimal;
  qty: Decimal;
  notionalUsd: Decimal;
  grossProfitUsd: Decimal;
  feeUsd: Decimal;
  netProfitUsd: Decimal;
}

export function recordArbTrade(params: RecordArbTradeParams): ArbTrade {
  const id = newId();
  const now = nowIso();
  db.prepare(
    `INSERT INTO arb_trades (id, opportunity_id, symbol, buy_exchange, buy_price, sell_exchange, sell_price, qty, notional_usd, gross_profit_usd, fee_usd, net_profit_usd, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.opportunityId,
    params.symbol,
    params.buyExchange,
    params.buyPrice.toFixed(),
    params.sellExchange,
    params.sellPrice.toFixed(),
    params.qty.toFixed(),
    params.notionalUsd.toFixed(),
    params.grossProfitUsd.toFixed(),
    params.feeUsd.toFixed(),
    params.netProfitUsd.toFixed(),
    now,
  );
  const row = db.prepare("SELECT * FROM arb_trades WHERE id = ?").get(id) as Record<string, unknown>;
  const trade = rowToTrade(row);
  botEvents.emitEvent("arb_trade_created", trade);
  return trade;
}

export function listArbTrades(limit = 200): ArbTrade[] {
  return (db.prepare("SELECT * FROM arb_trades ORDER BY created_at DESC LIMIT ?").all(limit) as Record<string, unknown>[]).map(rowToTrade);
}

export function realizedPnlSinceArb(sinceIso: string): Decimal {
  const rows = db.prepare("SELECT net_profit_usd FROM arb_trades WHERE created_at >= ?").all(sinceIso) as Array<{ net_profit_usd: string }>;
  return rows.reduce((sum, r) => sum.plus(new Decimal(r.net_profit_usd)), new Decimal(0));
}
