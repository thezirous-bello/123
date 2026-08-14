import { createHmac } from "node:crypto";
import { env } from "../../../env.js";
import { logger } from "../../../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../../../lib/providerHealth.js";
import type { BalanceCheckResult, DepositCheckResult, ExchangeAuthClient } from "./types.js";

// OKX's V5 signing scheme: prehash = ISO8601-with-ms timestamp + method +
// requestPath(+query) + body, HMAC-SHA256, base64-encoded. Headers:
// OK-ACCESS-KEY / -SIGN / -TIMESTAMP / -PASSPHRASE. This app can't verify
// the exact response shape of /api/v5/asset/currencies against a live
// account from this environment — auth failures are logged clearly rather
// than assumed to mean "no deposit."
const BASE_URL = "https://www.okx.com";

function isConfigured(): boolean {
  return !!(env.OKX_API_KEY && env.OKX_API_SECRET && env.OKX_API_PASSPHRASE);
}

function sign(prehash: string, secret: string): string {
  return createHmac("sha256", secret).update(prehash).digest("base64");
}

interface OkxCurrency {
  ccy: string;
  canDep?: boolean;
  chain?: string;
}
interface OkxEnvelope<T> {
  code: string;
  data: T;
}
interface OkxBalanceDetail {
  ccy: string;
  availBal?: string;
  frozenBal?: string;
}

async function signedGet<T>(path: string): Promise<{ data: T | null; error: string | null }> {
  if (!env.OKX_API_KEY || !env.OKX_API_SECRET || !env.OKX_API_PASSPHRASE) return { data: null, error: "not configured" };
  const timestamp = new Date().toISOString();
  const prehash = `${timestamp}GET${path}`;
  const signature = sign(prehash, env.OKX_API_SECRET);

  const startedAt = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "OK-ACCESS-KEY": env.OKX_API_KEY,
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": env.OKX_API_PASSPHRASE,
        "content-type": "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      recordProviderFailure("okx", `HTTP ${res.status}`);
      logger.warn({ path, status: res.status, body: body.slice(0, 300) }, "OKX authenticated request failed");
      return { data: null, error: `HTTP ${res.status}` };
    }
    const envelope = (await res.json()) as OkxEnvelope<T>;
    if (envelope.code !== "0") {
      recordProviderFailure("okx", `code ${envelope.code}`);
      return { data: null, error: `OKX error code ${envelope.code}` };
    }
    recordProviderSuccess("okx", performance.now() - startedAt);
    return { data: envelope.data, error: null };
  } catch (err) {
    recordProviderFailure("okx", (err as Error).message);
    return { data: null, error: (err as Error).message };
  }
}

async function checkDeposit(symbol: string): Promise<DepositCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, depositEnabled: null, error: null };
  const { data, error } = await signedGet<OkxCurrency[]>(`/api/v5/asset/currencies?ccy=${encodeURIComponent(symbol.toUpperCase())}`);
  if (!data) return { configured: true, checkedOk: false, depositEnabled: null, error };
  if (data.length === 0) return { configured: true, checkedOk: true, depositEnabled: null, error: "coin not listed on OKX" };
  const enabled = data.some((c) => c.canDep === true);
  return { configured: true, checkedOk: true, depositEnabled: enabled, error: null };
}

async function checkBalance(): Promise<BalanceCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, hasNonZeroBalance: null, error: null };
  const { data, error } = await signedGet<OkxBalanceDetail[]>("/api/v5/asset/balances");
  if (!data) return { configured: true, checkedOk: false, hasNonZeroBalance: null, error };
  const hasFunds = data.some((b) => Number.parseFloat(b.availBal ?? "0") > 0 || Number.parseFloat(b.frozenBal ?? "0") > 0);
  return { configured: true, checkedOk: true, hasNonZeroBalance: hasFunds, error: null };
}

export const okxAuthClient: ExchangeAuthClient = { isConfigured, checkDeposit, checkBalance };
