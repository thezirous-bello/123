import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../lib/providerHealth.js";
import type { BirdeyeEnrichment } from "./types.js";

const BIRDEYE_API_URL = "https://public-api.birdeye.so";

interface BirdeyeOverviewResponse {
  success?: boolean;
  data?: {
    priceChange30mPercent?: number;
    priceChange2hPercent?: number;
    priceChange4hPercent?: number;
    priceChange8hPercent?: number;
    uniqueWallet24h?: number;
    trade24h?: number;
    vBuy24hUSD?: number;
    vSell24hUSD?: number;
  };
}

function num(v: number | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Best-effort enrichment from Birdeye's token-overview endpoint — entirely
 * optional (requires BIRDEYE_API_KEY), never required for the bot to
 * function, and never treated as authoritative over DexScreener/Jupiter. It
 * fills gaps those two don't cover (finer intraday price-change windows,
 * unique-trader counts). Any unexpected response shape or missing field
 * degrades to `null` for that field rather than guessing — see
 * BirdeyeEnrichment's doc comment. Callers should only call this for a
 * bounded shortlist of tokens (the strategy's actual scan set), not the
 * full watchlist, to respect Birdeye's rate limits on a free-tier key. */
export async function fetchBirdeyeEnrichment(mint: string): Promise<BirdeyeEnrichment | null> {
  if (!env.BIRDEYE_API_KEY) return null;

  const url = `${BIRDEYE_API_URL}/defi/token_overview?address=${encodeURIComponent(mint)}`;
  const startedAt = performance.now();
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "X-API-KEY": env.BIRDEYE_API_KEY,
        "x-chain": "solana",
      },
    });
    if (!res.ok) {
      logger.warn({ url, status: res.status }, "Birdeye request failed");
      recordProviderFailure("birdeye", `HTTP ${res.status}`);
      return null;
    }
    const body = (await res.json()) as BirdeyeOverviewResponse;
    recordProviderSuccess("birdeye", performance.now() - startedAt);
    if (!body.success || !body.data) return null;

    const d = body.data;
    const buyVolume24hUsd = num(d.vBuy24hUSD);
    const sellVolume24hUsd = num(d.vSell24hUSD);
    return {
      priceChange30mPct: num(d.priceChange30mPercent),
      priceChange2hPct: num(d.priceChange2hPercent),
      priceChange4hPct: num(d.priceChange4hPercent),
      priceChange8hPct: num(d.priceChange8hPercent),
      uniqueWallets24h: typeof d.uniqueWallet24h === "number" ? Math.round(d.uniqueWallet24h) : null,
      trades24h: typeof d.trade24h === "number" ? Math.round(d.trade24h) : null,
      buyVolume24hUsd,
      sellVolume24hUsd,
    };
  } catch (err) {
    logger.warn({ mint, err: (err as Error).message }, "Birdeye request errored");
    recordProviderFailure("birdeye", (err as Error).message);
    return null;
  }
}
