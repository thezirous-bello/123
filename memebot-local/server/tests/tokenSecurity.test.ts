import { describe, expect, it } from "vitest";
import { runTokenSecurityAnalysis, type SecurityCheckInput } from "../src/security/tokenSecurity.js";
import type { TokenSnapshot } from "../src/market/types.js";

const mint = "MintAddress111111111111111111111111111111";

function baseSnapshot(overrides: Partial<TokenSnapshot> = {}): TokenSnapshot {
  return {
    mint,
    symbol: "TEST",
    name: "Test Token",
    priceUsd: 0.001,
    liquidityUsd: 150_000,
    marketCapUsd: 500_000,
    fdvUsd: 500_000,
    volume5mUsd: 60_000,
    volume1hUsd: 200_000,
    priceChange5mPct: 8,
    priceChange1hPct: 20,
    buys5m: 40,
    sells5m: 10,
    pairCreatedAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
    dexId: "raydium",
    pairAddress: "Pair11111111111111111111111111111111111111",
    quoteSymbol: "SOL",
    source: "dexscreener",
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

function baseInput(overrides: Partial<SecurityCheckInput> = {}): SecurityCheckInput {
  return {
    mint,
    snapshot: baseSnapshot(),
    onchain: { mint, mintAuthority: null, freezeAuthority: null, decimals: 6, supply: "1000000000000" },
    holders: { top10Percentage: 15, largestHolders: [] },
    sellRoute: { exists: true, priceImpactPct: 1.2 },
    ...overrides,
  };
}

describe("runTokenSecurityAnalysis", () => {
  it("never uses the word 'safe' in its summary", () => {
    const report = runTokenSecurityAnalysis(baseInput());
    expect(report.summary.toLowerCase()).not.toContain("safe");
  });

  it("reports low risk with no critical/high findings when everything checks out", () => {
    const report = runTokenSecurityAnalysis(baseInput());
    expect(report.riskLevel).toBe("low");
    expect(report.summary).toBe("No critical issue detected by the available checks.");
  });

  it("forces critical risk when mint authority is still active", () => {
    const report = runTokenSecurityAnalysis(
      baseInput({ onchain: { mint, mintAuthority: "SomeAuthority11111111111111111111111111111", freezeAuthority: null, decimals: 6, supply: "1" } }),
    );
    expect(report.riskLevel).toBe("critical");
    expect(report.mintAuthorityDisabled).toBe(false);
  });

  it("forces critical risk when no sell route exists", () => {
    const report = runTokenSecurityAnalysis(baseInput({ sellRoute: { exists: false, priceImpactPct: null } }));
    expect(report.riskLevel).toBe("critical");
    expect(report.sellSimulationOk).toBe(false);
  });

  it("treats missing on-chain data as an unresolved-identity critical, not a silent pass", () => {
    const report = runTokenSecurityAnalysis(baseInput({ onchain: null, snapshot: null }));
    expect(report.riskLevel).toBe("critical");
    expect(report.missingChecks).toContain("mint_authority");
  });

  it("flags high holder concentration without necessarily blocking outright", () => {
    const report = runTokenSecurityAnalysis(baseInput({ holders: { top10Percentage: 60, largestHolders: [] } }));
    expect(report.findings.some((f) => f.check === "holder_concentration" && f.status === "fail")).toBe(true);
  });

  it("records missing checks distinctly from failed checks", () => {
    const report = runTokenSecurityAnalysis(baseInput({ holders: null }));
    expect(report.missingChecks).toContain("holder_concentration");
    expect(report.confidence).not.toBe("high");
  });
});
