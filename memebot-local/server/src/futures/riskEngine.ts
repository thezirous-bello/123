import { futuresLiveTradingAllowedByConfig } from "../env.js";
import { Decimal } from "../lib/decimal.js";
import { recordRiskEvent } from "../lib/auditLog.js";
import type { BybitMode } from "../bybit/client.js";
import { countOpenFuturesPositions, realizedPnlSinceFutures } from "./repository.js";
import { getFuturesBotState, isFuturesEmergencyStopped } from "./state.js";
import type { FuturesStrategyConfig } from "./schema.js";

export interface FuturesRiskCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface FuturesRiskAssessment {
  approved: boolean;
  checks: FuturesRiskCheck[];
  blockingReasons: string[];
}

function check(name: string, passed: boolean, detail: string): FuturesRiskCheck {
  return { name, passed, detail };
}

// A very rough liquidation-distance estimate (ignoring maintenance margin,
// fees, and funding) — entry moving against the position by 1/leverage
// wipes the margin. This strategy's own max stop-loss distance (3%) gets
// uncomfortably close to that at 30x (~3.33%), so this isn't a formality:
// it's the one thing standing between "stop-loss triggers" and
// "position gets liquidated before the stop-loss can fire."
const LIQUIDATION_SAFETY_FACTOR = 0.7; // stop must trigger within 70% of the naive liquidation distance

/** Largest leverage for which a given fixed stop-loss distance still stays
 * inside the liquidation safety buffer above. The new strategy's stop-loss
 * is a fixed 3-4% (not ATR-scaled), so at the high end of that band (4%)
 * the strategy's own 15-30x leverage range would routinely fail
 * `liquidation_safety_buffer` — 30x's naive liquidation distance is only
 * ~3.33%, and 70% of that (~2.33%) is tighter than a 4% stop. Rather than
 * silently rejecting otherwise-good entries, the controller calls this to
 * clamp the chosen leverage down to whatever the actual stop distance can
 * safely support, still within [minLeverage, maxLeverage]. */
export function maxSafeLeverageForStopDistance(stopLossDistancePct: number): number {
  if (stopLossDistancePct <= 0) return Infinity;
  return Math.floor((100 * LIQUIDATION_SAFETY_FACTOR) / stopLossDistancePct);
}

export interface FuturesEntryRiskInput {
  mode: BybitMode;
  leverage: number;
  maxInstrumentLeverage: number;
  stopLossDistancePct: number; // as a percentage, e.g. 3 for 3%
  marginUsd: Decimal;
  availableBalanceUsd: Decimal;
  accountEquityUsd: Decimal;
  config: FuturesStrategyConfig;
}

/** The single gate every futures entry must pass, mirroring the meme-coin
 * bot's assessEntryRisk in structure and intent — same "block by default,
 * log every reason" philosophy, adapted for leverage/margin and this
 * strategy's much higher risk profile. */
