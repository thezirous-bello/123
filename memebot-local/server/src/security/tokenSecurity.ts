import { db, newId, nowIso } from "../db/index.js";
import type { HolderConcentration, OnChainMintInfo, TokenSnapshot } from "../market/types.js";
import { tokenAgeMinutes } from "../market/snapshotService.js";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingStatus = "pass" | "fail" | "warning" | "unknown";

export interface SecurityFinding {
  check: string;
  status: FindingStatus;
  severity: FindingSeverity;
  detail: string;
}

export interface SellRouteCheck {
  exists: boolean;
  priceImpactPct: number | null;
}

export interface SecurityCheckInput {
  mint: string;
  snapshot: TokenSnapshot | null;
  onchain: OnChainMintInfo | null;
  holders: HolderConcentration | null;
  sellRoute: SellRouteCheck | null;
}

export interface SecurityReport {
  mint: string;
  riskScore: number;
  riskLevel: RiskLevel;
  findings: SecurityFinding[];
  missingChecks: string[];
  confidence: "low" | "medium" | "high";
  sellSimulationOk: boolean | null;
  mintAuthorityDisabled: boolean | null;
  freezeAuthorityDisabled: boolean | null;
  dataSource: string;
  checkedAt: string;
  /** Deliberately never the word "safe" — see project safety rules. */
  summary: string;
}

const SEVERITY_PENALTY: Record<FindingSeverity, number> = {
  critical: 45,
  high: 25,
  medium: 12,
  low: 5,
  info: 0,
};

/**
 * Runs every available token-security check against already-fetched data
 * (on-chain mint info, holder concentration, market snapshot, sell-route
 * check) and produces a 0-100 risk score plus a fixed risk level. Pure
 * function of its inputs — no network calls here — so it is fully
 * deterministic and unit-testable, and so a missing data source becomes an
 * explicit "unknown" finding rather than a silent skip.
 */
