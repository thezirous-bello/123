import { Decimal } from "../lib/decimal.js";
import { getQuote } from "../jupiter/quote.js";
import { SOL_DECIMALS, SOL_MINT, USDC_MINT } from "../jupiter/constants.js";
import { fetchTokenSnapshotByMint } from "./dexscreener.js";

let cachedSolPrice: { value: Decimal; fetchedAtMs: number } | null = null;
const SOL_PRICE_CACHE_MS = 15_000;

/** USD price of 1 SOL, used to convert simulated network/priority fees (paid
 * in lamports) into dollars for paper-trading PnL and dashboard display.
 * Cached briefly to avoid hammering providers on every fee calculation. */
export async function getSolUsdPrice(): Promise<Decimal> {
  if (cachedSolPrice && Date.now() - cachedSolPrice.fetchedAtMs < SOL_PRICE_CACHE_MS) {
    return cachedSolPrice.value;
  }

  const snapshot = await fetchTokenSnapshotByMint(SOL_MINT);
  if (snapshot?.priceUsd) {
    cachedSolPrice = { value: new Decimal(snapshot.priceUsd), fetchedAtMs: Date.now() };
    return cachedSolPrice.value;
  }

  const quote = await getQuote({
    inputMint: SOL_MINT,
    outputMint: USDC_MINT,
    amountBaseUnits: String(10 ** SOL_DECIMALS),
    slippageBps: 100,
  });
  if (quote) {
    const price = new Decimal(quote.outAmount).div(10 ** 6);
    cachedSolPrice = { value: price, fetchedAtMs: Date.now() };
    return price;
  }

  // Last resort: keep the previous cached value even if stale, rather than
  // returning zero and corrupting fee math.
  return cachedSolPrice?.value ?? new Decimal(150);
}

export function getQuoteTokenUsdPrice(quoteToken: "SOL" | "USDC"): Promise<Decimal> {
  if (quoteToken === "USDC") return Promise.resolve(new Decimal(1));
  return getSolUsdPrice();
}
