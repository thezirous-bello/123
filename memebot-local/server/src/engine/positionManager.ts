import { Decimal } from "../lib/decimal.js";
import type { MomentumConfig } from "../lib/settings.js";
import type { MomentumScoreResult } from "../market/momentum.js";
import type { Position } from "./positionRepository.js";

export type ExitReason =
  | "stop_loss"
  | `take_profit_${number}`
  | "momentum_reversal"
  | "sell_pressure_reversal"
  | "trailing_stop"
  | "max_holding_period";

export interface ExitAction {
  reason: ExitReason;
  sellPercentageOfOriginal: number;
  takeProfitIndex?: number;
}

/**
 * Pure decision function: given a position and a current price, decides the
 * single next exit action to take (if any). Priority order: stop loss (limit
 * downside first) > next unfilled take-profit level in ascending order (lock
 * in gains) > momentum-reversal / sell-pressure-reversal (dynamic exits that
 * let a winner keep running while momentum holds up, instead of bailing on a
 * mechanical percentage the instant it retraces) > trailing stop (mechanical
 * backstop) > max holding period (final catch-all). Called once per snapshot
 * per open position; the caller re-evaluates on the next tick after
 * executing whatever this returns, since the position's remaining size and
 * cost basis change after every partial exit.
 *
 * `momentum`/`momentumConfig` are optional so existing callers that only
 * care about the fixed stop-loss/take-profit/trailing-stop/max-holding
 * mechanics keep working unchanged — omitting them simply skips the two
 * momentum-based exit checks.
 */
export function evaluateExitAction(
  position: Position,
  currentPriceUsd: Decimal,
  now: Date = new Date(),
  momentum?: MomentumScoreResult | null,
  momentumConfig?: MomentumConfig | null,
): ExitAction | null {
  if (position.status !== "open") return null;

  const pnlPct = currentPriceUsd.minus(position.entryPriceUsd).div(position.entryPriceUsd).times(100);

  if (position.stopLossPercentage !== null && pnlPct.lte(-position.stopLossPercentage)) {
    return { reason: "stop_loss", sellPercentageOfOriginal: 100 };
  }

  for (let i = 0; i < position.takeProfits.length; i++) {
    if (position.takeProfitsFilled.includes(i)) continue;
    const level = position.takeProfits[i];
    if (!level) continue;
    if (pnlPct.gte(level.profitPercentage)) {
      return { reason: `take_profit_${i}`, sellPercentageOfOriginal: level.sellPercentage, takeProfitIndex: i };
    }
  }

  // Dynamic momentum-based exits: only ever fire on a position that is
  // already profitable (never used as a way to bail below cost — stop loss
  // owns that) and only once real momentum has genuinely broken down, not
  // merely paused — this is what lets a strong winner keep running instead
  // of getting closed the moment it takes a breath.
  if (momentum && momentumConfig && pnlPct.gt(0)) {
    const exitOnMomentumReversal = momentumConfig.exitOnMomentumReversal;
    const exitThreshold = momentumConfig.exitMomentumScoreThreshold;
    if (exitOnMomentumReversal && momentum.totalScore < exitThreshold && momentum.trendDirection !== "bullish") {
      return { reason: "momentum_reversal", sellPercentageOfOriginal: 100 };
    }

    if (momentumConfig.exitOnSellPressureReversal && momentum.buySellRatio !== null) {
      const sellRatio = 1 - momentum.buySellRatio;
      if (sellRatio >= momentumConfig.sellPressureReversalRatio) {
        return { reason: "sell_pressure_reversal", sellPercentageOfOriginal: 100 };
      }
    }
  }

  if (position.trailingStopPercentage !== null && position.trailingStopHighUsd !== null) {
    const trailingTriggerPrice = position.trailingStopHighUsd.times(1 - position.trailingStopPercentage / 100);
    if (currentPriceUsd.lte(trailingTriggerPrice)) {
      return { reason: "trailing_stop", sellPercentageOfOriginal: 100 };
    }
  }

  if (position.maxHoldingPeriodMinutes !== null) {
    const ageMinutes = (now.getTime() - new Date(position.openedAt).getTime()) / 60_000;
    if (ageMinutes >= position.maxHoldingPeriodMinutes) {
      return { reason: "max_holding_period", sellPercentageOfOriginal: 100 };
    }
  }

  return null;
}

/** Converts a "sell N% of the original position" action into an actual
 * token amount to sell right now, capped by what's actually left (handles
 * dust and the case where a prior partial fill already reduced the
 * position below what a later percentage would imply). */
export function resolveSellTokenAmount(position: Position, action: ExitAction): Decimal {
  const requested = position.tokenAmount.times(action.sellPercentageOfOriginal / 100);
  return Decimal.min(requested, position.remainingTokenAmount);
}
