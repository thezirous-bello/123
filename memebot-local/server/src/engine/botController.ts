import { liveTradingAllowedByConfig } from "../env.js";
import { Decimal } from "../lib/decimal.js";
import { recordLog } from "../lib/auditLog.js";
import { checkSellRoute } from "../jupiter/quote.js";
import { quoteTokenDecimals, quoteTokenMint } from "../jupiter/constants.js";
import { fetchHolderConcentration, fetchOnChainMintInfo } from "../market/onchain.js";
import { discoverTrendingSolanaMints } from "../market/discovery.js";
import { getFreshTokenSnapshot, isSnapshotFresh, MAX_SNAPSHOT_AGE_SECONDS } from "../market/snapshotService.js";
import { addToWatchlist, listWatchlist } from "../market/watchlist.js";
import { persistSecurityReport, runTokenSecurityAnalysis } from "../security/tokenSecurity.js";
import { getActiveStrategy } from "../strategy/repository.js";
import { getBotState, isEmergencyStopped, setActiveStrategy, setMode, setRunning, type BotState } from "./emergency.js";
import { executeLiveBuy, executeLiveSell } from "./liveEngine.js";
import { executePaperBuy, executePaperSell } from "./paperEngine.js";
import { getPaperAccount } from "./paperAccount.js";
import { accountEquityUsd, assessEntryRisk } from "./riskEngine.js";
import { evaluateEntryConditions, evaluateHolderConcentration } from "./strategyEvaluator.js";
import { evaluateExitAction, resolveSellTokenAmount } from "./positionManager.js";
import { getPosition, listOpenPositions, updateTrailingHigh, type Position } from "./positionRepository.js";
import { getSolBalance } from "../wallet/walletManager.js";
import { getRiskLimits } from "../lib/settings.js";
import { getSolUsdPrice } from "../market/pricing.js";
import { hasOpenPositionAnyMode, openPositionForMint, type Mode } from "./queries.js";
import { removeFromWatchlist } from "../market/watchlist.js";
import type { StrategyRules } from "../strategy/schema.js";
import type { SecurityReport } from "../security/tokenSecurity.js";
import type { TokenSnapshot, OnChainMintInfo } from "../market/types.js";
import type { EntryCondition } from "./strategyEvaluator.js";

const TICK_INTERVAL_MS = 20_000;
// How often to pull fresh candidate tokens from DexScreener's public
// trending/boosted feeds. Kept well below their rate limits — this is a
// discovery pass, not per-tick traffic.
const DISCOVERY_INTERVAL_MS = 3 * 60_000;
// Caps how many tokens the bot will track at once, whether added manually
// or discovered automatically. Once at capacity, discovery evicts the
// oldest entries that have no open position to make room for fresh ones —
// so the watchlist keeps turning over instead of filling up once and
// freezing. Real ceiling here is provider rate limits (DexScreener, Jupiter,
// and especially the Solana RPC), not this number — see SCAN_CONCURRENCY.
const MAX_WATCHLIST_SIZE = 150;
// How many tokens get scanned (market data + on-chain checks + security
// analysis) at once per tick, instead of strictly one-at-a-time. Higher is
// faster but hits the free public Solana RPC's rate limit harder — if
// you've set a Helius (or other paid) RPC URL, this can safely go higher.
const SCAN_CONCURRENCY = 5;

let tickHandle: NodeJS.Timeout | null = null;
let tickCounter = 0;
let tickInFlight = false;
let lastDiscoveryAtMs = 0;

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export function startBot(): BotState {
  const state = setRunning(true);
  recordLog("info", "bot", "Bot started");
  scheduleNextTick(1000);
  return state;
}

export function stopBot(): BotState {
  const state = setRunning(false);
  if (tickHandle) clearTimeout(tickHandle);
  recordLog("info", "bot", "Bot stopped");
  return state;
}

