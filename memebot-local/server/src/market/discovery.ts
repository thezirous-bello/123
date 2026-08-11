import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../lib/providerHealth.js";

const SOLANA_CHAIN_ID = "solana";

interface DexScreenerDiscoveryItem {
  chainId?: string;
  tokenAddress?: string;
}

/** Returns null (not just an empty array) on a failed/errored request, so
 * the caller can tell "DexScreener responded with zero trending tokens
 * right now" apart from "the request itself never succeeded" — the two
 * previously looked identical from the outside, which is exactly what made
 * a real connectivity problem invisible on the dashboard (see
 * discoverTrendingSolanaMints below). Reports to the same provider-health
 * tracker every other market-data call uses, so a failing discovery pass
 * now shows up in the network map / CALLS-FAILED counters instead of
 * looking like the bot simply isn't doing anything. */
async function fetchDiscoveryList(path: string): Promise<DexScreenerDiscoveryItem[] | null> {
  const startedAt = performance.now();
  try {
    const res = await fetch(`${env.DEXSCREENER_API_URL}${path}`, { headers: { accept: "application/json" } });
    if (!res.ok) {
      logger.warn({ path, status: res.status }, "token discovery request failed");
      recordProviderFailure("dexscreener", `HTTP ${res.status} on ${path}`);
      return null;
    }
    const data = (await res.json()) as unknown;
    recordProviderSuccess("dexscreener", performance.now() - startedAt);
    return Array.isArray(data) ? (data as DexScreenerDiscoveryItem[]) : [];
  } catch (err) {
    logger.warn({ path, err: (err as Error).message }, "token discovery request errored");
    recordProviderFailure("dexscreener", (err as Error).message);
    return null;
  }
}

export interface DiscoveryResult {
  mints: string[];
  /** False only when BOTH feed requests failed outright (network error, DNS,
   * firewall, non-2xx) — distinct from "the requests succeeded but returned
   * zero trending tokens right now", which is a normal, quiet outcome. */
  requestsOk: boolean;
  /** Human-readable reason for each feed that failed, empty when both (or
   * whichever were reachable) succeeded. */
  errors: string[];
}

/**
 * Pulls candidate Solana mint addresses from DexScreener's public
 * "boosted" and "latest profiled" token feeds — no scan of "every possible
 * token" is realistic or honest to promise (there are hundreds of
 * thousands of SPL tokens), but this gives a continuously refreshed set of
 * actively-promoted/trending tokens without the user manually searching
 * and clicking "Watch" on each one. No API key required.
 */
export async function discoverTrendingSolanaMints(limit = 30): Promise<DiscoveryResult> {
  const [boosted, profiled] = await Promise.all([
    fetchDiscoveryList("/token-boosts/latest/v1"),
    fetchDiscoveryList("/token-profiles/latest/v1"),
  ]);

  const errors: string[] = [];
  if (boosted === null) errors.push("the boosted-tokens feed request failed");
  if (profiled === null) errors.push("the token-profiles feed request failed");

  const seen = new Set<string>();
  const mints: string[] = [];
  for (const item of [...(boosted ?? []), ...(profiled ?? [])]) {
    if (item.chainId !== SOLANA_CHAIN_ID || !item.tokenAddress) continue;
    if (seen.has(item.tokenAddress)) continue;
    seen.add(item.tokenAddress);
    mints.push(item.tokenAddress);
    if (mints.length >= limit) break;
  }
  return { mints, requestsOk: boosted !== null || profiled !== null, errors };
}
