import { Decimal } from "../lib/decimal.js";
import type { FuturesPosition } from "./repository.js";
import type { FuturesStrategyConfig } from "./schema.js";

export interface FuturesExitDecision {
  action: "stop_loss" | "trailing_stop" | "tp1" | "tp2";
  closeQty: Decimal;
  moveToBreakeven: boolean;
}

/** Pure decision function — never touches the DB or places orders. The
 * controller is responsible for executing whatever this returns. Mirrors
 * the meme-coin bot's evaluateExitAction/positionManager split. */
export function evaluateFuturesExit(position: FuturesPosition, currentPrice: Decimal, config: FuturesStrategyConfig): FuturesExitDecision | null {
  const isLong = position.side === "long";
  const effectiveStop = position.trailingActive && position.trailingStopPrice ? position.trailingStopPrice : position.stopLoss;
  const stopBreached = isLong ? currentPrice.lte(effectiveStop) : currentPrice.gte(effectiveStop);
  if (stopBreached && position.remainingQty.gt(0)) {
    return { action: position.trailingActive ? "trailing_stop" : "stop_loss", closeQty: position.remainingQty, moveToBreakeven: false };
  }

  const tp1 = position.takeProfits.find((t) => t.label === "tp1");
  const tp2 = position.takeProfits.find((t) => t.label === "tp2");
  const tp1Filled = position.takeProfitsFilled.includes("tp1");
  const tp2Filled = position.takeProfitsFilled.includes("tp2");

  if (tp1 && !tp1Filled) {
    const hit = isLong ? currentPrice.gte(tp1.price) : currentPrice.lte(tp1.price);
    if (hit) {
      const closeQty = Decimal.min(position.qty.times(tp1.closePct / 100), position.remainingQty);
      return { action: "tp1", closeQty, moveToBreakeven: config.moveSlToBreakevenAtTp1 };
    }
  }

  if (tp2 && tp1Filled && !tp2Filled) {
    const hit = isLong ? currentPrice.gte(tp2.price) : currentPrice.lte(tp2.price);
    if (hit) {
      const closeQty = Decimal.min(position.qty.times(tp2.closePct / 100), position.remainingQty);
      return { action: "tp2", closeQty, moveToBreakeven: false };
    }
  }

  return null;
}

/** Ratchets the ATR trailing stop for the final runner tranche, active only
 * after TP2 has filled ("Let final 25% trail using 1.2 x ATR"). Returns the
 * new trailing-stop price only when it actually improves (never loosens
 * the stop), or null if there's nothing to update this tick. */
export function computeTrailingStopUpdate(position: FuturesPosition, currentPrice: Decimal, currentAtr: number, config: FuturesStrategyConfig): Decimal | null {
  if (!position.takeProfitsFilled.includes("tp2")) return null;
  const isLong = position.side === "long";
  const trailDistance = new Decimal(currentAtr * config.trailingAtrMultiplier);
  const candidate = isLong ? currentPrice.minus(trailDistance) : currentPrice.plus(trailDistance);
  const existing = position.trailingStopPrice;
  if (!existing) return candidate;
  if (isLong && candidate.gt(existing)) return candidate;
  if (!isLong && candidate.lt(existing)) return candidate;
  return null;
}
