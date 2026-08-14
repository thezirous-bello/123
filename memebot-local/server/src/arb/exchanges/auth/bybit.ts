import { bybitGetPrivate, isBybitConfigured } from "../../../bybit/client.js";
import { logger } from "../../../lib/logger.js";
import type { BalanceCheckResult, DepositCheckResult, ExchangeAuthClient } from "./types.js";

// Reuses the same signed Bybit V5 client the spot/futures bots already use
// (proven, documented against Bybit's official docs — see bybit/client.ts).
// Always queries mainnet ("live"), same reasoning as bybitSpot.ts's ticker
// adapter: a deposit-status check against testnet would be meaningless for
// a real-price arbitrage comparison. Only ever calls read-only GET
// endpoints — never places an order or withdrawal.

interface BybitCoinInfoChain {
  chain: string;
  chainDeposit?: string; // "1" enabled, "0" disabled per Bybit's docs
}
interface BybitCoinInfoResult {
  rows?: Array<{ coin: string; chains?: BybitCoinInfoChain[] }>;
}
interface BybitBalanceResult {
  list?: Array<{ coin?: Array<{ walletBalance?: string }> }>;
}

function isConfigured(): boolean {
  return isBybitConfigured("live");
}

async function checkDeposit(symbol: string): Promise<DepositCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, depositEnabled: null, error: null };
  try {
    const result = await bybitGetPrivate<BybitCoinInfoResult>("live", "/v5/asset/coin/query-info", { coin: symbol.toUpperCase() });
    const row = result.rows?.find((r) => r.coin?.toUpperCase() === symbol.toUpperCase());
    if (!row) return { configured: true, checkedOk: true, depositEnabled: null, error: "coin not listed on Bybit" };
    const enabled = (row.chains ?? []).some((c) => c.chainDeposit === "1");
    return { configured: true, checkedOk: true, depositEnabled: enabled, error: null };
  } catch (err) {
    logger.warn({ symbol, err: (err as Error).message }, "Bybit deposit-status check failed");
    return { configured: true, checkedOk: false, depositEnabled: null, error: (err as Error).message };
  }
}

async function checkBalance(): Promise<BalanceCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, hasNonZeroBalance: null, error: null };
  try {
    const result = await bybitGetPrivate<BybitBalanceResult>("live", "/v5/account/wallet-balance", { accountType: "UNIFIED" });
    const hasFunds = (result.list ?? []).some((acct) => (acct.coin ?? []).some((c) => Number.parseFloat(c.walletBalance ?? "0") > 0));
    return { configured: true, checkedOk: true, hasNonZeroBalance: hasFunds, error: null };
  } catch (err) {
    return { configured: true, checkedOk: false, hasNonZeroBalance: null, error: (err as Error).message };
  }
}

export const bybitAuthClient: ExchangeAuthClient = { isConfigured, checkDeposit, checkBalance };
