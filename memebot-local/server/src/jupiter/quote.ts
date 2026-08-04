import { env } from "../env.js";
import { logger } from "../lib/logger.js";

export interface RoutePlanStep {
  swapInfo: { ammKey: string; label?: string; inputMint: string; outputMint: string; inAmount: string; outAmount: string };
  percent: number | null;
}

export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: "ExactIn" | "ExactOut";
  slippageBps: number;
  priceImpactPct: string;
  routePlan: RoutePlanStep[];
  contextSlot?: number;
  timeTaken?: number;
  /** Local timestamp (ms) this quote was fetched, used for freshness checks. */
  fetchedAtMs: number;
}

export interface GetQuoteParams {
  inputMint: string;
  outputMint: string;
  amountBaseUnits: string;
  slippageBps: number;
}

function jupiterHeaders(): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (env.JUPITER_API_KEY) headers["x-api-key"] = env.JUPITER_API_KEY;
  return headers;
}

/** Requests a swap quote from Jupiter. Returns null (never throws) on any
 * failure — callers must treat a null quote as "cannot trade right now". */
export async function getQuote(params: GetQuoteParams): Promise<QuoteResponse | null> {
  const url = new URL(`${env.JUPITER_API_URL}/quote`);
  url.searchParams.set("inputMint", params.inputMint);
  url.searchParams.set("outputMint", params.outputMint);
  url.searchParams.set("amount", params.amountBaseUnits);
  url.searchParams.set("slippageBps", String(params.slippageBps));
  url.searchParams.set("swapMode", "ExactIn");

  try {
    const res = await fetch(url, { headers: jupiterHeaders() });
    if (!res.ok) {
      logger.warn({ url: url.toString(), status: res.status }, "Jupiter quote request failed");
      return null;
    }
    const data = (await res.json()) as Omit<QuoteResponse, "fetchedAtMs">;
    return { ...data, fetchedAtMs: Date.now() };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Jupiter quote request errored");
    return null;
  }
}

export interface QuoteValidationLimits {
  expectedInputMint: string;
  expectedOutputMint: string;
  maxPriceImpactPct: number;
  maxQuoteAgeSeconds: number;
}

export interface QuoteValidationResult {
  ok: boolean;
  reasons: string[];
}

/**
 * Never trust quote data blindly. Re-checks everything the risk engine
 * cares about directly on the quote object right before it is used to build
 * a transaction: correct mints, a non-empty route, price impact within
 * strategy/account limits, and that the quote hasn't gone stale while other
 * checks were running.
 */
export function validateQuote(quote: QuoteResponse, limits: QuoteValidationLimits): QuoteValidationResult {
  const reasons: string[] = [];

  if (quote.inputMint !== limits.expectedInputMint) reasons.push("Quote input mint does not match the requested token.");
  if (quote.outputMint !== limits.expectedOutputMint) reasons.push("Quote output mint does not match the requested token.");
  if (!quote.routePlan || quote.routePlan.length === 0) reasons.push("Quote has no route.");

  const priceImpact = Number.parseFloat(quote.priceImpactPct);
  if (!Number.isFinite(priceImpact)) reasons.push("Quote price impact is not a valid number.");
  else if (priceImpact * 100 > limits.maxPriceImpactPct) {
    reasons.push(`Price impact ${(priceImpact * 100).toFixed(2)}% exceeds the maximum of ${limits.maxPriceImpactPct}%.`);
  }

  const ageSeconds = (Date.now() - quote.fetchedAtMs) / 1000;
  if (ageSeconds > limits.maxQuoteAgeSeconds) {
    reasons.push(`Quote is ${ageSeconds.toFixed(1)}s old, exceeding the ${limits.maxQuoteAgeSeconds}s freshness limit.`);
  }

  const outAmount = BigInt(quote.outAmount);
  if (outAmount <= 0n) reasons.push("Quote expected output amount is zero.");

  return { ok: reasons.length === 0, reasons };
}

/** Lightweight route-existence + price-impact check used by the token
 * security analysis (does NOT execute or build a transaction). */
export async function checkSellRoute(
  mint: string,
  amountBaseUnits: string,
  quoteMint: string,
): Promise<{ exists: boolean; priceImpactPct: number | null }> {
  const quote = await getQuote({
    inputMint: mint,
    outputMint: quoteMint,
    amountBaseUnits,
    slippageBps: 500,
  });
  if (!quote || quote.routePlan.length === 0) return { exists: false, priceImpactPct: null };
  const priceImpact = Number.parseFloat(quote.priceImpactPct);
  return { exists: true, priceImpactPct: Number.isFinite(priceImpact) ? priceImpact * 100 : null };
}
