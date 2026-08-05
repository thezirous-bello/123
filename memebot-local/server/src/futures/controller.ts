import { futuresLiveTradingAllowedByConfig } from "../env.js";
import { Decimal } from "../lib/decimal.js";
import { recordLog } from "../lib/auditLog.js";
import type { BybitMode } from "../bybit/client.js";
import { getAllTickers, getInstrumentInfo, getKlines } from "../bybit/marketData.js";
import { getWalletBalance, setLeverage, setTradingStop, submitMarketOrder } from "../bybit/trading.js";
import { atr } from "../ta/indicators.js";
import { getFuturesStrategyConfig } from "./configStore.js";
import { pickBestCandidate, scanSymbolStage1, validateSignalStage2, type Stage1Candidate } from "./signalEngine.js";
import { assessFuturesEntryRisk, computeFuturesPositionSize } from "./riskEngine.js";
import { computeTrailingStopUpdate, evaluateFuturesExit } from "./tradeManager.js";
import {
  countPendingSignals,
  createSignal,
  expireStaleSignals,
  hasPendingSignalForSymbol,
  listOpenFuturesPositions,
  createFuturesPosition,
  applyFuturesExit,
  moveStopLossToBreakeven,
  updateTrailingStop,
  updateSignalStatus,
  recordFuturesTrade,
  countOpenFuturesPositions,
  type FuturesPosition,
} from "./repository.js";
import {
  getFuturesBotState,
  isFuturesEmergencyStopped,
  recordFuturesTradeOutcome,
  setFuturesMode,
  setFuturesRunning,
  type FuturesBotState,
} from "./state.js";

const CATEGORY = "linear" as const;
const POSITION_MANAGE_INTERVAL_MS = 20_000;
const SIGNAL_SCAN_INTERVAL_MS = 3 * 60_000; // matches "runs every ~3 minutes" in the spec
const SCAN_CONCURRENCY = 5;

let tickHandle: NodeJS.Timeout | null = null;
let tickInFlight = false;
let lastScanAtMs = 0;
let scanInFlight = false;

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export function startFuturesBot(): FuturesBotState {
  const state = setFuturesRunning(true);
  recordLog("info", "futures_bot", "Futures bot started");
  scheduleNextTick(1000);
  return state;
}

export function stopFuturesBot(): FuturesBotState {
  const state = setFuturesRunning(false);
  if (tickHandle) clearTimeout(tickHandle);
  recordLog("info", "futures_bot", "Futures bot stopped");
  return state;
}

/** testnet is always allowed (it's the safe default); live (mainnet) needs
 * both the server-side flag and an explicit confirmed=true from the
 * dashboard, exactly like the meme-coin bot's live trading gate. Given this
 * strategy's 15-30x leverage and 20-50% position sizing, mainnet here is
 * about as consequential a switch as this app has. */
export function requestFuturesModeChange(mode: BybitMode, confirmed: boolean): { ok: boolean; reason?: string; state?: FuturesBotState } {
  if (mode === "live") {
    if (!futuresLiveTradingAllowedByConfig) {
      return { ok: false, reason: 'Live futures trading is disabled by server configuration. Set FUTURES_LIVE_TRADING_ENABLED=true in .env and restart to allow it.' };
    }
    if (!confirmed) {
      return { ok: false, reason: "Live futures trading requires explicit confirmation." };
    }
  }
  const state = setFuturesMode(mode);
  recordLog("warn", "futures_bot", `Futures trading mode changed to ${mode.toUpperCase()}`, { mode });
  return { ok: true, state };
}

function scheduleNextTick(delayMs: number) {
  if (tickHandle) clearTimeout(tickHandle);
  tickHandle = setTimeout(runTick, delayMs);
}

