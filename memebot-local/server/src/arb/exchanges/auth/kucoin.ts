import { createHmac } from "node:crypto";
import { env } from "../../../env.js";
import { logger } from "../../../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../../../lib/providerHealth.js";
import type { BalanceCheckResult, DepositCheckResult, ExchangeAuthClient } from "./types.js";

// KuCoin's v2 signing scheme: str_to_sign = timestamp + method + endpoint(+
// query) + body, KC-API-SIGN = base64(HMAC-SHA256(secret, str_to_sign)),
// and (key-version 2) the passphrase itself is ALSO HMAC-SHA256-signed with
// the secret before being sent. Headers: KC-API-KEY / -SIGN / -TIMESTAMP /
// -PASSPHRASE / -KEY-VERSION. This app can't verify the exact response
// shape of these endpoints against a live account from this environment —
// auth failures are logged clearly rather than assumed to mean "no deposit."
const BASE_URL = "https://api.kucoin.com";

function isConfigured(): boolean {
  return !!(env.KUCOIN_API_KEY && env.KUCOIN_API_SECRET && env.KUCOIN_API_PASSPHRASE);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64");
}

interface KucoinChain {
  chainName?: string;
  isDepositEnabled?: boolean;
}
interface KucoinCurrency {
  currency: string;
  chains?: KucoinChain[];
}
interface KucoinEnvelope<T> {
  code: string;
  data: T;
}
interface KucoinAccount {
  currency: string;
  balance: string;
}

async function signedGet<T>(endpoint: string): Promise<{ data: T | null; error: string | null }> {
  if (!env.KUCOIN_API_KEY || !env.KUCOIN_API_SECRET || !env.KUCOIN_API_PASSPHRASE) return { data: null, error: "not configured" };
  const timestamp = Date.now().toString();
  const strToSign = `${timestamp}GET${endpoint}`;
  const signature = sign(strToSign, env.KUCOIN_API_SECRET);
  const signedPassphrase = sign(env.KUCOIN_API_PASSPHRASE, env.KUCOIN_API_SECRET);

  const startedAt = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        "KC-API-KEY": env.KUCOIN_API_KEY,
        "KC-API-SIGN": signature,
        "KC-API-TIMESTAMP": timestamp,
        "KC-API-PASSPHRASE": signedPassphrase,
        "KC-API-KEY-VERSION": "2",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      recordProviderFailure("kucoin", `HTTP ${res.status}`);
      logger.warn({ endpoint, status: res.status, body: body.slice(0, 300) }, "KuCoin authenticated request failed");
      return { data: null, error: `HTTP ${res.status}` };
    }
    const envelope = (await res.json()) as KucoinEnvelope<T>;
    if (envelope.code !== "200000") {
      recordProviderFailure("kucoin", `code ${envelope.code}`);
      return { data: null, error: `KuCoin error code ${envelope.code}` };
    }
    recordProviderSuccess("kucoin", performance.now() - startedAt);
    return { data: envelope.data, error: null };
  } catch (err) {
    recordProviderFailure("kucoin", (err as Error).message);
    return { data: null, error: (err as Error).message };
  }
}

async function checkDeposit(symbol: string): Promise<DepositCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, depositEnabled: null, error: null };
  const { data, error } = await signedGet<KucoinCurrency>(`/api/v3/currencies/${encodeURIComponent(symbol.toUpperCase())}`);
  if (!data) return { configured: true, checkedOk: false, depositEnabled: null, error };
  const enabled = (data.chains ?? []).some((c) => c.isDepositEnabled === true);
  return { configured: true, checkedOk: true, depositEnabled: enabled, error: null };
}

async function checkBalance(): Promise<BalanceCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, hasNonZeroBalance: null, error: null };
  const { data, error } = await signedGet<KucoinAccount[]>("/api/v1/accounts");
  if (!data) return { configured: true, checkedOk: false, hasNonZeroBalance: null, error };
  const hasFunds = data.some((a) => Number.parseFloat(a.balance) > 0);
  return { configured: true, checkedOk: true, hasNonZeroBalance: hasFunds, error: null };
}

export const kucoinAuthClient: ExchangeAuthClient = { isConfigured, checkDeposit, checkBalance };
