import { db, newId, nowIso } from "../db/index.js";
import { Decimal } from "../lib/decimal.js";
import { botEvents } from "../lib/events.js";
import type { BybitMode } from "../bybit/client.js";

// Spot has no shorting (no margin borrowing in this app) — every signal and
// position is a long (buy low, sell high). Kept as a union of one for
// symmetry with the futures module's SignalSide, which does need both.
export type SignalSide = "long";
export type SignalStatus = "pending" | "active" | "filled" | "cancelled" | "expired";

export interface TakeProfitPlan {
  label: "tp1" | "tp2" | "tp3";
  price: number;
  closePct: number;
}

export interface SpotSignal {
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

function rowToSignal(row: Record<string, unknown>): SpotSignal {
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

export function listPendingSignals(): SpotSignal[] {
  return (db.prepare("SELECT * FROM spot_signals WHERE status = 'pending' ORDER BY created_at DESC").all() as Record<string, unknown>[]).map(
    rowToSignal,
  );
}

export function listSignals(limit = 100): SpotSignal[] {
  return (db.prepare("SELECT * FROM spot_signals ORDER BY created_at DESC LIMIT ?").all(limit) as Record<string, unknown>[]).map(
    rowToSignal,
  );
}

export function getSignal(id: string): SpotSignal | null {
  const row = db.prepare("SELECT * FROM spot_signals WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToSignal(row) : null;
}

export function hasPendingSignalForSymbol(symbol: string): boolean {
  const row = db.prepare("SELECT 1 FROM spot_signals WHERE symbol = ? AND status IN ('pending','active') LIMIT 1").get(symbol);
  return !!row;
}

export function countPendingSignals(): number {
  const row = db.prepare("SELECT COUNT(*) as n FROM spot_signals WHERE status IN ('pending','active')").get() as { n: number };
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

export function createSignal(params: CreateSignalParams): SpotSignal {
  const id = newId();
  const now = nowIso();
  const expiresAt = new Date(Date.now() + params.expiryMinutes * 60_000).toISOString();
  db.prepare(
    `INSERT INTO spot_signals (id, symbol, side, status, entry_price, stop_loss, take_profits_json, score, stage1_json, stage2_json, expires_at, created_at, updated_at)
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
  const signal = getSignal(id) as SpotSignal;
  botEvents.emitEvent("spot_signal_changed", signal);
  return signal;
}

export function updateSignalStatus(id: string, status: SignalStatus, extra?: { stage2?: Record<string, unknown>; cancelledReason?: string }): SpotSignal {
  db.prepare(
    `UPDATE spot_signals SET status = ?, stage2_json = COALESCE(?, stage2_json), cancelled_reason = COALESCE(?, cancelled_reason), updated_at = ? WHERE id = ?`,
  ).run(status, extra?.stage2 ? JSON.stringify(extra.stage2) : null, extra?.cancelledReason ?? null, nowIso(), id);
  const signal = getSignal(id) as SpotSignal;
  botEvents.emitEvent("spot_signal_changed", signal);
  return signal;
}

export function expireStaleSignals(): number {
  const now = nowIso();
  const stale = db
    .prepare("SELECT id FROM spot_signals WHERE status IN ('pending','active') AND expires_at < ?")
    .all(now) as Array<{ id: string }>;
  for (const row of stale) {
    updateSignalStatus(row.id, "expired", { cancelledReason: "Signal expired without being entered (15-minute window elapsed)." });
  }
  return stale.length;
}

// ---- Positions ----

export type SpotPositionStatus = "open" | "closed";

export interface SpotPosition {
  id: string;
  signalId: string | null;
  symbol: string;
  side: SignalSide;
  mode: BybitMode;
  status: SpotPositionStatus;
  entryPrice: Decimal;
  qty: Decimal;
  remainingQty: Decimal;
  notionalUsd: Decimal;
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

function rowToPosition(row: Record<string, unknown>): SpotPosition {
  return {
    id: row.id as string,
    signalId: (row.signal_id as string) ?? null,
    symbol: row.symbol as string,
    side: row.side as SignalSide,
    mode: row.mode as BybitMode,
    status: row.status as SpotPositionStatus,
    entryPrice: new Decimal(row.entry_price as string),
    qty: new Decimal(row.qty as string),
    remainingQty: new Decimal(row.remaining_qty as string),
    notionalUsd: new Decimal(row.notional_usd as string),
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

export function listOpenSpotPositions(mode?: BybitMode): SpotPosition[] {
  const rows = mode
    ? (db.prepare("SELECT * FROM spot_positions WHERE status = 'open' AND mode = ? ORDER BY opened_at DESC").all(mode) as Record<string, unknown>[])
    : (db.prepare("SELECT * FROM spot_positions WHERE status = 'open' ORDER BY opened_at DESC").all() as Record<string, unknown>[]);
  return rows.map(rowToPosition);
}

export function listSpotPositions(mode?: BybitMode, limit = 200): SpotPosition[] {
  const rows = mode
    ? (db.prepare("SELECT * FROM spot_positions WHERE mode = ? ORDER BY opened_at DESC LIMIT ?").all(mode, limit) as Record<string, unknown>[])
    : (db.prepare("SELECT * FROM spot_positions ORDER BY opened_at DESC LIMIT ?").all(limit) as Record<string, unknown>[]);
  return rows.map(rowToPosition);
}

export function getSpotPosition(id: string): SpotPosition | null {
  const row = db.prepare("SELECT * FROM spot_positions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToPosition(row) : null;
}

export function countOpenSpotPositions(mode: BybitMode): number {
  const row = db.prepare("SELECT COUNT(*) as n FROM spot_positions WHERE status = 'open' AND mode = ?").get(mode) as { n: number };
  return row.n;
}

export interface CreateSpotPositionParams {
  signalId: string | null;
  symbol: string;
  side: SignalSide;
  mode: BybitMode;
  entryPrice: Decimal;
  qty: Decimal;
  notionalUsd: Decimal;
  stopLoss: Decimal;
  takeProfits: TakeProfitPlan[];
  bybitOrderId: string | null;
}

export function createSpotPosition(params: CreateSpotPositionParams): SpotPosition {
  const id = newId();
  const now = nowIso();
  db.prepare(
    `INSERT INTO spot_positions (
      id, signal_id, symbol, side, mode, status, entry_price, qty, remaining_qty, notional_usd,
      stop_loss, take_profits_json, take_profits_filled_json, breakeven_moved, trailing_active, bybit_order_id, realized_pnl_usd, opened_at
    ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, '[]', 0, 0, ?, '0', ?)`,
  ).run(
    id,
    params.signalId,
    params.symbol,
    params.side,
    params.mode,
    params.entryPrice.toFixed(),
    params.qty.toFixed(),
    params.qty.toFixed(),
    params.notionalUsd.toFixed(),
    params.stopLoss.toFixed(),
    JSON.stringify(params.takeProfits),
    params.bybitOrderId,
    now,
  );
  const position = getSpotPosition(id) as SpotPosition;
  botEvents.emitEvent("spot_position_changed", position);
  return position;
}

export interface ApplySpotExitParams {
  closedQty: Decimal;
  exitPrice: Decimal;
  takeProfitLabelFilled?: "tp1" | "tp2" | "tp3";
  closeReason?: string;
}

export function applySpotExit(id: string, params: ApplySpotExitParams): SpotPosition {
  const position = getSpotPosition(id);
  if (!position) throw new Error(`Spot position ${id} not found`);

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
    `UPDATE spot_positions SET
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
  const updated = getSpotPosition(id) as SpotPosition;
  botEvents.emitEvent("spot_position_changed", updated);
  return updated;
}

export function moveStopLossToBreakeven(id: string): void {
  const position = getSpotPosition(id);
  if (!position) return;
  db.prepare("UPDATE spot_positions SET stop_loss = ?, breakeven_moved = 1 WHERE id = ?").run(position.entryPrice.toFixed(), id);
  botEvents.emitEvent("spot_position_changed", getSpotPosition(id));
}

export function updateTrailingStop(id: string, active: boolean, price: Decimal): void {
  db.prepare("UPDATE spot_positions SET trailing_active = ?, trailing_stop_price = ? WHERE id = ?").run(active ? 1 : 0, price.toFixed(), id);
  botEvents.emitEvent("spot_position_changed", getSpotPosition(id));
}

// ---- Trades ----

export function recordSpotTrade(params: {
  positionId: string | null;
  symbol: string;
  side: "buy" | "sell";
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
    `INSERT INTO spot_trades (id, position_id, symbol, side, mode, qty, price_usd, notional_usd, fee_usd, bybit_order_id, status, failure_reason, created_at)
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
  const trade = db.prepare("SELECT * FROM spot_trades WHERE id = ?").get(id);
  botEvents.emitEvent("spot_trade_created", trade);
  return trade;
}

export function listSpotTrades(limit = 200) {
  return db.prepare("SELECT * FROM spot_trades ORDER BY created_at DESC LIMIT ?").all(limit);
}

export function realizedPnlSinceSpot(mode: BybitMode, sinceIso: string): Decimal {
  const rows = db
    .prepare("SELECT realized_pnl_usd FROM spot_positions WHERE mode = ? AND status = 'closed' AND closed_at >= ?")
    .all(mode, sinceIso) as Array<{ realized_pnl_usd: string }>;
  return rows.reduce((sum, r) => sum.plus(new Decimal(r.realized_pnl_usd)), new Decimal(0));
}
