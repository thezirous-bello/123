import { Decimal } from "../lib/decimal.js";
import { recordLog } from "../lib/auditLog.js";
import { getArbStrategyConfig } from "./configStore.js";
import { fetchAllTickers, type ExchangeId, type TickerQuote } from "./exchanges/index.js";
import { checkDepositGate, refreshExchangeBalanceSnapshot } from "./exchanges/auth/index.js";
import { refreshCoinIdentityIfStale, isSameCoinAcrossExchanges } from "./identity.js";
import { findOpportunitiesFromExchange, scanAllSymbols, takerFeePctFor, type SpreadOpportunity } from "./signalEngine.js";
import { computeBuyFill, computeReturnHomeAmount, computeSellProceeds, evaluateEntryGates, hasArrived, shouldReturnHome } from "./journeyEngine.js";
import {
  adjustArbPaperCash,
  beginReturnHome,
  chainNextLeg,
  createJourney,
  createOpportunity,
  getArbPaperAccount,
  getJourney,
  lastActedOpportunityForSymbol,
  listOpenJourneys,
  markArrivedAndSold,
  closeJourneyAborted,
  closeJourneyReturnedHome,
  recordArbTrade,
  type ArbJourney,
} from "./repository.js";
import { getArbBotState, isArbEmergencyStopped, recordArbScan, setArbRunning, triggerArbEmergencyStop, resumeArbFromEmergencyStop, type ArbBotState } from "./state.js";
import type { ArbStrategyConfig } from "./schema.js";

// Why this bot stays paper-only rather than wiring up real cross-exchange
// execution: a genuine price gap between two exchanges closes in seconds —
// it's being arbitraged by firms with colocated servers and sub-millisecond
// execution. This scanner instead simulates a realistic sequential journey
// (buy on exchange A, simulated withdrawal transfer time, sell on exchange
// B, then either chain into a fresh opportunity from B's now-liquid cash or
// wire principal+profit back to A) — see journeyEngine.ts for the state
// machine and repository.ts's arb_journeys table for what's persisted. It
// tells you whether/how often genuine opportunities actually appear, how
// large, and how a realistic (not instant/pre-funded-everywhere) execution
// model would have fared — the right first step before committing real
// capital to any of that.

let tickHandle: NodeJS.Timeout | null = null;
let tickInFlight = false;
let lastBalanceRefreshAtMs = 0;
const BALANCE_REFRESH_INTERVAL_MS = 15 * 60_000; // real-balance checks are purely informational; no need to hammer them

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

function maybeRefreshExchangeBalances(exchanges: ExchangeId[]) {
  const now = Date.now();
  if (now - lastBalanceRefreshAtMs < BALANCE_REFRESH_INTERVAL_MS) return;
  lastBalanceRefreshAtMs = now;
  for (const exchange of exchanges) {
    refreshExchangeBalanceSnapshot(exchange).catch(() => {});
  }
}

async function scan(config: ArbStrategyConfig) {
  const tickersByExchange = await fetchAllTickers(config.exchanges, config.symbols);
  recordArbScan();

  // Background/periodic refreshes — deliberately not awaited, never block
  // the scan tick on a multi-minute CoinGecko crawl or a batch of signed
  // balance calls.
  refreshCoinIdentityIfStale(config.exchanges).catch(() => {});
  maybeRefreshExchangeBalances(config.exchanges);

  if (tickersByExchange.size < 2) {
    recordLog("debug", "arb_bot", `Only ${tickersByExchange.size} exchange(s) responded this scan — need at least 2 to compare.`);
    return;
  }

  // Existing journeys always get progressed first — an arrival, a
  // reverse-check chain-or-timeout decision — before we consider opening
  // any brand new one this tick.
  await progressJourneys(tickersByExchange, config);

  if (isArbEmergencyStopped()) return;

  if (listOpenJourneys().length >= config.maxConcurrentJourneys) {
    recordLog(
      "debug",
      "arb_bot",
      `${listOpenJourneys().length} journey(s) already in flight, at the configured limit of ${config.maxConcurrentJourneys} — skipping new entries this scan.`,
    );
    return;
  }

  const opportunities = scanAllSymbols(tickersByExchange, config);
  let tradesThisScan = 0;

  for (const opp of opportunities) {
    if (isArbEmergencyStopped()) break;
    // findBestOpportunity always returns the best available buy/sell pair
    // for a symbol, even when the "buy" price is actually higher than the
    // "sell" price — that's just the normal, most-common state (no crossed
    // market between any two exchanges right now), not a real opportunity.
    // Don't even log the non-crossed case; it's noise, not a skip.
    if (opp.grossSpreadPct <= 0) continue;
    if (listOpenJourneys().length >= config.maxConcurrentJourneys) break;

    const skipReason = await whySkipEntry(opp, config, tradesThisScan);
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
    openJourney(opp, config);
    tradesThisScan += 1;
  }
}

