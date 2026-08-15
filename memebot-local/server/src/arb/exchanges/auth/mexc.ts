import { createHmac } from "node:crypto";
import { env } from "../../../env.js";
import { logger } from "../../../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../../../lib/providerHealth.js";
import type { BalanceCheckResult, DepositCheckResult, ExchangeAuthClient } from "./types.js";

// MEXC's spot API mirrors Binance's design closely, including this same
// query-string HMAC-SHA256 signing scheme and an equivalent
// capital/config/getall endpoint — this app cannot verify the exact
// response shape against a live account from this environment, so auth
// failures here are logged clearly rather than assumed to mean "no
// deposit" (see checkDeposit).
const BASE_URL = "https://api.mexc.com";

function isConfigured(): boolean {
  return !!(env.MEXC_API_KEY && env.MEXC_API_SECRET);
}

function sign(query: string, secret: string): string {
  return createHmac("sha256", secret).update(query).digest("hex");
}

interface MexcCoinConfig {
  coin: string;
  depositAllEnable?: boolean;
  networkList?: Array<{ network: string; depositEnable?: boolean }>;
}

// MEXC rejects a request outright if the local clock has drifted from
// MEXC's server clock by more than recvWindow — 5000ms (their common
// default) is tight enough that ordinary local clock drift (a machine
// whose OS time sync is stale/off, not unusual on Windows) trips it. 60000
// is the max MEXC's Binance-compatible API generally accepts; using it
// doesn't weaken anything meaningful (recvWindow is a freshness window,
// not a security secret) and avoids depending on the local clock being
// accurate to the second.
const RECV_WINDOW_MS = 60_000;

async function signedGet<T>(path: string): Promise<{ data: T | null; error: string | null }> {
  if (!env.MEXC_API_KEY || !env.MEXC_API_SECRET) return { data: null, error: "not configured" };
  const timestamp = Date.now().toString();
  const query = `timestamp=${timestamp}&recvWindow=${RECV_WINDOW_MS}`;
  const signature = sign(query, env.MEXC_API_SECRET);
  const url = `${BASE_URL}${path}?${query}&signature=${signature}`;

  const startedAt = performance.now();
  try {
    const res = await fetch(url, { headers: { "X-MEXC-APIKEY": env.MEXC_API_KEY } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      recordProviderFailure("mexc", `HTTP ${res.status}`);
      logger.warn({ path, status: res.status, body: body.slice(0, 300) }, "MEXC authenticated request failed");
      return { data: null, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as T;
    recordProviderSuccess("mexc", performance.now() - startedAt);
    return { data, error: null };
  } catch (err) {
    recordProviderFailure("mexc", (err as Error).message);
    return { data: null, error: (err as Error).message };
  }
}

async function checkDeposit(symbol: string): Promise<DepositCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, depositEnabled: null, error: null };
  const { data, error } = await signedGet<MexcCoinConfig[]>("/api/v3/capital/config/getall");
  if (!data) return { configured: true, checkedOk: false, depositEnabled: null, error };
  const entry = data.find((c) => c.coin?.toUpperCase() === symbol.toUpperCase());
  if (!entry) return { configured: true, checkedOk: true, depositEnabled: null, error: "coin not listed on MEXC" };
  const enabled = entry.depositAllEnable === true || (entry.networkList ?? []).some((n) => n.depositEnable === true);
  return { configured: true, checkedOk: true, depositEnabled: enabled, error: null };
}

async function checkBalance(): Promise<BalanceCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, hasNonZeroBalance: null, error: null };
  const { data, error } = await signedGet<{ balances?: Array<{ free: string; locked: string }> }>("/api/v3/account");
  if (!data) return { configured: true, checkedOk: false, hasNonZeroBalance: null, error };
  const hasFunds = (data.balances ?? []).some((b) => Number.parseFloat(b.free) > 0 || Number.parseFloat(b.locked) > 0);
  return { configured: true, checkedOk: true, hasNonZeroBalance: hasFunds, error: null };
}

export const mexcAuthClient: ExchangeAuthClient = { isConfigured, checkDeposit, checkBalance };
