import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { botEvents } from "./events.js";

export function logApiCall(provider: string, endpoint: string, success: boolean, statusCode?: number, errorMessage?: string, latencyMs?: number): void {
  db.prepare(
    "INSERT INTO api_logs (id, provider, endpoint, success, status_code, error_message, latency_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(randomUUID(), provider, endpoint, success ? 1 : 0, statusCode ?? null, errorMessage ?? null, latencyMs ?? null, new Date().toISOString());
  if (provider === "telegram") botEvents.emitEvent("telegram_health_changed", { success });
}

export interface ProviderHealth {
  status: "ok" | "degraded" | "down" | "unknown";
  lastSuccessAt: string | null;
  lastError: string | null;
  totalCalls: number;
  totalFailures: number;
}

export function getProviderHealth(provider: string): ProviderHealth {
  const recent = db.prepare("SELECT success, error_message FROM api_logs WHERE provider = ? ORDER BY created_at DESC LIMIT 5").all(provider) as Array<{
    success: number;
    error_message: string | null;
  }>;
  const totals = db.prepare("SELECT COUNT(*) as total, SUM(1 - success) as failures FROM api_logs WHERE provider = ?").get(provider) as {
    total: number;
    failures: number | null;
  };
  if (recent.length === 0) return { status: "unknown", lastSuccessAt: null, lastError: null, totalCalls: 0, totalFailures: 0 };

  const lastSuccess = db.prepare("SELECT created_at FROM api_logs WHERE provider = ? AND success = 1 ORDER BY created_at DESC LIMIT 1").get(provider) as
    | { created_at: string }
    | undefined;
  const failuresInRecent = recent.filter((r) => !r.success).length;
  const status: ProviderHealth["status"] = recent[0]!.success ? "ok" : failuresInRecent >= 3 ? "down" : "degraded";
  const lastError = recent.find((r) => !r.success)?.error_message ?? null;

  return { status, lastSuccessAt: lastSuccess?.created_at ?? null, lastError, totalCalls: totals.total, totalFailures: totals.failures ?? 0 };
}
