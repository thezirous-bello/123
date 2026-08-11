import type { SecurityReport } from "../security/tokenSecurity.js";
import type { TokenSnapshot } from "../market/types.js";
import { tokenAgeMinutes } from "../market/snapshotService.js";
import type { MomentumScoreResult } from "../market/momentum.js";
import type { MomentumConfig } from "../lib/settings.js";
import type { StrategyRules } from "../strategy/schema.js";

export interface EntryCondition {
  name: string;
  passed: boolean;
  detail: string;
}

export interface EntryEvaluation {
  passed: boolean;
  conditions: EntryCondition[];
}

function cond(name: string, passed: boolean, detail: string): EntryCondition {
  return { name, passed, detail };
}

/**
 * Deterministic entry-condition evaluator: same snapshot + security report +
 * strategy rules always produce the same result. No network calls, no AI —
 * this is what makes every triggered (or rejected) decision reproducible
 * from the data stored alongside it.
 */
export function evaluateEntryConditions(
  rules: StrategyRules,
  snapshot: TokenSnapshot,
  security: SecurityReport,
): EntryEvaluation {
  const conditions: EntryCondition[] = [];

  conditions.push(
    cond(
      "critical_risk",
      security.riskLevel !== "critical",
      `Token risk level is "${security.riskLevel}". ${security.summary}`,
    ),
  );

  if (snapshot.liquidityUsd !== null) {
    conditions.push(
      cond(
        "minimum_liquidity",
        snapshot.liquidityUsd >= rules.minimumLiquidityUsd,
        `Liquidity $${snapshot.liquidityUsd.toLocaleString()} vs required >= $${rules.minimumLiquidityUsd.toLocaleString()}.`,
      ),
    );
  } else {
    conditions.push(cond("minimum_liquidity", false, "Liquidity data unavailable."));
  }

  if (rules.minimumVolume5mUsd !== undefined) {
    conditions.push(
      cond(
        "minimum_volume_5m",
        snapshot.volume5mUsd !== null && snapshot.volume5mUsd >= rules.minimumVolume5mUsd,
        `5m volume ${snapshot.volume5mUsd ?? "unknown"} vs required >= $${rules.minimumVolume5mUsd.toLocaleString()}.`,
      ),
    );
  }

  if (rules.minimumVolume1hUsd !== undefined) {
    conditions.push(
      cond(
        "minimum_volume_1h",
        snapshot.volume1hUsd !== null && snapshot.volume1hUsd >= rules.minimumVolume1hUsd,
        `1h volume ${snapshot.volume1hUsd ?? "unknown"} vs required >= $${rules.minimumVolume1hUsd.toLocaleString()}.`,
      ),
    );
  }

  const ageMinutes = tokenAgeMinutes(snapshot);
  if (rules.maximumTokenAgeMinutes !== undefined) {
    conditions.push(
      cond(
        "maximum_token_age",
        ageMinutes !== null && ageMinutes <= rules.maximumTokenAgeMinutes,
        `Token age ${ageMinutes?.toFixed(1) ?? "unknown"}m vs required <= ${rules.maximumTokenAgeMinutes}m.`,
      ),
    );
  }
  if (rules.minimumTokenAgeMinutes !== undefined) {
    conditions.push(
      cond(
        "minimum_token_age",
        ageMinutes !== null && ageMinutes >= rules.minimumTokenAgeMinutes,
        `Token age ${ageMinutes?.toFixed(1) ?? "unknown"}m vs required >= ${rules.minimumTokenAgeMinutes}m.`,
      ),
    );
  }

  if (rules.requireMintAuthorityDisabled) {
    conditions.push(
      cond(
        "mint_authority_disabled",
        security.mintAuthorityDisabled === true,
        security.mintAuthorityDisabled === null ? "Mint authority status unknown." : `Mint authority disabled: ${security.mintAuthorityDisabled}.`,
      ),
    );
  }

  if (rules.requireFreezeAuthorityDisabled) {
    conditions.push(
      cond(
        "freeze_authority_disabled",
        security.freezeAuthorityDisabled === true,
        security.freezeAuthorityDisabled === null
          ? "Freeze authority status unknown."
          : `Freeze authority disabled: ${security.freezeAuthorityDisabled}.`,
      ),
    );
  }

  if (rules.requireSellSimulation) {
    conditions.push(
      cond(
        "sell_simulation",
        security.sellSimulationOk === true,
        security.sellSimulationOk === null ? "Sell route not checked." : `Sell route exists: ${security.sellSimulationOk}.`,
      ),
    );
  }

  if (rules.minimumPriceChange5mPct !== undefined || rules.maximumPriceChange5mPct !== undefined) {
    const value = snapshot.priceChange5mPct;
    const min = rules.minimumPriceChange5mPct ?? -Infinity;
    const max = rules.maximumPriceChange5mPct ?? Infinity;
    conditions.push(
      cond(
        "price_change_5m_range",
        value !== null && value >= min && value <= max,
        `5m price change ${value ?? "unknown"}% vs required [${rules.minimumPriceChange5mPct ?? "-inf"}, ${rules.maximumPriceChange5mPct ?? "+inf"}]%.`,
      ),
    );
  }

  if (rules.minimumPriceChange1hPct !== undefined || rules.maximumPriceChange1hPct !== undefined) {
    const value = snapshot.priceChange1hPct;
    const min = rules.minimumPriceChange1hPct ?? -Infinity;
    const max = rules.maximumPriceChange1hPct ?? Infinity;
    conditions.push(
      cond(
        "price_change_1h_range",
        value !== null && value >= min && value <= max,
        `1h price change ${value ?? "unknown"}% vs required [${rules.minimumPriceChange1hPct ?? "-inf"}, ${rules.maximumPriceChange1hPct ?? "+inf"}]%.`,
      ),
    );
  }

  return { passed: conditions.every((c) => c.passed), conditions };
}

