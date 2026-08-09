import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import type { VerificationResult } from "./verification.js";
import type { ScoreResult } from "./scoring.js";

export function saveAnalysis(offerId: string, verification: VerificationResult): void {
  db.prepare(
    `INSERT INTO deal_analysis (id, offer_id, deal_confidence, discount_pct, absolute_saving, evidence_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    offerId,
    verification.confidence,
    verification.discountPct,
    verification.absoluteSaving,
    JSON.stringify(verification.evidence),
    new Date().toISOString(),
  );
}

export function saveScore(offerId: string, score: ScoreResult): void {
  db.prepare(
    `INSERT INTO deal_scores (id, offer_id, deal_score, profit_score, estimated_commission, status_label, breakdown_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), offerId, score.dealScore, score.profitScore, score.estimatedCommission, score.statusLabel, JSON.stringify(score.breakdown), new Date().toISOString());
}

export interface LatestAnalysis {
  deal_confidence: number;
  discount_pct: number | null;
  absolute_saving: string | null;
  evidence_json: string;
  created_at: string;
}

export interface LatestScore {
  deal_score: number;
  profit_score: number;
  estimated_commission: string | null;
  status_label: string;
  breakdown_json: string;
  created_at: string;
}

export function getLatestAnalysis(offerId: string): LatestAnalysis | undefined {
  return db.prepare("SELECT * FROM deal_analysis WHERE offer_id = ? ORDER BY created_at DESC LIMIT 1").get(offerId) as LatestAnalysis | undefined;
}

export function getLatestScore(offerId: string): LatestScore | undefined {
  return db.prepare("SELECT * FROM deal_scores WHERE offer_id = ? ORDER BY created_at DESC LIMIT 1").get(offerId) as LatestScore | undefined;
}
