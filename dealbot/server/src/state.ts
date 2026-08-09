import { db } from "./db/index.js";
import { botEvents } from "./lib/events.js";

export interface BotState {
  id: 1;
  running: number;
  paused: number;
  last_scan_at: string | null;
  next_scan_at: string | null;
  last_scan_products_found: number;
  updated_at: string;
}

export function getBotState(): BotState {
  return db.prepare("SELECT * FROM bot_state WHERE id = 1").get() as BotState;
}

function patch(fields: Record<string, unknown>): BotState {
  const keys = Object.keys(fields);
  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE bot_state SET ${setClause}, updated_at = ? WHERE id = 1`).run(...keys.map((k) => fields[k]), new Date().toISOString());
  const state = getBotState();
  botEvents.emitEvent("bot_state_changed", state);
  return state;
}

export function setRunning(running: boolean): BotState {
  return patch({ running: running ? 1 : 0, paused: 0 });
}

export function setPaused(paused: boolean): BotState {
  return patch({ paused: paused ? 1 : 0 });
}

export function recordScanCompleted(productsFound: number, nextScanAt: string | null): BotState {
  return patch({ last_scan_at: new Date().toISOString(), last_scan_products_found: productsFound, next_scan_at: nextScanAt });
}
