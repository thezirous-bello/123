import { spotLiveTradingAllowedByConfig } from "../env.js";
import { Decimal } from "../lib/decimal.js";
import { recordLog } from "../lib/auditLog.js";
import type { BybitMode } from "../bybit/client.js";
import { getAllTickers, getInstrumentInfo, getKlines } from "../bybit/marketData.js";
import { getWalletBalance, submitMarketOrder } from "../bybit/trading.js";
import { atr } from "../ta/indicators.js";

const CATEGORY = "spot" as const;
import { getSpotStrategyConfig } from "./configStore.js";
import { pickBestCandidate, scanSymbolStage1, validateSignalStage2, type Stage1Candidate } from "./signalEngine.js";
import { assessSpotEntryRisk, computeSpotPositionSize } from "./riskEngine.js";
import { computeTrailingStopUpdate, evaluateSpotExit } from "./tradeManager.js";
import {
  countPendingSignals,
  createSignal,
  expireStaleSignals,
  hasPendingSignalForSymbol,
  listOpenSpotPositions,
  createSpotPosition,
  applySpotExit,
  moveStopLossToBreakeven,
  updateTrailingStop,
  updateSignalStatus,
  recordSpotTrade,
  countOpenSpotPositions,
  type SpotPosition,
} from "./repository.js";
import {
  getSpotBotState,
  isSpotEmergencyStopped,
  recordSpotTradeOutcome,
  setSpotMode,
  setSpotRunning,
  type SpotBotState,
} from "./state.js";

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

export function startSpotBot(): SpotBotState {
  const state = setSpotRunning(true);
  recordLog("info", "spot_bot", "Spot bot started");
  scheduleNextTick(1000);
  return state;
}

export function stopSpotBot(): SpotBotState {
  const state = setSpotRunning(false);
  if (tickHandle) clearTimeout(tickHandle);
  recordLog("info", "spot_bot", "Spot bot stopped");
  return state;
}

/** testnet is always allowed (it's the safe default); live (mainnet) needs
 * both the server-side flag and an explicit confirmed=true from the
 * dashboard, exactly like the meme-coin bot's live trading gate. */
export function requestSpotModeChange(mode: BybitMode, confirmed: boolean): { ok: boolean; reason?: string; state?: SpotBotState } {
  if (mode === "live") {
    if (!spotLiveTradingAllowedByConfig) {
      return { ok: false, reason: 'Live spot trading is disabled by server configuration. Set SPOT_LIVE_TRADING_ENABLED=true in .env and restart to allow it.' };
    }
    if (!confirmed) {
      return { ok: false, reason: "Live spot trading requires explicit confirmation." };
    }
  }
  const state = setSpotMode(mode);
  recordLog("warn", "spot_bot", `Spot trading mode changed to ${mode.toUpperCase()}`, { mode });
  return { ok: true, state };
}

function scheduleNextTick(delayMs: number) {
  if (tickHandle) clearTimeout(tickHandle);
  tickHandle = setTimeout(runTick, delayMs);
}

async function runTick() {
  const state = getSpotBotState();
  if (!state.running) return;
  if (tickInFlight) {
    scheduleNextTick(POSITION_MANAGE_INTERVAL_MS);
    return;
  }
  tickInFlight = true;
  try {
    await tick(state.mode);
  } catch (err) {
    recordLog("error", "spot_bot", `Spot tick failed: ${(err as Error).message}`);
  } finally {
    tickInFlight = false;
    if (getSpotBotState().running) scheduleNextTick(POSITION_MANAGE_INTERVAL_MS);
  }
}

