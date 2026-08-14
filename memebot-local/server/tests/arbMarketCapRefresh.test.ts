import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "./testUtils.js";
import { db, nowIso } from "../src/db/index.js";
import { refreshMarketCapIfStale, checkMinMarketCap, _resetMarketCapRefreshStateForTests } from "../src/arb/marketCap.js";
import { _resetCoinGeckoRateLimitStateForTests } from "../src/arb/coingeckoRateLimit.js";

function seedIdentity(exchange: string, symbol: string, coingeckoId: string) {
  db.prepare(`INSERT INTO coin_identity_cache (exchange_id, symbol, coingecko_id, cmc_id, checked_at) VALUES (?, ?, ?, NULL, ?)`).run(
    exchange,
    symbol,
    coingeckoId,
    nowIso(),
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  resetDb();
  _resetMarketCapRefreshStateForTests();
  _resetCoinGeckoRateLimitStateForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("refreshMarketCapIfStale", () => {
  it("does nothing (and doesn't start its 6h cooldown) when no identity data exists yet", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await refreshMarketCapIfStale();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("regression: a coin whose identity resolves AFTER an earlier empty call still gets its market cap looked up promptly, not after a 6h wait", async () => {
    // This reproduces the real bug: on a cold start, refreshMarketCapIfStale
    // used to run once while coin_identity_cache was still empty (identity
    // refresh is rate-limit-paced and takes minutes), which used to "use up"
    // its 6h cooldown for nothing — leaving every coin's market cap
    // permanently "unverifiable" (and every trade blocked by the
    // requireMinMarketCap gate) until the next 6h window.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse([{ id: "bitcoin", market_cap: 900_000_000_000 }]));

    // Tick 1: identity refresh hasn't populated anything yet.
    await refreshMarketCapIfStale();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(checkMinMarketCap("BTC", "binance", "okx", 50_000_000)).toBe("unverifiable");

    // Tick 2 (moments later, nowhere near the 6h window): identity data for
    // BTC just landed. The fix must catch this up immediately rather than
    // waiting for the (never-started, because tick 1 was a no-op) 6h timer.
    seedIdentity("binance", "BTC", "bitcoin");
    await refreshMarketCapIfStale();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(checkMinMarketCap("BTC", "binance", "okx", 50_000_000)).toBe("sufficient");
  });

  it("does not re-fetch a coin id it has already covered, on a later call with no new ids", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse([{ id: "bitcoin", market_cap: 900_000_000_000 }]));
    seedIdentity("binance", "BTC", "bitcoin");

    await refreshMarketCapIfStale();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await refreshMarketCapIfStale();
    expect(fetchSpy).toHaveBeenCalledTimes(1); // no new ids, not due for a full refresh yet -> no-op
  });

  it("catches up a second coin's id that appears after the first refresh, without waiting for the full-refresh interval", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(typeof input === "string" ? input : (input as URL).toString());
      const ids = url.searchParams.get("ids") ?? "";
      if (ids.includes("bitcoin")) return jsonResponse([{ id: "bitcoin", market_cap: 900_000_000_000 }]);
      if (ids.includes("ethereum")) return jsonResponse([{ id: "ethereum", market_cap: 300_000_000_000 }]);
      return jsonResponse([]);
    });

    seedIdentity("binance", "BTC", "bitcoin");
    await refreshMarketCapIfStale();
    expect(checkMinMarketCap("BTC", "binance", "okx", 50_000_000)).toBe("sufficient");
    expect(checkMinMarketCap("ETH", "binance", "okx", 50_000_000)).toBe("unverifiable");

    // A second exchange's identity pagination finishes later, resolving ETH.
    // (Reset the shared CoinGecko pacer between calls — this test is about
    // the catch-up logic, not the real inter-request pacing, which would
    // otherwise add a genuine ~6.5s wait here.)
    _resetCoinGeckoRateLimitStateForTests();
    seedIdentity("okx", "ETH", "ethereum");
    await refreshMarketCapIfStale();
    expect(checkMinMarketCap("ETH", "binance", "okx", 50_000_000)).toBe("sufficient");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
