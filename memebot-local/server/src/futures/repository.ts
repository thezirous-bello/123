import { db, newId, nowIso } from "../db/index.js";
import { Decimal } from "../lib/decimal.js";
import { botEvents } from "../lib/events.js";
import type { BybitMode } from "../bybit/client.js";

export type SignalSide = "long" | "short";
export type SignalStatus = "pending" | "active" | "filled" | "cancelled" | "expired";

export interface TakeProfitPlan {
  label: "tp1" | "tp2" | "tp3";
  price: number;
  closePct: number;
}

export interface FuturesSignal {
  id: string;
  symbol: string;
  side: SignalSide;
  status: SignalStatus;
  entryPrice: Decimal;
  stopLoss: Decimal;
  takeProfits: TakeProfitPlan[];
  score: Decimal;
  stage1: Record<string, unknown>;
  stage2: Record<string, unknown>;
  cancelledReason: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

function rowToSignal(row: Record<string, unknown>): FuturesSignal {
  return {
    id: row.id as string,
    symbol: row.symbol as string,
    side: row.side as SignalSide,
    status: row.status as SignalStatus,
    entryPrice: new Decimal(row.entry_price as string),
    stopLoss: new Decimal(row.stop_loss as string),
    takeProfits: JSON.parse(row.take_profits_json as string),
    score: new Decimal(row.score as string),
    stage1: JSON.parse((row.stage1_json as string) ?? "{}"),
    stage2: JSON.parse((row.stage2_json as string) ?? "{}"),
    cancelledReason: (row.cancelled_reason as string) ?? null,
    expiresAt: row.expires_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function listPendingSignals(): FuturesSignal[] {
  return (db.prepare("SELECT * FROM futures_signals WHERE status = 'pending' ORDER BY created_at DESC").all() as Record<string, unknown>[]).map(
    rowToSignal,
  );
}

export function listSignals(limit = 100): FuturesSignal[] {
  return (db.prepare("SELECT * FROM futures_signals ORDER BY created_at DESC LIMIT ?").all(limit) as Record<string, unknown>[]).map(
    rowToSignal,
  );
}

export function getSignal(id: string): FuturesSignal | null {
  const row = db.prepare("SELECT * FROM futures_signals WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToSignal(row) : null;
}

export function hasPendingSignalForSymbol(symbol: string): boolean {
  const row = db.prepare("SELECT 1 FROM futures_signals WHERE symbol = ? AND status IN ('pending','active') LIMIT 1").get(symbol);
  return !!row;
}

export function countPendingSignals(): number {
  const row = db.prepare("SELECT COUNT(*) as n FROM futures_signals WHERE status IN ('pending','active')").get() as { n: number };
  return row.n;
}

export interface CreateSignalParams {
  symbol: string;
  side: SignalSide;
  entryPrice: Decimal;
  stopLoss: Decimal;
  takeProfits: TakeProfitPlan[];
  score: Decimal;
  stage1: Record<string, unknown>;
  expiryMinutes: number;
}

export function createSignal(params: CreateSignalParams): FuturesSignal {
  const id = newId();
  const now = nowIso();
  const expiresAt = new Date(Date.now() + params.expiryMinutes * 60_000).toISOString();
  db.prepare(
    `INSERT INTO futures_signals (id, symbol, side, status, entry_price, stop_loss, take_profits_json, score, stage1_json, stage2_json, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, '{}', ?, ?, ?)`,
  ).run(
    id,
    params.symbol,
    params.side,
    params.entryPrice.toFixed(),
    params.stopLoss.toFixed(),
    JSON.stringify(params.takeProfits),
    params.score.toFixed(),
    JSON.stringify(params.stage1),
    expiresAt,
    now,
    now,
  );
  const signal = getSignal(id) as FuturesSignal;
  botEvents.emitEvent("futures_signal_changed", signal);
  return signal;
}

export function updateSignalStatus(id: string, status: SignalStatus, extra?: { stage2?: Record<string, unknown>; cancelledReason?: string }): FuturesSignal {
  db.prepare(
    `UPDATE futures_signals SET status = ?, stage2_json = COALESCE(?, stage2_json), cancelled_reason = COALESCE(?, cancelled_reason), updated_at = ? WHERE id = ?`,
  ).run(status, extra?.stage2 ? JSON.stringify(extra.stage2) : null, extra?.cancelledReason ?? null, nowIso(), id);
  const signal = getSignal(id) as FuturesSignal;
  botEvents.emitEvent("futures_signal_changed", signal);
  return signal;
}

export function expireStaleSignals(): number {
  const now = nowIso();
  const stale = db
    .prepare("SELECT id FROM futures_signals WHERE status IN ('pending','active') AND expires_at < ?")
    .all(now) as Array<{ id: string }>;
  for (const row of stale) {
    updateSignalStatus(row.id, "expired", { cancelledReason: "Signal expired without being entered (15-minute window elapsed)." });
  }
  return stale.length;
}

// ---- Positions ----

export type FuturesPositionStatus = "open" | "closed";

export interface FuturesPosition {
  id: string;
  signalId: string | null;
  symbol: string;
  side: SignalSide;
  mode: BybitMode;
  status: FuturesPositionStatus;
  leverage: number;
  entryPrice: Decimal;
  qty: Decimal;
  remainingQty: Decimal;
  notionalUsd: Decimal;
  marginUsd: Decimal;
  stopLoss: Decimal;
  takeProfits: TakeProfitPlan[];
  takeProfitsFilled: string[];
  breakevenMoved: boolean;
  trailingActive: boolean;
  trailingStopPrice: Decimal | null;
  bybitOrderId: string | null;
  realizedPnlUsd: Decimal;
  closeReason: string | null;
  openedAt: string;
  closedAt: string | null;
}

function rowToPosition(row: Record<string, unknown>): FuturesPosition {
  return {
    id: row.id as string,
    signalId: (row.signal_id as string) ?? null,
    symbol: row.symbol as string,
    side: row.side as SignalSide,
    mode: row.mode as BybitMode,
    status: row.status as FuturesPositionStatus,
    leverage: row.leverage as number,
    entryPrice: new Decimal(row.entry_price as string),
    qty: new Decimal(row.qty as string),
    remainingQty: new Decimal(row.remaining_qty as string),
    notionalUsd: new Decimal(row.notional_usd as string),
    marginUsd: new Decimal(row.margin_usd as string),
    stopLoss: new Decimal(row.stop_loss as string),
    takeProfits: JSON.parse(row.take_profits_json as string),
    takeProfitsFilled: JSON.parse(row.take_profits_filled_json as string),
    breakevenMoved: row.breakeven_moved === 1,
    trailingActive: row.trailing_active === 1,
    trailingStopPrice: row.trailing_stop_price !== null ? new Decimal(row.trailing_stop_price as string) : null,
    bybitOrderId: (row.bybit_order_id as string) ?? null,
    realizedPnlUsd: new Decimal(row.realized_pnl_usd as string),
    closeReason: (row.close_reason as string) ?? null,
    openedAt: row.opened_at as string,
    closedAt: (row.closed_at as string) ?? null,
  };
}

export function listOpenFuturesPositions(mode?: BybitMode): FuturesPosition[] {
  const rows = mode
    ? (db.prepare("SELECT * FROM futures_positions WHERE status = 'open' AND mode = ? ORDER BY opened_at DESC").all(mode) as Record<string, unknown>[])
    : (db.prepare("SELECT * FROM futures_positions WHERE status = 'open' ORDER BY opened_at DESC").all() as Record<string, unknown>[]);
  return rows.map(rowToPosition);
}

export function listFuturesPositions(mode?: BybitMode, limit = 200): FuturesPosition[] {
  const rows = mode
    ? (db.prepare("SELECT * FROM futures_positions WHERE mode = ? ORDER BY opened_at DESC LIMIT ?").all(mode, limit) as Record<string, unknown>[])
    : (db.prepare("SELECT * FROM futures_positions ORDER BY opened_at DESC LIMIT ?").all(limit) as Record<string, unknown>[]);
  return rows.map(rowToPosition);
}

export function getFuturesPosition(id: string): FuturesPosition | null {
  const row = db.prepare("SELECT * FROM futures_positions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToPosition(row) : null;
}

export function countOpenFuturesPositions(mode: BybitMode): number {
  const row = db.prepare("SELECT COUNT(*) as n FROM futures_positions WHERE status = 'open' AND mode = ?").get(mode) as { n: number };
  return row.n;
}

export interface CreateFuturesPositionParams {
  signalId: string | null;
  symbol: string;
  side: SignalSide;
  mode: BybitMode;
  leverage: number;
  entryPrice: Decimal;
  qty: Decimal;
  notionalUsd: Decimal;
  marginUsd: Decimal;
  stopLoss: Decimal;
  takeProfits: TakeProfitPlan[];
  bybitOrderId: string | null;
}

export function createFuturesPosition(params: CreateFuturesPositionParams): FuturesPosition {
  const id = newId();
  const now = nowIso();
  db.prepare(
    `INSERT INTO futures_positions (
      id, signal_id, symbol, side, mode, status, leverage, entry_price, qty, remaining_qty, notional_usd, margin_usd,
      stop_loss, take_profits_json, take_profits_filled_json, breakeven_moved, trailing_active, bybit_order_id, realized_pnl_usd, opened_at
    ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, '[]', 0, 0, ?, '0', ?)`,
  ).run(
    id,
    params.signalId,
    params.symbol,
    params.side,
    params.mode,
    params.leverage,
    params.entryPrice.toFixed(),
    params.qty.toFixed(),
    params.qty.toFixed(),
    params.notionalUsd.toFixed(),
    params.marginUsd.toFixed(),
    params.stopLoss.toFixed(),
    JSON.stringify(params.takeProfits),
    params.bybitOrderId,
    now,
  );
  const position = getFuturesPosition(id) as FuturesPosition;
  botEvents.emitEvent("futures_position_changed", position);
  return position;
}

export interface ApplyFuturesExitParams {
  closedQty: Decimal;
  exitPrice: Decimal;
  takeProfitLabelFilled?: "tp1" | "tp2" | "tp3";
  closeReason?: string;
}

export function applyFuturesExit(id: string, params: ApplyFuturesExitParams): FuturesPosition {
  const position = getFuturesPosition(id);
  if (!position) throw new Error(`Futures position ${id} not found`);

  const direction = position.side === "long" ? 1 : -1;
  const pnlDelta = params.exitPrice.minus(position.entryPrice).times(direction).times(params.closedQty);

  const remaining = position.remainingQty.minus(params.closedQty);
  const dustThreshold = position.qty.times(0.001);
  const isFullyClosed = remaining.lte(dustThreshold);

  const takeProfitsFilled = params.takeProfitLabelFilled
    ? [...position.takeProfitsFilled, params.takeProfitLabelFilled]
    : position.takeProfitsFilled;

  const now = nowIso();
  db.prepare(
    `UPDATE futures_positions SET
      remaining_qty = ?, realized_pnl_usd = ?, take_profits_filled_json = ?, status = ?, close_reason = ?, closed_at = ?
    WHERE id = ?`,
  ).run(
    isFullyClosed ? "0" : remaining.toFixed(),
    position.realizedPnlUsd.plus(pnlDelta).toFixed(),
    JSON.stringify(takeProfitsFilled),
    isFullyClosed ? "closed" : "open",
    isFullyClosed ? (params.closeReason ?? "manual") : null,
    isFullyClosed ? now : null,
    id,
  );
  const updated = getFuturesPosition(id) as FuturesPosition;
  botEvents.emitEvent("futures_position_changed", updated);
  return updated;
}

export function moveStopLossToBreakeven(id: string): void {
  const position = getFuturesPosition(id);
  if (!position) return;
  db.prepare("UPDATE futures_positions SET stop_loss = ?, breakeven_moved = 1 WHERE id = ?").run(position.entryPrice.toFixed(), id);
  botEvents.emitEvent("futures_position_changed", getFuturesPosition(id));
}

export function updateTrailingStop(id: string, active: boolean, price: Decimal): void {
  db.prepare("UPDATE futures_positions SET trailing_active = ?, trailing_stop_price = ? WHERE id = ?").run(active ? 1 : 0, price.toFixed(), id);
  botEvents.emitEvent("futures_position_changed", getFuturesPosition(id));
}

// ---- Trades ----

export function recordFuturesTrade(params: {
  positionId: string | null;
  symbol: string;
  side: "open_long" | "open_short" | "close_long" | "close_short";
  mode: BybitMode;
  qty: Decimal;
  priceUsd: Decimal;
  notionalUsd: Decimal;
  feeUsd: Decimal;
  bybitOrderId: string | null;
  status: "simulated" | "submitted" | "confirmed" | "failed";
  failureReason: string | null;
}) {
  const id = newId();
  db.prepare(
    `INSERT INTO futures_trades (id, position_id, symbol, side, mode, qty, price_usd, notional_usd, fee_usd, bybit_order_id, status, failure_reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.positionId,
    params.symbol,
    params.side,
    params.mode,
    params.qty.toFixed(),
    params.priceUsd.toFixed(),
    params.notionalUsd.toFixed(),
    params.feeUsd.toFixed(),
    params.bybitOrderId,
    params.status,
    params.failureReason,
    nowIso(),
  );
  const trade = db.prepare("SELECT * FROM futures_trades WHERE id = ?").get(id);
  botEvents.emitEvent("futures_trade_created", trade);
  return trade;
}

export function listFuturesTrades(limit = 200) {
  return db.prepare("SELECT * FROM futures_trades ORDER BY created_at DESC LIMIT ?").all(limit);
}

export function realizedPnlSinceFutures(mode: BybitMode, sinceIso: string): Decimal {
  const rows = db
    .prepare("SELECT realized_pnl_usd FROM futures_positions WHERE mode = ? AND status = 'closed' AND closed_at >= ?")
    .all(mode, sinceIso) as Array<{ realized_pnl_usd: string }>;
  return rows.reduce((sum, r) => sum.plus(new Decimal(r.realized_pnl_usd)), new Decimal(0));
}