async function tick(mode: BybitMode) {
  expireStaleSignals();
  await manageOpenSpotPositions(mode);

  if (isSpotEmergencyStopped()) return;

  // Not awaited: with symbolUniverse="all" a scan can take well over a
  // minute, and awaiting it here would delay the next position-management
  // pass (open positions need their stop-loss/take-profit checked every
  // ~20s regardless of scan duration). Guarded by scanInFlight so two
  // scans can never overlap.
  const now = Date.now();
  if (!scanInFlight && now - lastScanAtMs >= SIGNAL_SCAN_INTERVAL_MS) {
    lastScanAtMs = now;
    scanInFlight = true;
    runSignalScan(mode)
      .catch((err) => recordLog("error", "spot_signal_evaluation", `Signal scan failed: ${(err as Error).message}`))
      .finally(() => {
        scanInFlight = false;
      });
  }
}

async function resolveSymbolUniverse(mode: BybitMode): Promise<string[]> {
  const config = getSpotStrategyConfig();
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
  const config = getSpotStrategyConfig();
  if (!config.enabled) return;

  const activeTrades = countOpenSpotPositions(mode);
  const pendingSignals = countPendingSignals();
  if (pendingSignals >= config.maxPendingSignals || activeTrades >= config.maxActiveTrades) {
    recordLog("debug", "spot_signal_evaluation", `Skipping scan: ${pendingSignals} pending / ${activeTrades} active already at capacity.`);
    return;
  }

  let symbols: string[];
  try {
    symbols = await resolveSymbolUniverse(mode);
  } catch (err) {
    recordLog("warn", "spot_signal_evaluation", `Failed to resolve symbol universe: ${(err as Error).message}`);
    return;
  }
  if (symbols.length === 0) return;

  const results = await mapWithConcurrency(symbols, SCAN_CONCURRENCY, (symbol) =>
    scanSymbolStage1(symbol, config, mode).catch((err) => ({ symbol, reason: `Fetch error: ${(err as Error).message}` })),
  );

  const best = pickBestCandidate(results);
  if (!best) {
    recordLog("debug", "spot_signal_evaluation", `Scanned ${symbols.length} symbols, no Stage 1 setup qualified.`);
    return;
  }
  recordLog("info", "spot_signal_evaluation", `Stage 1 winner: ${best.symbol} (score ${best.score.toFixed(1)})`, { candidate: best });

  // The scan runs detached from the tick loop (see tick()'s comment) and a
  // full "all symbols" pass can take over a minute — re-check that the bot
  // is still meant to be trading before acting on what it found, in case
  // Stop/Emergency Stop was clicked mid-scan.
  if (!getSpotBotState().running || isSpotEmergencyStopped()) {
    recordLog("debug", "spot_signal_evaluation", "Bot stopped mid-scan — discarding this scan's result.");
    return;
  }

  const stage2 = await validateSignalStage2(best, config, mode, {
    pendingSignalsCount: countPendingSignals(),
    hasPendingForSymbol: hasPendingSignalForSymbol(best.symbol),
    activeTradesCount: countOpenSpotPositions(mode),
  });

  if (!stage2.approved) {
    recordLog("info", "spot_signal_evaluation", `Stage 2 rejected ${best.symbol}: ${stage2.blockingReasons[0]}`, { checks: stage2.checks });
    return;
  }

  const signal = createSignal({
    symbol: best.symbol,
    side: best.side,
    entryPrice: new Decimal(best.entryPrice),
    stopLoss: new Decimal(best.stopLoss),
    takeProfits: best.takeProfits,
    score: new Decimal(best.score),
    stage1: best.details,
    expiryMinutes: config.signalExpiryMinutes,
  });
  updateSignalStatus(signal.id, "active", { stage2: { checks: stage2.checks, positionSizeMultiplier: stage2.positionSizeMultiplier } });
  recordLog("info", "spot_signal_evaluation", `Signal accepted for ${best.symbol}, attempting entry.`, { signalId: signal.id });

  await tryEnterSignal(signal.id, best, config, mode, stage2.positionSizeMultiplier);
}