async function whySkipEntry(opp: SpreadOpportunity, config: ArbStrategyConfig, tradesThisScan: number): Promise<string | null> {
  if (tradesThisScan >= config.maxTradesPerScan) {
    return `Already opened ${tradesThisScan} journey(s) this scan, limit is ${config.maxTradesPerScan}.`;
  }
  const last = lastActedOpportunityForSymbol(opp.symbol);
  if (last) {
    const secondsSince = (Date.now() - new Date(last.createdAt).getTime()) / 1000;
    if (secondsSince < config.perSymbolCooldownSeconds) {
      return `${opp.symbol} traded ${secondsSince.toFixed(0)}s ago, cooldown is ${config.perSymbolCooldownSeconds}s.`;
    }
  }
  const account = getArbPaperAccount();
  if (account.cashBalanceUsd.lt(config.positionSizeUsd)) {
    return `Insufficient free paper capital: need $${config.positionSizeUsd}, have $${account.cashBalanceUsd.toFixed(2)} uncommitted (the rest is in flight in other journeys).`;
  }

  const identity = config.requireCoinIdentityVerified ? isSameCoinAcrossExchanges(opp.symbol, opp.buyExchange, opp.sellExchange) : "match";
  const depositGate = config.requireDepositVerified ? await checkDepositGate(opp.sellExchange, opp.symbol) : "enabled";
  const gate = evaluateEntryGates({
    identity,
    depositGate,
    netSpreadPct: opp.netSpreadPct,
    minNetSpreadPct: config.minNetSpreadPct,
    requireCoinIdentityVerified: config.requireCoinIdentityVerified,
    requireDepositVerified: config.requireDepositVerified,
  });
  return gate.reason;
}

function openJourney(opp: SpreadOpportunity, config: ArbStrategyConfig): void {
  const buyFeePct = takerFeePctFor(opp.buyExchange, config);
  const qty = computeBuyFill(new Decimal(config.positionSizeUsd), opp.buyPrice, buyFeePct);
  const arrivesAt = new Date(Date.now() + config.simulatedTransferMinutes * 60_000).toISOString();
  createJourney({
    symbol: opp.symbol,
    originExchange: opp.buyExchange,
    legDestinationExchange: opp.sellExchange,
    principalUsd: new Decimal(config.positionSizeUsd),
    assetQty: qty,
    arrivesAt,
  });
  adjustArbPaperCash(new Decimal(config.positionSizeUsd).negated());
}

async function progressJourneys(tickersByExchange: Map<ExchangeId, Map<string, TickerQuote>>, config: ArbStrategyConfig): Promise<void> {
  const now = Date.now();
  for (const journey of listOpenJourneys()) {
    if (isArbEmergencyStopped()) return;
    if (journey.status === "in_transit" && journey.arrivesAt && hasArrived(now, new Date(journey.arrivesAt).getTime())) {
      handleArrival(journey, tickersByExchange, config);
    } else if (journey.status === "checking_reverse" && journey.reverseCheckDeadline) {
      await handleReverseCheck(journey, tickersByExchange, config, now);
    } else if (journey.status === "returning_home" && journey.arrivesAt && hasArrived(now, new Date(journey.arrivesAt).getTime())) {
      handleReturnHomeArrival(journey, config);
    }
  }
}

