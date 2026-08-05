import { bybitGetPublic, type BybitMode } from "./client.js";

// Field shapes verified against Bybit's official V5 API docs / SDK type
// defs (bybit-exchange.github.io/docs/v5/market/*). Every market-data call
// below is shared between the spot bot (category=spot) and futures bot
// (category=linear — USDT perpetuals only, no inverse/option contracts);
// funding rate and open interest have no spot equivalent and are always
// category=linear.
export type BybitCategory = "spot" | "linear";
const DEFAULT_CATEGORY: BybitCategory = "linear";

export interface Candle {
  startTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

type KlineRow = [string, string, string, string, string, string, string];

interface KlineResult {
  category: string;
  symbol: string;
  list: KlineRow[];
}

/** Bybit returns klines newest-first; this returns them oldest-first, which
 * is what every indicator function in ../ta/indicators.ts expects. */
export async function getKlines(
  symbol: string,
  intervalMinutes: 30 | 60 | 240,
  limit = 200,
  mode: BybitMode = "testnet",
  category: BybitCategory = DEFAULT_CATEGORY,
): Promise<Candle[]> {
  const result = await bybitGetPublic<KlineResult>(
    "/v5/market/kline",
    { category, symbol, interval: String(intervalMinutes), limit },
    mode,
  );
  return result.list
    .map((row) => ({
      startTime: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
      turnover: Number(row[6]),
    }))
    .reverse();
}

export interface TickerSnapshot {
  symbol: string;
  lastPrice: number;
  volume24h: number;
  turnover24h: number;
  price24hPct: number;
  openInterest: number;
  fundingRate: number;
  bid1Price: number;
  bid1Size: number;
  ask1Price: number;
  ask1Size: number;
}

interface TickerRow {
  symbol: string;
  lastPrice: string;
  volume24h: string;
  turnover24h: string;
  price24hPcnt: string;
  openInterest: string;
  fundingRate: string;
  bid1Price: string;
  bid1Size: string;
  ask1Price: string;
  ask1Size: string;
}

interface TickersResult {
  category: string;
  list: TickerRow[];
}

export async function getTicker(symbol: string, mode: BybitMode = "testnet", category: BybitCategory = DEFAULT_CATEGORY): Promise<TickerSnapshot | null> {
  const result = await bybitGetPublic<TickersResult>("/v5/market/tickers", { category, symbol }, mode);
  const row = result.list[0];
  if (!row) return null;
  return {
    symbol: row.symbol,
    lastPrice: Number(row.lastPrice),
    volume24h: Number(row.volume24h),
    turnover24h: Number(row.turnover24h),
    price24hPct: Number(row.price24hPcnt) * 100,
    openInterest: Number(row.openInterest),
    fundingRate: Number(row.fundingRate),
    bid1Price: Number(row.bid1Price),
    bid1Size: Number(row.bid1Size),
    ask1Price: Number(row.ask1Price),
    ask1Size: Number(row.ask1Size),
  };
}

export async function getAllTickers(mode: BybitMode = "testnet", category: BybitCategory = DEFAULT_CATEGORY): Promise<TickerSnapshot[]> {
  const result = await bybitGetPublic<TickersResult>("/v5/market/tickers", { category }, mode);
  return result.list.map((row) => ({
    symbol: row.symbol,
    lastPrice: Number(row.lastPrice),
    volume24h: Number(row.volume24h),
    turnover24h: Number(row.turnover24h),
    price24hPct: Number(row.price24hPcnt) * 100,
    openInterest: Number(row.openInterest),
    fundingRate: Number(row.fundingRate),
    bid1Price: Number(row.bid1Price),
    bid1Size: Number(row.bid1Size),
    ask1Price: Number(row.ask1Price),
    ask1Size: Number(row.ask1Size),
  }));
}

interface OrderbookResult {
  s: string;
  b: [string, string][];
  a: [string, string][];
  ts: number;
}

export interface OrderbookSnapshot {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
}

export async function getOrderbook(
  symbol: string,
  depth = 25,
  mode: BybitMode = "testnet",
  category: BybitCategory = DEFAULT_CATEGORY,
): Promise<OrderbookSnapshot> {
  const result = await bybitGetPublic<OrderbookResult>("/v5/market/orderbook", { category, symbol, limit: depth }, mode);
  return {
    bids: result.b.map(([price, size]) => ({ price: Number(price), size: Number(size) })),
    asks: result.a.map(([price, size]) => ({ price: Number(price), size: Number(size) })),
  };
}

interface OpenInterestRow {
  openInterest: string;
  timestamp: string;
}

interface OpenInterestResult {
  category: string;
  symbol: string;
  list: OpenInterestRow[];
}

/** Open interest history, oldest-first, one point per day (intervalTime=1d)
 * so `openInterestVs100dAverage` can compare current OI to a trailing average. */
export async function getOpenInterestHistory(symbol: string, days = 100, mode: BybitMode = "testnet"): Promise<Array<{ timestamp: number; openInterest: number }>> {
  const result = await bybitGetPublic<OpenInterestResult>(
    "/v5/market/open-interest",
    { category: "linear", symbol, intervalTime: "1d", limit: Math.min(days, 200) },
    mode,
  );
  return result.list.map((row) => ({ timestamp: Number(row.timestamp), openInterest: Number(row.openInterest) })).reverse();
}

interface FundingRateRow {
  symbol: string;
  fundingRate: string;
  fundingRateTimestamp: string;
}

interface FundingHistoryResult {
  category: string;
  list: FundingRateRow[];
}

export async function getLatestFundingRate(symbol: string, mode: BybitMode = "testnet"): Promise<number | null> {
  const result = await bybitGetPublic<FundingHistoryResult>("/v5/market/funding/history", { category: "linear", symbol, limit: 1 }, mode);
  const row = result.list[0];
  return row ? Number(row.fundingRate) * 100 : null;
}

interface InstrumentInfoRow {
  symbol: string;
  status: string;
  // Linear: qtyStep. Spot: basePrecision instead (no qtyStep field at all) —
  // verified against Bybit's own SDK type defs, these genuinely differ.
  lotSizeFilter: { qtyStep?: string; basePrecision?: string; minOrderQty: string };
  priceFilter: { tickSize: string };
  // Spot instruments have no leverageFilter at all (spot has no leverage).
  leverageFilter?: { minLeverage: string; maxLeverage: string };
}

interface InstrumentsInfoResult {
  category: string;
  list: InstrumentInfoRow[];
}

export interface InstrumentInfo {
  symbol: string;
  tradingActive: boolean;
  qtyStep: number;
  minOrderQty: number;
  tickSize: number;
  maxLeverage: number;
}

/** Every symbol's quantity/price rounding rules (and max leverage, for
 * linear only — spot instruments report maxLeverage as 1) — required before
 * placing any order so qty/price aren't rejected for wrong precision. */
export async function getInstrumentInfo(
  symbol: string,
  mode: BybitMode = "testnet",
  category: BybitCategory = DEFAULT_CATEGORY,
): Promise<InstrumentInfo | null> {
  const result = await bybitGetPublic<InstrumentsInfoResult>("/v5/market/instruments-info", { category, symbol }, mode);
  const row = result.list[0];
  if (!row) return null;
  return {
    symbol: row.symbol,
    tradingActive: row.status === "Trading",
    qtyStep: Number(row.lotSizeFilter.qtyStep ?? row.lotSizeFilter.basePrecision ?? 0.001),
    minOrderQty: Number(row.lotSizeFilter.minOrderQty),
    tickSize: Number(row.priceFilter.tickSize),
    maxLeverage: row.leverageFilter ? Number(row.leverageFilter.maxLeverage) : 1,
  };
}

export async function listActiveLinearSymbols(mode: BybitMode = "testnet"): Promise<string[]> {
  const result = await bybitGetPublic<InstrumentsInfoResult>("/v5/market/instruments-info", { category: "linear" }, mode);
  return result.list.filter((r) => r.status === "Trading" && r.symbol.endsWith("USDT")).map((r) => r.symbol);
}