async function runTick() {
  const state = getFuturesBotState();
  if (!state.running) return;
  if (tickInFlight) {
    scheduleNextTick(POSITION_MANAGE_INTERVAL_MS);
    return;
  }
  tickInFlight = true;
  try {
    await tick(state.mode);
  } catch (err) {
    recordLog("error", "futures_bot", `Futures tick failed: ${(err as Error).message}`);
  } finally {
    tickInFlight = false;
    if (getFuturesBotState().running) scheduleNextTick(POSITION_MANAGE_INTERVAL_MS);
  }
}

async function tick(mode: BybitMode) {
  expireStaleSignals();
  await manageOpenFuturesPositions(mode);

  if (isFuturesEmergencyStopped()) return;

  // The scan is deliberately NOT awaited here: with symbolUniverse="all" it
  // can take well over a minute (every Bybit symbol above the liquidity
  // floor), and awaiting it would delay this function's return — which
  // delays scheduleNextTick — which delays the NEXT position-management
  // pass. Open leveraged positions need their stop-loss/take-profit
  // checked every ~20s regardless of how long a scan is taking, so the scan
  // runs in the background instead, guarded by scanInFlight so two scans
  // can never overlap.
  const now = Date.now();
  if (!scanInFlight && now - lastScanAtMs >= SIGNAL_SCAN_INTERVAL_MS) {
    lastScanAtMs = now;
    scanInFlight = true;
    runSignalScan(mode)
      .catch((err) => recordLog("error", "futures_signal_evaluation", `Signal scan failed: ${(err as Error).message}`))
      .finally(() => {
        scanInFlight = false;
      });
  }
}

async function resolveSymbolUniverse(mode: BybitMode): Promise<string[]> {
  const config = getFuturesStrategyConfig();
  if (config.symbolUniverse === "manual") return config.manualSymbols;
  const tickers = await getAllTickers(mode, CATEGORY);
  const usdtPairs = tickers.filter((t) => t.symbol.endsWith("USDT"));
  if (config.symbolUniverse === "all") {
    // Every USDT pair Bybit lists for this category/mode — no turnover
    // pre-filter here. min24hTurnoverUsd is still enforced, just correctly:
    // as a per-symbol Stage 1 skip-condition (see scanSymbolStage1), which
    // logs *why* a specific symbol was skipped instead of silently erasing
    // it from the universe before it's ever looked at. Pre-filtering here
    // used to double-apply the same threshold and, on testnet (where most
    // pairs report near-zero fake 24h volume), collapsed "all" down to a
    // small handful of symbols — the opposite of what "all" means.
    return usdtPairs.map((t) => t.symbol);
  }
  // "auto" is an intentional top-N-by-volume cap for anyone who wants a
  // smaller, faster-cycling universe instead of scanning everything.
  return usdtPairs
    .sort((a, b) => b.turnover24h - a.turnover24h)
    .slice(0, config.autoTopNByVolume)
    .map((t) => t.symbol);
}