export function pauseStrategy(strategyId: string): void {
  setActiveStrategy(null);
  recordLog("info", "bot", "Strategy paused", { strategyId });
}

export function resumeStrategy(strategyId: string): void {
  setActiveStrategy(strategyId);
  recordLog("info", "bot", "Strategy resumed", { strategyId });
}

/** Live mode requires the server-side flag AND an explicit confirmed=true
 * from the caller, which the dashboard only sends after showing the
 * mainnet warning dialog. */
export function requestModeChange(mode: Mode, confirmed: boolean): { ok: boolean; reason?: string; state?: BotState } {
  if (mode === "live") {
    if (!liveTradingAllowedByConfig) {
      return { ok: false, reason: 'Live trading is disabled by server configuration. Set LIVE_TRADING_ENABLED=true in .env and restart to allow it.' };
    }
    if (!confirmed) {
      return { ok: false, reason: "Live trading requires explicit confirmation." };
    }
  }
  const state = setMode(mode);
  recordLog("warn", "bot", `Trading mode changed to ${mode.toUpperCase()}`, { mode });
  return { ok: true, state };
}

function scheduleNextTick(delayMs: number) {
  if (tickHandle) clearTimeout(tickHandle);
  tickHandle = setTimeout(runTick, delayMs);
}

async function runTick() {
  const state = getBotState();
  if (!state.running) return;
  if (tickInFlight) {
    scheduleNextTick(TICK_INTERVAL_MS);
    return;
  }
  tickInFlight = true;
  try {
    await tick(state.mode);
  } catch (err) {
    recordLog("error", "bot", `Tick failed: ${(err as Error).message}`);
  } finally {
    tickInFlight = false;
    const stillRunning = getBotState().running;
    if (stillRunning) scheduleNextTick(TICK_INTERVAL_MS);
  }
}

/**
 * Pulls trending/boosted Solana tokens from DexScreener and adds any new
 * ones to the watchlist automatically — the bot builds its own scan
 * universe instead of relying on the user to search and click "Watch" on
 * every token. Runs on its own interval (not every 20s tick) to stay well
 * within DexScreener's free-tier rate limits, and always fires once
 * immediately after startup.
 */
export async function runAutoDiscovery(): Promise<{ added: number; candidates: number; evicted: number }> {
  const candidates = await discoverTrendingSolanaMints(80);
  if (candidates.length === 0) {
    return { added: 0, candidates: 0, evicted: 0 };
  }

  const current = listWatchlist();
  const currentMints = new Set(current.map((c) => c.mint));
  const newMints = candidates.filter((mint) => !currentMints.has(mint));

  // Make room for new discoveries by recycling out the oldest entries that
  // aren't currently held as an open position — never evicts something the
  // bot actually has money in.
  let evicted = 0;
  const roomNeeded = current.length + newMints.length - MAX_WATCHLIST_SIZE;
  if (roomNeeded > 0) {
    const evictable = current.filter((c) => !c.blocked && !hasOpenPositionAnyMode(c.mint)).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
    for (const entry of evictable) {
      if (evicted >= roomNeeded) break;
      removeFromWatchlist(entry.mint);
      evicted += 1;
    }
  }

  const capacityRemaining = Math.max(0, MAX_WATCHLIST_SIZE - (current.length - evicted));
  let added = 0;
  for (const mint of newMints) {
    if (added >= capacityRemaining) break;
    addToWatchlist(mint, null, null);
    added += 1;
  }

  if (added > 0 || evicted > 0) {
    recordLog(
      "info",
      "discovery",
      `Auto-discovered ${added} new Solana token(s) from DexScreener's trending/boosted feeds` +
        (evicted > 0 ? ` (recycled out ${evicted} stale watchlist entr${evicted === 1 ? "y" : "ies"} to make room).` : "."),
      { added, evicted, candidates: candidates.length },
    );
  }
  return { added, candidates: candidates.length, evicted };
}

