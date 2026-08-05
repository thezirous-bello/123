import { bybitGetPrivate, bybitPostPrivate, type BybitMode } from "./client.js";

const CATEGORY = "linear" as const;

export type OrderSide = "Buy" | "Sell";

export interface SubmitOrderParams {
  symbol: string;
  side: OrderSide;
  qty: string;
  reduceOnly?: boolean;
  orderLinkId?: string;
}

export interface OrderResult {
  orderId: string;
  orderLinkId: string;
}

/** Market order only — this bot never uses limit entries, matching the
 * strategy's "enter now within the zone" behavior. positionIdx=0 is
 * one-way mode (not hedge mode), which is what a fresh Bybit account uses
 * by default and what setLeverage below assumes. */
export async function submitMarketOrder(mode: BybitMode, params: SubmitOrderParams): Promise<OrderResult> {
  return bybitPostPrivate<OrderResult>(mode, "/v5/order/create", {
    category: CATEGORY,
    symbol: params.symbol,
    side: params.side,
    orderType: "Market",
    qty: params.qty,
    reduceOnly: params.reduceOnly ?? false,
    positionIdx: 0,
    orderLinkId: params.orderLinkId,
  });
}

export interface PositionInfo {
  symbol: string;
  side: "Buy" | "Sell" | "None";
  size: number;
  avgPrice: number;
  markPrice: number;
  liqPrice: number | null;
  leverage: number;
  unrealisedPnl: number;
  positionValue: number;
}

interface PositionRow {
  symbol: string;
  side: string;
  size: string;
  avgPrice: string;
  markPrice: string;
  liqPrice: string;
  leverage: string;
  unrealisedPnl: string;
  positionValue: string;
}

interface PositionListResult {
  category: string;
  list: PositionRow[];
}

export async function getOpenPositions(mode: BybitMode, symbol?: string): Promise<PositionInfo[]> {
  const params: Record<string, unknown> = { category: CATEGORY, settleCoin: "USDT" };
  if (symbol) params.symbol = symbol;
  const result = await bybitGetPrivate<PositionListResult>(mode, "/v5/position/list", params);
  return result.list
    .filter((row) => Number(row.size) > 0)
    .map((row) => ({
      symbol: row.symbol,
      side: row.side as "Buy" | "Sell" | "None",
      size: Number(row.size),
      avgPrice: Number(row.avgPrice),
      markPrice: Number(row.markPrice),
      liqPrice: row.liqPrice ? Number(row.liqPrice) : null,
      leverage: Number(row.leverage),
      unrealisedPnl: Number(row.unrealisedPnl),
      positionValue: Number(row.positionValue),
    }));
}

export async function setLeverage(mode: BybitMode, symbol: string, leverage: number): Promise<void> {
  await bybitPostPrivate(mode, "/v5/position/set-leverage", {
    category: CATEGORY,
    symbol,
    buyLeverage: String(leverage),
    sellLeverage: String(leverage),
  });
}

export interface SetTradingStopParams {
  symbol: string;
  stopLoss?: string;
  takeProfit?: string;
  trailingStop?: string;
}

/** Places/updates the exchange-side SL/TP so a position is protected even if
 * this process is offline — the bot's own tick loop also manages exits, but
 * this is the backstop. positionIdx=0 matches submitMarketOrder above. */
export async function setTradingStop(mode: BybitMode, params: SetTradingStopParams): Promise<void> {
  await bybitPostPrivate(mode, "/v5/position/trading-stop", {
    category: CATEGORY,
    symbol: params.symbol,
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    trailingStop: params.trailingStop,
    positionIdx: 0,
  });
}

export interface WalletBalanceSummary {
  totalEquityUsd: number;
  availableBalanceUsd: number;
}

interface WalletCoinRow {
  coin: string;
  equity: string;
  availableToWithdraw: string;
}

interface WalletAccountRow {
  accountType: string;
  totalEquity: string;
  totalAvailableBalance: string;
  coin: WalletCoinRow[];
}

interface WalletBalanceResult {
  list: WalletAccountRow[];
}

/** UNIFIED is the account type every Bybit account created since 2024 uses
 * (including testnet accounts from the faucet) — CONTRACT is the legacy
 * type and would 10004-error on a unified account. */
export async function getWalletBalance(mode: BybitMode): Promise<WalletBalanceSummary | null> {
  const result = await bybitGetPrivate<WalletBalanceResult>(mode, "/v5/account/wallet-balance", { accountType: "UNIFIED" });
  const account = result.list[0];
  if (!account) return null;
  return {
    totalEquityUsd: Number(account.totalEquity),
    availableBalanceUsd: Number(account.totalAvailableBalance),
  };
}
