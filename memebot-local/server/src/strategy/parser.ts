import type { StrategyRules, TakeProfitLevel } from "./schema.js";

export interface ParseResult {
  ok: boolean;
  rules: Partial<StrategyRules>;
  warnings: string[];
  errors: string[];
}

/** Instructions that must never be silently "interpreted" — the whole point
 * of a deterministic strategy is that risk is bounded, so anything that asks
 * for unbounded size, unbounded universe, or to skip safety checks is a hard
 * rejection with an explicit reason, not a best-effort guess. */
const UNSAFE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(whole|entire|all of my|my entire)\s+wallet\b/i,
    reason: 'Position size must be a specific dollar amount — "use my whole/entire wallet" has no bound.',
  },
  {
    pattern: /\ball\s+(my\s+)?(sol|funds|balance|money)\b/i,
    reason: "Position size must be a specific dollar amount, not your entire balance.",
  },
  {
    pattern: /\bunlimited\s+(slippage|size|position|risk)\b/i,
    reason: "Slippage and position size must be bounded — unlimited values are rejected.",
  },
  {
    pattern: /\b(without|no)\s+limits?\b/i,
    reason: "Every strategy must have explicit limits (trade size, stop loss). Trading without limits is rejected.",
  },
  {
    pattern: /\bignore\s+(safety|security|risk)\b/i,
    reason: "Safety and security checks cannot be disabled by a strategy instruction.",
  },
  {
    pattern: /\banything\s+(that'?s?\s+)?trending\b/i,
    reason: "Token universe must be bounded by explicit filters (liquidity, age, holder concentration, etc.), not \"anything trending\".",
  },
  {
    pattern: /\bno\s+stop[\s-]?loss\b/i,
    reason: "A stop loss is required for every strategy.",
  },
];

export function findUnsafeInstructionReasons(text: string): string[] {
  const reasons: string[] = [];
  for (const { pattern, reason } of UNSAFE_PATTERNS) {
    if (pattern.test(text)) reasons.push(reason);
  }
  return reasons;
}

function parseMagnitude(raw: string): number {
  const cleaned = raw.replace(/,/g, "").trim().toLowerCase();
  const match = /^([\d.]+)\s*(k|m)?$/.exec(cleaned);
  if (!match) return Number.NaN;
  const value = Number.parseFloat(match[1] ?? "");
  const suffix = match[2];
  if (suffix === "k") return value * 1_000;
  if (suffix === "m") return value * 1_000_000;
  return value;
}

function firstMatch(text: string, patterns: RegExp[]): RegExpExecArray | null {
  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (m) return m;
  }
  return null;
}

function minutesFrom(amount: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("hour") || u === "h" || u === "hr" || u === "hrs") return amount * 60;
  if (u.startsWith("day")) return amount * 60 * 24;
  return amount;
}

function parseTakeProfits(text: string): { levels: TakeProfitLevel[]; matchedClauses: string[] } {
  const levels: TakeProfitLevel[] = [];
  const matchedClauses: string[] = [];
  let allocatedPct = 0;

  // "sell half at 80% profit" / "sell 50% at 80% profit"
  const explicitPctRe = /sell\s+(\d{1,3}(?:\.\d+)?)\s*%\s+(?:of (?:the )?position\s+)?at\s+(\d{1,4}(?:\.\d+)?)\s*%\s*(?:profit)?/gi;
  const halfRe = /sell\s+half\s+at\s+(\d{1,4}(?:\.\d+)?)\s*%\s*(?:profit)?/gi;
  const anotherRe = /another\s+(\d{1,3}(?:\.\d+)?)\s*%\s+at\s+(\d{1,4}(?:\.\d+)?)\s*%/gi;

  let m: RegExpExecArray | null;
  while ((m = halfRe.exec(text))) {
    levels.push({ sellPercentage: 50, profitPercentage: Number.parseFloat(m[1] ?? "0") });
    allocatedPct += 50;
    matchedClauses.push(m[0]);
  }
  while ((m = explicitPctRe.exec(text))) {
    levels.push({
      sellPercentage: Number.parseFloat(m[1] ?? "0"),
      profitPercentage: Number.parseFloat(m[2] ?? "0"),
    });
    allocatedPct += Number.parseFloat(m[1] ?? "0");
    matchedClauses.push(m[0]);
  }
  while ((m = anotherRe.exec(text))) {
    levels.push({
      sellPercentage: Number.parseFloat(m[1] ?? "0"),
      profitPercentage: Number.parseFloat(m[2] ?? "0"),
    });
    allocatedPct += Number.parseFloat(m[1] ?? "0");
    matchedClauses.push(m[0]);
  }

  // "sell the rest at 100% profit" — only meaningful if something is left.
  const restRe = /sell\s+(?:the\s+)?(?:rest|remainder|remaining)\s+at\s+(\d{1,4}(?:\.\d+)?)\s*%\s*(?:profit)?/i;
  const restMatch = restRe.exec(text);
  if (restMatch) {
    const remaining = Math.max(0, 100 - allocatedPct);
    if (remaining > 0) {
      levels.push({ sellPercentage: remaining, profitPercentage: Number.parseFloat(restMatch[1] ?? "0") });
      matchedClauses.push(restMatch[0]);
    }
  }

  return { levels, matchedClauses };
}

