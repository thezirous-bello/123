import { db, nowIso } from "../db/index.js";
import { recordRiskEvent } from "../lib/auditLog.js";
import { botEvents } from "../lib/events.js";

export interface ArbBotState {
  running: boolean;
  emergencyStopped: boolean;
  emergencyStoppedAt: string | null;
  emergencyStoppedReason: string | null;
  emergencyStoppedBy: string | null;
  lastScanAt: string | null;
  totalScans: number;
  updatedAt: string;
}

function rowToState(row: Record<string, unknown>): ArbBotState {
  return {
    running: row.running === 1,
    emergencyStopped: row.emergency_stopped === 1,
    emergencyStoppedAt: (row.emergency_stopped_at as string) ?? null,
    emergencyStoppedReason: (row.emergency_stopped_reason as string) ?? null,
    emergencyStoppedBy: (row.emergency_stopped_by as string) ?? null,
    lastScanAt: (row.last_scan_at as string) ?? null,
    totalScans: row.total_scans as number,
    updatedAt: row.updated_at as string,
  };
}

export function getArbBotState(): ArbBotState {
  const row = db.prepare("SELECT * FROM arb_bot_state WHERE id = 1").get() as Record<string, unknown>;
  return rowToState(row);
}

function persistPatch(patch: Record<string, unknown>): ArbBotState {
  const keys = Object.keys(patch);
  const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE arb_bot_state SET ${setClause}, updated_at = @updated_at WHERE id = 1`).run({ ...patch, updated_at: nowIso() });
  const state = getArbBotState();
  botEvents.emitEvent("arb_state_changed", state);
  return state;
}

export function setArbRunning(running: boolean): ArbBotState {
  return persistPatch({ running: running ? 1 : 0 });
}

export function isArbEmergencyStopped(): boolean {
  return getArbBotState().emergencyStopped;
}

export function triggerArbEmergencyStop(triggeredBy: string, reason: string): ArbBotState {
  const state = persistPatch({
    emergency_stopped: 1,
    emergency_stopped_at: nowIso(),
    emergency_stopped_reason: reason,
    emergency_stopped_by: triggeredBy,
    running: 0,
  });
  recordRiskEvent("arb_emergency_stop", "critical", `Arbitrage bot emergency stop triggered by ${triggeredBy}: ${reason}`, { triggeredBy, reason });
  return state;
}

export function resumeArbFromEmergencyStop(confirmedBy: string): ArbBotState {
  const state = persistPatch({ emergency_stopped: 0, emergency_stopped_at: null, emergency_stopped_reason: null, emergency_stopped_by: null });
  recordRiskEvent("arb_emergency_resume", "warning", `Arbitrage bot emergency stop cleared by ${confirmedBy}`, { confirmedBy });
  return state;
}

export function recordArbScan(): ArbBotState {
  const state = getArbBotState();
  return persistPatch({ last_scan_at: nowIso(), total_scans: state.totalScans + 1 });
}
