import { db, nowIso } from "../../../db/index.js";
import { recordLog } from "../../../lib/auditLog.js";
import { binanceAuthClient } from "./binance.js";
import { bitstampAuthClient } from "./bitstamp.js";
import { bybitAuthClient } from "./bybit.js";
import { gateioAuthClient } from "./gateio.js";
import { krakenAuthClient } from "./kraken.js";
import { kucoinAuthClient } from "./kucoin.js";
import { mexcAuthClient } from "./mexc.js";
import { okxAuthClient } from "./okx.js";
import type { ExchangeId } from "../index.js";
import type { ExchangeAuthClient } from "./types.js";

export const AUTH_CLIENT_REGISTRY: Record<ExchangeId, ExchangeAuthClient> = {
  binance: binanceAuthClient,
  bybit: bybitAuthClient,
  okx: okxAuthClient,
  kucoin: kucoinAuthClient,
  gateio: gateioAuthClient,
  mexc: mexcAuthClient,
  kraken: krakenAuthClient,
  bitstamp: bitstampAuthClient,
};

// Deposit status is genuinely allowed to change (chain upgrades,
// maintenance) so this cache is much shorter-lived than the coin-identity
// one — long enough that the arb scan loop (every ~10s) isn't firing a
// signed request per symbol per tick, short enough to reflect a real
// change within a trading session.
const DEPOSIT_CACHE_TTL_MS = 20 * 60_000;
const loggedAuthFailureOnce = new Set<ExchangeId>();

export type DepositGateResult = "enabled" | "disabled" | "unverifiable";

function cachedDeposit(exchange: ExchangeId, symbol: string): { enabled: boolean; checkedAt: string } | null {
  const row = db.prepare("SELECT deposit_enabled, checked_at FROM deposit_status_cache WHERE exchange_id = ? AND symbol = ?").get(exchange, symbol) as
    | { deposit_enabled: number; checked_at: string }
    | undefined;
  if (!row) return null;
  const ageMs = Date.now() - new Date(row.checked_at).getTime();
  if (ageMs > DEPOSIT_CACHE_TTL_MS) return null;
  return { enabled: row.deposit_enabled === 1, checkedAt: row.checked_at };
}

function persistDeposit(exchange: ExchangeId, symbol: string, enabled: boolean): void {
  db.prepare(
    `INSERT INTO deposit_status_cache (exchange_id, symbol, deposit_enabled, checked_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(exchange_id, symbol) DO UPDATE SET deposit_enabled = excluded.deposit_enabled, checked_at = excluded.checked_at`,
  ).run(exchange, symbol, enabled ? 1 : 0, nowIso());
}

/**
 * Whether `symbol` can currently be deposited on `exchange`, per that
 * exchange's own real, read-only, authenticated account data — cached for
 * DEPOSIT_CACHE_TTL_MS. Never fabricated: no configured key, an
 * unreachable/failing authenticated call, or a coin the exchange doesn't
 * even list all resolve to "unverifiable", which callers must treat as a
 * block, not a pass — this is the direct fix for "it bought on platform 1
 * but deposits were blocked on platform 2, wasting the fee."
 */
export async function checkDepositGate(exchange: ExchangeId, symbol: string): Promise<DepositGateResult> {
  const upper = symbol.toUpperCase();
  const cached = cachedDeposit(exchange, upper);
  if (cached) return cached.enabled ? "enabled" : "disabled";

  const client = AUTH_CLIENT_REGISTRY[exchange];
  const result = await client.checkDeposit(upper);

  if (!result.configured) return "unverifiable";
  if (!result.checkedOk || result.depositEnabled === null) {
    if (!loggedAuthFailureOnce.has(exchange)) {
      loggedAuthFailureOnce.add(exchange);
      recordLog(
        "warn",
        "arb_bot",
        `${exchange}: deposit-status check unavailable (${result.error ?? "unknown reason"}) — verify its API key/secret${
          exchange === "okx" || exchange === "kucoin" ? "/passphrase" : ""
        } in .env has read permission. Trades landing on ${exchange} will be skipped until this resolves.`,
      );
    }
    return "unverifiable";
  }

  persistDeposit(exchange, upper, result.depositEnabled);
  return result.depositEnabled ? "enabled" : "disabled";
}

export interface ExchangeAuthStatus {
  exchange: ExchangeId;
  configured: boolean;
}

export function listExchangeAuthStatus(exchanges: ExchangeId[]): ExchangeAuthStatus[] {
  return exchanges.map((exchange) => ({ exchange, configured: AUTH_CLIENT_REGISTRY[exchange].isConfigured() }));
}

/** Best-effort, informational-only real balance snapshot — refreshed by the
 * caller on its own schedule (see arb/controller.ts), never read by any
 * trading decision. */
export async function refreshExchangeBalanceSnapshot(exchange: ExchangeId): Promise<void> {
  const client = AUTH_CLIENT_REGISTRY[exchange];
  if (!client.isConfigured()) return;
  const result = await client.checkBalance();
  if (!result.checkedOk) return;
  db.prepare(
    `INSERT INTO arb_exchange_balances (exchange_id, real_balance_usd, checked_at) VALUES (?, ?, ?)
     ON CONFLICT(exchange_id) DO UPDATE SET real_balance_usd = excluded.real_balance_usd, checked_at = excluded.checked_at`,
  ).run(exchange, result.hasNonZeroBalance ? "has_funds" : "0", nowIso());
}