function decimalPlacesFromStep(step: number): number {
  const s = step.toString();
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

async function tryEnterSignal(signalId: string, candidate: Stage1Candidate, config: ReturnType<typeof getSpotStrategyConfig>, mode: BybitMode, sizeMultiplier: number) {
  const instrument = await getInstrumentInfo(candidate.symbol, mode, CATEGORY).catch(() => null);
  if (!instrument || !instrument.tradingActive) {
    updateSignalStatus(signalId, "cancelled", { cancelledReason: "Instrument info unavailable or not trading." });
    return;
  }
  const wallet = await getWalletBalance(mode).catch(() => null);
  if (!wallet) {
    updateSignalStatus(signalId, "cancelled", { cancelledReason: "Could not read Bybit wallet balance — check API keys." });
    recordLog("warn", "spot_trade", `Cannot size position for ${candidate.symbol}: wallet balance unavailable.`);
    return;
  }

  const equityUsd = new Decimal(wallet.totalEquityUsd);
  const availableUsd = new Decimal(wallet.availableBalanceUsd);

  const sized = computeSpotPositionSize({
    equityUsd,
    entryPrice: new Decimal(candidate.entryPrice),
    stopLoss: new Decimal(candidate.stopLoss),
    riskPerTradePct: config.riskPerTradePct,
    sizeMultiplier,
    qtyStep: instrument.qtyStep,
  });

  if (sized.qty.lte(0) || sized.qty.lt(instrument.minOrderQty)) {
    updateSignalStatus(signalId, "cancelled", { cancelledReason: `Computed size ${sized.qty.toFixed()} is below exchange minimum ${instrument.minOrderQty}.` });
    return;
  }

  const risk = assessSpotEntryRisk({
    mode,
    notionalUsd: sized.notionalUsd,
    availableBalanceUsd: availableUsd,
    accountEquityUsd: equityUsd,
    config,
  });
  if (!risk.approved) {
    updateSignalStatus(signalId, "cancelled", { cancelledReason: risk.blockingReasons.join("; ") });
    recordLog("warn", "spot_risk", `Entry blocked for ${candidate.symbol}: ${risk.blockingReasons.join("; ")}`, { checks: risk.checks });
    return;
  }

  try {
    const qtyStr = sized.qty.toFixed(decimalPlacesFromStep(instrument.qtyStep));
    // Buy uses marketUnit=quoteCoin with the USDT amount to spend — Bybit's
    // own docs recommend this over a base-coin qty for spot market buys,
    // since it's exact regardless of price movement between quote and fill.
    const order = await submitMarketOrder(mode, {
      category: CATEGORY,
      symbol: candidate.symbol,
      side: "Buy",
      qty: sized.notionalUsd.toFixed(2),
      marketUnit: "quoteCoin",
    });

    const position = createSpotPosition({
      signalId,
      symbol: candidate.symbol,
      side: candidate.side,
      mode,
      entryPrice: new Decimal(candidate.entryPrice),
      qty: sized.qty,
      notionalUsd: sized.notionalUsd,
      stopLoss: new Decimal(candidate.stopLoss),
      takeProfits: candidate.takeProfits,
      bybitOrderId: order.orderId,
    });

    // Spot has no exchange-side conditional stop-loss/take-profit order in
    // this app (unlike futures' trading-stop endpoint) — the bot's own tick
    // loop below is the only thing watching this position's exits.

    recordSpotTrade({
      positionId: position.id,
      symbol: candidate.symbol,
      side: "buy",
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
    recordLog("info", "spot_trade", `Bought ${qtyStr} ${candidate.symbol} @ ${candidate.entryPrice} (risking $${sized.riskAmountUsd.toFixed(2)})`, {
      positionId: position.id,
    });
  } catch (err) {
    updateSignalStatus(signalId, "cancelled", { cancelledReason: `Order failed: ${(err as Error).message}` });
    recordSpotTrade({
      positionId: null,
      symbol: candidate.symbol,
      side: "buy",
      mode,
      qty: sized.qty,
      priceUsd: new Decimal(candidate.entryPrice),
      notionalUsd: sized.notionalUsd,
      feeUsd: new Decimal(0),
      bybitOrderId: null,
      status: "failed",
      failureReason: (err as Error).message,
    });
    recordLog("error", "spot_trade", `Order failed for ${candidate.symbol}: ${(err as Error).message}`);
  }
}

async function manageOpenSpotPositions(mode: BybitMode) {
  const positions = listOpenSpotPositions(mode);
  for (const position of positions) {
    await manageOnePosition(position, mode);
  }
}

async function manageOnePosition(position: SpotPosition, mode: BybitMode) {
  const candles = await getKlines(position.symbol, 30, 20, mode, CATEGORY).catch(() => null);
  if (!candles || candles.length < 15) return;
  const currentPrice = new Decimal(candles[candles.length - 1]!.close);
  const currentAtr = atr(candles, 14).at(-1);

  if (currentAtr !== undefined && !Number.isNaN(currentAtr)) {
    const config = getSpotStrategyConfig();
    const trailingUpdate = computeTrailingStopUpdate(position, currentPrice, currentAtr, config);
    if (trailingUpdate) {
      updateTrailingStop(position.id, true, trailingUpdate);
      position.trailingActive = true;
      position.trailingStopPrice = trailingUpdate;
    }
  }

  const config = getSpotStrategyConfig();
  const decision = evaluateSpotExit(position, currentPrice, config);
  if (!decision || decision.closeQty.lte(0)) return;

  await executeSpotExit(position, decision.action, decision.closeQty, currentPrice, decision.moveToBreakeven, mode);
}

async function executeSpotExit(
  position: SpotPosition,
  action: "stop_loss" | "trailing_stop" | "tp1" | "tp2" | "manual",
  closeQty: Decimal,
  currentPrice: Decimal,
  moveToBreakeven: boolean,
  mode: BybitMode,
) {
  const instrument = await getInstrumentInfo(position.symbol, mode, CATEGORY).catch(() => null);
  const qtyStr = closeQty.toFixed(instrument ? decimalPlacesFromStep(instrument.qtyStep) : 6);

  try {
    // Spot sells are always in base-coin qty (how much of the coin to
    // sell) — marketUnit only affects Buy orders.
    const order = await submitMarketOrder(mode, { category: CATEGORY, symbol: position.symbol, side: "Sell", qty: qtyStr });

    const updated = applySpotExit(position.id, {
      closedQty: closeQty,
      exitPrice: currentPrice,
      takeProfitLabelFilled: action === "tp1" ? "tp1" : action === "tp2" ? "tp2" : undefined,
      closeReason: action === "stop_loss" || action === "trailing_stop" ? action : undefined,
    });

    recordSpotTrade({
      positionId: position.id,
      symbol: position.symbol,
      side: "sell",
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

    recordLog("info", "spot_position", `Exit (${action}) for ${position.symbol}: closed ${qtyStr} @ ${currentPrice.toFixed()}`, { positionId: position.id });

    if (updated.status === "closed") {
      recordSpotTradeOutcome(updated.realizedPnlUsd.lt(0));
    }
  } catch (err) {
    recordLog("error", "spot_position", `Exit order failed for ${position.symbol} (${action}): ${(err as Error).message}`, { positionId: position.id });
  }
}

export interface ManualSpotCloseResult {
  ok: boolean;
  reason?: string;
}

/** Manual close, triggered from the dashboard — always permitted, including
 * while the emergency stop is active, matching the meme-coin bot's manual
 * sell behavior (monitoring/manual exits keep working during a kill-switch). */
export async function manualCloseSpotPosition(positionId: string): Promise<ManualSpotCloseResult> {
  const positions = listOpenSpotPositions();
  const position = positions.find((p) => p.id === positionId);
  if (!position) return { ok: false, reason: "Position not found or already closed." };

  const candles = await getKlines(position.symbol, 30, 5, position.mode, CATEGORY).catch(() => null);
  const currentPrice = candles && candles.length > 0 ? new Decimal(candles[candles.length - 1]!.close) : position.entryPrice;

  await executeSpotExit(position, "manual", position.remainingQty, currentPrice, false, position.mode);
  return { ok: true };
}

export { tick as _internalSpotTickForTests };
