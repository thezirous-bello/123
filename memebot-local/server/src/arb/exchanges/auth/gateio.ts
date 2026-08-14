import { createHash, createHmac } from "node:crypto";
import { env } from "../../../env.js";
import { logger } from "../../../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../../../lib/providerHealth.js";
import type { BalanceCheckResult, DepositCheckResult, ExchangeAuthClient } from "./types.js";

// Gate.io's v4 signing scheme: sign_string = Method + "\n" + Path + "\n" +
// Query + "\n" + SHA512(Body) + "\n" + Timestamp, signature =
// HMAC-SHA512(secret, sign_string) hex. Headers: KEY, SIGN, Timestamp. This
// app can't verify the exact response shape of these endpoints against a
// live account from this environment — auth failures are logged clearly
// rather than assumed to mean "no deposit."
const BASE_URL = "https://api.gateio.ws";
const EMPTY_BODY_SHA512 = createHash("sha512").update("").digest("hex");

function isConfigured(): boolean {
  return !!(env.GATEIO_API_KEY && env.GATEIO_API_SECRET);
}

function sign(signString: string, secret: string): string {
  return createHmac("sha512", secret).update(signString).digest("hex");
}

interface GateioCurrency {
  currency: string;
  deposit_disabled?: boolean;
  delisted?: boolean;
}
interface GateioAccount {
  currency: string;
  available?: string;
  locked?: string;
}

async function signedGet<T>(path: string, query = ""): Promise<{ data: T | null; error: string | null }> {
  if (!env.GATEIO_API_KEY || !env.GATEIO_API_SECRET) return { data: null, error: "not configured" };
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signString = `GET\n${path}\n${query}\n${EMPTY_BODY_SHA512}\n${timestamp}`;
  const signature = sign(signString, env.GATEIO_API_SECRET);

  const startedAt = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${path}${query ? `?${query}` : ""}`, {
      headers: {
        KEY: env.GATEIO_API_KEY,
        SIGN: signature,
        Timestamp: timestamp,
        accept: "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      recordProviderFailure("gateio", `HTTP ${res.status}`);
      logger.warn({ path, status: res.status, body: body.slice(0, 300) }, "Gate.io authenticated request failed");
      return { data: null, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as T;
    recordProviderSuccess("gateio", performance.now() - startedAt);
    return { data, error: null };
  } catch (err) {
    recordProviderFailure("gateio", (err as Error).message);
    return { data: null, error: (err as Error).message };
  }
}

async function checkDeposit(symbol: string): Promise<DepositCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, depositEnabled: null, error: null };
  const { data, error } = await signedGet<GateioCurrency>(`/api/v4/spot/currencies/${encodeURIComponent(symbol.toUpperCase())}`);
  if (!data) return { configured: true, checkedOk: false, depositEnabled: null, error };
  if (data.delisted) return { configured: true, checkedOk: true, depositEnabled: false, error: null };
  return { configured: true, checkedOk: true, depositEnabled: data.deposit_disabled !== true, error: null };
}

async function checkBalance(): Promise<BalanceCheckResult> {
  if (!isConfigured()) return { configured: false, checkedOk: false, hasNonZeroBalance: null, error: null };
  const { data, error } = await signedGet<GateioAccount[]>("/api/v4/spot/accounts");
  if (!data) return { configured: true, checkedOk: false, hasNonZeroBalance: null, error };
  const hasFunds = data.some((a) => Number.parseFloat(a.available ?? "0") > 0 || Number.parseFloat(a.locked ?? "0") > 0);
  return { configured: true, checkedOk: true, hasNonZeroBalance: hasFunds, error: null };
}

export const gateioAuthClient: ExchangeAuthClient = { isConfigured, checkDeposit, checkBalance };
