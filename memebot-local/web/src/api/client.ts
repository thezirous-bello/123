const BASE = "/api";

export class ApiError extends Error {
  details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(hasBody ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(body?.message ?? body?.error ?? `Request failed (${res.status})`, body?.details);
  }
  return body as T;
}

function get<T>(path: string): Promise<T> {
  return request<T>(path);
}
function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });
}
function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}
function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

// ---- Types (mirrors server shapes; kept intentionally loose/plain) ----

export interface BotStatus {
  running: boolean;
  mode: "paper" | "live";
  emergencyStopped: boolean;
  emergencyStoppedAt: string | null;
  emergencyStoppedReason: string | null;
  liveTradingAllowedByConfig: boolean;
  walletConfigured: boolean;
  activeStrategy: { id: string; name: string } | null;
  updatedAt: string;
}

export interface WalletInfo {
  configured: boolean;
  address: string | null;
  solBalance: string | null;
  tokenBalances: Array<{ mint: string; amount: string; decimals: number; uiAmount: string }>;
}

export interface PaperAccountInfo {
  startingBalanceUsd: string;
  cashBalanceUsd: string;
  updatedAt: string;
}

export interface TakeProfitLevel {
  profitPercentage: number;
  sellPercentage: number;
}

export interface StrategyRules {
  quoteToken: "SOL" | "USDC";
  maxTradeUsd: number;
  minimumLiquidityUsd: number;
  minimumVolume5mUsd?: number;
  minimumVolume1hUsd?: number;
  minimumTokenAgeMinutes?: number;
  maximumTokenAgeMinutes?: number;
  maximumTop10HolderPercentage: number;
  requireMintAuthorityDisabled: boolean;
  requireFreezeAuthorityDisabled: boolean;
  requireSellSimulation: boolean;
  minimumPriceChange5mPct?: number;
  maximumPriceChange5mPct?: number;
  minimumPriceChange1hPct?: number;
  maximumPriceChange1hPct?: number;
  maximumSlippagePercentage: number;
  maximumPriceImpactPercentage: number;
  stopLossPercentage: number;
  takeProfits: TakeProfitLevel[];
  trailingStopPercentage?: number;
  maxHoldingPeriodMinutes?: number;
  cooldownMinutesAfterLoss: number;
  dailyTradeLimit: number;
}

export interface InterpretResult {
  ok: boolean;
  rules?: StrategyRules;
  warnings: string[];
  errors: string[];
  source: "local" | "ai" | "rejected";
  plainEnglish?: string[];
}

export interface Strategy {
  id: string;
  name: string;
  rawInstruction: string;
  rules: StrategyRules;
  warnings: string[];
  enabled: boolean;
  archived: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  plainEnglish?: string[];
}

export interface TokenSnapshot {
  mint: string;
  symbol: string | null;
  name: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  volume5mUsd: number | null;
  volume1hUsd: number | null;
  priceChange5mPct: number | null;
  priceChange1hPct: number | null;
  buys5m: number | null;
  sells5m: number | null;
  pairCreatedAt: string | null;
  dexId: string | null;
  quoteSymbol: string | null;
}

export interface SecurityFinding {
  check: string;
  status: "pass" | "fail" | "warning" | "unknown";
  severity: "critical" | "high" | "medium" | "low" | "info";
  detail: string;
}

export interface SecurityReport {
  mint: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  findings: SecurityFinding[];
  missingChecks: string[];
  confidence: string;
  summary: string;
  checkedAt: string;
}

export interface WatchlistEntry {
  mint: string;
  symbol: string | null;
  name: string | null;
  blocked: boolean;
  addedAt: string;
}

export interface Position {
  id: string;
  mint: string;
  symbol: string | null;
  mode: "paper" | "live";
  status: "open" | "closed";
  strategyId: string | null;
  entryPriceUsd: string;
  entryAmountUsd: string;
  tokenAmount: string;
  remainingTokenAmount: string;
  costBasisUsd: string;
  stopLossPercentage: number | null;
  takeProfits: TakeProfitLevel[];
  takeProfitsFilled: number[];
  trailingStopPercentage: number | null;
  realizedPnlUsd: string;
  closeReason: string | null;
  openedAt: string;
  closedAt: string | null;
}