function parseTrailingStop(text: string, alreadyAllocatedPct: number): number | undefined {
  const m = /trail(?:ing)?(?:\s+the\s+rest| the remaining)?\s*(?:stop)?\s*(?:by|of)\s+(\d{1,3}(?:\.\d+)?)\s*%/i.exec(text);
  if (!m) return undefined;
  return Number.parseFloat(m[1] ?? "0");
}

/**
 * Deterministic, dependency-free natural-language strategy parser. Always
 * available (no API key required) and always produces the same output for
 * the same input, which is what makes activation reproducible. Field
 * extraction only ever *adds* structure to what was said — it never invents
 * a value the instruction didn't actually contain, aside from the schema's
 * own conservative defaults applied later during validation.
 */
export function parseStrategyInstructionLocally(text: string): ParseResult {
  const errors = findUnsafeInstructionReasons(text);
  if (errors.length > 0) {
    return { ok: false, rules: {}, warnings: [], errors };
  }

  const rules: Partial<StrategyRules> = {};
  const warnings: string[] = [];

  const buyMatch = firstMatch(text, [
    /buy\s+up\s+to\s+\$\s?([\d,.]+[km]?\b)/i,
    /(?:max(?:imum)?\s+(?:trade|buy|position)(?:\s+size)?(?:\s+is|\s+of|:)?)\s+\$\s?([\d,.]+[km]?\b)/i,
    /buy\s+\$\s?([\d,.]+[km]?\b)/i,
  ]);
  if (buyMatch?.[1]) {
    const value = parseMagnitude(buyMatch[1]);
    if (Number.isFinite(value) && value > 0) rules.maxTradeUsd = value;
  }

  const liquidityMatch = firstMatch(text, [
    /liquidity\s+(?:is\s+)?(?:above|over|greater than|at least)\s+\$\s?([\d,.]+[km]?\b)/i,
  ]);
  if (liquidityMatch?.[1]) {
    const value = parseMagnitude(liquidityMatch[1]);
    if (Number.isFinite(value)) rules.minimumLiquidityUsd = value;
  }

  const vol5Match = firstMatch(text, [
    /(?:five|5)[\s-]?minute\s+volume\s+(?:is\s+)?(?:above|over|greater than|at least)\s+\$\s?([\d,.]+[km]?\b)/i,
    /5m\s+volume\s+(?:above|over)\s+\$\s?([\d,.]+[km]?\b)/i,
  ]);
  if (vol5Match?.[1]) {
    const value = parseMagnitude(vol5Match[1]);
    if (Number.isFinite(value)) rules.minimumVolume5mUsd = value;
  }

  const vol1hMatch = firstMatch(text, [
    /(?:one|1)[\s-]?hour\s+volume\s+(?:is\s+)?(?:above|over|greater than|at least)\s+\$\s?([\d,.]+[km]?\b)/i,
  ]);
  if (vol1hMatch?.[1]) {
    const value = parseMagnitude(vol1hMatch[1]);
    if (Number.isFinite(value)) rules.minimumVolume1hUsd = value;
  }

  const maxAgeMatch = firstMatch(text, [
    /less\s+than\s+(\d+(?:\.\d+)?)\s*(hours?|minutes?|mins?|days?)\s+old/i,
    /younger\s+than\s+(\d+(?:\.\d+)?)\s*(hours?|minutes?|mins?|days?)/i,
  ]);
  if (maxAgeMatch?.[1] && maxAgeMatch[2]) {
    rules.maximumTokenAgeMinutes = minutesFrom(Number.parseFloat(maxAgeMatch[1]), maxAgeMatch[2]);
  }

  const minAgeMatch = firstMatch(text, [
    /older\s+than\s+(\d+(?:\.\d+)?)\s*(hours?|minutes?|mins?|days?)/i,
    /at\s+least\s+(\d+(?:\.\d+)?)\s*(hours?|minutes?|mins?|days?)\s+old/i,
  ]);
  if (minAgeMatch?.[1] && minAgeMatch[2]) {
    rules.minimumTokenAgeMinutes = minutesFrom(Number.parseFloat(minAgeMatch[1]), minAgeMatch[2]);
  }

  const holdersMatch = firstMatch(text, [
    /top\s+(?:ten|10)\s+holders?\s+(?:own|owning|hold)?\s*(?:less than|below|under)\s+(\d+(?:\.\d+)?)\s*%/i,
    /top\s*10\s+holder\s+concentration\s+(?:below|under|less than)\s+(\d+(?:\.\d+)?)\s*%/i,
  ]);
  if (holdersMatch?.[1]) {
    rules.maximumTop10HolderPercentage = Number.parseFloat(holdersMatch[1]);
  }

  if (/mint\s+authority\s+is\s+disabled/i.test(text) || /mint\s+authority\s+(?:is\s+)?renounced/i.test(text)) {
    rules.requireMintAuthorityDisabled = true;
  }
  if (/freeze\s+authority\s+is\s+disabled/i.test(text) || /freeze\s+authority\s+(?:is\s+)?renounced/i.test(text)) {
    rules.requireFreezeAuthorityDisabled = true;
  }

  const slippageMatch = firstMatch(text, [/slippage\s+(?:of\s+|below\s+|under\s+|less than\s+)?(\d+(?:\.\d+)?)\s*%/i]);
  if (slippageMatch?.[1]) rules.maximumSlippagePercentage = Number.parseFloat(slippageMatch[1]);

  const priceImpactMatch = firstMatch(text, [/price\s+impact\s+(?:of\s+|below\s+|under\s+|less than\s+)?(\d+(?:\.\d+)?)\s*%/i]);
  if (priceImpactMatch?.[1]) rules.maximumPriceImpactPercentage = Number.parseFloat(priceImpactMatch[1]);

  const priceChangeRangeMatch = firstMatch(text, [
    /price\s+(?:increased|rose|went up|changed)\s+between\s+(\d+(?:\.\d+)?)\s*%\s+and\s+(\d+(?:\.\d+)?)\s*%\s+(?:during\s+the\s+)?last\s+(\d+)\s*(minutes?|mins?|hours?)/i,
  ]);
  if (priceChangeRangeMatch?.[1] && priceChangeRangeMatch[2] && priceChangeRangeMatch[4]) {
    const min = Number.parseFloat(priceChangeRangeMatch[1]);
    const max = Number.parseFloat(priceChangeRangeMatch[2]);
    const isHourWindow = /hour/i.test(priceChangeRangeMatch[4]);
    if (isHourWindow) {
      rules.minimumPriceChange1hPct = min;
      rules.maximumPriceChange1hPct = max;
    } else {
      rules.minimumPriceChange5mPct = min;
      rules.maximumPriceChange5mPct = max;
    }
  }

  const stopLossMatch = firstMatch(text, [
    /stop[\s-]?loss\s+(?:at|of)\s+(?:a\s+)?(\d+(?:\.\d+)?)\s*%/i,
    /stop\s+out\s+at\s+(?:a\s+)?(\d+(?:\.\d+)?)\s*%\s+loss/i,
  ]);
  if (stopLossMatch?.[1]) rules.stopLossPercentage = Number.parseFloat(stopLossMatch[1]);

  const { levels: takeProfits } = parseTakeProfits(text);
  if (takeProfits.length > 0) rules.takeProfits = takeProfits;

  const allocated = takeProfits.reduce((sum, tp) => sum + tp.sellPercentage, 0);
  const trailing = parseTrailingStop(text, allocated);
  if (trailing !== undefined) rules.trailingStopPercentage = trailing;

  if (rules.maxTradeUsd === undefined) {
    errors.push(
      'Could not find a maximum trade size. Please state one explicitly, e.g. "buy up to $20".',
    );
  }
  if (rules.stopLossPercentage === undefined) {
    errors.push(
      'Could not find a stop loss. Every strategy needs one, e.g. "stop loss at 20%".',
    );
  }
  if (rules.minimumLiquidityUsd === undefined) {
    warnings.push("No minimum liquidity was stated — defaulting to your global minimum liquidity setting.");
  }
  if (!rules.takeProfits?.length && rules.trailingStopPercentage === undefined) {
    warnings.push(
      "No take-profit or trailing stop was found — this strategy will only exit via stop loss or manual close.",
    );
  }

  return { ok: errors.length === 0, rules, warnings, errors };
}
