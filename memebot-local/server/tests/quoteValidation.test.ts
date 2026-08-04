import { describe, expect, it } from "vitest";
import { validateQuote, type QuoteResponse } from "../src/jupiter/quote.js";

const SOL = "So11111111111111111111111111111111111111112";
const TOKEN = "MintAddress111111111111111111111111111111";

function baseQuote(overrides: Partial<QuoteResponse> = {}): QuoteResponse {
  return {
    inputMint: SOL,
    inAmount: "1000000000",
    outputMint: TOKEN,
    outAmount: "500000000",
    otherAmountThreshold: "490000000",
    swapMode: "ExactIn",
    slippageBps: 300,
    priceImpactPct: "0.01",
    routePlan: [{ swapInfo: { ammKey: "amm1", inputMint: SOL, outputMint: TOKEN, inAmount: "1000000000", outAmount: "500000000" }, percent: 100 }],
    fetchedAtMs: Date.now(),
    ...overrides,
  };
}

const limits = { expectedInputMint: SOL, expectedOutputMint: TOKEN, maxPriceImpactPct: 2, maxQuoteAgeSeconds: 20 };

describe("validateQuote", () => {
  it("accepts a fresh, well-formed quote within limits", () => {
    const result = validateQuote(baseQuote(), limits);
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("rejects a mismatched input mint", () => {
    const result = validateQuote(baseQuote({ inputMint: "SomeOtherMint1111111111111111111111111111" }), limits);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => /input mint/i.test(r))).toBe(true);
  });

  it("rejects a mismatched output mint", () => {
    const result = validateQuote(baseQuote({ outputMint: "SomeOtherMint1111111111111111111111111111" }), limits);
    expect(result.ok).toBe(false);
  });

  it("rejects a quote with an empty route", () => {
    const result = validateQuote(baseQuote({ routePlan: [] }), limits);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => /no route/i.test(r))).toBe(true);
  });

  it("rejects price impact above the configured maximum", () => {
    const result = validateQuote(baseQuote({ priceImpactPct: "0.05" }), limits); // 5% > 2% max
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => /price impact/i.test(r))).toBe(true);
  });

  it("rejects a stale quote", () => {
    const result = validateQuote(baseQuote({ fetchedAtMs: Date.now() - 30_000 }), limits); // 30s > 20s max
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => /quote is/i.test(r))).toBe(true);
  });

  it("rejects a quote with zero expected output", () => {
    const result = validateQuote(baseQuote({ outAmount: "0" }), limits);
    expect(result.ok).toBe(false);
  });
});