async function runSignalScan(mode: BybitMode) {
  const config = getFuturesStrategyConfig();
  if (!config.enabled) return;

  const activeTrades = countOpenFuturesPositions(mode);
  const pendingSignals = countPendingSignals();
  if (pendingSignals >= config.maxPendingSignals || activeTrades >= config.maxActiveTrades) {
    recordLog("debug", "futures_signal_evaluation", `Skipping scan: ${pendingSignals} pending / ${activeTrades} active already at capacity.`);
    return;
  }

  let symbols: string[];
  try {
    symbols = await resolveSymbolUniverse(mode);
  } catch (err) {
    recordLog("warn", "futures_signal_evaluation", `Failed to resolve symbol universe: ${(err as Error).message}`);
    return;
  }
  if (symbols.length === 0) return;

  const results = await mapWithConcurrency(symbols, SCAN_CONCURRENCY, (symbol) =>
    scanSymbolStage1(symbol, config, mode).catch((err) => ({ symbol, reason: `Fetch error: ${(err as Error).message}` })),
  );

  const best = pickBestCandidate(results);
  if (!best) {
    recordLog("debug", "futures_signal_evaluation", `Scanned ${symbols.length} symbols, no Stage 1 setup qualified (long or short).`);
    return;
  }
  recordLog("info", "futures_signal_evaluation", `Stage 1 winner: ${best.side.toUpperCase()} ${best.symbol} (score ${best.score.toFixed(1)}, ${best.confidence} confidence)`, { candidate: best });

  // The scan runs detached from the tick loop (see tick()'s comment) and a
  // full "all symbols" pass can take over a minute — re-check that the bot
  // is still meant to be trading before acting on what it found, in case
  // Stop/Emergency Stop was clicked mid-scan.
  if (!getFuturesBotState().running || isFuturesEmergencyStopped()) {
    recordLog("debug", "futures_signal_evaluation", "Bot stopped mid-scan — discarding this scan's result.");
    return;
  }

  const stage2 = await validateSignalStage2(best, config, mode, {
    pendingSignalsCount: countPendingSignals(),
    hasPendingForSymbol: hasPendingSignalForSymbol(best.symbol),
    activeTradesCount: countOpenFuturesPositions(mode),
  });

  if (!stage2.approved) {
    recordLog("info", "futures_signal_evaluation", `Stage 2 rejected ${best.side.toUpperCase()} ${best.symbol}: ${stage2.blockingReasons[0]}`, { checks: stage2.checks });
    return;
  }

  const signal = createSignal({
    symbol: best.symbol,
    side: best.side,
    entryPrice: new Decimal(best.entryPrice),
    stopLoss: new Decimal(best.stopLoss),
    takeProfits: best.takeProfits,
    score: new Decimal(best.score),
    confidence: best.confidence,
    leverage: best.leverage,
    positionSizePct: new Decimal(best.positionSizePct),
    stage1: best.details,
    expiryMinutes: config.signalExpiryMinutes,
  });
  updateSignalStatus(signal.id, "active", { stage2: { checks: stage2.checks } });
  recordLog("info", "futures_signal_evaluation", `Signal accepted for ${best.side.toUpperCase()} ${best.symbol}, attempting entry.`, { signalId: signal.id });

  await tryEnterSignal(signal.id, best, config, mode);
}

