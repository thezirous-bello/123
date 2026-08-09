import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { botEvents } from "./events.js";
import { logger } from "./logger.js";

export type ActivityLevel = "debug" | "info" | "warn" | "error";

export interface ActivityRecord {
  id: string;
  level: ActivityLevel;
  category: string;
  message: string;
  details_json: string;
  created_at: string;
}

const insert = db.prepare(
  `INSERT INTO bot_activity (id, level, category, message, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
);

/** Every scan-loop step writes here — this table backs the dashboard's
 * live activity feed. Also mirrors to the process logger so `npm run dev`
 * output shows the same trail. */
export function logActivity(level: ActivityLevel, category: string, message: string, details?: Record<string, unknown>): ActivityRecord {
  const record: ActivityRecord = {
    id: randomUUID(),
    level,
    category,
    message,
    details_json: JSON.stringify(details ?? {}),
    created_at: new Date().toISOString(),
  };
  insert.run(record.id, record.level, record.category, record.message, record.details_json, record.created_at);
  logger[level === "warn" ? "warn" : level === "error" ? "error" : "info"]({ category, ...details }, message);
  botEvents.emitEvent("activity_logged", record);
  return record;
}

export function recentActivity(limit = 200): ActivityRecord[] {
  return db.prepare("SELECT * FROM bot_activity ORDER BY created_at DESC LIMIT ?").all(limit) as ActivityRecord[];
}
