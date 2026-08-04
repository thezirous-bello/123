import { db, newId, nowIso } from "../db/index.js";
import { recordLog } from "../lib/auditLog.js";
import type { Strategy, StrategyRules } from "./schema.js";
import { StrategySchema } from "./schema.js";

interface StrategyRow {
  id: string;
  name: string;
  raw_instruction: string;
  payload_json: string;
  warnings_json: string;
  version: number;
  enabled: number;
  archived: number;
  created_at: string;
  updated_at: string;
}

function rowToStrategy(row: StrategyRow): Strategy {
  return StrategySchema.parse({
    id: row.id,
    name: row.name,
    rawInstruction: row.raw_instruction,
    rules: JSON.parse(row.payload_json),
    warnings: JSON.parse(row.warnings_json),
    version: row.version,
    enabled: row.enabled === 1,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function listStrategies(): Strategy[] {
  const rows = db.prepare("SELECT * FROM strategies ORDER BY created_at DESC").all() as StrategyRow[];
  return rows.map(rowToStrategy);
}

export function getStrategy(id: string): Strategy | null {
  const row = db.prepare("SELECT * FROM strategies WHERE id = ?").get(id) as StrategyRow | undefined;
  return row ? rowToStrategy(row) : null;
}

export function getActiveStrategy(): Strategy | null {
  const row = db
    .prepare("SELECT * FROM strategies WHERE enabled = 1 AND archived = 0 ORDER BY updated_at DESC LIMIT 1")
    .get() as StrategyRow | undefined;
  return row ? rowToStrategy(row) : null;
}

export function createStrategy(params: {
  name: string;
  rawInstruction: string;
  rules: StrategyRules;
  warnings: string[];
}): Strategy {
  const now = nowIso();
  const id = newId();
  db.prepare(
    `INSERT INTO strategies (id, name, raw_instruction, payload_json, warnings_json, version, enabled, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, 0, 0, ?, ?)`,
  ).run(id, params.name, params.rawInstruction, JSON.stringify(params.rules), JSON.stringify(params.warnings), now, now);
  db.prepare(
    `INSERT INTO strategy_versions (id, strategy_id, version, payload_json, created_at) VALUES (?, ?, 1, ?, ?)`,
  ).run(newId(), id, JSON.stringify(params.rules), now);
  recordLog("info", "strategy", `Strategy "${params.name}" created`, { strategyId: id });
  return getStrategy(id) as Strategy;
}

export function updateStrategyRules(id: string, rules: StrategyRules, warnings: string[]): Strategy | null {
  const existing = getStrategy(id);
  if (!existing) return null;
  const now = nowIso();
  const nextVersion = existing.version + 1;
  db.prepare(
    `UPDATE strategies SET payload_json = ?, warnings_json = ?, version = ?, updated_at = ? WHERE id = ?`,
  ).run(JSON.stringify(rules), JSON.stringify(warnings), nextVersion, now, id);
  db.prepare(
    `INSERT INTO strategy_versions (id, strategy_id, version, payload_json, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(newId(), id, nextVersion, JSON.stringify(rules), now);
  recordLog("info", "strategy", `Strategy "${existing.name}" edited (v${nextVersion})`, { strategyId: id });
  return getStrategy(id);
}

export function setStrategyEnabled(id: string, enabled: boolean): Strategy | null {
  const existing = getStrategy(id);
  if (!existing) return null;
  if (enabled) {
    // Only one active strategy at a time keeps evaluation and risk accounting
    // unambiguous — activating one pauses any other currently-active strategy.
    db.prepare("UPDATE strategies SET enabled = 0, updated_at = ? WHERE enabled = 1").run(nowIso());
  }
  db.prepare("UPDATE strategies SET enabled = ?, updated_at = ? WHERE id = ?").run(
    enabled ? 1 : 0,
    nowIso(),
    id,
  );
  recordLog("info", "strategy", `Strategy "${existing.name}" ${enabled ? "activated" : "paused"}`, {
    strategyId: id,
  });
  return getStrategy(id);
}

export function archiveStrategy(id: string): Strategy | null {
  const existing = getStrategy(id);
  if (!existing) return null;
  db.prepare("UPDATE strategies SET archived = 1, enabled = 0, updated_at = ? WHERE id = ?").run(nowIso(), id);
  recordLog("info", "strategy", `Strategy "${existing.name}" archived`, { strategyId: id });
  return getStrategy(id);
}

export function duplicateStrategy(id: string): Strategy | null {
  const existing = getStrategy(id);
  if (!existing) return null;
  return createStrategy({
    name: `${existing.name} (copy)`,
    rawInstruction: existing.rawInstruction,
    rules: existing.rules,
    warnings: existing.warnings,
  });
}

export function listStrategyVersions(id: string) {
  return db
    .prepare("SELECT version, payload_json, created_at FROM strategy_versions WHERE strategy_id = ? ORDER BY version DESC")
    .all(id) as Array<{ version: number; payload_json: string; created_at: string }>;
}

export function restoreStrategyVersion(id: string, version: number): Strategy | null {
  const row = db
    .prepare("SELECT payload_json FROM strategy_versions WHERE strategy_id = ? AND version = ?")
    .get(id, version) as { payload_json: string } | undefined;
  if (!row) return null;
  const rules = JSON.parse(row.payload_json) as StrategyRules;
  return updateStrategyRules(id, rules, [`Restored from version ${version}.`]);
}
