import { db, nowIso } from "../db/index.js";
import { recordRiskEvent } from "../lib/auditLog.js";
import { botEvents } from "../lib/events.js";
import type { BybitMode } from "../bybit/client.js";

export interface SpotBotState {
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

function rowToState(row: Record<string, unknown>): SpotBotState {
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

export function getSpotBotState(): SpotBotState {
  const row = db.prepare("SELECT * FROM spot_bot_state WHERE id = 1").get() as Record<string, unknown>;
  return rowToState(row);
}

function persistPatch(patch: Record<string, unknown>): SpotBotState {
  const keys = Object.keys(patch);
  const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE spot_bot_state SET ${setClause}, updated_at = @updated_at WHERE id = 1`).run({
    ...patch,
    updated_at: nowIso(),
  });
  const state = getSpotBotState();
  botEvents.emitEvent("spot_state_changed", state);
  return state;
}

export function setSpotRunning(running: boolean): SpotBotState {
  return persistPatch({ running: running ? 1 : 0 });
}

export function setSpotMode(mode: BybitMode): SpotBotState {
  return persistPatch({ mode });
}

export function isSpotEmergencyStopped(): boolean {
  return getSpotBotState().emergencyStopped;
}

export function triggerSpotEmergencyStop(triggeredBy: string, reason: string): SpotBotState {
  const state = persistPatch({
    emergency_stopped: 1,
    emergency_stopped_at: nowIso(),
    emergency_stopped_reason: reason,
    emergency_stopped_by: triggeredBy,
    running: 0,
  });
  recordRiskEvent("spot_emergency_stop", "critical", `Spot bot emergency stop triggered by ${triggeredBy}: ${reason}`, {
    triggeredBy,
    reason,
  });
  return state;
}

export function resumeSpotFromEmergencyStop(confirmedBy: string): SpotBotState {
  const state = persistPatch({
    emergency_stopped: 0,
    emergency_stopped_at: null,
    emergency_stopped_reason: null,
    emergency_stopped_by: null,
  });
  recordRiskEvent("spot_emergency_resume", "warning", `Spot bot emergency stop cleared by ${confirmedBy}`, { confirmedBy });
  return state;
}

export function recordSpotTradeOutcome(wasLoss: boolean): SpotBotState {
  const state = getSpotBotState();
  const consecutiveLosses = wasLoss ? state.consecutiveLosses + 1 : 0;
  return persistPatch({ consecutive_losses: consecutiveLosses });
}

export function setSpotTradingHaltedUntil(untilIso: string | null): SpotBotState {
  return persistPatch({ trading_halted_until: untilIso });
}
