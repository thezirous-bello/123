import { liveTradingAllowedByConfig } from "../env.js";
import { Decimal } from "../lib/decimal.js";
import { recordRiskEvent } from "../lib/auditLog.js";
import { getRiskLimits } from "../lib/settings.js";
import type { RiskLevel } from "../security/tokenSecurity.js";
import { isEmergencyStopped } from "./emergency.js";
import {
  countOpenPositions,
  countStrategyTradesSince,
  countTradesSince,
  lastLossTimeForStrategy,
  realizedPnlSince,
  recentClosedPositionOutcomes,
  totalOpenExposureUsd,
  type Mode,
} from "./queries.js";

const RISK_LEVEL_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export interface RiskCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface RiskAssessment {
  approved: boolean;
  checks: RiskCheck[];
  blockingReasons: string[];
}

export interface EntryRiskInput {
  mode: Mode;
  strategyId: string;
  tradeUsd: Decimal;
  accountEquityUsd: Decimal;
  slippagePercentage: number;
  priceImpactPercentage: number;
  tokenRiskLevel: RiskLevel;
  sellSimulationOk: boolean | null;
  requireSellSimulation: boolean;
  quoteAgeSeconds: number;
  solBalanceAfterTradeSol?: Decimal;
  strategyDailyTradeLimit: number;
}

function check(name: string, passed: boolean, detail: string): RiskCheck {
  return { name, passed, detail };
}

/**
 * The single gate every buy order must pass — called before a quote is even
 * requested, and re-checked with fresh data right before signing. Nothing
 * downstream (paper engine, live engine) is allowed to skip this. Returns
 * every check performed, not just the failing ones, so the position record
 * can store the complete picture of why a trade was (or wasn't) approved.
 */
