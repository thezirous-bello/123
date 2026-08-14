/**
 * Shared request pacing across every CoinGecko call this app makes (coin
 * identity refresh in identity.ts, market-cap refresh in marketCap.ts) —
 * a single global gate, not one per caller, since two independent limiters
 * running concurrently would together exceed CoinGecko's actual rate limit
 * even if each individually looks safe on its own.
 */

// CoinGecko's free public tier allows roughly 10-30 requests/min; 6.5s
// keeps this app under ~9/min even in the worst case across every caller.
const MIN_REQUEST_GAP_MS = 6500;
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 30_000;

let nextSlotAtMs = 0;

export async function waitForCoinGeckoSlot(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, nextSlotAtMs - now);
  nextSlotAtMs = Math.max(now, nextSlotAtMs) + MIN_REQUEST_GAP_MS;
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

/** Call after a 429 response to push every subsequent request (from any
 * caller) out by the rate-limited backoff, instead of just this one. */
export function backOffAfterRateLimit(retryAfterHeader: string | null): number {
  const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
  const backoffMs = Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : DEFAULT_RATE_LIMIT_BACKOFF_MS;
  nextSlotAtMs = Date.now() + backoffMs;
  return backoffMs;
}

/** Test-only: this module's pacing state persists across the whole process,
 * so tests that make several calls in a row need a clean slate to avoid a
 * real multi-second wait bleeding in from another test's timing. */
export function _resetCoinGeckoRateLimitStateForTests(): void {
  nextSlotAtMs = 0;
}
