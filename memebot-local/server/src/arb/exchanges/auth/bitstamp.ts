import { createHmac, randomUUID } from "node:crypto";
import { env } from "../../../env.js";
import { logger } from "../../../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../../../lib/providerHealth.js";
import type { BalanceCheckResult, DepositCheckResult, ExchangeAuthClient } from "./types.js";

// Bitstamp's v2 signing scheme: message = "BITSTAMP " + api_key + http_verb
// + host + path + query_string + content_type + nonce + timestamp + "v2" +
// body, signature = HMAC-SHA256(api_secret, message) hex uppercase.
// Headers: X-Auth, X-Auth-Signature, X-Auth-Nonce, X-Auth-Timestamp,
// X-Auth-Version. This app can't verify the exact request/response shape
// against a live account from this environment — auth failures are logged
// clearly rather than assumed to mean "no deposit."
//
// Known limitation: Bitstamp's public API does not expose a simple
// per-coin "is deposit enabled" endpoint the way Binance/OKX/KuCoin/Gate.io
// do — checkDeposit is honestly reported as unsupported (checkedOk: false)
// rather than guessing at a call that likely doesn't exist. Balance
// checking (which Bitstamp does support) still works normally.
const HOST = "www.bitstamp.net";
const BASE_URL = `https://${HOST}`;

function isConfigured(): boolean {
  return !!(env.BITSTAMP_API_KEY && env.BITSTAMP_API_SECRET);
}

function sign(message: string, secret: string): string {
  return createHmac("sha256", secret).update(message).digest("hex").toUpperCase();
}

async function signedPost<T>(path: string): Promise<{ data: T | null; error: string | null }> {
  if (!env.BITSTAMP_API_KEY || !env.BITSTAMP_API_SECRET) return { data: null, error: "not configured" };
  const nonce = randomUUID();
  const timestamp = Date.now().toString();
  const contentType = "";
  const body = "";
  const message = `BITSTAMP ${env.BITSTAMP_API_KEY}POST${HOST}${path}${contentType}${nonce}${timestamp}v2${body}`;
  const signature = sign(message, env.BITSTAMP_API_SECRET);

  const startedAt = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "X-Auth": `BITSTAMP ${env.BITSTAMP_API_KEY}`,
        "X-Auth-Signature": signature,
        "X-Auth-Nonce": nonce,
        "X-Auth-Timestamp": timestamp,
        "X-Auth-Version": "v2",
      },
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      recordProviderFailure("bitstamp", `HTTP ${res.status}`);
      logger.warn({ path, status: res.status, body: bodyText.slice(0, 300) }, "Bitstamp authenticated request failed");
      return { data: null, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as T;
    recordProviderSuccess("bitstamp", performance.now() - startedAt);
    return { data, error: null };
  } catch (err) {
    recordProviderFailure("bitstamp", (err as Error).message);
    return { data: null, error: (err as Error).message };
  }
}

async function checkDeposit(_symbol: string): Promise<DepositCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, depositEnabled: null, error: null };
  return {
    configured: true,
    checkedOk: false,
    depositEnabled: null,
    error: "Bitstamp has no public per-coin deposit-status API — this gate can't be verified for Bitstamp.",
  };
}

async function checkBalance(): Promise<BalanceCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, hasNonZeroBalance: null, error: null };
  const { data, error } = await signedPost<Record<string, string>>("/api/v2/balance/");
  if (!data) return { configured: true, checkedOk: false, hasNonZeroBalance: null, error };
  const hasFunds = Object.entries(data).some(([key, value]) => key.endsWith("_balance") && Number.parseFloat(value) > 0);
  return { configured: true, checkedOk: true, hasNonZeroBalance: hasFunds, error: null };
}

export const bitstampAuthClient: ExchangeAuthClient = { isConfigured, checkDeposit, checkBalance };