export function runTokenSecurityAnalysis(input: SecurityCheckInput): SecurityReport {
  const findings: SecurityFinding[] = [];
  const missingChecks: string[] = [];

  // --- Mint identity & authorities -----------------------------------
  let mintAuthorityDisabled: boolean | null = null;
  let freezeAuthorityDisabled: boolean | null = null;

  if (input.onchain) {
    mintAuthorityDisabled = input.onchain.mintAuthority === null;
    freezeAuthorityDisabled = input.onchain.freezeAuthority === null;

    findings.push(
      mintAuthorityDisabled
        ? { check: "mint_authority", status: "pass", severity: "info", detail: "Mint authority is disabled." }
        : {
            check: "mint_authority",
            status: "fail",
            severity: "critical",
            detail: "Mint authority is still active — the deployer can mint unlimited new supply at any time.",
          },
    );

    findings.push(
      freezeAuthorityDisabled
        ? { check: "freeze_authority", status: "pass", severity: "info", detail: "Freeze authority is disabled." }
        : {
            check: "freeze_authority",
            status: "fail",
            severity: "high",
            detail: "Freeze authority is still active — the deployer can freeze holder accounts, including this wallet's.",
          },
    );
  } else {
    missingChecks.push("mint_authority");
    missingChecks.push("freeze_authority");
    findings.push({
      check: "mint_identity",
      status: "unknown",
      severity: "high",
      detail: "Could not read on-chain mint account. Token identity and authorities are unverified.",
    });
  }

  // --- Sell route / liquidity exit -------------------------------------
  let sellSimulationOk: boolean | null = null;
  if (input.sellRoute) {
    sellSimulationOk = input.sellRoute.exists;
    if (!input.sellRoute.exists) {
      findings.push({
        check: "sell_route",
        status: "fail",
        severity: "critical",
        detail: "No Jupiter route was found to sell this token back to SOL/USDC.",
      });
    } else {
      findings.push({ check: "sell_route", status: "pass", severity: "info", detail: "A sell route exists on Jupiter." });
      if (input.sellRoute.priceImpactPct !== null && input.sellRoute.priceImpactPct > 15) {
        findings.push({
          check: "sell_price_impact",
          status: "fail",
          severity: "high",
          detail: `Selling even a small amount moves price ${input.sellRoute.priceImpactPct.toFixed(1)}% — likely to be very difficult to exit.`,
        });
      }
    }
  } else {
    missingChecks.push("sell_route");
    findings.push({
      check: "sell_route",
      status: "unknown",
      severity: "high",
      detail: "Sell route was not checked.",
    });
  }

  // --- Liquidity ---------------------------------------------------------
  if (input.snapshot?.liquidityUsd !== null && input.snapshot?.liquidityUsd !== undefined) {
    const liquidity = input.snapshot.liquidityUsd;
    if (liquidity < 5_000) {
      findings.push({
        check: "liquidity",
        status: "fail",
        severity: "critical",
        detail: `Liquidity is only $${liquidity.toLocaleString()} — extremely thin, a single trade can move price drastically.`,
      });
    } else if (liquidity < 20_000) {
      findings.push({
        check: "liquidity",
        status: "warning",
        severity: "medium",
        detail: `Liquidity is $${liquidity.toLocaleString()} — thin, expect significant price impact.`,
      });
    } else {
      findings.push({ check: "liquidity", status: "pass", severity: "info", detail: `Liquidity is $${liquidity.toLocaleString()}.` });
    }
  } else {
    missingChecks.push("liquidity");
    findings.push({ check: "liquidity", status: "unknown", severity: "high", detail: "Liquidity data unavailable." });
  }

  // --- Holder concentration -----------------------------------------------
  if (input.holders?.top10Percentage !== null && input.holders?.top10Percentage !== undefined) {
    const pct = input.holders.top10Percentage;
    if (pct > 50) {
      findings.push({
        check: "holder_concentration",
        status: "fail",
        severity: "high",
        detail: `Top 10 holders own ${pct.toFixed(1)}% of supply — highly concentrated.`,
      });
    } else if (pct > 25) {
      findings.push({
        check: "holder_concentration",
        status: "warning",
        severity: "medium",
        detail: `Top 10 holders own ${pct.toFixed(1)}% of supply.`,
      });
    } else {
      findings.push({
        check: "holder_concentration",
        status: "pass",
        severity: "info",
        detail: `Top 10 holders own ${pct.toFixed(1)}% of supply.`,
      });
    }
  } else {
    missingChecks.push("holder_concentration");
    findings.push({ check: "holder_concentration", status: "unknown", severity: "medium", detail: "Holder data unavailable." });
  }

  // --- Token age -------------------------------------------------------
  const ageMinutes = input.snapshot ? tokenAgeMinutes(input.snapshot) : null;
  if (ageMinutes !== null) {
    if (ageMinutes < 5) {
      findings.push({
        check: "token_age",
        status: "warning",
        severity: "medium",
        detail: `Pool is only ${ageMinutes.toFixed(1)} minutes old — very new tokens have the highest rug-pull rate.`,
      });
    } else {
      findings.push({ check: "token_age", status: "pass", severity: "info", detail: `Pool age: ${ageMinutes.toFixed(0)} minutes.` });
    }
  } else {
    missingChecks.push("token_age");
    findings.push({ check: "token_age", status: "unknown", severity: "low", detail: "Pool creation time unavailable." });
  }

  // --- Score -------------------------------------------------------------
  let score = 100;
  for (const finding of findings) {
    if (finding.status === "fail") score -= SEVERITY_PENALTY[finding.severity];
    else if (finding.status === "warning") score -= SEVERITY_PENALTY[finding.severity] / 2;
    else if (finding.status === "unknown") score -= 5;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const hasCriticalFail = findings.some((f) => f.status === "fail" && f.severity === "critical");
  const unresolvedIdentity = mintAuthorityDisabled === null && input.snapshot === null;

  let riskLevel: RiskLevel;
  if (hasCriticalFail || unresolvedIdentity) riskLevel = "critical";
  else if (score >= 80) riskLevel = "low";
  else if (score >= 50) riskLevel = "medium";
  else if (score >= 25) riskLevel = "high";
  else riskLevel = "critical";

  const confidence: "low" | "medium" | "high" =
    missingChecks.length === 0 ? "high" : missingChecks.length <= 2 ? "medium" : "low";

  const summary =
    riskLevel === "critical"
      ? "Critical issue detected — trading blocked."
      : findings.some((f) => f.status === "fail" || f.status === "warning")
        ? "Some findings require review — see details."
        : "No critical issue detected by the available checks.";

  return {
    mint: input.mint,
    riskScore: score,
    riskLevel,
    findings,
    missingChecks,
    confidence,
    sellSimulationOk,
    mintAuthorityDisabled,
    freezeAuthorityDisabled,
    dataSource: [input.snapshot?.source, input.onchain ? "solana-rpc" : null].filter(Boolean).join(",") || "none",
    checkedAt: nowIso(),
    summary,
  };
}

export function persistSecurityReport(report: SecurityReport): void {
  db.prepare(
    `INSERT INTO security_checks (
      id, mint, risk_score, risk_level, findings_json, missing_checks_json, confidence,
      sell_simulation_ok, mint_authority_disabled, freeze_authority_disabled, data_source, checked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    report.mint,
    report.riskScore,
    report.riskLevel,
    JSON.stringify(report.findings),
    JSON.stringify(report.missingChecks),
    report.confidence,
    report.sellSimulationOk === null ? null : report.sellSimulationOk ? 1 : 0,
    report.mintAuthorityDisabled === null ? null : report.mintAuthorityDisabled ? 1 : 0,
    report.freezeAuthorityDisabled === null ? null : report.freezeAuthorityDisabled ? 1 : 0,
    report.dataSource,
    report.checkedAt,
  );
}

export function latestSecurityReport(mint: string): SecurityReport | null {
  const row = db
    .prepare("SELECT * FROM security_checks WHERE mint = ? ORDER BY checked_at DESC LIMIT 1")
    .get(mint) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    mint: row.mint as string,
    riskScore: row.risk_score as number,
    riskLevel: row.risk_level as RiskLevel,
    findings: JSON.parse(row.findings_json as string),
    missingChecks: JSON.parse(row.missing_checks_json as string),
    confidence: row.confidence as "low" | "medium" | "high",
    sellSimulationOk: row.sell_simulation_ok === null ? null : row.sell_simulation_ok === 1,
    mintAuthorityDisabled: row.mint_authority_disabled === null ? null : row.mint_authority_disabled === 1,
    freezeAuthorityDisabled: row.freeze_authority_disabled === null ? null : row.freeze_authority_disabled === 1,
    dataSource: row.data_source as string,
    checkedAt: row.checked_at as string,
    summary:
      (row.risk_level as string) === "critical"
        ? "Critical issue detected — trading blocked."
        : "No critical issue detected by the available checks.",
  };
}
