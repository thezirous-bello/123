import { spotLiveTradingAllowedByConfig } from "../env.js";
import { Decimal } from "../lib/decimal.js";
import { recordRiskEvent } from "../lib/auditLog.js";
import type { BybitMode } from "../bybit/client.js";
import { countOpenSpotPositions, realizedPnlSinceSpot } from "./repository.js";
import { getSpotBotState, isSpotEmergencyStopped } from "./state.js";
import type { SpotStrategyConfig } from "./schema.js";

export interface SpotRiskCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface SpotRiskAssessment {
  approved: boolean;
  checks: SpotRiskCheck[];
  blockingReasons: string[];
}

function check(name: string, passed: boolean, detail: string): SpotRiskCheck {
  return { name, passed, detail };
}

export interface SpotEntryRiskInput {
  mode: BybitMode;
  notionalUsd: Decimal;
  availableBalanceUsd: Decimal;
  accountEquityUsd: Decimal;
  config: SpotStrategyConfig;
}

/** The single gate every spot entry must pass, mirroring the meme-coin
 * bot's assessEntryRisk in structure and intent — same "block by default,
 * log every reason" philosophy. No leverage/margin here: spot just needs
 * the cash on hand to cover the buy. */
export function assessSpotEntryRisk(input: SpotEntryRiskInput): SpotRiskAssessment {
  const checks: SpotRiskCheck[] = [];
  const state = getSpotBotState();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  checks.push(check("emergency_stop", !isSpotEmergencyStopped(), "Emergency stop must not be active."));

  if (input.mode === "live") {
    checks.push(
      check(
        "live_trading_config_flag",
        spotLiveTradingAllowedByConfig,
        "SPOT_LIVE_TRADING_ENABLED must be \"true\" in the server .env for any live (mainnet) spot trade.",
      ),
    );
  }

  const openPositions = countOpenSpotPositions(input.mode);
  checks.push(
    check(
      "max_active_trades",
      openPositions < input.config.maxActiveTrades,
      `${openPositions} open spot position(s), limit is ${input.config.maxActiveTrades}.`,
    ),
  );

  checks.push(
    check(
      "cash_available",
      input.notionalUsd.gt(0) && input.notionalUsd.lte(input.availableBalanceUsd),
      `Required cash $${input.notionalUsd.toFixed(2)} must be <= available balance $${input.availableBalanceUsd.toFixed(2)}.`,
    ),
  );

  const dailyPnl = realizedPnlSinceSpot(input.mode, dayAgo);
  const dailyLossPct = input.accountEquityUsd.gt(0) ? dailyPnl.negated().div(input.accountEquityUsd).times(100) : new Decimal(0);
  checks.push(
    check(
      "daily_max_loss",
      dailyPnl.gte(0) || dailyLossPct.lte(input.config.dailyMaxLossPct),
      `Realized spot PnL today is $${dailyPnl.toFixed(2)} (${dailyLossPct.toFixed(2)}% of equity), limit is ${input.config.dailyMaxLossPct}%.`,
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
    recordRiskEvent("spot_entry_blocked", "warning", `Spot trade blocked by risk engine: ${blockingReasons[0]}`, {
      mode: input.mode,
      allReasons: blockingReasons,
    });
  }

  return { approved, checks, blockingReasons };
}

/** Position sizing from the strategy's own rule: risk `riskPerTradePct`% of
 * account equity on the distance to stop-loss, then derive the buy qty/
 * notional from that — no leverage, so notional IS the cash required.
 * `sizeMultiplier` comes from Stage 2's Fear & Greed check (reduces size
 * instead of blocking above 80). */
export function computeSpotPositionSize(params: {
  equityUsd: Decimal;
  entryPrice: Decimal;
  stopLoss: Decimal;
  riskPerTradePct: number;
  sizeMultiplier: number;
  qtyStep: number;
}): { qty: Decimal; notionalUsd: Decimal; riskAmountUsd: Decimal } {
  const riskAmountUsd = params.equityUsd.times(params.riskPerTradePct / 100).times(params.sizeMultiplier);
  const stopDistance = params.entryPrice.minus(params.stopLoss).abs();
  if (stopDistance.lte(0)) {
    return { qty: new Decimal(0), notionalUsd: new Decimal(0), riskAmountUsd };
  }
  const rawQty = riskAmountUsd.div(stopDistance);
  const step = new Decimal(params.qtyStep || 0.001);
  const qty = rawQty.div(step).floor().times(step);
  const notionalUsd = qty.times(params.entryPrice);
  return { qty, notionalUsd, riskAmountUsd };
}
