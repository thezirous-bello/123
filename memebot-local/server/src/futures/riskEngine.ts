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

export interface FuturesEntryRiskInput {
  mode: BybitMode;
  leverage: number;
  maxInstrumentLeverage: number;
  marginUsd: Decimal;
  availableBalanceUsd: Decimal;
  accountEquityUsd: Decimal;
  config: FuturesStrategyConfig;
}

/** The single gate every futures entry must pass, mirroring the meme-coin
 * bot's assessEntryRisk in structure and intent — same "block by default,
 * log every reason" philosophy, adapted for leverage/margin instead of a
 * flat trade-size cap. */
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
      "leverage_cap",
      input.leverage <= input.config.maxLeverage && input.leverage <= input.maxInstrumentLeverage,
      `Leverage ${input.leverage}x must be <= configured max ${input.config.maxLeverage}x and <= instrument max ${input.maxInstrumentLeverage}x.`,
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

/** Position sizing from the strategy's own rule: risk `riskPerTradePct`% of
 * account equity on the distance to stop-loss, then derive qty/notional/
 * margin from that and the chosen leverage. `sizeMultiplier` comes from
 * Stage 2's Fear & Greed check (reduces size instead of blocking above 80). */
export function computeFuturesPositionSize(params: {
  equityUsd: Decimal;
  entryPrice: Decimal;
  stopLoss: Decimal;
  riskPerTradePct: number;
  leverage: number;
  sizeMultiplier: number;
  qtyStep: number;
}): { qty: Decimal; notionalUsd: Decimal; marginUsd: Decimal; riskAmountUsd: Decimal } {
  const riskAmountUsd = params.equityUsd.times(params.riskPerTradePct / 100).times(params.sizeMultiplier);
  const stopDistance = params.entryPrice.minus(params.stopLoss).abs();
  if (stopDistance.lte(0)) {
    return { qty: new Decimal(0), notionalUsd: new Decimal(0), marginUsd: new Decimal(0), riskAmountUsd };
  }
  const rawQty = riskAmountUsd.div(stopDistance);
  const step = new Decimal(params.qtyStep || 0.001);
  const qty = rawQty.div(step).floor().times(step);
  const notionalUsd = qty.times(params.entryPrice);
  const marginUsd = notionalUsd.div(params.leverage);
  return { qty, notionalUsd, marginUsd, riskAmountUsd };
}
