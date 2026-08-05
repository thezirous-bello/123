import { logger } from "../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../lib/providerHealth.js";

// alternative.me's Crypto Fear & Greed Index — free, no API key, documented
// at https://alternative.me/crypto/fear-and-greed-index. Updates once daily.
const FNG_URL = "https://api.alternative.me/fng/?limit=1&format=json";

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
