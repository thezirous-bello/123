import { db, nowIso } from "../db/index.js";
import { recordRiskEvent } from "../lib/auditLog.js";
import { botEvents } from "../lib/events.js";

export interface BotState {
  running: boolean;
  mode: "paper" | "live";
  activeStrategyId: string | null;
  emergencyStopped: boolean;
  emergencyStoppedAt: string | null;
  emergencyStoppedReason: string | null;
  emergencyStoppedBy: string | null;
  updatedAt: string;
}

function rowToState(row: Record<string, unknown>): BotState {
  return {
    running: row.running === 1,
    mode: row.mode as "paper" | "live",
    activeStrategyId: (row.active_strategy_id as string) ?? null,
    emergencyStopped: row.emergency_stopped === 1,
    emergencyStoppedAt: (row.emergency_stopped_at as string) ?? null,
    emergencyStoppedReason: (row.emergency_stopped_reason as string) ?? null,
    emergencyStoppedBy: (row.emergency_stopped_by as string) ?? null,
    updatedAt: row.updated_at as string,
  };
}

export function getBotState(): BotState {
  const row = db.prepare("SELECT * FROM bot_state WHERE id = 1").get() as Record<string, unknown>;
  return rowToState(row);
}

function persistPatch(patch: Record<string, unknown>) {
  const keys = Object.keys(patch);
  const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE bot_state SET ${setClause}, updated_at = @updated_at WHERE id = 1`).run({
    ...patch,
    updated_at: nowIso(),
  });
  const state = getBotState();
  botEvents.emitEvent("bot_state_changed", state);
  return state;
}

export function setRunning(running: boolean): BotState {
  return persistPatch({ running: running ? 1 : 0 });
}

export function setMode(mode: "paper" | "live"): BotState {
  return persistPatch({ mode });
}

export function setActiveStrategy(strategyId: string | null): BotState {
  return persistPatch({ active_strategy_id: strategyId });
}

export function isEmergencyStopped(): boolean {
  return getBotState().emergencyStopped;
}

/** Triggers the kill switch: blocks all new entries and signing immediately.
 * Monitoring and manual selling continue — this never force-liquidates. */
export function triggerEmergencyStop(triggeredBy: string, reason: string): BotState {
  const state = persistPatch({
    emergency_stopped: 1,
    emergency_stopped_at: nowIso(),
    emergency_stopped_reason: reason,
    emergency_stopped_by: triggeredBy,
    running: 0,
  });
  recordRiskEvent("emergency_stop", "critical", `Emergency stop triggered by ${triggeredBy}: ${reason}`, {
    triggeredBy,
    reason,
  });
  return state;
}

/** Requires an explicit, separate confirmation call to resume — never
 * implicit in a restart or page reload. */
export function resumeFromEmergencyStop(confirmedBy: string): BotState {
  const state = persistPatch({
    emergency_stopped: 0,
    emergency_stopped_at: null,
    emergency_stopped_reason: null,
    emergency_stopped_by: null,
  });
  recordRiskEvent("emergency_resume", "warning", `Emergency stop cleared by ${confirmedBy}`, { confirmedBy });
  return state;
}
