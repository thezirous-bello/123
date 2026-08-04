import { db, newId, nowIso } from "../db/index.js";
import { logger, scrubSecrets } from "./logger.js";
import { botEvents } from "./events.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  id: string;
  level: LogLevel;
  category: string;
  message: string;
  details_json: string;
  created_at: string;
}

const insertStmt = db.prepare(
  `INSERT INTO bot_logs (id, level, category, message, details_json, created_at)
   VALUES (@id, @level, @category, @message, @details_json, @created_at)`,
);

/**
 * The single audit-log write path for the whole app. Every trade, risk
 * decision, and control action should flow through here so the dashboard's
 * Logs panel and the strategy-evaluation → risk → quote → tx → position
 * trail stay complete and reconstructable.
 */
export function recordLog(
  level: LogLevel,
  category: string,
  message: string,
  details: Record<string, unknown> = {},
): LogRecord {
  const record: LogRecord = {
    id: newId(),
    level,
    category,
    message: scrubSecrets(message),
    details_json: JSON.stringify(details),
    created_at: nowIso(),
  };
  insertStmt.run(record);
  logger[level]({ category, ...details }, record.message);
  botEvents.emitEvent("log_created", record);
  return record;
}

export function recentLogs(limit = 200): LogRecord[] {
  return db
    .prepare("SELECT * FROM bot_logs ORDER BY created_at DESC LIMIT ?")
    .all(limit) as LogRecord[];
}

export function recordRiskEvent(
  type: string,
  severity: "info" | "warning" | "critical",
  message: string,
  details: Record<string, unknown> = {},
) {
  const id = newId();
  const created_at = nowIso();
  db.prepare(
    `INSERT INTO risk_events (id, type, severity, message, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, type, severity, scrubSecrets(message), JSON.stringify(details), created_at);
  recordLog(severity === "critical" ? "error" : severity === "warning" ? "warn" : "info", "risk", message, details);
  const record = { id, type, severity, message, details_json: JSON.stringify(details), created_at };
  botEvents.emitEvent("risk_event_created", record);
  return record;
}

export function recentRiskEvents(limit = 100) {
  return db.prepare("SELECT * FROM risk_events ORDER BY created_at DESC LIMIT ?").all(limit);
}
