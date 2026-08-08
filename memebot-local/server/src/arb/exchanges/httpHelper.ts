import { logger } from "../../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../../lib/providerHealth.js";
import type { ProviderId } from "../../lib/providerHealth.js";

/** Shared fetch-JSON-and-track-provider-health helper for the arb bot's
 * exchange adapters — every one of them is a single public, unauthenticated
 * "all tickers" GET, so there's no reason to duplicate this per adapter.
 * Returns null (never throws) on any failure so the scan loop can just skip
 * whichever exchange is down for that cycle instead of failing the whole
 * scan. */
export async function fetchJson<T>(provider: ProviderId, url: string): Promise<T | null> {
  const startedAt = performance.now();
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      recordProviderFailure(provider, `HTTP ${res.status}`);
      logger.warn({ url, status: res.status }, `${provider} request failed`);
      return null;
    }
    const data = (await res.json()) as T;
    recordProviderSuccess(provider, performance.now() - startedAt);
    return data;
  } catch (err) {
    recordProviderFailure(provider, (err as Error).message);
    logger.warn({ url, err: (err as Error).message }, `${provider} request errored`);
    return null;
  }
}
