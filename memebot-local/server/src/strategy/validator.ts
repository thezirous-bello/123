import type { RiskLimits } from "../lib/settings.js";
import { StrategyRulesSchema, type StrategyRules } from "./schema.js";

export interface ZodValidationOutcome {
  ok: boolean;
  rules?: StrategyRules;
  errors: string[];
}

/** Runs the strict Zod schema over a candidate rule set (from the local
 * parser, the AI parser, or a hand-edit in the visual rule builder) and
 * turns any failure into a plain-English message — never silently drops or
 * coerces an invalid field. */
export function validateStrategyRules(candidate: unknown): ZodValidationOutcome {
  const result = StrategyRulesSchema.safeParse(candidate);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
    };
  }
  return { ok: true, rules: result.data, errors: [] };
}

/**
 * A strategy may set stricter limits than the account's global risk limits,
 * but it may never exceed them. Anything that would exceed a global ceiling
 * is clamped down (never silently loosened) and reported as a warning so the
 * user sees exactly what changed before activating.
 */
export function enforceGlobalLimits(
  rules: StrategyRules,
  limits: RiskLimits,
): { rules: StrategyRules; warnings: string[] } {
  const warnings: string[] = [];
  const next: StrategyRules = { ...rules };

  if (next.maxTradeUsd > limits.maxTradeUsd) {
    warnings.push(
      `Requested trade size $${next.maxTradeUsd} exceeds your global maximum of $${limits.maxTradeUsd} — clamped to $${limits.maxTradeUsd}.`,
    );
    next.maxTradeUsd = limits.maxTradeUsd;
  }

  if (next.maximumSlippagePercentage > limits.maxSlippagePercentage) {
    warnings.push(
      `Requested slippage ${next.maximumSlippagePercentage}% exceeds your global maximum of ${limits.maxSlippagePercentage}% — clamped.`,
    );
    next.maximumSlippagePercentage = limits.maxSlippagePercentage;
  }

  if (next.maximumPriceImpactPercentage > limits.maxPriceImpactPercentage) {
    warnings.push(
      `Requested price impact ${next.maximumPriceImpactPercentage}% exceeds your global maximum of ${limits.maxPriceImpactPercentage}% — clamped.`,
    );
    next.maximumPriceImpactPercentage = limits.maxPriceImpactPercentage;
  }

  if (next.minimumLiquidityUsd < limits.minimumLiquidityUsd) {
    warnings.push(
      `Requested minimum liquidity $${next.minimumLiquidityUsd} is below your global floor of $${limits.minimumLiquidityUsd} — raised to $${limits.minimumLiquidityUsd}.`,
    );
    next.minimumLiquidityUsd = limits.minimumLiquidityUsd;
  }

  if (!next.requireSellSimulation) {
    warnings.push("Sell-simulation requirement cannot be disabled — re-enabled for safety.");
    next.requireSellSimulation = true;
  }

  return { rules: next, warnings };
}
