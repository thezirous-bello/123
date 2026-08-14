import { describe, expect, it } from "vitest";
import { Decimal } from "../src/lib/decimal.js";
import {
  computeBuyFill,
  computeReturnHomeAmount,
  computeSellProceeds,
  evaluateEntryGates,
  hasArrived,
  shouldReturnHome,
  type EntryGateInput,
} from "../src/arb/journeyEngine.js";

function baseInput(overrides: Partial<EntryGateInput> = {}): EntryGateInput {
  return {
    identity: "match",
    depositGate: "enabled",
    marketCap: "sufficient",
    netSpreadPct: 1.5,
    minNetSpreadPct: 1,
    minMarketCapUsd: 50_000_000,
    requireCoinIdentityVerified: true,
    requireDepositVerified: true,
    requireMinMarketCap: true,
    ...overrides,
  };
}

describe("evaluateEntryGates", () => {
  it("passes when identity matches, deposits are enabled, and spread clears the minimum", () => {
    const result = evaluateEntryGates(baseInput());
    expect(result.passed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("fails on a coin-identity mismatch (same ticker symbol, different underlying coin)", () => {
    const result = evaluateEntryGates(baseInput({ identity: "mismatch" }));
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/different underlying coin/i);
  });

  it("fails when coin identity is unverifiable — never assumes a match", () => {
    const result = evaluateEntryGates(baseInput({ identity: "unverifiable" }));
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/could not verify/i);
  });

  it("skips the identity check entirely when requireCoinIdentityVerified is false", () => {
    const result = evaluateEntryGates(baseInput({ identity: "mismatch", requireCoinIdentityVerified: false }));
    expect(result.passed).toBe(true);
  });

  it("fails when deposits are disabled on the sell exchange", () => {
    const result = evaluateEntryGates(baseInput({ depositGate: "disabled" }));
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/deposits are currently disabled/i);
  });

  it("fails when deposit status is unverifiable — never assumes deposits are open", () => {
    const result = evaluateEntryGates(baseInput({ depositGate: "unverifiable" }));
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/could not verify deposit status/i);
  });

  it("skips the deposit check entirely when requireDepositVerified is false", () => {
    const result = evaluateEntryGates(baseInput({ depositGate: "disabled", requireDepositVerified: false }));
    expect(result.passed).toBe(true);
  });

  it("fails when market cap is below the configured minimum", () => {
    const result = evaluateEntryGates(baseInput({ marketCap: "insufficient" }));
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/below the configured \$50,000,000 minimum/i);
  });

  it("fails when market cap is unverifiable — never assumes it's large enough", () => {
    const result = evaluateEntryGates(baseInput({ marketCap: "unverifiable" }));
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/could not verify this coin's market cap/i);
  });

  it("skips the market-cap check entirely when requireMinMarketCap is false", () => {
    const result = evaluateEntryGates(baseInput({ marketCap: "insufficient", requireMinMarketCap: false }));
    expect(result.passed).toBe(true);
  });

  it("fails when net spread is below the configured minimum, even with clean identity/deposit/market-cap gates", () => {
    const result = evaluateEntryGates(baseInput({ netSpreadPct: 0.4, minNetSpreadPct: 1 }));
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/below the 1% minimum/i);
  });

  it("checks identity before deposit before market cap before spread (priority order)", () => {
    // Identity, deposit, market cap, and spread are all bad here; the identity failure must win.
    const result = evaluateEntryGates(baseInput({ identity: "mismatch", depositGate: "disabled", marketCap: "insufficient", netSpreadPct: 0.1 }));
    expect(result.reason).toMatch(/different underlying coin/i);
  });

  it("checks deposit before market cap when identity passes", () => {
    const result = evaluateEntryGates(baseInput({ depositGate: "disabled", marketCap: "insufficient" }));
    expect(result.reason).toMatch(/deposits are currently disabled/i);
  });
});

describe("shouldReturnHome", () => {
  it("is false before the reverse-check deadline", () => {
    expect(shouldReturnHome(1000, 2000)).toBe(false);
  });

  it("is true at or after the reverse-check deadline", () => {
    expect(shouldReturnHome(2000, 2000)).toBe(true);
    expect(shouldReturnHome(3000, 2000)).toBe(true);
  });
});

describe("hasArrived", () => {
  it("is false before the simulated arrival time", () => {
    expect(hasArrived(1000, 2000)).toBe(false);
  });

  it("is true at or after the simulated arrival time", () => {
    expect(hasArrived(2000, 2000)).toBe(true);
    expect(hasArrived(2500, 2000)).toBe(true);
  });
});

describe("computeBuyFill", () => {
  it("spends the full position size and takes the taker fee out of the asset quantity received", () => {
    const qty = computeBuyFill(new Decimal(1000), 100, 0.1); // $1000 at $100/coin, 0.1% fee
    // gross qty = 10, minus 0.1% fee -> 9.99
    expect(qty.toNumber()).toBeCloseTo(9.99, 6);
  });

  it("charges zero fee correctly", () => {
    const qty = computeBuyFill(new Decimal(500), 50, 0);
    expect(qty.toNumber()).toBeCloseTo(10, 6);
  });
});

describe("computeSellProceeds", () => {
  it("sells the asset, deducts the taker fee, and subtracts a flat withdrawal fee", () => {
    const proceeds = computeSellProceeds(new Decimal(10), 100, 0.1, 2); // 10 coins @ $100, 0.1% fee, $2 withdrawal fee
    // gross = 1000 * 0.999 = 999, minus 2 = 997
    expect(proceeds.toNumber()).toBeCloseTo(997, 6);
  });

  it("never goes negative even when the withdrawal fee exceeds proceeds", () => {
    const proceeds = computeSellProceeds(new Decimal(0.001), 1, 0.1, 50);
    expect(proceeds.toNumber()).toBe(0);
  });
});

describe("computeReturnHomeAmount", () => {
  it("subtracts the withdrawal fee from the returning USD amount", () => {
    const amount = computeReturnHomeAmount(new Decimal(500), 3);
    expect(amount.toNumber()).toBeCloseTo(497, 6);
  });

  it("never goes negative", () => {
    const amount = computeReturnHomeAmount(new Decimal(1), 5);
    expect(amount.toNumber()).toBe(0);
  });
});
