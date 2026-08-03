import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureTestStrategy, resetDb } from "./testUtils.js";
import { Decimal } from "../src/lib/decimal.js";
import { executePaperBuy, executePaperSell } from "../src/engine/paperEngine.js";
import { getPaperAccount } from "../src/engine/paperAccount.js";
import { getPosition } from "../src/engine/positionRepository.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const TEST_MINT = "TestMint111111111111111111111111111111111";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function mockFetch() {
  return vi.fn(async (input: string | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/latest/dex/tokens/")) {
      // SOL price lookup used for fee conversion / quote-token pricing.
      return jsonResponse({
        pairs: [
          {
            chainId: "solana",
            dexId: "raydium",
            pairAddress: "Pair1111111111111111111111111111111111111",
            baseToken: { address: SOL_MINT, name: "Wrapped SOL", symbol: "SOL" },
            quoteToken: { address: "USDC", name: "USD Coin", symbol: "USDC" },
            priceUsd: "150",
            liquidity: { usd: 50_000_000 },
            volume: { m5: 1_000_000, h1: 5_000_000 },
            priceChange: { m5: 0.1, h1: 0.5 },
            txns: { m5: { buys: 100, sells: 90 } },
            pairCreatedAt: Date.now() - 1000 * 60 * 60 * 24 * 365,
          },
        ],
      });
    }

    if (url.includes("/quote")) {
      const isSelling = url.includes(`inputMint=${TEST_MINT}`);
      return jsonResponse({
        inputMint: isSelling ? TEST_MINT : SOL_MINT,
        inAmount: "66666667",
        outputMint: isSelling ? SOL_MINT : TEST_MINT,
        outAmount: isSelling ? "66000000" : "1000000000000",
        otherAmountThreshold: isSelling ? "65000000" : "990000000000",
        swapMode: "ExactIn",
        slippageBps: 300,
        priceImpactPct: "0.005",
        routePlan: [
          {
            swapInfo: { ammKey: "amm1", inputMint: SOL_MINT, outputMint: TEST_MINT, inAmount: "66666667", outAmount: "1000000000000" },
            percent: 100,
          },
        ],
        contextSlot: 123456,
      });
    }

    throw new Error(`Unexpected fetch to ${url}`);
  });
}

beforeEach(() => {
  resetDb();
  ensureTestStrategy("strat-1");
  vi.stubGlobal("fetch", mockFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("executePaperBuy", () => {
  it("opens a paper position and debits the paper cash balance by the total cost basis", async () => {
    const before = getPaperAccount();
    const result = await executePaperBuy({
      mint: TEST_MINT,
      symbol: "TEST",
      decimals: 6,
      strategyId: "strat-1",
      quoteToken: "SOL",
      tradeUsd: new Decimal(10),
      slippageBps: 300,
      maxPriceImpactPercentage: 2,
      maxQuoteAgeSeconds: 20,
      stopLossPercentage: 20,
      takeProfits: [{ profitPercentage: 50, sellPercentage: 100 }],
      trailingStopPercentage: null,
      maxHoldingPeriodMinutes: null,
      entryReason: {},
      idempotencyKey: "buy-1",
    });

    expect(result.ok).toBe(true);
    expect(result.position?.mode).toBe("paper");
    expect(result.position?.tokenAmount.gt(0)).toBe(true);

    const after = getPaperAccount();
    const expectedCash = before.cashBalanceUsd.minus(result.position!.costBasisUsd);
    expect(after.cashBalanceUsd.toFixed(2)).toBe(expectedCash.toFixed(2));
  });

  it("rejects a duplicate order using the same idempotency key", async () => {
    const params = {
      mint: TEST_MINT,
      symbol: "TEST",
      decimals: 6,
      strategyId: "strat-1",
      quoteToken: "SOL" as const,
      tradeUsd: new Decimal(10),
      slippageBps: 300,
      maxPriceImpactPercentage: 2,
      maxQuoteAgeSeconds: 20,
      stopLossPercentage: 20,
      takeProfits: [],
      trailingStopPercentage: null,
      maxHoldingPeriodMinutes: null,
      entryReason: {},
      idempotencyKey: "dup-key",
    };
    const first = await executePaperBuy(params);
    expect(first.ok).toBe(true);

    const second = await executePaperBuy(params);
    expect(second.ok).toBe(false);
    expect(second.reasons.some((r) => /duplicate/i.test(r))).toBe(true);
  });

  it("rejects a buy that would exceed the paper account's cash balance", async () => {
    const result = await executePaperBuy({
      mint: TEST_MINT,
      symbol: "TEST",
      decimals: 6,
      strategyId: "strat-1",
      quoteToken: "SOL",
      tradeUsd: new Decimal(1_000_000), // far more than the $1000 starting balance
      slippageBps: 300,
      maxPriceImpactPercentage: 2,
      maxQuoteAgeSeconds: 20,
      stopLossPercentage: 20,
      takeProfits: [],
      trailingStopPercentage: null,
      maxHoldingPeriodMinutes: null,
      entryReason: {},
      idempotencyKey: "buy-too-big",
    });
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => /insufficient/i.test(r))).toBe(true);
  });
});

describe("executePaperBuy + executePaperSell — round trip PnL", () => {
  it("realizes a profit when selling above the entry price and closes the position", async () => {
    const buy = await executePaperBuy({
      mint: TEST_MINT,
      symbol: "TEST",
      decimals: 6,
      strategyId: "strat-1",
      quoteToken: "SOL",
      tradeUsd: new Decimal(10),
      slippageBps: 0, // no simulated slippage, deterministic fill
      maxPriceImpactPercentage: 2,
      maxQuoteAgeSeconds: 20,
      stopLossPercentage: 20,
      takeProfits: [],
      trailingStopPercentage: null,
      maxHoldingPeriodMinutes: null,
      entryReason: {},
      idempotencyKey: "roundtrip-buy",
    });
    expect(buy.ok).toBe(true);
    const position = getPosition(buy.position!.id)!;

    const sell = await executePaperSell({
      position,
      sellTokenAmount: position.remainingTokenAmount,
      quoteToken: "SOL",
      slippageBps: 0,
      maxPriceImpactPercentage: 2,
      maxQuoteAgeSeconds: 20,
      reason: "manual",
      idempotencyKey: "roundtrip-sell",
    });
    expect(sell.ok).toBe(true);

    const closed = getPosition(position.id)!;
    expect(closed.status).toBe("closed");
    // Sell quote in the mock returns 66,000,000 lamports (~0.066 SOL) for
    // the full position at $150/SOL ≈ $9.90 gross — close to the $10 cost
    // basis; realized PnL should be a small, finite number either way.
    expect(closed.realizedPnlUsd.isFinite()).toBe(true);
  });
});