function handleArrival(journey: ArbJourney, tickersByExchange: Map<ExchangeId, Map<string, TickerQuote>>, config: ArbStrategyConfig): void {
  const destination = journey.legDestinationExchange;
  if (!destination || !journey.assetQty) return;
  const quote = tickersByExchange.get(destination)?.get(journey.symbol);
  if (!quote) return; // no fresh price for the destination this tick — wait for the next one rather than fabricate a fill

  const sellFeePct = takerFeePctFor(destination, config);
  const usdAmount = computeSellProceeds(journey.assetQty, quote.bid, sellFeePct, config.simulatedWithdrawalFeeUsd);
  const fromExchange = journey.currentExchange;
  const approxBuyPrice = journey.principalUsd.div(journey.assetQty);

  markArrivedAndSold(journey.id, {
    usdAmount,
    reverseCheckDeadline: new Date(Date.now() + config.reverseCheckWindowSeconds * 1000).toISOString(),
  });

  const netProfitUsd = usdAmount.minus(journey.principalUsd);
  recordArbTrade({
    opportunityId: null,
    symbol: journey.symbol,
    buyExchange: fromExchange,
    buyPrice: approxBuyPrice,
    sellExchange: destination,
    sellPrice: new Decimal(quote.bid),
    qty: journey.assetQty,
    notionalUsd: journey.principalUsd,
    grossProfitUsd: netProfitUsd,
    feeUsd: new Decimal(config.simulatedWithdrawalFeeUsd),
    netProfitUsd,
  });
}

async function handleReverseCheck(
  journey: ArbJourney,
  tickersByExchange: Map<ExchangeId, Map<string, TickerQuote>>,
  config: ArbStrategyConfig,
  now: number,
): Promise<void> {
  const deadlineMs = new Date(journey.reverseCheckDeadline as string).getTime();

  if (!shouldReturnHome(now, deadlineMs)) {
    const next = await findQualifyingOpportunityFrom(journey.currentExchange, tickersByExchange, config);
    if (next && journey.usdAmount) {
      const buyFeePct = takerFeePctFor(journey.currentExchange, config);
      const qty = computeBuyFill(journey.usdAmount, next.buyPrice, buyFeePct);
      const arrivesAt = new Date(Date.now() + config.simulatedTransferMinutes * 60_000).toISOString();
      chainNextLeg(journey.id, { legDestinationExchange: next.sellExchange, assetQty: qty, arrivesAt });
    }
    return;
  }

  const arrivesAt = new Date(Date.now() + config.simulatedTransferMinutes * 60_000).toISOString();
  beginReturnHome(journey.id, { arrivesAt });
}

function handleReturnHomeArrival(journey: ArbJourney, config: ArbStrategyConfig): void {
  const finalUsd = computeReturnHomeAmount(journey.usdAmount ?? new Decimal(0), config.simulatedWithdrawalFeeUsd);
  closeJourneyReturnedHome(journey.id, finalUsd);
}

/** Scans for a fresh opportunity buying FROM `fromExchange` (the exchange a
 * journey's capital currently sits on as cash) and returns the first
 * candidate — best net spread first — that clears the same identity/
 * deposit/spread gates a brand new entry would. Bounded to a handful of
 * gate-checks per call so a quiet reverse-check tick doesn't run 500
 * async deposit-status lookups. */
async function findQualifyingOpportunityFrom(
  fromExchange: ExchangeId,
  tickersByExchange: Map<ExchangeId, Map<string, TickerQuote>>,
  config: ArbStrategyConfig,
): Promise<SpreadOpportunity | null> {
  const candidates = findOpportunitiesFromExchange(fromExchange, tickersByExchange, config).slice(0, 15);
  for (const opp of candidates) {
    const identity = config.requireCoinIdentityVerified ? isSameCoinAcrossExchanges(opp.symbol, opp.buyExchange, opp.sellExchange) : "match";
    const depositGate = config.requireDepositVerified ? await checkDepositGate(opp.sellExchange, opp.symbol) : "enabled";
    const gate = evaluateEntryGates({
      identity,
      depositGate,
      netSpreadPct: opp.netSpreadPct,
      minNetSpreadPct: config.minNetSpreadPct,
      requireCoinIdentityVerified: config.requireCoinIdentityVerified,
      requireDepositVerified: config.requireDepositVerified,
    });
    if (gate.passed) return opp;
  }
  return null;
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

/** Manually resolves a journey stuck in a bad state (e.g. its destination
 * exchange stopped quoting entirely, so it can never detect an arrival) —
 * recovers whatever is actually known: the cash amount if it already sold,
 * otherwise its principal (never fabricates a profit on a forced close). */
export function abortJourney(journeyId: string, reason: string) {
  const journey = getJourney(journeyId);
  if (!journey) throw new Error(`Journey ${journeyId} not found`);
  const recovered = journey.usdAmount ?? journey.principalUsd;
  return closeJourneyAborted(journeyId, recovered, reason);
}

export { runTick as _internalArbTickForTests };
