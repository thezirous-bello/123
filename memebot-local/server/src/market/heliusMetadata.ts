import { env } from "../env.js";
import { logger } from "../lib/logger.js";

interface HeliusAssetMetadata {
  name: string | null;
  symbol: string | null;
}

/** Optional fallback for token name/symbol via Helius's DAS `getAsset` method,
 * only used when DexScreener has no pair data for a mint yet (e.g. a
 * brand-new token) and only if HELIUS_API_KEY is configured. */
export async function fetchHeliusAssetMetadata(mint: string): Promise<HeliusAssetMetadata | null> {
  if (!env.HELIUS_API_KEY) return null;
  const url = `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "memebot-local", method: "getAsset", params: { id: mint } }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      result?: { content?: { metadata?: { name?: string; symbol?: string } } };
    };
    const metadata = body.result?.content?.metadata;
    if (!metadata) return null;
    return { name: metadata.name ?? null, symbol: metadata.symbol ?? null };
  } catch (err) {
    logger.warn({ mint, err: (err as Error).message }, "Helius asset metadata lookup failed");
    return null;
  }
}
