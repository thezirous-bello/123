/** Normalized token market data, regardless of which provider it came from.
 * Always keyed by mint address — never trust a symbol alone to identify a
 * token, since symbols are trivially spoofable.
 *
 * Every timeframe field is `null` when the provider genuinely doesn't
 * supply it — never fabricated. 1m/15m changes usually come from our own
 * stored snapshot history instead of a provider (see
 * snapshotService.deriveShortTermChanges), since DexScreener only exposes
 * 5m/1h/6h/24h windows. */
export interface TokenSnapshot {
  mint: string;
  symbol: string | null;
  name: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;

  // Volume by window (USD).
  volume5mUsd: number | null;
  volume1hUsd: number | null;
  volume6hUsd: number | null;
  volume24hUsd: number | null;
  /** Derived from our own stored snapshot history, not a provider field. */
  volume1mUsd: number | null;

  // Price change by window (%).
  priceChange5mPct: number | null;
  priceChange1hPct: number | null;
  priceChange6hPct: number | null;
  priceChange24hPct: number | null;
  /** Derived from our own stored snapshot history, not a provider field. */
  priceChange1mPct: number | null;
  /** Derived from our own stored snapshot history, not a provider field. */
  priceChange15mPct: number | null;

  // Trading activity (transaction counts) by window.
  buys5m: number | null;
  sells5m: number | null;
  buys1h: number | null;
  sells1h: number | null;
  buys6h: number | null;
  sells6h: number | null;
  buys24h: number | null;
  sells24h: number | null;

  pairCreatedAt: string | null;
  dexId: string | null;
  pairAddress: string | null;
  quoteSymbol: string | null;
  source: string;
  fetchedAt: string;
}

export interface OnChainMintInfo {
  mint: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  decimals: number;
  supply: string;
}

export interface HolderConcentration {
  top10Percentage: number | null;
  largestHolders: Array<{ address: string; percentage: number }>;
}

/** Best-effort enrichment from Birdeye, only ever used to fill gaps
 * DexScreener doesn't cover (finer time windows, unique trader counts).
 * Every field is independently nullable — a missing/unexpected response
 * shape degrades to "unavailable", never a fabricated value. */
export interface BirdeyeEnrichment {
  priceChange30mPct: number | null;
  priceChange2hPct: number | null;
  priceChange4hPct: number | null;
  priceChange8hPct: number | null;
  uniqueWallets24h: number | null;
  trades24h: number | null;
  buyVolume24hUsd: number | null;
  sellVolume24hUsd: number | null;
}
