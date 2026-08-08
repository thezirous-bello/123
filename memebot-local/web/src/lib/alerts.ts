import type { LogEntry } from "../api/client.js";
import type { AlertRow, AlertSeverity } from "../components/SystemAlertsFeed.js";

const LEVEL_TO_SEVERITY: Record<LogEntry["level"], AlertSeverity> = {
  error: "critical",
  warn: "warning",
  info: "success",
  debug: "info",
};

/** Every bot writes its real log lines through the same shared audit log
 * (recordLog on the server), tagged with a bot-specific category prefix
 * (spot_*, futures_*, arb_*) — this just filters+maps that real stream
 * into the alert feed's shape, skipping debug-level noise. */
export function logsToAlerts(logs: LogEntry[], categoryPrefix: string, limit = 30): AlertRow[] {
  return logs
    .filter((l) => l.category.startsWith(categoryPrefix) && l.level !== "debug")
    .slice(0, limit)
    .map((l) => ({
      id: l.id,
      time: new Date(l.created_at).toLocaleTimeString(),
      severity: LEVEL_TO_SEVERITY[l.level],
      message: l.message,
    }));
}

const OTHER_BOT_PREFIXES = ["spot_", "futures_", "arb_"];

/** The meme bot's own log categories were never given a shared prefix
 * (risk/strategy_evaluation/paper_trade/etc.) — this is everything in the
 * shared audit log that isn't tagged for one of the other three bots. */
export function memeLogsToAlerts(logs: LogEntry[], limit = 30): AlertRow[] {
  return logs
    .filter((l) => l.level !== "debug" && !OTHER_BOT_PREFIXES.some((p) => l.category.startsWith(p)))
    .slice(0, limit)
    .map((l) => ({
      id: l.id,
      time: new Date(l.created_at).toLocaleTimeString(),
      severity: LEVEL_TO_SEVERITY[l.level],
      message: l.message,
    }));
}
