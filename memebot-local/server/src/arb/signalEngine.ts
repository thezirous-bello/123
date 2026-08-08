import { EXCHANGE_REGISTRY, type ExchangeId, type TickerQuote } from "./exchanges/index.js";
import type { ArbStrategyConfig } from "./schema.js";

export interface SpreadOpportunity {
  symbol: string;
  buyExchange: ExchangeId;
  buyPrice: number;
  sellExchange: ExchangeId;
  sellPrice: number;
  grossSpreadPct: number;
  netSpreadPct: number;
}

function takerFeePctFor(exchangeId: ExchangeId, config: ArbStrategyConfig): number {
  return config.takerFeePctOverride ?? EXCHANGE_REGISTRY[exchangeId].defaultTakerFeePct;
}

/** For one symbol: buy where the ask is lowest, sell where the bid is
 * highest, across whichever exchanges actually quote it. Returns null if
 * fewer than two exchanges have a quote, or if buy/sell land on the same
 * exchange (not a cross-exchange spread). Net spread already subtracts
 * both legs' taker fees and a configurable safety buffer — this is a pure
 * function, it does NOT decide whether to act on the result (that's
 * config.minNetSpreadPct, applied by the caller). */
export function findBestOpportunity(symbol: string, tickersByExchange: Map<ExchangeId, Map<string, TickerQuote>>, config: ArbStrategyConfig): SpreadOpportunity | null {
  const quotes: Array<{ exchange: ExchangeId; quote: TickerQuote }> = [];
  for (const [exchange, tickers] of tickersByExchange) {
    const quote = tickers.get(symbol);
    if (quote) quotes.push({ exchange, quote });
  }
  if (quotes.length < 2) return null;

  const cheapest = quotes.reduce((best, c) => (c.quote.ask < best.quote.ask ? c : best));
  const priciest = quotes.reduce((best, c) => (c.quote.bid > best.quote.bid ? c : best));
  if (cheapest.exchange === priciest.exchange) return null;
  if (!(cheapest.quote.ask > 0) || !(priciest.quote.bid > 0)) return null;

  const grossSpreadPct = ((priciest.quote.bid - cheapest.quote.ask) / cheapest.quote.ask) * 100;
  const totalFeePct = takerFeePctFor(cheapest.exchange, config) + takerFeePctFor(priciest.exchange, config);
  const netSpreadPct = grossSpreadPct - totalFeePct - config.safetyBufferPct;

  return {
    symbol,
    buyExchange: cheapest.exchange,
    buyPrice: cheapest.quote.ask,
    sellExchange: priciest.exchange,
    sellPrice: priciest.quote.bid,
    grossSpreadPct,
    netSpreadPct,
  };
}

/** Runs findBestOpportunity across every configured symbol, returning only
 * the ones where at least two exchanges quoted a price (skips symbols no
 * configured exchange lists, rather than erroring). */
export function scanAllSymbols(tickersByExchange: Map<ExchangeId, Map<string, TickerQuote>>, config: ArbStrategyConfig): SpreadOpportunity[] {
  const results: SpreadOpportunity[] = [];
  for (const symbol of config.symbols) {
    const opportunity = findBestOpportunity(symbol, tickersByExchange, config);
    if (opportunity) results.push(opportunity);
  }
  return results;
}