async function maybeRunAutoDiscovery() {
  const now = Date.now();
  if (now - lastDiscoveryAtMs < DISCOVERY_INTERVAL_MS) return;
  lastDiscoveryAtMs = now;
  try {
    await runAutoDiscovery();
  } catch (err) {
    recordLog("warn", "discovery", `Auto-discovery failed: ${(err as Error).message}`);
  }
}

async function tick(mode: Mode) {
  tickCounter += 1;
  await maybeRunAutoDiscovery();
  await manageOpenPositions(mode);

  if (isEmergencyStopped()) return; // monitoring continues above; no new entries below

  const strategy = getActiveStrategy();
  if (!strategy || !strategy.enabled) return;

  const limits = getRiskLimits();
  if (listOpenPositions(mode).length >= limits.maxOpenPositions) return;

  const watchlist = listWatchlist()
    .filter((w) => !w.blocked)
    .filter((w) => !openPositionForMint(w.mint, mode));

  // The expensive, parallelizable part: fetch market data + on-chain checks
  // + run security analysis for every watched token at once (bounded by
  // SCAN_CONCURRENCY), instead of one token fully round-tripping before the
  // next even starts. This is what lets a larger watchlist actually get
  // revisited at a reasonable cadence instead of trickling through
  // sequentially.
  const scans = await mapWithConcurrency(watchlist, SCAN_CONCURRENCY, (entry) => scanToken(strategy.rules, entry.mint));

  // The cheap, sequential part: only tokens that already passed scanning
  // reach here, and this loop stays single-threaded on purpose — it's the
  // part that actually checks risk limits and commits a trade, and doing
  // that concurrently would let two tokens both "see" the same open-position
  // count and both buy, blowing past maxOpenPositions.
  for (const scan of scans) {
    if (!scan || !scan.passed) continue;
    if (listOpenPositions(mode).length >= limits.maxOpenPositions) break;
    if (openPositionForMint(scan.mint, mode)) continue; // could have been opened moments ago
    await tryEnterFromScan(mode, strategy.id, strategy.rules, scan);
  }
}

async function manageOpenPositions(mode: Mode) {
  const positions = listOpenPositions(mode);
  for (const position of positions) {
    const snapshot = await getFreshTokenSnapshot(position.mint);
    if (!snapshot || snapshot.priceUsd === null) continue;
    const currentPrice = new Decimal(snapshot.priceUsd);

    updateTrailingHigh(position.id, currentPrice);
    const refreshed = getPosition(position.id);
    if (!refreshed) continue;

    const action = evaluateExitAction(refreshed, currentPrice);
    if (!action) continue;

    const sellAmount = resolveSellTokenAmount(refreshed, action);
    if (sellAmount.lte(0)) continue;

    await executeExit(mode, refreshed, sellAmount, action.reason);
  }
}

async function executeExit(mode: Mode, position: Position, sellAmount: Decimal, reason: string) {
  const limits = getRiskLimits();
  const idempotencyKey = `${position.id}:${reason}:${tickCounter}`;
  const quoteToken: "SOL" | "USDC" = "SOL";
  const slippageBps = Math.round(limits.maxSlippagePercentage * 100);

  const params = {
    position,
    sellTokenAmount: sellAmount,
    quoteToken,
    slippageBps,
    maxPriceImpactPercentage: limits.maxPriceImpactPercentage,
    maxQuoteAgeSeconds: limits.maxQuoteAgeSeconds,
    reason,
    idempotencyKey,
  };

  const result = mode === "paper" ? await executePaperSell(params) : await executeLiveSell(params);
  if (!result.ok) {
    recordLog("warn", "position", `Exit (${reason}) failed for ${position.symbol ?? position.mint}: ${result.reasons.join("; ")}`, {
      positionId: position.id,
    });
  }
}

