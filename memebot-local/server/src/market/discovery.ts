import { env } from "../env.js";
import { logger } from "../lib/logger.js";

const SOLANA_CHAIN_ID = "solana";

interface DexScreenerDiscoveryItem {
  chainId?: string;
  tokenAddress?: string;
}

async function fetchDiscoveryList(path: string): Promise<DexScreenerDiscoveryItem[]> {
  try {
    const res = await fetch(`${env.DEXSCREENER_API_URL}${path}`, { headers: { accept: "application/json" } });
    if (!res.ok) {
      logger.warn({ path, status: res.status }, "token discovery request failed");
      return [];
    }
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as DexScreenerDiscoveryItem[]) : [];
  } catch (err) {
    logger.warn({ path, err: (err as Error).message }, "token discovery request errored");
    return [];
  }
}

/**
 * Pulls candidate Solana mint addresses from DexScreener's public
 * "boosted" and "latest profiled" token feeds — no scan of "every possible
 * token" is realistic or honest to promise (there are hundreds of
 * thousands of SPL tokens), but this gives a continuously refreshed set of
 * actively-promoted/trending tokens without the user manually searching
 * and clicking "Watch" on each one. No API key required.
 */
export async function discoverTrendingSolanaMints(limit = 30): Promise<string[]> {
  const [boosted, profiled] = await Promise.all([
    fetchDiscoveryList("/token-boosts/latest/v1"),
    fetchDiscoveryList("/token-profiles/latest/v1"),
  ]);

  const seen = new Set<string>();
  const mints: string[] = [];
  for (const item of [...boosted, ...profiled]) {
    if (item.chainId !== SOLANA_CHAIN_ID || !item.tokenAddress) continue;
    if (seen.has(item.tokenAddress)) continue;
    seen.add(item.tokenAddress);
    mints.push(item.tokenAddress);
    if (mints.length >= limit) break;
  }
  return mints;
}