function decimalPlacesFromStep(step: number): number {
  const s = step.toString();
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

async function tryEnterSignal(signalId: string, candidate: Stage1Candidate, config: ReturnType<typeof getFuturesStrategyConfig>, mode: BybitMode) {
  const instrument = await getInstrumentInfo(candidate.symbol, mode, CATEGORY).catch(() => null);
  if (!instrument || !instrument.tradingActive) {
    updateSignalStatus(signalId, "cancelled", { cancelledReason: "Instrument info unavailable or not trading." });
    return;
  }
  const wallet = await getWalletBalance(mode).catch(() => null);
  if (!wallet) {
    updateSignalStatus(signalId, "cancelled", { cancelledReason: "Could not read Bybit wallet balance — check API keys." });
    recordLog("warn", "futures_trade", `Cannot size position for ${candidate.symbol}: wallet balance unavailable.`);
    return;
  }

  const equityUsd = new Decimal(wallet.totalEquityUsd);
  const availableUsd = new Decimal(wallet.availableBalanceUsd);
  const leverage = Math.min(candidate.leverage, instrument.maxLeverage);

  const sized = computeFuturesPositionSize({
    equityUsd,
    entryPrice: new Decimal(candidate.entryPrice),
    positionSizePct: candidate.positionSizePct,
    leverage,
    qtyStep: instrument.qtyStep,
  });

  if (sized.qty.lte(0) || sized.qty.lt(instrument.minOrderQty)) {
    updateSignalStatus(signalId, "cancelled", { cancelledReason: `Computed size ${sized.qty.toFixed()} is below exchange minimum ${instrument.minOrderQty}.` });
    return;
  }

  const stopLossDistancePct = (Math.abs(candidate.entryPrice - candidate.stopLoss) / candidate.entryPrice) * 100;
  const risk = assessFuturesEntryRisk({
    mode,
    leverage,
    maxInstrumentLeverage: instrument.maxLeverage,
    stopLossDistancePct,
    marginUsd: sized.marginUsd,
    availableBalanceUsd: availableUsd,
    accountEquityUsd: equityUsd,
    config,
  });
  if (!risk.approved) {
    updateSignalStatus(signalId, "cancelled", { cancelledReason: risk.blockingReasons.join("; ") });
    recordLog("warn", "futures_risk", `Entry blocked for ${candidate.side.toUpperCase()} ${candidate.symbol}: ${risk.blockingReasons.join("; ")}`, { checks: risk.checks });
    return;
  }

  try {
    await setLeverage(mode, candidate.symbol, leverage);
    const qtyStr = sized.qty.toFixed(decimalPlacesFromStep(instrument.qtyStep));
    const order = await submitMarketOrder(mode, {
      category: CATEGORY,
      symbol: candidate.symbol,
      side: candidate.side === "long" ? "Buy" : "Sell",
      qty: qtyStr,
    });

    const position = createFuturesPosition({
      signalId,
      symbol: candidate.symbol,
      side: candidate.side,
      mode,
      leverage,
      confidence: candidate.confidence,
      entryPrice: new Decimal(candidate.entryPrice),
      qty: sized.qty,
      notionalUsd: sized.notionalUsd,
      marginUsd: sized.marginUsd,
      stopLoss: new Decimal(candidate.stopLoss),
      takeProfits: candidate.takeProfits,
      bybitOrderId: order.orderId,
    });

    await setTradingStop(mode, { symbol: candidate.symbol, stopLoss: new Decimal(candidate.stopLoss).toFixed(decimalPlacesFromStep(instrument.tickSize)) }).catch((err) =>
      recordLog("warn", "futures_trade", `Exchange-side stop-loss failed to set for ${candidate.symbol}: ${(err as Error).message}`),
    );

    recordFuturesTrade({
      positionId: position.id,
      symbol: candidate.symbol,
      side: candidate.side === "long" ? "open_long" : "open_short",
      mode,
      qty: sized.qty,
      priceUsd: new Decimal(candidate.entryPrice),
      notionalUsd: sized.notionalUsd,
      feeUsd: new Decimal(0),
      bybitOrderId: order.orderId,
      status: "confirmed",
      failureReason: null,
    });

    updateSignalStatus(signalId, "filled");
    recordLog(
      "info",
      "futures_trade",
      `Entered ${candidate.side.toUpperCase()} ${candidate.symbol} qty=${qtyStr} @ ${candidate.entryPrice} (${leverage}x, ${candidate.confidence} confidence, margin $${sized.marginUsd.toFixed(2)})`,
      { positionId: position.id },
    );
  } catch (err) {
    updateSignalStatus(signalId, "cancelled", { cancelledReason: `Order failed: ${(err as Error).message}` });
    recordFuturesTrade({
      positionId: null,
      symbol: candidate.symbol,
      side: candidate.side === "long" ? "open_long" : "open_short",
      mode,
      qty: sized.qty,
      priceUsd: new Decimal(candidate.entryPrice),
      notionalUsd: sized.notionalUsd,
      feeUsd: new Decimal(0),
      bybitOrderId: null,
      status: "failed",
      failureReason: (err as Error).message,
    });
    recordLog("error", "futures_trade", `Order failed for ${candidate.symbol}: ${(err as Error).message}`);
  }
}

async function manageOpenFuturesPositions(mode: BybitMode) {
  const positions = listOpenFuturesPositions(mode);
  for (const position of positions) {
    await manageOnePosition(position, mode);
  }
}

async function manageOnePosition(position: FuturesPosition, mode: BybitMode) {
  const candles = await getKlines(position.symbol, 30, 20, mode, CATEGORY).catch(() => null);
  if (!candles || candles.length < 15) return;
  const currentPrice = new Decimal(candles[candles.length - 1]!.close);
  const currentAtr = atr(candles, 14).at(-1);

  const config = getFuturesStrategyConfig();

  if (currentAtr !== undefined && !Number.isNaN(currentAtr)) {
    const trailingUpdate = computeTrailingStopUpdate(position, currentPrice, currentAtr, config);
    if (trailingUpdate) {
      updateTrailingStop(position.id, true, trailingUpdate);
      position.trailingActive = true;
      position.trailingStopPrice = trailingUpdate;
    }
  }

  const decision = evaluateFuturesExit(position, currentPrice, config);
  if (!decision || decision.closeQty.lte(0)) return;

  await executeFuturesExit(position, decision.action, decision.closeQty, currentPrice, decision.moveToBreakeven, mode);
}

async function executeFuturesExit(
  position: FuturesPosition,
  action: "stop_loss" | "trailing_stop" | "tp1" | "tp2" | "manual",
  closeQty: Decimal,
  currentPrice: Decimal,
  moveToBreakeven: boolean,
  mode: BybitMode,
) {
  const instrument = await getInstrumentInfo(position.symbol, mode, CATEGORY).catch(() => null);
  const qtyStr = closeQty.toFixed(instrument ? decimalPlacesFromStep(instrument.qtyStep) : 6);
  const closeSide = position.side === "long" ? "Sell" : "Buy";

  try {
    const order = await submitMarketOrder(mode, { category: CATEGORY, symbol: position.symbol, side: closeSide, qty: qtyStr, reduceOnly: true });

    const updated = applyFuturesExit(position.id, {
      closedQty: closeQty,
      exitPrice: currentPrice,
      takeProfitLabelFilled: action === "tp1" ? "tp1" : action === "tp2" ? "tp2" : undefined,
      closeReason: action === "stop_loss" || action === "trailing_stop" ? action : undefined,
    });

    recordFuturesTrade({
      positionId: position.id,
      symbol: position.symbol,
      side: position.side === "long" ? "close_long" : "close_short",
      mode,
      qty: closeQty,
      priceUsd: currentPrice,
      notionalUsd: closeQty.times(currentPrice),
      feeUsd: new Decimal(0),
      bybitOrderId: order.orderId,
      status: "confirmed",
      failureReason: null,
    });

    if (moveToBreakeven) moveStopLossToBreakeven(position.id);

    recordLog("info", "futures_position", `Exit (${action}) for ${position.side.toUpperCase()} ${position.symbol}: closed ${qtyStr} @ ${currentPrice.toFixed()}`, { positionId: position.id });

    if (updated.status === "closed") {
      recordFuturesTradeOutcome(updated.realizedPnlUsd.lt(0));
    }
  } catch (err) {
    recordLog("error", "futures_position", `Exit order failed for ${position.symbol} (${action}): ${(err as Error).message}`, { positionId: position.id });
  }
}

export interface ManualFuturesCloseResult {
  ok: boolean;
  reason?: string;
}

/** Manual close, triggered from the dashboard — always permitted, including
 * while the emergency stop is active, matching the meme-coin bot's manual
 * sell behavior (monitoring/manual exits keep working during a kill-switch). */
export async function manualCloseFuturesPosition(positionId: string): Promise<ManualFuturesCloseResult> {
  const positions = listOpenFuturesPositions();
  const position = positions.find((p) => p.id === positionId);
  if (!position) return { ok: false, reason: "Position not found or already closed." };

  const candles = await getKlines(position.symbol, 30, 5, position.mode, CATEGORY).catch(() => null);
  const currentPrice = candles && candles.length > 0 ? new Decimal(candles[candles.length - 1]!.close) : position.entryPrice;

  await executeFuturesExit(position, "manual", position.remainingQty, currentPrice, false, position.mode);
  return { ok: true };
}

export { tick as _internalFuturesTickForTests };
