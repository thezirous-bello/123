import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { nowIso } from "../db/index.js";
import { recordProviderFailure, recordProviderSuccess } from "../lib/providerHealth.js";
import type { TokenSnapshot } from "./types.js";

const SOLANA_CHAIN_ID = "solana";

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  volume?: { m5?: number; h1?: number };
  priceChange?: { m5?: number; h1?: number };
  txns?: { m5?: { buys?: number; sells?: number } };
  pairCreatedAt?: number;
}

interface DexScreenerResponse {
  pairs: DexScreenerPair[] | null;
}

async function dexScreenerFetch(path: string): Promise<DexScreenerResponse | null> {
  const url = `${env.DEXSCREENER_API_URL}${path}`;
  const startedAt = performance.now();
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      logger.warn({ url, status: res.status }, "DexScreener request failed");
      recordProviderFailure("dexscreener", `HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as DexScreenerResponse;
    recordProviderSuccess("dexscreener", performance.now() - startedAt);
    return data;
  } catch (err) {
    logger.warn({ url, err: (err as Error).message }, "DexScreener request errored");
    recordProviderFailure("dexscreener", (err as Error).message);
    return null;
  }
}

function pairToSnapshot(pair: DexScreenerPair): TokenSnapshot {
  return {
    mint: pair.baseToken.address,
    symbol: pair.baseToken.symbol ?? null,
    name: pair.baseToken.name ?? null,
    priceUsd: pair.priceUsd ? Number.parseFloat(pair.priceUsd) : null,
    liquidityUsd: pair.liquidity?.usd ?? null,
    marketCapUsd: pair.marketCap ?? null,
    fdvUsd: pair.fdv ?? null,
    volume5mUsd: pair.volume?.m5 ?? null,
    volume1hUsd: pair.volume?.h1 ?? null,
    priceChange5mPct: pair.priceChange?.m5 ?? null,
    priceChange1hPct: pair.priceChange?.h1 ?? null,
    buys5m: pair.txns?.m5?.buys ?? null,
    sells5m: pair.txns?.m5?.sells ?? null,
    pairCreatedAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null,
    dexId: pair.dexId ?? null,
    pairAddress: pair.pairAddress ?? null,
    quoteSymbol: pair.quoteToken?.symbol ?? null,
    source: "dexscreener",
    fetchedAt: nowIso(),
  };
}

/** Fetches all known trading pairs for a mint address and returns the one
 * with the deepest liquidity as the token's canonical snapshot — never
 * identifies a token by symbol, always by mint address. */
export async function fetchTokenSnapshotByMint(mint: string): Promise<TokenSnapshot | null> {
  const data = await dexScreenerFetch(`/latest/dex/tokens/${mint}`);
  const pairs = (data?.pairs ?? []).filter(
    (p) => p.chainId === SOLANA_CHAIN_ID && p.baseToken.address === mint,
  );
  if (pairs.length === 0) return null;
  const best = pairs.reduce((a, b) => ((b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a));
  return pairToSnapshot(best);
}

/** Free-text search (name, symbol, or mint address) against DexScreener,
 * used by the token scanner. Deduplicated by mint, sorted by liquidity. */
export async function searchTokens(query: string, limit = 20): Promise<TokenSnapshot[]> {
  const data = await dexScreenerFetch(`/latest/dex/search?q=${encodeURIComponent(query)}`);
  const pairs = (data?.pairs ?? []).filter((p) => p.chainId === SOLANA_CHAIN_ID);
  const byMint = new Map<string, DexScreenerPair>();
  for (const pair of pairs) {
    const existing = byMint.get(pair.baseToken.address);
    if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      byMint.set(pair.baseToken.address, pair);
    }
  }
  return [...byMint.values()]
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
    .slice(0, limit)
    .map(pairToSnapshot);
}
