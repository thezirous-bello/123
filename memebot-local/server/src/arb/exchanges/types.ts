export type ExchangeId = "binance" | "bybit" | "okx" | "kucoin" | "gateio" | "mexc" | "kraken" | "bitstamp";

export interface TickerQuote {
  bid: number; // best bid — what you'd receive per unit selling right now
  ask: number; // best ask — what you'd pay per unit buying right now
}

export interface ExchangeAdapter {
  id: ExchangeId;
  label: string;
  /** Typical taker fee for a market order, as a percentage (0.1 = 0.1%).
   * Used to estimate round-trip cost when the strategy config doesn't
   * override it — real fees vary by account tier/volume, this is a
   * reasonable public default per exchange. */
  defaultTakerFeePct: number;
  /** Fetches best bid/ask for every symbol this exchange lists, keyed by
   * base coin (e.g. "BTC", not "BTCUSDT"). Filters down to `symbols` where
   * the adapter can cheaply do so. Returns null on any fetch failure. */
  fetchTickers(symbols: string[]): Promise<Map<string, TickerQuote> | null>;
}
