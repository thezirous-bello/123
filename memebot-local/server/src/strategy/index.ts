import { getRiskLimits } from "../lib/settings.js";
import { tryParseWithClaude } from "./aiParser.js";
import { findUnsafeInstructionReasons, parseStrategyInstructionLocally } from "./parser.js";
import { StrategyRulesSchema, type StrategyRules } from "./schema.js";
import { enforceGlobalLimits, validateStrategyRules } from "./validator.js";

export interface InterpretResult {
  ok: boolean;
  rules?: StrategyRules;
  warnings: string[];
  errors: string[];
  source: "local" | "ai" | "rejected";
  plainEnglish?: string[];
}

/**
 * The single entry point for turning a natural-language instruction into a
 * validated, activation-ready StrategyRules object. Order of operations is
 * fixed and never skipped: unsafe-phrase rejection -> local deterministic
 * parse -> optional AI-assisted parse only if local parsing was inconclusive
 * -> strict Zod validation -> clamping to global account risk limits. The AI
 * step (if it runs) only ever produces the same kind of plain-data object the
 * local parser does, and it goes through the exact same validation.
 */
export async function interpretStrategyInstruction(rawInstruction: string): Promise<InterpretResult> {
  const unsafe = findUnsafeInstructionReasons(rawInstruction);
  if (unsafe.length > 0) {
    return { ok: false, warnings: [], errors: unsafe, source: "rejected" };
  }

  let parsed = parseStrategyInstructionLocally(rawInstruction);
  let source: "local" | "ai" = "local";

  if (!parsed.ok) {
    const aiResult = await tryParseWithClaude(rawInstruction);
    if (aiResult) {
      // Merge: keep anything the local parser already found with confidence,
      // let the AI fill genuine gaps. Local extraction wins on conflicts
      // since it is fully deterministic and auditable.
      parsed = {
        ok: aiResult.ok,
        rules: { ...aiResult.rules, ...parsed.rules },
        warnings: [...parsed.warnings, ...aiResult.warnings],
        errors: aiResult.ok ? [] : aiResult.errors,
      };
      source = "ai";
    }
  }

  if (!parsed.ok) {
    return { ok: false, warnings: parsed.warnings, errors: parsed.errors, source };
  }

  const zodResult = validateStrategyRules(parsed.rules);
  if (!zodResult.ok || !zodResult.rules) {
    return { ok: false, warnings: parsed.warnings, errors: zodResult.errors, source };
  }

  const limits = getRiskLimits();
  const { rules: finalRules, warnings: clampWarnings } = enforceGlobalLimits(zodResult.rules, limits);

  return {
    ok: true,
    rules: finalRules,
    warnings: [...parsed.warnings, ...clampWarnings],
    errors: [],
    source,
    plainEnglish: explainStrategyRules(finalRules),
  };
}

/** Renders the structured rules back into plain English for the mandatory
 * pre-activation review screen. */
export function explainStrategyRules(rules: StrategyRules): string[] {
  const lines: string[] = [];
  lines.push(`Buy up to $${rules.maxTradeUsd} per trade, paid in ${rules.quoteToken}.`);
  lines.push(`Only consider tokens with at least $${rules.minimumLiquidityUsd.toLocaleString()} liquidity.`);
  if (rules.minimumVolume5mUsd !== undefined) {
    lines.push(`Require at least $${rules.minimumVolume5mUsd.toLocaleString()} in 5-minute volume.`);
  }
  if (rules.minimumVolume1hUsd !== undefined) {
    lines.push(`Require at least $${rules.minimumVolume1hUsd.toLocaleString()} in 1-hour volume.`);
  }
  if (rules.maximumTokenAgeMinutes !== undefined) {
    lines.push(`Only consider tokens younger than ${formatMinutes(rules.maximumTokenAgeMinutes)}.`);
  }
  if (rules.minimumTokenAgeMinutes !== undefined) {
    lines.push(`Only consider tokens older than ${formatMinutes(rules.minimumTokenAgeMinutes)}.`);
  }
  lines.push(`Require the top 10 holders to own less than ${rules.maximumTop10HolderPercentage}% of supply.`);
  lines.push(
    `Require mint authority ${rules.requireMintAuthorityDisabled ? "to be disabled" : "check skipped (not required)"}.`,
  );
  lines.push(
    `Require freeze authority ${rules.requireFreezeAuthorityDisabled ? "to be disabled" : "check skipped (not required)"}.`,
  );
  lines.push(`Require a successful sell simulation before buying${rules.requireSellSimulation ? "" : " (disabled — not recommended)"}.`);
  if (rules.minimumPriceChange5mPct !== undefined || rules.maximumPriceChange5mPct !== undefined) {
    lines.push(
      `Require 5-minute price change between ${rules.minimumPriceChange5mPct ?? "-∞"}% and ${rules.maximumPriceChange5mPct ?? "+∞"}%.`,
    );
  }
  if (rules.minimumPriceChange1hPct !== undefined || rules.maximumPriceChange1hPct !== undefined) {
    lines.push(
      `Require 1-hour price change between ${rules.minimumPriceChange1hPct ?? "-∞"}% and ${rules.maximumPriceChange1hPct ?? "+∞"}%.`,
    );
  }
  lines.push(`Reject trades with more than ${rules.maximumSlippagePercentage}% slippage or ${rules.maximumPriceImpactPercentage}% price impact.`);
  lines.push(`Stop out (sell everything) at a ${rules.stopLossPercentage}% loss.`);
  for (const tp of rules.takeProfits) {
    lines.push(`Sell ${tp.sellPercentage}% of the position at ${tp.profitPercentage}% profit.`);
  }
  if (rules.trailingStopPercentage !== undefined) {
    lines.push(`Trail the remaining position with a ${rules.trailingStopPercentage}% trailing stop.`);
  }
  if (rules.maxHoldingPeriodMinutes !== undefined) {
    lines.push(`Force-close the position after ${formatMinutes(rules.maxHoldingPeriodMinutes)} regardless of price.`);
  }
  lines.push(`Wait ${rules.cooldownMinutesAfterLoss} minutes after a loss on this strategy before trading it again.`);
  lines.push(`Trade this strategy at most ${rules.dailyTradeLimit} times per day.`);
  return lines;
}

function formatMinutes(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes / 1440 === 1 ? "" : "s"}`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes / 60 === 1 ? "" : "s"}`;
  return `${minutes} minutes`;
}

export { StrategyRulesSchema };
