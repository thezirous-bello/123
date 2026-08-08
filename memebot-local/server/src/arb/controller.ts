import { Decimal } from "../lib/decimal.js";
import { recordLog } from "../lib/auditLog.js";
import { getArbStrategyConfig } from "./configStore.js";
import { fetchAllTickers } from "./exchanges/index.js";
import { scanAllSymbols, type SpreadOpportunity } from "./signalEngine.js";
import { adjustArbPaperCash, createOpportunity, getArbPaperAccount, lastActedOpportunityForSymbol, recordArbTrade } from "./repository.js";
import { getArbBotState, isArbEmergencyStopped, recordArbScan, setArbRunning, triggerArbEmergencyStop, resumeArbFromEmergencyStop, type ArbBotState } from "./state.js";

// Why this bot stays paper-only rather than wiring up real cross-exchange
// execution: a genuine price gap between two exchanges closes in seconds —
// it's being arbitraged by firms with colocated servers and sub-millisecond
// execution. Capturing it for real requires pre-funding BOTH currencies on
// EVERY exchange up front (so each leg fires as a plain same-exchange order,
// no cross-exchange transfer inside the trade) plus much faster market data
// than REST polling provides. This scanner tells you whether/how often
// genuine opportunities actually appear and roughly how large, which is the
// right first step before committing real capital to any of that.

let tickHandle: NodeJS.Timeout | null = null;
let tickInFlight = false;

export function startArbBot(): ArbBotState {
  const state = setArbRunning(true);
  recordLog("info", "arb_bot", "Arbitrage scanner started");
  scheduleNextTick(500);
  return state;
}

export function stopArbBot(): ArbBotState {
  const state = setArbRunning(false);
  if (tickHandle) clearTimeout(tickHandle);
  recordLog("info", "arb_bot", "Arbitrage scanner stopped");
  return state;
}

function scheduleNextTick(delayMs: number) {
  if (tickHandle) clearTimeout(tickHandle);
  tickHandle = setTimeout(runTick, delayMs);
}

async function runTick() {
  const state = getArbBotState();
  if (!state.running) return;
  if (tickInFlight) {
    scheduleNextTick(1000);
    return;
  }
  tickInFlight = true;
  const config = getArbStrategyConfig();
  try {
    if (config.enabled && !isArbEmergencyStopped()) {
      await scan(config);
    }
  } catch (err) {
    recordLog("error", "arb_bot", `Arb scan failed: ${(err as Error).message}`);
  } finally {
    tickInFlight = false;
    if (getArbBotState().running) scheduleNextTick(Math.max(1000, config.scanIntervalSeconds * 1000));
  }
}

async function scan(config: ReturnType<typeof getArbStrategyConfig>) {
  const tickersByExchange = await fetchAllTickers(config.exchanges, config.symbols);
  recordArbScan();
  if (tickersByExchange.size < 2) {
    recordLog("debug", "arb_bot", `Only ${tickersByExchange.size} exchange(s) responded this scan — need at least 2 to compare.`);
    return;
  }

  const opportunities = scanAllSymbols(tickersByExchange, config);
  let tradesThisScan = 0;

  for (const opp of opportunities) {
    if (isArbEmergencyStopped()) break;

    const skipReason = whySkip(opp, config, tradesThisScan);
    const acted = skipReason === null;
    createOpportunity({
      symbol: opp.symbol,
      buyExchange: opp.buyExchange,
      buyPrice: new Decimal(opp.buyPrice),
      sellExchange: opp.sellExchange,
      sellPrice: new Decimal(opp.sellPrice),
      grossSpreadPct: new Decimal(opp.grossSpreadPct),
      netSpreadPct: new Decimal(opp.netSpreadPct),
      acted,
      skipReason,
    });

    if (!acted) continue;
    simulateTrade(opp, config);
    tradesThisScan += 1;
  }
}

function whySkip(opp: SpreadOpportunity, config: ReturnType<typeof getArbStrategyConfig>, tradesThisScan: number): string | null {
  if (opp.netSpreadPct < config.minNetSpreadPct) {
    return `Net spread ${opp.netSpreadPct.toFixed(3)}% below minimum ${config.minNetSpreadPct}% after fees + buffer.`;
  }
  if (tradesThisScan >= config.maxTradesPerScan) {
    return `Already simulated ${tradesThisScan} trade(s) this scan, limit is ${config.maxTradesPerScan}.`;
  }
  const last = lastActedOpportunityForSymbol(opp.symbol);
  if (last) {
    const secondsSince = (Date.now() - new Date(last.createdAt).getTime()) / 1000;
    if (secondsSince < config.perSymbolCooldownSeconds) {
      return `${opp.symbol} traded ${secondsSince.toFixed(0)}s ago, cooldown is ${config.perSymbolCooldownSeconds}s.`;
    }
  }
  return null;
}

/** Instant-fill simulation: no latency or slippage modeled, so results here
 * are optimistic relative to what real execution would realize — see the
 * module comment above for why real execution is a much bigger undertaking
 * than this scanner. */
function simulateTrade(opp: SpreadOpportunity, config: ReturnType<typeof getArbStrategyConfig>) {
  const qty = new Decimal(config.positionSizeUsd).div(opp.buyPrice);
  const notionalUsd = new Decimal(config.positionSizeUsd);
  const grossProfitUsd = qty.times(opp.sellPrice - opp.buyPrice);
  // totalFeePct = grossSpreadPct - netSpreadPct - safetyBufferPct, algebraically
  // reversed out of how netSpreadPct was derived in findBestOpportunity.
  const totalFeePct = new Decimal(opp.grossSpreadPct).minus(opp.netSpreadPct).minus(config.safetyBufferPct);
  const feeUsd = notionalUsd.times(totalFeePct).div(100);
  const netProfitUsd = grossProfitUsd.minus(feeUsd);

  const trade = recordArbTrade({
    opportunityId: null,
    symbol: opp.symbol,
    buyExchange: opp.buyExchange,
    buyPrice: new Decimal(opp.buyPrice),
    sellExchange: opp.sellExchange,
    sellPrice: new Decimal(opp.sellPrice),
    qty,
    notionalUsd,
    grossProfitUsd,
    feeUsd,
    netProfitUsd,
  });
  adjustArbPaperCash(netProfitUsd);
  recordLog(
    "info",
    "arb_trade",
    `${opp.symbol}: bought ${opp.buyExchange} @ ${opp.buyPrice}, sold ${opp.sellExchange} @ ${opp.sellPrice} — net +$${netProfitUsd.toFixed(2)} (${opp.netSpreadPct.toFixed(3)}% net spread)`,
    { tradeId: trade.id },
  );
}

export function emergencyStopArb(triggeredBy: string, reason: string) {
  stopArbBot();
  return triggerArbEmergencyStop(triggeredBy, reason);
}

export function resumeArb(confirmedBy: string) {
  return resumeArbFromEmergencyStop(confirmedBy);
}

export function getArbWallet() {
  const account = getArbPaperAccount();
  return { cashBalanceUsd: account.cashBalanceUsd, startingBalanceUsd: account.startingBalanceUsd };
}

export { runTick as _internalArbTickForTests };