export interface Trade {
  id: string;
  position_id: string | null;
  mint: string;
  symbol: string | null;
  side: "buy" | "sell";
  mode: "paper" | "live";
  amount_usd: string;
  token_amount: string;
  price_usd: string;
  status: string;
  failure_reason: string | null;
  tx_signature: string | null;
  created_at: string;
}

export interface RiskLimits {
  maxTradeUsd: number;
  maxWalletPercentagePerTrade: number;
  maxOpenPositions: number;
  maxTradesPerHour: number;
  maxTradesPerDay: number;
  maxDailyLossPercentage: number;
  maxSlippagePercentage: number;
  maxPriceImpactPercentage: number;
  minimumLiquidityUsd: number;
  minimumSolReserve: number;
  maxTokenRiskLevel: "low" | "medium" | "high";
  cooldownMinutesAfterLoss: number;
  consecutiveLossesBeforeCooldown: number;
  consecutiveLossCooldownMinutes: number;
  maxQuoteAgeSeconds: number;
}

export interface LogEntry {
  id: string;
  level: "debug" | "info" | "warn" | "error";
  category: string;
  message: string;
  details_json: string;
  created_at: string;
}

export const api = {
  status: () => get<BotStatus>("/status"),
  wallet: () => get<WalletInfo>("/wallet"),
  paperAccount: () => get<PaperAccountInfo>("/paper-account"),
  resetPaper: (startingBalanceUsd: number) => post("/paper/reset", { startingBalanceUsd }),

  interpretStrategy: (instruction: string) => post<InterpretResult>("/strategies/interpret", { instruction }),
  createStrategy: (name: string, rawInstruction: string, rules: StrategyRules) =>
    post<Strategy>("/strategies", { name, rawInstruction, rules }),
  listStrategies: () => get<Strategy[]>("/strategies"),
  getStrategy: (id: string) => get<Strategy>(`/strategies/${id}`),
  updateStrategy: (id: string, rules: StrategyRules) => patch<Strategy>(`/strategies/${id}`, { rules }),
  activateStrategy: (id: string) => post<Strategy>(`/strategies/${id}/activate`),
  pauseStrategy: (id: string) => post<Strategy>(`/strategies/${id}/pause`),
  archiveStrategy: (id: string) => post<Strategy>(`/strategies/${id}/archive`),
  duplicateStrategy: (id: string) => post<Strategy>(`/strategies/${id}/duplicate`),

  searchTokens: (q: string) => get<TokenSnapshot[]>(`/tokens/search?q=${encodeURIComponent(q)}`),
  getToken: (mint: string) => get<{ snapshot: TokenSnapshot; security: SecurityReport }>(`/tokens/${mint}`),
  watchlist: () => get<WatchlistEntry[]>("/watchlist"),
  addWatchlist: (mint: string, symbol?: string, name?: string) => post<WatchlistEntry>("/watchlist", { mint, symbol, name }),
  removeWatchlist: (mint: string) => del(`/watchlist/${mint}`),
  blockToken: (mint: string) => post(`/watchlist/${mint}/block`),
  unblockToken: (mint: string) => post(`/watchlist/${mint}/unblock`),
  discoverTokens: () => post<{ added: number; candidates: number }>("/tokens/discover"),

  listPositions: (mode?: "paper" | "live") => get<Position[]>(`/positions${mode ? `?mode=${mode}` : ""}`),
  sellPosition: (id: string, percentage: number) => post(`/positions/${id}/sell`, { percentage }),
  closePosition: (id: string) => post(`/positions/${id}/close`),

  listTrades: () => get<Trade[]>("/trades"),

  riskLimits: () => get<RiskLimits>("/risk/limits"),
  updateRiskLimits: (patchBody: Partial<RiskLimits>) => patch<RiskLimits>("/risk/limits", patchBody),
  riskEvents: () => get("/risk/events"),

  start: () => post("/control/start"),
  stop: () => post("/control/stop"),
  setMode: (mode: "paper" | "live", confirmed: boolean) => post("/control/mode", { mode, confirmed }),
  emergencyStop: (reason: string) => post("/control/emergency-stop", { reason }),
  resume: () => post("/control/resume", { confirm: true }),

  logs: (limit = 200) => get<LogEntry[]>(`/logs?limit=${limit}`),

  systemStats: () => get<SystemStats>("/system"),
  equityCurve: (hours = 24) => get<EquityPoint[]>(`/analytics/equity-curve?hours=${hours}`),
  tokenHistory: (mint: string, limit = 60) => get<PricePoint[]>(`/tokens/${mint}/history?limit=${limit}`),
  providerStatus: () => get<ProviderHealth[]>("/providers/status"),

  spotStatus: () => get<SpotStatus>("/spot/status"),
  spotWallet: (mode?: BybitMode) => get<SpotWallet>(`/spot/wallet${mode ? `?mode=${mode}` : ""}`),
  spotConfig: () => get<SpotStrategyConfig>("/spot/config"),
  updateSpotConfig: (patchBody: Partial<SpotStrategyConfig>) => patch<SpotStrategyConfig>("/spot/config", patchBody),
  spotStart: () => post("/spot/control/start"),
  spotStop: () => post("/spot/control/stop"),
  spotSetMode: (mode: BybitMode, confirmed: boolean) => post("/spot/control/mode", { mode, confirmed }),
  spotEmergencyStop: (reason: string) => post("/spot/control/emergency-stop", { reason }),
  spotResume: () => post("/spot/control/resume", { confirm: true }),
  spotSignals: () => get<SpotSignal[]>("/spot/signals"),
  spotPositions: (mode?: BybitMode) => get<SpotPosition[]>(`/spot/positions${mode ? `?mode=${mode}` : ""}`),
  spotTrades: () => get<SpotTrade[]>("/spot/trades"),
  closeSpotPosition: (id: string) => post(`/spot/positions/${id}/close`),

  futuresStatus: () => get<FuturesStatus>("/futures/status"),
  futuresWallet: (mode?: BybitMode) => get<FuturesWallet>(`/futures/wallet${mode ? `?mode=${mode}` : ""}`),
  futuresConfig: () => get<FuturesStrategyConfig>("/futures/config"),
  updateFuturesConfig: (patchBody: Partial<FuturesStrategyConfig>) => patch<FuturesStrategyConfig>("/futures/config", patchBody),
  futuresStart: () => post("/futures/control/start"),
  futuresStop: () => post("/futures/control/stop"),
  futuresSetMode: (mode: BybitMode, confirmed: boolean) => post("/futures/control/mode", { mode, confirmed }),
  futuresEmergencyStop: (reason: string) => post("/futures/control/emergency-stop", { reason }),
  futuresResume: () => post("/futures/control/resume", { confirm: true }),
  futuresSignals: () => get<FuturesSignal[]>("/futures/signals"),
  futuresPositions: (mode?: BybitMode) => get<FuturesPosition[]>(`/futures/positions${mode ? `?mode=${mode}` : ""}`),
  futuresTrades: () => get<FuturesTrade[]>("/futures/trades"),
  closeFuturesPosition: (id: string) => post(`/futures/positions/${id}/close`),
};

