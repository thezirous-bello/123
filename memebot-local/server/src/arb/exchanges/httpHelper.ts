import { logger } from "../../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../../lib/providerHealth.js";
import type { ProviderId } from "../../lib/providerHealth.js";

// Node's built-in fetch sends no User-Agent header at all unless one is set
// explicitly (unlike a browser) — some exchanges' API gateways treat a
// missing/non-browser-like User-Agent as a bot signal and reject the
// request (often with a generic 400 rather than 403), independent of
// whether the request is otherwise well-formed. A plain, honest UA fixes
// that class of failure without pretending to be a real browser.
const USER_AGENT = "memebot-local/1.0 (+https://github.com)";
const ERROR_BODY_PREVIEW_CHARS = 300;

/** Shared fetch-JSON-and-track-provider-health helper for the arb bot's
 * exchange adapters — every one of them is a single public, unauthenticated
 * "all tickers" GET, so there's no reason to duplicate this per adapter.
 * Returns null (never throws) on any failure so the scan loop can just skip
 * whichever exchange is down for that cycle instead of failing the whole
 * scan. On a non-OK response, logs a preview of the response body (not just
 * the status code) — exchange APIs usually explain a 400 in the body, and
 * guessing at the cause without that is how a wrong "fix" ships. */
export async function fetchJson<T>(provider: ProviderId, url: string): Promise<T | null> {
  const startedAt = performance.now();
  try {
    const res = await fetch(url, { headers: { accept: "application/json", "user-agent": USER_AGENT } });
    if (!res.ok) {
      const bodyPreview = await res
        .text()
        .then((t) => t.slice(0, ERROR_BODY_PREVIEW_CHARS))
        .catch(() => "");
      recordProviderFailure(provider, `HTTP ${res.status}${bodyPreview ? `: ${bodyPreview}` : ""}`);
      logger.warn({ url, status: res.status, body: bodyPreview }, `${provider} request failed`);
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
