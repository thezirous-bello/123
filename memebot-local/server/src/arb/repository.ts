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

// ---- Arb journeys (sequential buy -> withdraw -> sell -> chain-or-return-home) ----

export type JourneyStatus = "in_transit" | "checking_reverse" | "returning_home" | "closed";

export interface ArbJourney {
  id: string;
  symbol: string;
  originExchange: ExchangeId;
  currentExchange: ExchangeId;
  legDestinationExchange: ExchangeId | null;
  status: JourneyStatus;
  principalUsd: Decimal;
  assetQty: Decimal | null;
  usdAmount: Decimal | null;
  realizedProfitUsd: Decimal;
  legCount: number;
  openedAt: string;
  legStartedAt: string;
  arrivesAt: string | null;
  reverseCheckDeadline: string | null;
  closedAt: string | null;
  closeReason: string | null;
}

function rowToJourney(row: Record<string, unknown>): ArbJourney {
  return {
    id: row.id as string,
    symbol: row.symbol as string,
    originExchange: row.origin_exchange as ExchangeId,
    currentExchange: row.current_exchange as ExchangeId,
    legDestinationExchange: (row.leg_destination_exchange as ExchangeId) ?? null,
    status: row.status as JourneyStatus,
    principalUsd: new Decimal(row.principal_usd as string),
    assetQty: row.asset_qty !== null ? new Decimal(row.asset_qty as string) : null,
    usdAmount: row.usd_amount !== null ? new Decimal(row.usd_amount as string) : null,
    realizedProfitUsd: new Decimal(row.realized_profit_usd as string),
    legCount: row.leg_count as number,
    openedAt: row.opened_at as string,
    legStartedAt: row.leg_started_at as string,
    arrivesAt: (row.arrives_at as string) ?? null,
    reverseCheckDeadline: (row.reverse_check_deadline as string) ?? null,
    closedAt: (row.closed_at as string) ?? null,
    closeReason: (row.close_reason as string) ?? null,
  };
}

