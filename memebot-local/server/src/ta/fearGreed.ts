import { logger } from "../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../lib/providerHealth.js";

// alternative.me's Crypto Fear & Greed Index — free, no API key, documented
// at https://alternative.me/crypto/fear-and-greed-index. Updates once daily.
const FNG_URL = "https://api.alternative.me/fng/?limit=1&format=json";
const FNG_TREND_URL = "https://api.alternative.me/fng/?limit=2&format=json";

interface FngResponse {
  data: Array<{ value: string; value_classification: string; timestamp: string }>;
}

export interface FearGreedReading {
  value: number;
  classification: string;
  fetchedAt: string;
}

let cached: FearGreedReading | null = null;
let cachedAt = 0;
const CACHE_MS = 15 * 60_000; // updates daily server-side; no reason to refetch more than every 15m

export async function getFearGreedIndex(): Promise<FearGreedReading | null> {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  const startedAt = performance.now();
  try {
    const res = await fetch(FNG_URL, { headers: { accept: "application/json" } });
    if (!res.ok) {
      recordProviderFailure("fearGreed", `HTTP ${res.status}`);
      return cached;
    }
    const data = (await res.json()) as FngResponse;
    const row = data.data[0];
    if (!row) return cached;
    recordProviderSuccess("fearGreed", performance.now() - startedAt);
    cached = { value: Number(row.value), classification: row.value_classification, fetchedAt: new Date().toISOString() };
    cachedAt = Date.now();
    return cached;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Fear & Greed index request failed");
    recordProviderFailure("fearGreed", (err as Error).message);
    return cached;
  }
}

let cachedTrend: FearGreedReading[] | null = null;
let cachedTrendAt = 0;

/** Today's reading plus yesterday's, oldest-first — lets a caller detect
 * whether the index is actually rising or falling, not just its level. */
export async function getFearGreedTrend(): Promise<FearGreedReading[] | null> {
  if (cachedTrend && Date.now() - cachedTrendAt < CACHE_MS) return cachedTrend;
  const startedAt = performance.now();
  try {
    const res = await fetch(FNG_TREND_URL, { headers: { accept: "application/json" } });
    if (!res.ok) {
      recordProviderFailure("fearGreed", `HTTP ${res.status}`);
      return cachedTrend;
    }
    const data = (await res.json()) as FngResponse;
    if (data.data.length === 0) return cachedTrend;
    recordProviderSuccess("fearGreed", performance.now() - startedAt);
    cachedTrend = data.data
      .map((row) => ({ value: Number(row.value), classification: row.value_classification, fetchedAt: new Date().toISOString() }))
      .reverse();
    cachedTrendAt = Date.now();
    return cachedTrend;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Fear & Greed trend request failed");
    recordProviderFailure("fearGreed", (err as Error).message);
    return cachedTrend;
  }
}
