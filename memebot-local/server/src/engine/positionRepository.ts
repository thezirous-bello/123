import { db, newId, nowIso } from "../db/index.js";
import { Decimal } from "../lib/decimal.js";
import { botEvents } from "../lib/events.js";
import type { TakeProfitLevel } from "../strategy/schema.js";
import type { Mode } from "./queries.js";

export interface Position {
  id: string;
  mint: string;
  symbol: string | null;
  decimals: number;
  mode: Mode;
  status: "open" | "closed";
  strategyId: string | null;
  entryPriceUsd: Decimal;
  entryAmountUsd: Decimal;
  tokenAmount: Decimal;
  remainingTokenAmount: Decimal;
  costBasisUsd: Decimal;
  stopLossPercentage: number | null;
  takeProfits: TakeProfitLevel[];
  takeProfitsFilled: number[];
  trailingStopPercentage: number | null;
  trailingStopHighUsd: Decimal | null;
  /** Low-water mark since entry — MFE/MAE (max favorable/adverse
   * excursion) tracking. Updated every monitoring tick regardless of
   * whether a trailing stop is configured, same as trailingStopHighUsd. */
  lowestPriceSeenUsd: Decimal | null;
  maxHoldingPeriodMinutes: number | null;
  entryReason: Record<string, unknown>;
  entryTxSignature: string | null;
  realizedPnlUsd: Decimal;
  closeReason: string | null;
  openedAt: string;
  closedAt: string | null;
}

function rowToPosition(row: Record<string, unknown>): Position {
  return {
    id: row.id as string,
    mint: row.mint as string,
    symbol: (row.symbol as string) ?? null,
    decimals: row.decimals as number,
    mode: row.mode as Mode,
    status: row.status as "open" | "closed",
    strategyId: (row.strategy_id as string) ?? null,
    entryPriceUsd: new Decimal(row.entry_price_usd as string),
    entryAmountUsd: new Decimal(row.entry_amount_usd as string),
    tokenAmount: new Decimal(row.token_amount as string),
    remainingTokenAmount: new Decimal(row.remaining_token_amount as string),
    costBasisUsd: new Decimal(row.cost_basis_usd as string),
    stopLossPercentage: row.stop_loss_percentage !== null ? Number(row.stop_loss_percentage) : null,
    takeProfits: JSON.parse(row.take_profits_json as string),
    takeProfitsFilled: JSON.parse(row.take_profits_filled_json as string),
    trailingStopPercentage: row.trailing_stop_percentage !== null ? Number(row.trailing_stop_percentage) : null,
    trailingStopHighUsd: row.trailing_stop_high_usd !== null ? new Decimal(row.trailing_stop_high_usd as string) : null,
    lowestPriceSeenUsd: row.lowest_price_seen_usd !== null && row.lowest_price_seen_usd !== undefined ? new Decimal(row.lowest_price_seen_usd as string) : null,
    maxHoldingPeriodMinutes: row.max_holding_period_minutes !== null ? Number(row.max_holding_period_minutes) : null,
    entryReason: JSON.parse((row.entry_reason_json as string) ?? "{}"),
    entryTxSignature: (row.entry_tx_signature as string) ?? null,
    realizedPnlUsd: new Decimal(row.realized_pnl_usd as string),
    closeReason: (row.close_reason as string) ?? null,
    openedAt: row.opened_at as string,
    closedAt: (row.closed_at as string) ?? null,
  };
}

