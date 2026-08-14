import { createHash, createHmac } from "node:crypto";
import { env } from "../../../env.js";
import { logger } from "../../../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../../../lib/providerHealth.js";
import type { BalanceCheckResult, DepositCheckResult, ExchangeAuthClient } from "./types.js";

// Kraken's private-endpoint signing: message = path + SHA256(nonce +
// urlencoded-postdata), signature = base64(HMAC-SHA512(base64-decoded
// secret, message)). Headers: API-Key, API-Sign. POST-only,
// application/x-www-form-urlencoded body including the nonce. This app
// can't verify exact response shapes against a live account from this
// environment — auth failures are logged clearly rather than assumed to
// mean "no deposit."
//
// Known limitation: Kraken uses its own historical asset codes for some
// coins (famously "XBT" for BTC) rather than the ticker convention every
// other exchange in this app uses. Only the handful of legacy renames below
// are covered — an unmapped symbol is sent through unchanged, which is
// correct for the great majority of assets but may miss a match for a few
// older Kraken-specific codes.
const BASE_URL = "https://api.kraken.com";
const SYMBOL_ALIASES: Record<string, string> = { BTC: "XBT", DOGE: "XDG" };

function isConfigured(): boolean {
  return !!(env.KRAKEN_API_KEY && env.KRAKEN_API_SECRET);
}

function sign(path: string, postData: string, nonce: string, secretBase64: string): string {
  const secret = Buffer.from(secretBase64, "base64");
  const hash = createHash("sha256").update(nonce + postData).digest();
  const hmac = createHmac("sha512", secret).update(Buffer.concat([Buffer.from(path), hash])).digest("base64");
  return hmac;
}

interface KrakenEnvelope<T> {
  error: string[];
  result: T;
}

async function signedPost<T>(path: string, params: Record<string, string> = {}): Promise<{ data: T | null; error: string | null }> {
  if (!env.KRAKEN_API_KEY || !env.KRAKEN_API_SECRET) return { data: null, error: "not configured" };
  const nonce = Date.now().toString();
  const postData = new URLSearchParams({ nonce, ...params }).toString();
  const signature = sign(path, postData, nonce, env.KRAKEN_API_SECRET);

  const startedAt = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "API-Key": env.KRAKEN_API_KEY,
        "API-Sign": signature,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: postData,
    });
    if (!res.ok) {
      recordProviderFailure("kraken", `HTTP ${res.status}`);
      logger.warn({ path, status: res.status }, "Kraken authenticated request failed");
      return { data: null, error: `HTTP ${res.status}` };
    }
    const envelope = (await res.json()) as KrakenEnvelope<T>;
    if (envelope.error && envelope.error.length > 0) {
      recordProviderFailure("kraken", envelope.error.join("; "));
      return { data: null, error: envelope.error.join("; ") };
    }
    recordProviderSuccess("kraken", performance.now() - startedAt);
    return { data: envelope.result, error: null };
  } catch (err) {
    recordProviderFailure("kraken", (err as Error).message);
    return { data: null, error: (err as Error).message };
  }
}

async function checkDeposit(symbol: string): Promise<DepositCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, depositEnabled: null, error: null };
  const asset = SYMBOL_ALIASES[symbol.toUpperCase()] ?? symbol.toUpperCase();
  const { data, error } = await signedPost<Array<{ method: string }>>("/0/private/DepositMethods", { asset });
  if (!data) return { configured: true, checkedOk: false, depositEnabled: null, error };
  return { configured: true, checkedOk: true, depositEnabled: data.length > 0, error: null };
}

async function checkBalance(): Promise<BalanceCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, hasNonZeroBalance: null, error: null };
  const { data, error } = await signedPost<Record<string, string>>("/0/private/Balance");
  if (!data) return { configured: true, checkedOk: false, hasNonZeroBalance: null, error };
  const hasFunds = Object.values(data).some((v) => Number.parseFloat(v) > 0);
  return { configured: true, checkedOk: true, hasNonZeroBalance: hasFunds, error: null };
}

export const krakenAuthClient: ExchangeAuthClient = { isConfigured, checkDeposit, checkBalance };
