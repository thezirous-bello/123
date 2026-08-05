import { db, nowIso } from "../db/index.js";
import { recordRiskEvent } from "../lib/auditLog.js";
import { botEvents } from "../lib/events.js";
import type { BybitMode } from "../bybit/client.js";

export interface FuturesBotState {
  running: boolean;
  mode: BybitMode;
  emergencyStopped: boolean;
  emergencyStoppedAt: string | null;
  emergencyStoppedReason: string | null;
  emergencyStoppedBy: string | null;
  consecutiveLosses: number;
  tradingHaltedUntil: string | null;
  updatedAt: string;
}

function rowToState(row: Record<string, unknown>): FuturesBotState {
  return {
    running: row.running === 1,
    mode: row.mode as BybitMode,
    emergencyStopped: row.emergency_stopped === 1,
    emergencyStoppedAt: (row.emergency_stopped_at as string) ?? null,
    emergencyStoppedReason: (row.emergency_stopped_reason as string) ?? null,
    emergencyStoppedBy: (row.emergency_stopped_by as string) ?? null,
    consecutiveLosses: row.consecutive_losses as number,
    tradingHaltedUntil: (row.trading_halted_until as string) ?? null,
    updatedAt: row.updated_at as string,
  };
}

export function getFuturesBotState(): FuturesBotState {
  const row = db.prepare("SELECT * FROM futures_bot_state WHERE id = 1").get() as Record<string, unknown>;
  return rowToState(row);
}

function persistPatch(patch: Record<string, unknown>): FuturesBotState {
  const keys = Object.keys(patch);
  const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE futures_bot_state SET ${setClause}, updated_at = @updated_at WHERE id = 1`).run({
    ...patch,
    updated_at: nowIso(),
  });
  const state = getFuturesBotState();
  botEvents.emitEvent("futures_state_changed", state);
  return state;
}

export function setFuturesRunning(running: boolean): FuturesBotState {
  return persistPatch({ running: running ? 1 : 0 });
}

export function setFuturesMode(mode: BybitMode): FuturesBotState {
  return persistPatch({ mode });
}

export function isFuturesEmergencyStopped(): boolean {
  return getFuturesBotState().emergencyStopped;
}

export function triggerFuturesEmergencyStop(triggeredBy: string, reason: string): FuturesBotState {
  const state = persistPatch({
    emergency_stopped: 1,
    emergency_stopped_at: nowIso(),
    emergency_stopped_reason: reason,
    emergency_stopped_by: triggeredBy,
    running: 0,
  });
  recordRiskEvent("futures_emergency_stop", "critical", `Futures bot emergency stop triggered by ${triggeredBy}: ${reason}`, {
    triggeredBy,
    reason,
  });
  return state;
}

export function resumeFuturesFromEmergencyStop(confirmedBy: string): FuturesBotState {
  const state = persistPatch({
    emergency_stopped: 0,
    emergency_stopped_at: null,
    emergency_stopped_reason: null,
    emergency_stopped_by: null,
  });
  recordRiskEvent("futures_emergency_resume", "warning", `Futures bot emergency stop cleared by ${confirmedBy}`, { confirmedBy });
  return state;
}

export function recordFuturesTradeOutcome(wasLoss: boolean): FuturesBotState {
  const state = getFuturesBotState();
  const consecutiveLosses = wasLoss ? state.consecutiveLosses + 1 : 0;
  return persistPatch({ consecutive_losses: consecutiveLosses });
}

export function setFuturesTradingHaltedUntil(untilIso: string | null): FuturesBotState {
  return persistPatch({ trading_halted_until: untilIso });
}
