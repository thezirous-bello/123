import { describe, expect, it } from "vitest";
import { findBestOpportunity, scanAllSymbols } from "../src/arb/signalEngine.js";
import { ArbStrategyConfigSchema, DEFAULT_ARB_SYMBOLS } from "../src/arb/schema.js";
import type { ExchangeId, TickerQuote } from "../src/arb/exchanges/index.js";

describe("DEFAULT_ARB_SYMBOLS", () => {
  it("has no duplicate symbols (case-insensitive) — a duplicate would fail schema validation", () => {
    const upper = DEFAULT_ARB_SYMBOLS.map((s) => s.toUpperCase());
    expect(new Set(upper).size).toBe(upper.length);
  });

  it("is a wide default watchlist (~500 coins)", () => {
    expect(DEFAULT_ARB_SYMBOLS.length).toBeGreaterThanOrEqual(400);
  });

  it("parses successfully as the schema default (exercises the superRefine duplicate check for real)", () => {
    const result = ArbStrategyConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.symbols.length).toBe(DEFAULT_ARB_SYMBOLS.length);
  });
});

function tickers(entries: Array<[ExchangeId, string, TickerQuote]>): Map<ExchangeId, Map<string, TickerQuote>> {
  const out = new Map<ExchangeId, Map<string, TickerQuote>>();
  for (const [exchange, symbol, quote] of entries) {
    if (!out.has(exchange)) out.set(exchange, new Map());
    out.get(exchange)!.set(symbol, quote);
  }
  return out;
}

const config = ArbStrategyConfigSchema.parse({ takerFeePctOverride: 0.1, safetyBufferPct: 0.05 });

describe("findBestOpportunity", () => {
  it("finds the cheapest ask and highest bid across exchanges and computes gross/net spread", () => {
    const map = tickers([
      ["binance", "BTC", { bid: 64_900, ask: 64_910 }],
      ["okx", "BTC", { bid: 64_950, ask: 64_960 }], // best bid here
      ["kucoin", "BTC", { bid: 64_845, ask: 64_850 }], // best (lowest) ask here
    ]);
    const opp = findBestOpportunity("BTC", map, config);
    expect(opp).not.toBeNull();
    expect(opp!.buyExchange).toBe("kucoin");
    expect(opp!.buyPrice).toBe(64_850);
    expect(opp!.sellExchange).toBe("okx");
    expect(opp!.sellPrice).toBe(64_950);
    // gross = (64950-64850)/64850*100
    expect(opp!.grossSpreadPct).toBeCloseTo(((64_950 - 64_850) / 64_850) * 100, 5);
    // net = gross - (0.1+0.1) - 0.05
    expect(opp!.netSpreadPct).toBeCloseTo(opp!.grossSpreadPct - 0.25, 5);
  });

  it("returns null when fewer than two exchanges quote the symbol", () => {
    const map = tickers([["binance", "BTC", { bid: 100, ask: 101 }]]);
    expect(findBestOpportunity("BTC", map, config)).toBeNull();
  });

  it("returns null when the cheapest ask and highest bid are on the same exchange", () => {
    // binance has both the lowest ask (64990) AND the highest bid (65000) —
    // okx's much wider spread never wins either side, so no cross-exchange
    // pairing exists.
    const map = tickers([
      ["binance", "BTC", { bid: 65_000, ask: 64_990 }],
      ["okx", "BTC", { bid: 64_800, ask: 65_100 }],
    ]);
    const opp = findBestOpportunity("BTC", map, config);
    expect(opp).toBeNull();
  });

  it("returns a negative net spread (not null) when fees exceed the gross spread — caller decides to skip", () => {
    const map = tickers([
      ["binance", "BTC", { bid: 65_000, ask: 65_005 }], // tiny 0.03% gross spread
      ["okx", "BTC", { bid: 65_010, ask: 65_015 }],
    ]);
    const opp = findBestOpportunity("BTC", map, config);
    expect(opp).not.toBeNull();
    expect(opp!.netSpreadPct).toBeLessThan(0);
  });
});

describe("scanAllSymbols", () => {
  it("returns one opportunity per symbol that has quotes on at least two exchanges", () => {
    const map = tickers([
      ["binance", "BTC", { bid: 64_900, ask: 64_910 }],
      ["okx", "BTC", { bid: 64_950, ask: 64_960 }],
      ["binance", "ETH", { bid: 3_400, ask: 3_401 }],
      // SOL only on one exchange -> should be skipped
      ["binance", "SOL", { bid: 150, ask: 150.1 }],
    ]);
    const cfg = ArbStrategyConfigSchema.parse({ symbols: ["BTC", "ETH", "SOL"], takerFeePctOverride: 0.1 });
    const results = scanAllSymbols(map, cfg);
    const symbols = results.map((r) => r.symbol).sort();
    expect(symbols).toEqual(["BTC"]); // ETH and SOL are each quoted on only one exchange above
  });
});