export function assessEntryRisk(input: EntryRiskInput): RiskAssessment {
  const limits = getRiskLimits();
  const checks: RiskCheck[] = [];
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  checks.push(check("emergency_stop", !isEmergencyStopped(), "Emergency stop must not be active."));

  if (input.mode === "live") {
    checks.push(
      check(
        "live_trading_config_flag",
        liveTradingAllowedByConfig,
        "LIVE_TRADING_ENABLED must be \"true\" in the server .env for any live trade.",
      ),
    );
  }

  checks.push(
    check(
      "max_trade_usd",
      input.tradeUsd.gt(0) && input.tradeUsd.lte(limits.maxTradeUsd),
      `Trade size $${input.tradeUsd.toFixed(2)} must be > 0 and <= global max $${limits.maxTradeUsd}.`,
    ),
  );

  const walletPct = input.accountEquityUsd.gt(0)
    ? input.tradeUsd.div(input.accountEquityUsd).times(100)
    : new Decimal(100);
  checks.push(
    check(
      "max_wallet_percentage",
      walletPct.lte(limits.maxWalletPercentagePerTrade),
      `Trade is ${walletPct.toFixed(2)}% of account equity, limit is ${limits.maxWalletPercentagePerTrade}%.`,
    ),
  );

  const openPositions = countOpenPositions(input.mode);
  checks.push(
    check(
      "max_open_positions",
      openPositions < limits.maxOpenPositions,
      `${openPositions} open position(s), limit is ${limits.maxOpenPositions}.`,
    ),
  );

  const tradesThisHour = countTradesSince(input.mode, hourAgo);
  checks.push(
    check(
      "max_trades_per_hour",
      tradesThisHour < limits.maxTradesPerHour,
      `${tradesThisHour} trade(s) in the last hour, limit is ${limits.maxTradesPerHour}.`,
    ),
  );

  const tradesToday = countTradesSince(input.mode, dayAgo);
  checks.push(
    check(
      "max_trades_per_day",
      tradesToday < limits.maxTradesPerDay,
      `${tradesToday} trade(s) in the last 24h, limit is ${limits.maxTradesPerDay}.`,
    ),
  );

  const dailyPnl = realizedPnlSince(input.mode, dayAgo);
  const dailyLossPct = input.accountEquityUsd.gt(0)
    ? dailyPnl.negated().div(input.accountEquityUsd).times(100)
    : new Decimal(0);
  checks.push(
    check(
      "max_daily_loss",
      dailyPnl.gte(0) || dailyLossPct.lte(limits.maxDailyLossPercentage),
      `Realized PnL today is $${dailyPnl.toFixed(2)} (${dailyLossPct.toFixed(2)}% of equity), limit is ${limits.maxDailyLossPercentage}%.`,
    ),
  );

  checks.push(
    check(
      "max_slippage",
      input.slippagePercentage <= limits.maxSlippagePercentage,
      `Slippage ${input.slippagePercentage}% must be <= ${limits.maxSlippagePercentage}%.`,
    ),
  );

  checks.push(
    check(
      "max_price_impact",
      input.priceImpactPercentage <= limits.maxPriceImpactPercentage,
      `Price impact ${input.priceImpactPercentage.toFixed(2)}% must be <= ${limits.maxPriceImpactPercentage}%.`,
    ),
  );

  checks.push(
    check(
      "max_quote_age",
      input.quoteAgeSeconds <= limits.maxQuoteAgeSeconds,
      `Quote age ${input.quoteAgeSeconds.toFixed(1)}s must be <= ${limits.maxQuoteAgeSeconds}s.`,
    ),
  );

  checks.push(
    check(
      "token_risk_level",
      input.tokenRiskLevel !== "critical" && RISK_LEVEL_ORDER[input.tokenRiskLevel] <= RISK_LEVEL_ORDER[limits.maxTokenRiskLevel],
      `Token risk level is "${input.tokenRiskLevel}". Critical is always blocked; your configured maximum is "${limits.maxTokenRiskLevel}".`,
    ),
  );

  if (input.requireSellSimulation) {
    checks.push(
      check(
        "sell_simulation_required",
        input.sellSimulationOk === true,
        input.sellSimulationOk === null
          ? "Sell simulation has not been run — cannot buy a token with an unknown exit."
          : "Sell simulation failed — this token could not be sold in testing.",
      ),
    );
  }

  if (input.mode === "live" && input.solBalanceAfterTradeSol !== undefined) {
    checks.push(
      check(
        "min_sol_reserve",
        input.solBalanceAfterTradeSol.gte(limits.minimumSolReserve),
        `Wallet would hold ${input.solBalanceAfterTradeSol.toFixed(4)} SOL after this trade, minimum reserve is ${limits.minimumSolReserve} SOL.`,
      ),
    );
  }

  // Cooldown after a loss on this specific strategy.
  const lastLoss = lastLossTimeForStrategy(input.strategyId, input.mode);
  if (lastLoss) {
    const minutesSinceLoss = (now.getTime() - new Date(lastLoss).getTime()) / 60_000;
    checks.push(
      check(
        "cooldown_after_loss",
        minutesSinceLoss >= limits.cooldownMinutesAfterLoss,
        `${minutesSinceLoss.toFixed(1)} minutes since last loss on this strategy, cooldown is ${limits.cooldownMinutesAfterLoss} minutes.`,
      ),
    );
  }

  // Global consecutive-loss cooldown across all strategies in this mode.
  const recentOutcomes = recentClosedPositionOutcomes(null, input.mode, limits.consecutiveLossesBeforeCooldown);
  const allRecentAreLosses =
    recentOutcomes.length === limits.consecutiveLossesBeforeCooldown && recentOutcomes.every(Boolean);
  if (allRecentAreLosses) {
    checks.push(
      check(
        "consecutive_loss_cooldown",
        false,
        `${limits.consecutiveLossesBeforeCooldown} consecutive losses detected — cooldown of ${limits.consecutiveLossCooldownMinutes} minutes is in effect. Resume manually or wait it out.`,
      ),
    );
  }

  const strategyTradesToday = countStrategyTradesSince(input.strategyId, input.mode, dayAgo);
  checks.push(
    check(
      "strategy_daily_trade_limit",
      strategyTradesToday < input.strategyDailyTradeLimit,
      `${strategyTradesToday} trade(s) today for this strategy, limit is ${input.strategyDailyTradeLimit}.`,
    ),
  );

  const blockingReasons = checks.filter((c) => !c.passed).map((c) => c.detail);
  const approved = blockingReasons.length === 0;

  if (!approved) {
    recordRiskEvent("entry_blocked", "warning", `Trade blocked by risk engine: ${blockingReasons[0]}`, {
      mode: input.mode,
      strategyId: input.strategyId,
      allReasons: blockingReasons,
    });
  }

  return { approved, checks, blockingReasons };
}

export function accountEquityUsd(cashBalanceUsd: Decimal, mode: Mode): Decimal {
  return cashBalanceUsd.plus(totalOpenExposureUsd(mode));
}
