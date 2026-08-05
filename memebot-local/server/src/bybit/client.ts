import { createHmac } from "node:crypto";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../lib/providerHealth.js";

// Bybit V5 unified REST client. Endpoint paths, header names, and the
// signature construction below are taken directly from Bybit's official V5
// docs (bybit-exchange.github.io/docs/v5) and cross-checked against the
// tiagosiebler/bybit-api SDK's source — not guessed.
//
// Testnet vs mainnet is a base-URL + API-key switch, nothing else differs.
// `mode` throughout this module means which of those two we're pointed at,
// completely separate from the meme-coin bot's paper/live concept.
export type BybitMode = "testnet" | "live";

const BASE_URL: Record<BybitMode, string> = {
  testnet: "https://api-testnet.bybit.com",
  live: "https://api.bybit.com",
};

const RECV_WINDOW = "5000";

export class BybitApiError extends Error {
  retCode: number;
  constructor(retCode: number, retMsg: string) {
    super(retMsg);
    this.retCode = retCode;
  }
}

interface BybitEnvelope<T> {
  retCode: number;
  retMsg: string;
  result: T;
  time: number;
}

function credentialsFor(mode: BybitMode): { key: string; secret: string } | null {
  const key = mode === "testnet" ? env.BYBIT_TESTNET_API_KEY : env.BYBIT_API_KEY;
  const secret = mode === "testnet" ? env.BYBIT_TESTNET_API_SECRET : env.BYBIT_API_SECRET;
  if (!key || !secret) return null;
  return { key, secret };
}

export function isBybitConfigured(mode: BybitMode): boolean {
  return credentialsFor(mode) !== null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function toQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  return entries.map(([k, v]) => `${k}=${String(v)}`).join("&");
}

async function request<T>(
  mode: BybitMode,
  method: "GET" | "POST",
  path: string,
  params: Record<string, unknown> = {},
  requireAuth: boolean,
): Promise<T> {
  const base = BASE_URL[mode];
  const queryString = method === "GET" ? toQueryString(params) : "";
  const bodyString = method === "POST" ? JSON.stringify(params) : "";
  const url = `${base}${path}${queryString ? `?${queryString}` : ""}`;

  const headers: Record<string, string> = { "content-type": "application/json" };

  if (requireAuth) {
    const creds = credentialsFor(mode);
    if (!creds) {
      throw new Error(
        `Bybit ${mode} API credentials are not configured — set BYBIT_${mode === "testnet" ? "TESTNET_" : ""}API_KEY / _SECRET in .env.`,
      );
    }
    const timestamp = Date.now().toString();
    const signPayload = timestamp + creds.key + RECV_WINDOW + (method === "GET" ? queryString : bodyString);
    headers["X-BAPI-API-KEY"] = creds.key;
    headers["X-BAPI-TIMESTAMP"] = timestamp;
    headers["X-BAPI-RECV-WINDOW"] = RECV_WINDOW;
    headers["X-BAPI-SIGN"] = sign(signPayload, creds.secret);
  }

  const startedAt = performance.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method === "POST" ? bodyString : undefined,
    });
    if (!res.ok) {
      recordProviderFailure("bybit", `HTTP ${res.status}`);
      throw new Error(`Bybit HTTP ${res.status} on ${path}`);
    }
    const envelope = (await res.json()) as BybitEnvelope<T>;
    if (envelope.retCode !== 0) {
      recordProviderFailure("bybit", `retCode ${envelope.retCode}: ${envelope.retMsg}`);
      throw new BybitApiError(envelope.retCode, envelope.retMsg);
    }
    recordProviderSuccess("bybit", performance.now() - startedAt);
    return envelope.result;
  } catch (err) {
    if (!(err instanceof BybitApiError)) {
      recordProviderFailure("bybit", (err as Error).message);
    }
    logger.warn({ path, mode, err: (err as Error).message }, "Bybit request failed");
    throw err;
  }
}

export function bybitGetPublic<T>(path: string, params?: Record<string, unknown>, mode: BybitMode = "testnet"): Promise<T> {
  return request<T>(mode, "GET", path, params, false);
}

export function bybitGetPrivate<T>(mode: BybitMode, path: string, params?: Record<string, unknown>): Promise<T> {
  return request<T>(mode, "GET", path, params, true);
}

export function bybitPostPrivate<T>(mode: BybitMode, path: string, params: Record<string, unknown>): Promise<T> {
  return request<T>(mode, "POST", path, params, true);
}