interface TokenScanPass {
  mint: string;
  passed: boolean;
  snapshot: TokenSnapshot;
  onchain: OnChainMintInfo | null;
  security: SecurityReport;
  sellRoute: { exists: boolean; priceImpactPct: number | null } | null;
  allConditions: EntryCondition[];
}

/** The parallelizable half of entry evaluation: fetch market data, on-chain
 * checks, and security analysis for one token, and log the resulting
 * signal/rejection. Never touches the risk engine or places a trade — safe
 * to run many of these concurrently via mapWithConcurrency. */
async function scanToken(rules: StrategyRules, mint: string): Promise<TokenScanPass | null> {
  const snapshot = await getFreshTokenSnapshot(mint);
  if (!snapshot) {
    recordLog("debug", "strategy_evaluation", `No market data for ${mint} — skipped`, { mint });
    return null;
  }
  if (!isSnapshotFresh(snapshot)) {
    recordLog("warn", "strategy_evaluation", `Stale market data for ${mint} — skipped`, { mint, maxAgeSeconds: MAX_SNAPSHOT_AGE_SECONDS });
    return null;
  }

  const [onchain, holders] = await Promise.all([fetchOnChainMintInfo(mint), fetchHolderConcentration(mint)]);

  let sellRoute = null;
  if (onchain) {
    const nominalAmount = new Decimal(10).times(10 ** onchain.decimals).toFixed(0); // check sellability of a nominal 10-token amount
    sellRoute = await checkSellRoute(mint, nominalAmount, quoteTokenMint(rules.quoteToken));
  }

  const security = runTokenSecurityAnalysis({ mint, snapshot, onchain, holders, sellRoute });
  persistSecurityReport(security);

  if (security.riskLevel === "critical") {
    recordLog("info", "strategy_evaluation", `Token rejected (critical risk): ${snapshot.symbol ?? mint}`, {
      mint,
      findings: security.findings,
    });
    return null;
  }

  const entryEval = evaluateEntryConditions(rules, snapshot, security);
  const holderCondition = evaluateHolderConcentration(rules, holders?.top10Percentage ?? null);
  const allConditions = [...entryEval.conditions, holderCondition];
  const passed = allConditions.every((c) => c.passed);
  const firstFailure = allConditions.find((c) => !c.passed);

  recordLog(
    "info",
    "strategy_evaluation",
    passed ? `Signal: ${snapshot.symbol ?? mint}` : `Rejected ${snapshot.symbol ?? mint}: ${firstFailure?.detail ?? "unknown reason"}`,
    { mint, conditions: allConditions, snapshot },
  );

  return { mint, passed, snapshot, onchain, security, sellRoute, allConditions };
}

/** The sequential half: given a token that already passed scanning, run it
 * through the risk engine and place the trade if approved. Always called
 * one at a time from tick() — see the comment there for why. */
