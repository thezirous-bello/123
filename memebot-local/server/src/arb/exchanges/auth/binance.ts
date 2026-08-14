import { createHmac } from "node:crypto";
import { env } from "../../../env.js";
import { logger } from "../../../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../../../lib/providerHealth.js";
import type { BalanceCheckResult, DepositCheckResult, ExchangeAuthClient } from "./types.js";

// Binance's standard signed-request scheme: query string + timestamp, HMAC
// SHA256 of the query string with the API secret appended as `signature`,
// API key sent via the X-MBX-APIKEY header. This is Binance's own
// documented, very stable signing scheme (used identically across their
// whole REST API for years) — the part genuinely uncertain here is the
// exact response shape of /sapi/v1/capital/config/getall, since this app
// can't verify it against a live account from this environment. If auth
// keeps failing, check BINANCE_API_KEY/_SECRET permissions (read-only is
// enough) first.
const BASE_URL = "https://api.binance.com";

function isConfigured(): boolean {
  return !!(env.BINANCE_API_KEY && env.BINANCE_API_SECRET);
}

function sign(query: string, secret: string): string {
  return createHmac("sha256", secret).update(query).digest("hex");
}

interface BinanceCoinConfig {
  coin: string;
  depositAllEnable?: boolean;
  networkList?: Array<{ network: string; depositEnable?: boolean }>;
}

async function signedGet<T>(path: string): Promise<{ data: T | null; error: string | null }> {
  if (!env.BINANCE_API_KEY || !env.BINANCE_API_SECRET) return { data: null, error: "not configured" };
  const timestamp = Date.now().toString();
  const query = `timestamp=${timestamp}&recvWindow=5000`;
  const signature = sign(query, env.BINANCE_API_SECRET);
  const url = `${BASE_URL}${path}?${query}&signature=${signature}`;

  const startedAt = performance.now();
  try {
    const res = await fetch(url, { headers: { "X-MBX-APIKEY": env.BINANCE_API_KEY } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      recordProviderFailure("binance", `HTTP ${res.status}`);
      logger.warn({ path, status: res.status, body: body.slice(0, 300) }, "Binance authenticated request failed");
      return { data: null, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as T;
    recordProviderSuccess("binance", performance.now() - startedAt);
    return { data, error: null };
  } catch (err) {
    recordProviderFailure("binance", (err as Error).message);
    return { data: null, error: (err as Error).message };
  }
}

async function checkDeposit(symbol: string): Promise<DepositCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, depositEnabled: null, error: null };
  const { data, error } = await signedGet<BinanceCoinConfig[]>("/sapi/v1/capital/config/getall");
  if (!data) return { configured: true, checkedOk: false, depositEnabled: null, error };
  const entry = data.find((c) => c.coin?.toUpperCase() === symbol.toUpperCase());
  if (!entry) return { configured: true, checkedOk: true, depositEnabled: null, error: "coin not listed on Binance" };
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

export const binanceAuthClient: ExchangeAuthClient = { isConfigured, checkDeposit, checkBalance };