export function getPosition(id: string): Position | null {
  const row = db.prepare("SELECT * FROM positions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToPosition(row) : null;
}

export function listOpenPositions(mode?: Mode): Position[] {
  const rows = mode
    ? (db.prepare("SELECT * FROM positions WHERE status = 'open' AND mode = ? ORDER BY opened_at DESC").all(mode) as Record<
        string,
        unknown
      >[])
    : (db.prepare("SELECT * FROM positions WHERE status = 'open' ORDER BY opened_at DESC").all() as Record<string, unknown>[]);
  return rows.map(rowToPosition);
}

export function listPositions(mode?: Mode, limit = 200): Position[] {
  const rows = mode
    ? (db.prepare("SELECT * FROM positions WHERE mode = ? ORDER BY opened_at DESC LIMIT ?").all(mode, limit) as Record<
        string,
        unknown
      >[])
    : (db.prepare("SELECT * FROM positions ORDER BY opened_at DESC LIMIT ?").all(limit) as Record<string, unknown>[]);
  return rows.map(rowToPosition);
}

export interface CreatePositionParams {
  mint: string;
  symbol: string | null;
  decimals: number;
  mode: Mode;
  strategyId: string | null;
  entryPriceUsd: Decimal;
  entryAmountUsd: Decimal;
  tokenAmount: Decimal;
  costBasisUsd: Decimal;
  stopLossPercentage: number | null;
  takeProfits: TakeProfitLevel[];
  trailingStopPercentage: number | null;
  maxHoldingPeriodMinutes: number | null;
  entryReason: Record<string, unknown>;
  entryTxSignature: string | null;
}

export function createPosition(params: CreatePositionParams): Position {
  const id = newId();
  const now = nowIso();
  db.prepare(
    `INSERT INTO positions (
      id, mint, symbol, decimals, mode, status, strategy_id, entry_price_usd, entry_amount_usd, token_amount,
      remaining_token_amount, cost_basis_usd, stop_loss_percentage, take_profits_json, take_profits_filled_json,
      trailing_stop_percentage, trailing_stop_high_usd, lowest_price_seen_usd, max_holding_period_minutes, entry_reason_json,
      entry_tx_signature, realized_pnl_usd, opened_at
    ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, '0', ?)`,
  ).run(
    id,
    params.mint,
    params.symbol,
    params.decimals,
    params.mode,
    params.strategyId,
    params.entryPriceUsd.toFixed(),
    params.entryAmountUsd.toFixed(),
    params.tokenAmount.toFixed(),
    params.tokenAmount.toFixed(),
    params.costBasisUsd.toFixed(),
    params.stopLossPercentage,
    JSON.stringify(params.takeProfits),
    params.trailingStopPercentage,
    params.entryPriceUsd.toFixed(),
    params.entryPriceUsd.toFixed(),
    params.maxHoldingPeriodMinutes,
    JSON.stringify(params.entryReason),
    params.entryTxSignature,
    now,
  );
  const position = getPosition(id) as Position;
  botEvents.emitEvent("position_changed", position);
  return position;
}

export interface ApplyExitParams {
  soldTokenAmount: Decimal;
  proceedsUsd: Decimal;
  takeProfitIndexFilled?: number;
  closeReason?: string;
}

export function applyExit(id: string, params: ApplyExitParams): Position {
  const position = getPosition(id);
  if (!position) throw new Error(`Position ${id} not found`);

  const soldFraction = params.soldTokenAmount.div(position.tokenAmount);
  const costBasisPortion = position.costBasisUsd.times(soldFraction);
  const realizedPnlDelta = params.proceedsUsd.minus(costBasisPortion);

  const remaining = position.remainingTokenAmount.minus(params.soldTokenAmount);
  const dustThreshold = position.tokenAmount.times(0.001);
  const isFullyClosed = remaining.lte(dustThreshold);

  const takeProfitsFilled =
    params.takeProfitIndexFilled !== undefined
      ? [...position.takeProfitsFilled, params.takeProfitIndexFilled]
      : position.takeProfitsFilled;

  const now = nowIso();
  db.prepare(
    `UPDATE positions SET
      remaining_token_amount = ?,
      cost_basis_usd = ?,
      realized_pnl_usd = ?,
      take_profits_filled_json = ?,
      status = ?,
      close_reason = ?,
      closed_at = ?
    WHERE id = ?`,
  ).run(
    isFullyClosed ? "0" : remaining.toFixed(),
    isFullyClosed ? "0" : position.costBasisUsd.minus(costBasisPortion).toFixed(),
    position.realizedPnlUsd.plus(realizedPnlDelta).toFixed(),
    JSON.stringify(takeProfitsFilled),
    isFullyClosed ? "closed" : "open",
    isFullyClosed ? (params.closeReason ?? "manual") : null,
    isFullyClosed ? now : null,
    id,
  );

  const updated = getPosition(id) as Position;
  botEvents.emitEvent("position_changed", updated);
  return updated;
}

/** Updates both watermarks used for trailing-stop and MFE/MAE tracking:
 * the high (trailing-stop reference + max favorable excursion) and the low
 * (max adverse excursion). Always called every monitoring tick regardless
 * of whether a trailing stop is configured, so MFE/MAE stay accurate even
 * for positions that only use a fixed stop-loss/take-profit plan. */
export function updatePriceExtremes(id: string, priceUsd: Decimal): void {
  const position = getPosition(id);
  if (!position) return;
  const currentHigh = position.trailingStopHighUsd ?? position.entryPriceUsd;
  const currentLow = position.lowestPriceSeenUsd ?? position.entryPriceUsd;
  if (priceUsd.gt(currentHigh)) {
    db.prepare("UPDATE positions SET trailing_stop_high_usd = ? WHERE id = ?").run(priceUsd.toFixed(), id);
  }
  if (priceUsd.lt(currentLow)) {
    db.prepare("UPDATE positions SET lowest_price_seen_usd = ? WHERE id = ?").run(priceUsd.toFixed(), id);
  }
}

export function recordTrade(params: {
  positionId: string | null;
  mint: string;
  symbol: string | null;
  side: "buy" | "sell";
  mode: Mode;
  amountUsd: Decimal;
  tokenAmount: Decimal;
  priceUsd: Decimal;
  feeUsd: Decimal;
  networkFeeUsd: Decimal;
  slippageBps: number | null;
  priceImpactPct: number | null;
  quoteId: string | null;
  txSignature: string | null;
  status: "simulated" | "submitted" | "confirmed" | "failed";
  failureReason: string | null;
  idempotencyKey: string;
}) {
  const id = newId();
  db.prepare(
    `INSERT INTO trades (
      id, position_id, mint, symbol, side, mode, amount_usd, token_amount, price_usd, fee_usd, network_fee_usd,
      slippage_bps, price_impact_pct, quote_id, tx_signature, status, failure_reason, idempotency_key, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.positionId,
    params.mint,
    params.symbol,
    params.side,
    params.mode,
    params.amountUsd.toFixed(),
    params.tokenAmount.toFixed(),
    params.priceUsd.toFixed(),
    params.feeUsd.toFixed(),
    params.networkFeeUsd.toFixed(),
    params.slippageBps,
    params.priceImpactPct,
    params.quoteId,
    params.txSignature,
    params.status,
    params.failureReason,
    params.idempotencyKey,
    nowIso(),
  );
  const trade = db.prepare("SELECT * FROM trades WHERE id = ?").get(id);
  botEvents.emitEvent("trade_created", trade);
  return trade;
}

export function listTrades(limit = 200) {
  return db.prepare("SELECT * FROM trades ORDER BY created_at DESC LIMIT ?").all(limit);
}

export function tradeExistsForIdempotencyKey(key: string): boolean {
  const row = db.prepare("SELECT 1 FROM trades WHERE idempotency_key = ?").get(key);
  return !!row;
}