// ---- Bybit bots: shared types ----

export type BybitMode = "testnet" | "live";

export interface BybitTakeProfit {
  label: "tp1" | "tp2" | "tp3";
  price: number;
  closePct: number;
}

// ---- Bybit SPOT bot types ----

export interface SpotStatus {
  running: boolean;
  mode: BybitMode;
  emergencyStopped: boolean;
  emergencyStoppedAt: string | null;
  emergencyStoppedReason: string | null;
  consecutiveLosses: number;
  tradingHaltedUntil: string | null;
  liveTradingAllowedByConfig: boolean;
  testnetConfigured: boolean;
  liveConfigured: boolean;
  strategyEnabled: boolean;
  updatedAt: string;
}

export interface SpotWallet {
  configured: boolean;
  mode: BybitMode;
  totalEquityUsd: number | null;
  availableBalanceUsd: number | null;
}

export interface SpotStrategyConfig {
  enabled: boolean;
  symbolUniverse: "auto" | "all" | "manual";
  autoTopNByVolume: number;
  manualSymbols: string[];
  minCompletedCandles: number;
  atrOverCloseMax: number;
  stddev30Max: number;
  latestRangeAtrMultMax: number;
  min24hTurnoverUsd: number;
  volumeSpikeMultiplier: number;
  maxSpreadPct: number;
  entryZoneUpperMult: number;
  entryZoneLowerMult: number;
  trendEmaPeriod: number;
  stochRsiKMax: number;
  stochRsiCrossoverBelow: number;
  rsiMin: number;
  rsiMax: number;
  slAtrMultiplier: number;
  maxStopLossDistancePct: number;
  tp1Pct: number;
  tp2Pct: number;
  tp3AtrTrailMultiplier: number;
  minRiskReward: number;
  maxPendingSignals: number;
  maxActiveTrades: number;
  btcVolatilityShockCheckEnabled: boolean;
  fearGreedRejectBelow: number;
  fearGreedReduceSizeAbove: number;
  fearGreedSizeReductionFactor: number;
  btcStochRsiOverboughtReject: number;
  btcOrderbookAskBidRatioMax: number;
  btcRsiOverboughtMax: number;
  entryPriceMaxDriftPct: number;
  signalExpiryMinutes: number;
  riskPerTradePct: number;
  tp1ClosePct: number;
  tp2ClosePct: number;
  moveSlToBreakevenAtTp1: boolean;
  trailingAtrMultiplier: number;
  stopAfterConsecutiveLosses: number;
  dailyMaxLossPct: number;
}

