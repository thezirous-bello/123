import { Decimal } from "../lib/decimal.js";
import type { Position } from "./positionRepository.js";

export type ExitReason = "stop_loss" | `take_profit_${number}` | "trailing_stop" | "max_holding_period";

export interface ExitAction {
  reason: ExitReason;
  sellPercentageOfOriginal: number;
  takeProfitIndex?: number;
}

/**
 * Pure decision function: given a position and a current price, decides the
 * single next exit action to take (if any). Priority order: stop loss (limit
 * downside first) > next unfilled take-profit level in ascending order (lock
 * in gains) > trailing stop > max holding period. Called once per snapshot
 * per open position; the caller re-evaluates on the next tick after
 * executing whatever this returns, since the position's remaining size and
 * cost basis change after every partial exit.
 */
export function evaluateExitAction(position: Position, currentPriceUsd: Decimal, now: Date = new Date()): ExitAction | null {
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
