import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";

export interface SourceRow {
  id: string;
  name: string;
  kind: string;
  enabled: number;
  affiliate_tag: string | null;
  countries_json: string;
  categories_json: string;
  commission_info_json: string;
  config_json: string;
  last_successful_scan_at: string | null;
  api_status: "ok" | "degraded" | "down" | "unknown";
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export function listSources(): SourceRow[] {
  return db.prepare("SELECT * FROM affiliate_sources ORDER BY created_at ASC").all() as SourceRow[];
}

export function getSource(id: string): SourceRow | undefined {
  return db.prepare("SELECT * FROM affiliate_sources WHERE id = ?").get(id) as SourceRow | undefined;
}

export function createSource(input: {
  name: string;
  kind: string;
  affiliateTag?: string;
  countries?: string[];
  categories?: string[];
  config?: Record<string, unknown>;
}): SourceRow {
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO affiliate_sources
       (id, name, kind, enabled, affiliate_tag, countries_json, categories_json, commission_info_json, config_json, api_status, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?, ?, '{}', ?, 'unknown', ?, ?)`,
  ).run(
    id,
    input.name,
    input.kind,
    input.affiliateTag ?? null,
    JSON.stringify(input.countries ?? []),
    JSON.stringify(input.categories ?? []),
    JSON.stringify(input.config ?? {}),
    now,
    now,
  );
  return getSource(id)!;
}

export function setSourceEnabled(id: string, enabled: boolean): void {
  db.prepare("UPDATE affiliate_sources SET enabled = ?, updated_at = ? WHERE id = ?").run(enabled ? 1 : 0, new Date().toISOString(), id);
}

export function updateSource(
  id: string,
  patch: Partial<{ name: string; affiliateTag: string | null; countries: string[]; categories: string[]; commissionInfo: Record<string, unknown> }>,
): SourceRow | undefined {
  const existing = getSource(id);
  if (!existing) return undefined;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE affiliate_sources SET name = ?, affiliate_tag = ?, countries_json = ?, categories_json = ?, commission_info_json = ?, updated_at = ? WHERE id = ?`,
  ).run(
    patch.name ?? existing.name,
    patch.affiliateTag !== undefined ? patch.affiliateTag : existing.affiliate_tag,
    patch.countries ? JSON.stringify(patch.countries) : existing.countries_json,
    patch.categories ? JSON.stringify(patch.categories) : existing.categories_json,
    patch.commissionInfo ? JSON.stringify(patch.commissionInfo) : existing.commission_info_json,
    now,
    id,
  );
  return getSource(id);
}

export function recordSourceScanResult(id: string, ok: boolean, error?: string): void {
  const now = new Date().toISOString();
  if (ok) {
    db.prepare(
      "UPDATE affiliate_sources SET last_successful_scan_at = ?, api_status = 'ok', last_error = NULL, updated_at = ? WHERE id = ?",
    ).run(now, now, id);
  } else {
    db.prepare("UPDATE affiliate_sources SET api_status = 'down', last_error = ?, updated_at = ? WHERE id = ?").run(error ?? "unknown error", now, id);
  }
}

/** Seeds the built-in demo source once, so DEALBOT_MODE=demo has something
 * to scan out of the box. Never seeds it a second time and never touches
 * a real source's row. */
export function ensureDemoSourceSeeded(): void {
  const existing = db.prepare("SELECT id FROM affiliate_sources WHERE kind = 'demo'").get();
  if (existing) return;
  createSource({ name: "Demo Source (sample data)", kind: "demo", countries: ["AL"], categories: ["Tech", "Gaming", "Fashion", "Home", "Travel"] });
}