/**
 * The core of the "don't randomly trade meme coins" objective: multiple
 * independent momentum confirmations, not just a large historical
 * percentage gain. Every threshold falls back to the account-level
 * momentum config when the strategy doesn't set its own (see schema.ts) —
 * so this always applies real gating, never silently skips it because a
 * field happened to be unset.
 */
export function evaluateMomentumConditions(
  rules: StrategyRules,
  config: MomentumConfig,
  momentum: MomentumScoreResult,
): EntryCondition[] {
  const conditions: EntryCondition[] = [];

  const minScore = rules.minimumMomentumScore ?? config.minMomentumScoreToEnter;
  conditions.push(
    cond(
      "momentum_score",
      momentum.totalScore >= minScore,
      `Momentum score ${momentum.totalScore.toFixed(1)}/100 vs required >= ${minScore}. Drivers: ${momentum.reasons.slice(0, 3).join(" ") || "insufficient data"}`,
    ),
  );

  const requireTrendBullish = rules.requireTrendBullish ?? config.requireTrendBullish;
  if (requireTrendBullish) {
    conditions.push(cond("trend_bullish", momentum.trendDirection === "bullish", `Short-term trend is "${momentum.trendDirection}", required bullish.`));
  }

  const requireVolumeAccelerating = rules.requireVolumeAccelerating ?? config.requireVolumeAccelerating;
  if (requireVolumeAccelerating) {
    conditions.push(cond("volume_accelerating", momentum.volumeAccelerating, `Volume accelerating: ${momentum.volumeAccelerating}.`));
  }

  const requireBuyPressureDominant = rules.requireBuyPressureDominant ?? config.requireBuyPressureDominant;
  if (requireBuyPressureDominant) {
    conditions.push(
      cond(
        "buy_pressure_dominant",
        momentum.buyPressureDominant,
        `Buy pressure dominant: ${momentum.buyPressureDominant} (buy ratio ${momentum.buySellRatio !== null ? `${(momentum.buySellRatio * 100).toFixed(0)}%` : "unknown"}).`,
      ),
    );
  }

  const requireTxAccelerating = rules.requireTxAccelerating ?? config.requireTxAccelerating;
  if (requireTxAccelerating) {
    conditions.push(cond("tx_accelerating", momentum.txAccelerating, `Transaction activity accelerating: ${momentum.txAccelerating}.`));
  }

  // A single isolated giant candle with no acceleration confirmation and no
  // trend agreement across timeframes is exactly the "chasing a dead pump"
  // pattern this bot must avoid — block it even if the raw score cleared
  // the bar on the strength of one big cumulative window alone.
  if (momentum.exhaustionWarning) {
    conditions.push(cond("not_exhausted", false, "Momentum shows exhaustion — large cumulative gain but the most recent segment has stalled or reversed."));
  }

  return conditions;
}

/** Holder-concentration condition is evaluated separately from the report
 * (which only carries authority/liquidity flags) using the raw holder data
 * fetched alongside the security report, so callers append this to the
 * evaluation's conditions list. */
export function evaluateHolderConcentration(
  rules: StrategyRules,
  top10Percentage: number | null,
): EntryCondition {
  if (top10Percentage === null) {
    return cond("max_top10_holder_pct", false, "Holder concentration data unavailable.");
  }
  return cond(
    "max_top10_holder_pct",
    top10Percentage <= rules.maximumTop10HolderPercentage,
    `Top 10 holders own ${top10Percentage.toFixed(1)}% vs required <= ${rules.maximumTop10HolderPercentage}%.`,
  );
}