export function getJourney(id: string): ArbJourney | null {
  const row = db.prepare("SELECT * FROM arb_journeys WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToJourney(row) : null;
}

export function listOpenJourneys(): ArbJourney[] {
  return (db.prepare("SELECT * FROM arb_journeys WHERE status != 'closed' ORDER BY opened_at ASC").all() as Record<string, unknown>[]).map(rowToJourney);
}

export function listJourneys(limit = 100): ArbJourney[] {
  return (db.prepare("SELECT * FROM arb_journeys ORDER BY opened_at DESC LIMIT ?").all(limit) as Record<string, unknown>[]).map(rowToJourney);
}

export interface CreateJourneyParams {
  symbol: string;
  originExchange: ExchangeId;
  legDestinationExchange: ExchangeId;
  principalUsd: Decimal;
  assetQty: Decimal;
  arrivesAt: string;
}

/** Opens a new journey: capital just left originExchange (as assetQty of
 * `symbol`) headed for legDestinationExchange. currentExchange stays
 * originExchange until the leg actually arrives (see markArrivedAndSold). */
export function createJourney(params: CreateJourneyParams): ArbJourney {
  const id = newId();
  const now = nowIso();
  db.prepare(
    `INSERT INTO arb_journeys (
      id, symbol, origin_exchange, current_exchange, leg_destination_exchange, status,
      principal_usd, asset_qty, usd_amount, realized_profit_usd, leg_count,
      opened_at, leg_started_at, arrives_at, reverse_check_deadline, closed_at, close_reason
    ) VALUES (?, ?, ?, ?, ?, 'in_transit', ?, ?, NULL, '0', 1, ?, ?, ?, NULL, NULL, NULL)`,
  ).run(id, params.symbol, params.originExchange, params.originExchange, params.legDestinationExchange, params.principalUsd.toFixed(), params.assetQty.toFixed(), now, now, params.arrivesAt);
  const journey = getJourney(id) as ArbJourney;
  botEvents.emitEvent("arb_journey_changed", journey);
  recordLog(
    "info",
    "arb_bot",
    `${journey.symbol}: bought on ${journey.originExchange}, withdrawing to ${params.legDestinationExchange} (arrives ~${new Date(params.arrivesAt).toLocaleTimeString()})`,
    { journeyId: id },
  );
  return journey;
}

/** The in-flight leg has landed: sell the asset on the destination
 * exchange (current_exchange updates to where it landed) and open the
 * reverse-check window instead of immediately wiring proceeds home. */
export function markArrivedAndSold(id: string, params: { usdAmount: Decimal; reverseCheckDeadline: string }): ArbJourney {
  const journey = getJourney(id);
  if (!journey) throw new Error(`Journey ${id} not found`);
  const landedOn = journey.legDestinationExchange ?? journey.currentExchange;
  db.prepare(
    `UPDATE arb_journeys SET current_exchange = ?, leg_destination_exchange = NULL, status = 'checking_reverse',
       asset_qty = NULL, usd_amount = ?, reverse_check_deadline = ? WHERE id = ?`,
  ).run(landedOn, params.usdAmount.toFixed(), params.reverseCheckDeadline, id);
  const updated = getJourney(id) as ArbJourney;
  botEvents.emitEvent("arb_journey_changed", updated);
  recordLog(
    "info",
    "arb_bot",
    `${updated.symbol}: sold on ${landedOn} for $${params.usdAmount.toFixed(2)} — checking for a next opportunity from ${landedOn} for up to the reverse-check window before wiring it home.`,
    { journeyId: id },
  );
  return updated;
}

/** A profitable next leg appeared before the reverse-check deadline —
 * chain into it instead of paying a withdrawal fee to idly return home. */
export function chainNextLeg(id: string, params: { legDestinationExchange: ExchangeId; assetQty: Decimal; arrivesAt: string }): ArbJourney {
  const journey = getJourney(id);
  if (!journey) throw new Error(`Journey ${id} not found`);
  db.prepare(
    `UPDATE arb_journeys SET status = 'in_transit', leg_destination_exchange = ?, asset_qty = ?, usd_amount = NULL,
       leg_count = leg_count + 1, leg_started_at = ?, arrives_at = ?, reverse_check_deadline = NULL WHERE id = ?`,
  ).run(params.legDestinationExchange, params.assetQty.toFixed(), nowIso(), params.arrivesAt, id);
  const updated = getJourney(id) as ArbJourney;
  botEvents.emitEvent("arb_journey_changed", updated);
  recordLog(
    "info",
    "arb_bot",
    `${updated.symbol}: chained into a new leg from ${updated.currentExchange} -> ${params.legDestinationExchange} instead of returning capital home (leg ${updated.legCount}).`,
    { journeyId: id },
  );
  return updated;
}

/** No qualifying next leg within the reverse-check window — start
 * withdrawing the USDT sitting on current_exchange back to origin_exchange. */
export function beginReturnHome(id: string, params: { arrivesAt: string }): ArbJourney {
  const journey = getJourney(id);
  if (!journey) throw new Error(`Journey ${id} not found`);
  db.prepare(
    `UPDATE arb_journeys SET status = 'returning_home', leg_destination_exchange = ?, leg_started_at = ?, arrives_at = ?, reverse_check_deadline = NULL WHERE id = ?`,
  ).run(journey.originExchange, nowIso(), params.arrivesAt, id);
  const updated = getJourney(id) as ArbJourney;
  botEvents.emitEvent("arb_journey_changed", updated);
  recordLog(
    "info",
    "arb_bot",
    `${updated.symbol}: no qualifying opportunity from ${updated.currentExchange} within the reverse-check window — sending principal + profit back to ${journey.originExchange}.`,
    { journeyId: id },
  );
  return updated;
}

/** Capital has arrived back on origin_exchange — close the journey and
 * credit the shared paper cash pool with principal + profit (mirrors the
 * existing single-shot simulateTrade's adjustArbPaperCash call, so the
 * dashboard's existing Cash Balance / Realized PnL stats keep working
 * unchanged). */
export function closeJourneyReturnedHome(id: string, finalUsdAmount: Decimal): ArbJourney {
  const journey = getJourney(id);
  if (!journey) throw new Error(`Journey ${id} not found`);
  const profit = finalUsdAmount.minus(journey.principalUsd);
  const now = nowIso();
  db.prepare(
    `UPDATE arb_journeys SET status = 'closed', current_exchange = origin_exchange, leg_destination_exchange = NULL,
       usd_amount = ?, realized_profit_usd = ?, closed_at = ?, close_reason = 'returned_home' WHERE id = ?`,
  ).run(finalUsdAmount.toFixed(), profit.toFixed(), now, id);
  adjustArbPaperCash(finalUsdAmount);
  const updated = getJourney(id) as ArbJourney;
  botEvents.emitEvent("arb_journey_changed", updated);
  recordLog(
    "info",
    "arb_bot",
    `${updated.symbol}: journey closed — $${finalUsdAmount.toFixed(2)} back on ${journey.originExchange} (${profit.gte(0) ? "+" : ""}$${profit.toFixed(2)} net over ${updated.legCount} leg${updated.legCount === 1 ? "" : "s"}).`,
    { journeyId: id, legCount: updated.legCount },
  );
  return updated;
}

/** A leg failed a downstream check (e.g. the sell-side quote/route no
 * longer holds) — closes the journey without a home-return leg, crediting
 * back whatever was actually recovered (principal-only if the position had
 * to be unwound at cost, never fabricated). */
export function closeJourneyAborted(id: string, recoveredUsdAmount: Decimal, reason: string): ArbJourney {
  const journey = getJourney(id);
  if (!journey) throw new Error(`Journey ${id} not found`);
  const profit = recoveredUsdAmount.minus(journey.principalUsd);
  const now = nowIso();
  db.prepare(
    `UPDATE arb_journeys SET status = 'closed', usd_amount = ?, realized_profit_usd = ?, closed_at = ?, close_reason = ? WHERE id = ?`,
  ).run(recoveredUsdAmount.toFixed(), profit.toFixed(), now, reason, id);
  adjustArbPaperCash(recoveredUsdAmount);
  const updated = getJourney(id) as ArbJourney;
  botEvents.emitEvent("arb_journey_changed", updated);
  recordLog("warn", "arb_bot", `${updated.symbol}: journey aborted (${reason}) — recovered $${recoveredUsdAmount.toFixed(2)}.`, { journeyId: id });
  return updated;
}

/** Approximate bot-controlled paper capital currently sitting on each
 * exchange due to open journeys — usd_amount when it's cash, principal_usd
 * as a directional estimate while it's in transit as the asset itself
 * (exact live value would need a fresh price lookup this display doesn't
 * need to pay for). Informational only, never used in a trading decision. */
export function botControlledCapitalByExchange(): Record<string, Decimal> {
  const rows = db.prepare("SELECT current_exchange, principal_usd, usd_amount FROM arb_journeys WHERE status != 'closed'").all() as Array<{
    current_exchange: string;
    principal_usd: string;
    usd_amount: string | null;
  }>;
  const out: Record<string, Decimal> = {};
  for (const row of rows) {
    const amount = row.usd_amount !== null ? new Decimal(row.usd_amount) : new Decimal(row.principal_usd);
    out[row.current_exchange] = (out[row.current_exchange] ?? new Decimal(0)).plus(amount);
  }
  return out;
}

// ---- Real (informational-only) exchange balances ----

export interface ExchangeBalanceInfo {
  exchange: ExchangeId;
  hasRealFunds: boolean | null; // null = not configured / not checked yet
  checkedAt: string | null;
}

export function listExchangeBalances(exchanges: ExchangeId[]): ExchangeBalanceInfo[] {
  const rows = db.prepare("SELECT exchange_id, real_balance_usd, checked_at FROM arb_exchange_balances").all() as Array<{
    exchange_id: string;
    real_balance_usd: string | null;
    checked_at: string | null;
  }>;
  const byExchange = new Map(rows.map((r) => [r.exchange_id, r]));
  return exchanges.map((exchange) => {
    const row = byExchange.get(exchange);
    return {
      exchange,
      hasRealFunds: row?.real_balance_usd == null ? null : row.real_balance_usd === "has_funds",
      checkedAt: row?.checked_at ?? null,
    };
  });
}