export interface SpotSignal {
  id: string;
  symbol: string;
  side: "long";
  status: "pending" | "active" | "filled" | "cancelled" | "expired";
  entryPrice: string;
  stopLoss: string;
  takeProfits: BybitTakeProfit[];
  score: string;
  stage1: Record<string, unknown>;
  stage2: Record<string, unknown>;
  cancelledReason: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpotPosition {
  id: string;
  signalId: string | null;
  symbol: string;
  side: "long";
  mode: BybitMode;
  status: "open" | "closed";
  entryPrice: string;
  qty: string;
  remainingQty: string;
  notionalUsd: string;
  stopLoss: string;
  takeProfits: BybitTakeProfit[];
  takeProfitsFilled: string[];
  breakevenMoved: boolean;
  trailingActive: boolean;
  trailingStopPrice: string | null;
  bybitOrderId: string | null;
  realizedPnlUsd: string;
  closeReason: string | null;
  openedAt: string;
  closedAt: string | null;
}

export interface SpotTrade {
  id: string;
  position_id: string | null;
  symbol: string;
  side: "buy" | "sell";
  mode: BybitMode;
  qty: string;
  price_usd: string;
  notional_usd: string;
  fee_usd: string;
  bybit_order_id: string | null;
  status: "simulated" | "submitted" | "confirmed" | "failed";
  failure_reason: string | null;
  created_at: string;
}

// ---- Bybit FUTURES bot types (long & short, dynamic leverage) ----

export interface FuturesStatus {
  running: boolean;
  mode: BybitMode;
  emergencyStopped: boolean;
  emergencyStoppedAt: string | null;
  emergencyStoppedReason: string | null;
  consecutiveLosses: number;
  tradingHaltedUntil: string | null;
  liveTradingAllowedByConfig: boolean;
  testnetConfigured: boolean;
  liveConfigured: boolean;
  strategyEnabled: boolean;
  updatedAt: string;
}

export interface FuturesWallet {
  configured: boolean;
  mode: BybitMode;
  totalEquityUsd: number | null;
  availableBalanceUsd: number | null;
}

export interface FuturesStrategyConfig {
  enabled: boolean;
  symbolUniverse: "auto" | "all" | "manual";
  autoTopNByVolume: number;
  manualSymbols: string[];
  min24hTurnoverUsd: number;
  minDailyMovePct: number;
  maxSpreadPct: number;
  atrOverCloseMax: number;
  minCompletedCandles: number;
  trendEma4hPeriod: number;
  entryEmaPeriod: number;
  supportResistanceLookback: number;
  pullbackMaxDistancePct: number;
  rsiLongMin: number;
  rsiLongMax: number;
  rsiShortMin: number;
  rsiShortMax: number;
  volumeSpikeMultiplier: number;
  stochRsiCrossoverLookback: number;
  breakoutPreferenceEnabled: boolean;
  slMinPct: number;
  slMaxPct: number;
  tp1Pct: number;
  tp2Pct: number;
  trailingStopPct: number;
  minRiskReward: number;
  maxPendingSignals: number;
  maxActiveTrades: number;
  btcVolatilityShockCheckEnabled: boolean;
  btcSuddenMoveMaxPct: number;
  fundingLongMaxPct: number;
  fundingShortMinPct: number;
  oiIncreasingRequired: boolean;
  volumeIncreasingRequired: boolean;
  entryPriceMaxDriftPct: number;
  signalExpiryMinutes: number;
  fearGreedLongThreshold: number;
  fearGreedShortThreshold: number;
  confidenceHighScoreMin: number;
  confidenceMediumScoreMin: number;
  minLeverage: number;
  maxLeverage: number;
  leverageHighConfidence: number;
  leverageMediumConfidence: number;
  leverageLowConfidence: number;
  minPositionSizePct: number;
  maxPositionSizePct: number;
  positionSizeHighConfidencePct: number;
  positionSizeMediumConfidencePct: number;
  positionSizeLowConfidencePct: number;
  tp1ClosePct: number;
  tp2ClosePct: number;
  moveSlToBreakevenAtTp1: boolean;
  exitOnSetupInvalidation: boolean;
  stopAfterConsecutiveLosses: number;
  dailyMaxLossPct: number;
}

export type Confidence = "low" | "medium" | "high";

export interface FuturesSignal {
  id: string;
  symbol: string;
  side: "long" | "short";
  status: "pending" | "active" | "filled" | "cancelled" | "expired";
  entryPrice: string;
  stopLoss: string;
  takeProfits: BybitTakeProfit[];
  score: string;
  confidence: Confidence;
  leverage: number;
  positionSizePct: string;
  stage1: Record<string, unknown>;
  stage2: Record<string, unknown>;
  cancelledReason: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface FuturesPosition {
  id: string;
  signalId: string | null;
  symbol: string;
  side: "long" | "short";
  mode: BybitMode;
  status: "open" | "closed";
  leverage: number;
  confidence: Confidence;
  entryPrice: string;
  qty: string;
  remainingQty: string;
  notionalUsd: string;
  marginUsd: string;
  stopLoss: string;
  takeProfits: BybitTakeProfit[];
  takeProfitsFilled: string[];
  breakevenMoved: boolean;
  trailingActive: boolean;
  trailingStopPrice: string | null;
  bybitOrderId: string | null;
  realizedPnlUsd: string;
  closeReason: string | null;
  openedAt: string;
  closedAt: string | null;
}

export interface FuturesTrade {
  id: string;
  position_id: string | null;
  symbol: string;
  side: "open_long" | "open_short" | "close_long" | "close_short";
  mode: BybitMode;
  qty: string;
  price_usd: string;
  notional_usd: string;
  fee_usd: string;
  bybit_order_id: string | null;
  status: "simulated" | "submitted" | "confirmed" | "failed";
  failure_reason: string | null;
  created_at: string;
}

export type ProviderId = "dexscreener" | "solanaRpc" | "jupiter" | "helius" | "bybit" | "fearGreed";

export interface ProviderHealth {
  provider: ProviderId;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  totalCalls: number;
  totalFailures: number;
  lastLatencyMs: number | null;
}

export interface SystemStats {
  cpuPercent: number;
  memUsedMb: number;
  memTotalMb: number;
  uptimeSeconds: number;
  requestsPerMin: number;
  bytesInPerMin: number;
  bytesOutPerMin: number;
}

export interface EquityPoint {
  t: string;
  balance: number;
}

export interface PricePoint {
  fetchedAt: string;
  priceUsd: number | null;
}