export function assessFuturesEntryRisk(input: FuturesEntryRiskInput): FuturesRiskAssessment {
  const checks: FuturesRiskCheck[] = [];
  const state = getFuturesBotState();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  checks.push(check("emergency_stop", !isFuturesEmergencyStopped(), "Emergency stop must not be active."));

  if (input.mode === "live") {
    checks.push(
      check(
        "live_trading_config_flag",
        futuresLiveTradingAllowedByConfig,
        "FUTURES_LIVE_TRADING_ENABLED must be \"true\" in the server .env for any live (mainnet) futures trade.",
      ),
    );
  }

  const openPositions = countOpenFuturesPositions(input.mode);
  checks.push(
    check(
      "max_active_trades",
      openPositions < input.config.maxActiveTrades,
      `${openPositions} open futures position(s), limit is ${input.config.maxActiveTrades}.`,
    ),
  );

  checks.push(
    check(
      "leverage_bounds",
      input.leverage >= input.config.minLeverage && input.leverage <= input.config.maxLeverage && input.leverage <= input.maxInstrumentLeverage,
      `Leverage ${input.leverage}x must be within [${input.config.minLeverage}x, ${input.config.maxLeverage}x] and <= instrument max ${input.maxInstrumentLeverage}x.`,
    ),
  );

  const naiveLiquidationDistancePct = (1 / input.leverage) * 100;
  checks.push(
    check(
      "liquidation_safety_buffer",
      input.stopLossDistancePct <= naiveLiquidationDistancePct * LIQUIDATION_SAFETY_FACTOR,
      `Stop-loss distance ${input.stopLossDistancePct.toFixed(2)}% must be <= ${(naiveLiquidationDistancePct * LIQUIDATION_SAFETY_FACTOR).toFixed(2)}% (${LIQUIDATION_SAFETY_FACTOR * 100}% of the ~${naiveLiquidationDistancePct.toFixed(2)}% naive liquidation distance at ${input.leverage}x) — otherwise liquidation could hit before the stop-loss does.`,
    ),
  );

  checks.push(
    check(
      "margin_available",
      input.marginUsd.gt(0) && input.marginUsd.lte(input.availableBalanceUsd),
      `Required margin $${input.marginUsd.toFixed(2)} must be <= available balance $${input.availableBalanceUsd.toFixed(2)}.`,
    ),
  );

  const dailyPnl = realizedPnlSinceFutures(input.mode, dayAgo);
  const dailyLossPct = input.accountEquityUsd.gt(0) ? dailyPnl.negated().div(input.accountEquityUsd).times(100) : new Decimal(0);
  checks.push(
    check(
      "daily_max_loss",
      dailyPnl.gte(0) || dailyLossPct.lte(input.config.dailyMaxLossPct),
      `Realized futures PnL today is $${dailyPnl.toFixed(2)} (${dailyLossPct.toFixed(2)}% of equity), limit is ${input.config.dailyMaxLossPct}%.`,
    ),
  );

  checks.push(
    check(
      "consecutive_loss_halt",
      state.consecutiveLosses < input.config.stopAfterConsecutiveLosses,
      `${state.consecutiveLosses} consecutive loss(es) — trading halts at ${input.config.stopAfterConsecutiveLosses}. Resume manually to clear.`,
    ),
  );

  if (state.tradingHaltedUntil) {
    const stillHalted = new Date(state.tradingHaltedUntil).getTime() > now.getTime();
    checks.push(check("manual_halt_window", !stillHalted, `Trading is halted until ${state.tradingHaltedUntil}.`));
  }

  const blockingReasons = checks.filter((c) => !c.passed).map((c) => c.detail);
  const approved = blockingReasons.length === 0;

  if (!approved) {
    recordRiskEvent("futures_entry_blocked", "warning", `Futures trade blocked by risk engine: ${blockingReasons[0]}`, {
      mode: input.mode,
      allReasons: blockingReasons,
    });
  }

  return { approved, checks, blockingReasons };
}

/** Position sizing straight from the strategy's own rule: a flat
 * percentage of account equity (20-50%, tiered by confidence) goes to
 * notional exposure, then leverage determines how much margin that
 * actually costs. This is deliberately NOT risk-based sizing (unlike the
 * spot/meme bots) — the strategy explicitly specifies size as a % of
 * balance, not a % risked to stop-loss. */
export function computeFuturesPositionSize(params: {
  equityUsd: Decimal;
  entryPrice: Decimal;
  positionSizePct: number;
  leverage: number;
  qtyStep: number;
}): { qty: Decimal; notionalUsd: Decimal; marginUsd: Decimal } {
  const notionalTarget = params.equityUsd.times(params.positionSizePct / 100).times(params.leverage);
  const rawQty = notionalTarget.div(params.entryPrice);
  const step = new Decimal(params.qtyStep || 0.001);
  const qty = rawQty.div(step).floor().times(step);
  const notionalUsd = qty.times(params.entryPrice);
  const marginUsd = notionalUsd.div(params.leverage);
  return { qty, notionalUsd, marginUsd };
}
