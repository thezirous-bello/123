import { Decimal } from "../lib/decimal.js";
import type { IdentityCheckResult } from "./identity.js";
import type { DepositGateResult } from "./exchanges/auth/index.js";

export interface EntryGateInput {
  identity: IdentityCheckResult;
  depositGate: DepositGateResult;
  netSpreadPct: number;
  minNetSpreadPct: number;
  requireCoinIdentityVerified: boolean;
  requireDepositVerified: boolean;
}

export interface GateResult {
  passed: boolean;
  reason: string | null;
}

/**
 * The three hard gates a candidate opportunity must clear before this app
 * will simulate acting on it:
 *   1. The buy and sell exchanges must resolve to the SAME underlying coin
 *      for this ticker (not just the same symbol string) — the direct fix
 *      for "same symbol, different coin" ticker collisions.
 *   2. The coin must be currently deposit-enabled on the sell exchange — the
 *      direct fix for "bought on platform 1, but platform 2 had deposits
 *      blocked, wasting the fee for nothing."
 *   3. Net spread must clear the configured minimum (default >1%) — not a
 *      rounding-error-sized "opportunity."
 * "unverifiable" for either check 1 or 2 is treated as a fail, never a
 * pass — never trade on data we don't actually have.
 */
export function evaluateEntryGates(input: EntryGateInput): GateResult {
  if (input.requireCoinIdentityVerified && input.identity !== "match") {
    return {
      passed: false,
      reason:
        input.identity === "mismatch"
          ? "Symbol resolves to a different underlying coin on the buy vs sell exchange — refusing to trade a ticker collision."
          : "Could not verify the buy and sell exchanges list the same underlying coin for this symbol yet (identity data not cached).",
    };
  }
  if (input.requireDepositVerified && input.depositGate !== "enabled") {
    return {
      passed: false,
      reason:
        input.depositGate === "disabled"
          ? "Deposits are currently disabled for this coin on the sell exchange — would strand the capital there."
          : "Could not verify deposit status on the sell exchange (no API key configured for it, or the check failed) — refusing to risk stranding capital there.",
    };
  }
  if (input.netSpreadPct < input.minNetSpreadPct) {
    return { passed: false, reason: `Net spread ${input.netSpreadPct.toFixed(3)}% is below the ${input.minNetSpreadPct}% minimum required to qualify as a trade.` };
  }
  return { passed: true, reason: null };
}

/** Whether the reverse-check window has elapsed and it's time to give up
 * looking for a next leg to chain into and start heading capital back
 * home instead. */
export function shouldReturnHome(nowMs: number, reverseCheckDeadlineMs: number): boolean {
  return nowMs >= reverseCheckDeadlineMs;
}

/** Whether a simulated in-flight transfer (withdrawal->deposit) has landed. */
export function hasArrived(nowMs: number, arrivesAtMs: number): boolean {
  return nowMs >= arrivesAtMs;
}

/** Buy-side fill: spend `positionSizeUsd` at `buyPrice`, taker fee taken out
 * of the asset quantity received (not the USD spent — the USD spent is
 * exactly the position size, full stop). */
export function computeBuyFill(positionSizeUsd: Decimal, buyPrice: number, buyFeePct: number): Decimal {
  const grossQty = positionSizeUsd.div(buyPrice);
  return grossQty.times(1 - buyFeePct / 100);
}

/** Sell-side fill + a flat simulated withdrawal-fee deduction (the cost of
 * the transfer leg that just completed to make this sale possible) — never
 * goes negative. */
export function computeSellProceeds(assetQty: Decimal, sellPrice: number, sellFeePct: number, withdrawalFeeUsd: number): Decimal {
  const gross = assetQty.times(sellPrice).times(1 - sellFeePct / 100);
  return Decimal.max(0, gross.minus(withdrawalFeeUsd));
}

/** USD arriving home after a final withdrawal leg (no sale needed — it's
 * already cash), minus that leg's simulated withdrawal fee. */
export function computeReturnHomeAmount(usdAmount: Decimal, withdrawalFeeUsd: number): Decimal {
  return Decimal.max(0, usdAmount.minus(withdrawalFeeUsd));
}
