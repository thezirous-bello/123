import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../lib/providerHealth.js";

const JUPITER_PRICE_API_URL = "https://lite-api.jup.ag/price/v2";

interface JupiterPriceResponse {
  data?: Record<string, { id: string; price: string } | undefined>;
}

/** Bare USD price from Jupiter's Price API — used only as a fallback when
 * DexScreener has no pair for a mint yet (brand-new token, indexing lag, or
 * a provider outage), so the bot doesn't depend on a single market-data
 * source for something as basic as "does this token have a price at all".
 * Deliberately returns only a price, never fabricated volume/liquidity —
 * those stay null when DexScreener can't be reached, which callers must
 * treat as "insufficient data", not zero. */
export async function fetchJupiterPriceOnly(mint: string): Promise<number | null> {
  const url = `${JUPITER_PRICE_API_URL}?ids=${encodeURIComponent(mint)}`;
  const startedAt = performance.now();
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      logger.warn({ url, status: res.status }, "Jupiter price fallback request failed");
      recordProviderFailure("jupiterPrice", `HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as JupiterPriceResponse;
    recordProviderSuccess("jupiterPrice", performance.now() - startedAt);
    const entry = data.data?.[mint];
    if (!entry?.price) return null;
    const price = Number.parseFloat(entry.price);
    return Number.isFinite(price) ? price : null;
  } catch (err) {
    logger.warn({ mint, err: (err as Error).message }, "Jupiter price fallback errored");
    recordProviderFailure("jupiterPrice", (err as Error).message);
    return null;
  }
}
