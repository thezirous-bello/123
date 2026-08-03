/** Normalized token market data, regardless of which provider it came from.
 * Always keyed by mint address — never trust a symbol alone to identify a
 * token, since symbols are trivially spoofable. */
export interface TokenSnapshot {
  mint: string;
  symbol: string | null;
  name: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  volume5mUsd: number | null;
  volume1hUsd: number | null;
  priceChange5mPct: number | null;
  priceChange1hPct: number | null;
  buys5m: number | null;
  sells5m: number | null;
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