async function tryEnterFromScan(mode: Mode, strategyId: string, rules: StrategyRules, scan: TokenScanPass) {
  const { mint, snapshot, onchain, security, sellRoute, allConditions } = scan;

  const account = getPaperAccount();
  const equityUsd = mode === "paper" ? accountEquityUsd(account.cashBalanceUsd, "paper") : await estimateLiveEquityUsd();

  const decimals = onchain?.decimals ?? 9;
  const solBalance = mode === "live" ? await getSolBalance() : new Decimal(0);
  const limits = getRiskLimits();
  const solAfter = solBalance.minus(new Decimal(rules.maxTradeUsd).div(await estimateSolUsdPriceOrOne(rules.quoteToken)));

  const risk = assessEntryRisk({
    mode,
    strategyId,
    tradeUsd: new Decimal(rules.maxTradeUsd),
    accountEquityUsd: equityUsd,
    slippagePercentage: rules.maximumSlippagePercentage,
    priceImpactPercentage: sellRoute?.priceImpactPct ?? 0,
    tokenRiskLevel: security.riskLevel,
    sellSimulationOk: security.sellSimulationOk,
    requireSellSimulation: rules.requireSellSimulation,
    quoteAgeSeconds: 0,
    solBalanceAfterTradeSol: mode === "live" ? solAfter : undefined,
    strategyDailyTradeLimit: rules.dailyTradeLimit,
  });

  if (!risk.approved) {
    recordLog("warn", "risk", `Entry blocked for ${snapshot.symbol ?? mint}: ${risk.blockingReasons.join("; ")}`, {
      mint,
      checks: risk.checks,
    });
    return;
  }

  const idempotencyKey = `${strategyId}:${mint}:buy:${tickCounter}`;
  const buyParams = {
    mint,
    symbol: snapshot.symbol,
    decimals,
    strategyId,
    quoteToken: rules.quoteToken,
    tradeUsd: new Decimal(rules.maxTradeUsd),
    slippageBps: Math.round(rules.maximumSlippagePercentage * 100),
    maxPriceImpactPercentage: rules.maximumPriceImpactPercentage,
    maxQuoteAgeSeconds: limits.maxQuoteAgeSeconds,
    stopLossPercentage: rules.stopLossPercentage,
    takeProfits: rules.takeProfits,
    trailingStopPercentage: rules.trailingStopPercentage ?? null,
    maxHoldingPeriodMinutes: rules.maxHoldingPeriodMinutes ?? null,
    entryReason: { conditions: allConditions, security, strategyId },
    idempotencyKey,
  };

  const result = mode === "paper" ? await executePaperBuy(buyParams) : await executeLiveBuy(buyParams);
  if (!result.ok) {
    recordLog("warn", "trade", `Buy failed for ${snapshot.symbol ?? mint}: ${result.reasons.join("; ")}`, { mint });
  }
}

async function estimateSolUsdPriceOrOne(quoteToken: "SOL" | "USDC"): Promise<Decimal> {
  if (quoteToken === "USDC") return new Decimal(1);
  return getSolUsdPrice();
}

async function estimateLiveEquityUsd(): Promise<Decimal> {
  const solBalance = await getSolBalance();
  const solPrice = await estimateSolUsdPriceOrOne("SOL");
  const solValueUsd = solBalance.times(solPrice);
  return accountEquityUsd(solValueUsd, "live");
}

export interface ManualSellResult {
  ok: boolean;
  reasons: string[];
}

/** Manual sell / close-position, triggered from the dashboard. Always
 * permitted — including while the emergency stop is active, since the
 * safety rules explicitly require manual selling to keep working during a
 * kill-switch event. */
export async function manualSell(positionId: string, percentageOfRemaining: number): Promise<ManualSellResult> {
  const position = getPosition(positionId);
  if (!position) return { ok: false, reasons: ["Position not found."] };
  if (position.status !== "open") return { ok: false, reasons: ["Position is already closed."] };

  const pct = Math.max(0.01, Math.min(100, percentageOfRemaining));
  const sellAmount = position.remainingTokenAmount.times(pct / 100);
  if (sellAmount.lte(0)) return { ok: false, reasons: ["Nothing to sell."] };

  const limits = getRiskLimits();
  const idempotencyKey = `${position.id}:manual:${Date.now()}`;
  const params = {
    position,
    sellTokenAmount: sellAmount,
    quoteToken: "SOL" as const,
    slippageBps: Math.round(limits.maxSlippagePercentage * 100),
    maxPriceImpactPercentage: limits.maxPriceImpactPercentage,
    maxQuoteAgeSeconds: limits.maxQuoteAgeSeconds,
    reason: "manual",
    idempotencyKey,
  };

  const result = position.mode === "paper" ? await executePaperSell(params) : await executeLiveSell(params);
  if (!result.ok) {
    recordLog("warn", "position", `Manual sell failed for ${position.symbol ?? position.mint}: ${result.reasons.join("; ")}`, {
      positionId,
    });
  }
  return { ok: result.ok, reasons: result.reasons };
}

export { tick as _internalTickForTests };
