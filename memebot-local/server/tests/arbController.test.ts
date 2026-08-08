import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "./testUtils.js";
import { _internalArbTickForTests, stopArbBot } from "../src/arb/controller.js";
import { updateArbStrategyConfig } from "../src/arb/configStore.js";
import { setArbRunning } from "../src/arb/state.js";
import { listOpportunities } from "../src/arb/repository.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function mockBinanceAndOkx(binanceQuote: { bid: number; ask: number }, okxQuote: { bid: number; ask: number }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(typeof input === "string" ? input : (input as URL).toString());
    if (url.hostname.includes("binance")) {
      return jsonResponse([{ symbol: "BTCUSDT", bidPrice: String(binanceQuote.bid), askPrice: String(binanceQuote.ask) }]);
    }
    if (url.hostname.includes("okx")) {
      return jsonResponse({ code: "0", data: [{ instId: "BTC-USDT", bidPx: String(okxQuote.bid), askPx: String(okxQuote.ask) }] });
    }
    return jsonResponse({ list: [] });
  });
}

describe("arb controller — only logs genuinely crossed markets", () => {
  beforeEach(() => {
    resetDb();
    updateArbStrategyConfig({
      enabled: true,
      exchanges: ["binance", "okx"],
      symbols: ["BTC"],
      scanIntervalSeconds: 9999, // keep the test from scheduling a real next tick
      takerFeePctOverride: 0,
      safetyBufferPct: 0,
      minNetSpreadPct: 0.01,
    });
    setArbRunning(true);
  });

  afterEach(() => {
    stopArbBot(); // clears the scheduled next tick from runTick's finally block
    vi.restoreAllMocks();
  });

  it("does not log anything when the best ask already exceeds the best bid (the normal, non-crossed state)", async () => {
    // okx's best ask (64905) beats binance's best bid (64900) for buying,
    // and binance's own ask (64910) beats okx's bid (64895) for selling —
    // no exchange pair has bid > ask against the other. This is what a
    // healthy, non-arbitrageable market looks like almost all the time.
    const fetchSpy = mockBinanceAndOkx({ bid: 64900, ask: 64910 }, { bid: 64895, ask: 64905 });
    await _internalArbTickForTests();
    fetchSpy.mockRestore();

    expect(listOpportunities()).toEqual([]);
  });

  it("logs an opportunity when one exchange's bid genuinely beats another's ask", async () => {
    // okx's bid (65200) is well above binance's ask (64910) — a real
    // crossed-market opportunity: buy on binance, sell on okx.
    const fetchSpy = mockBinanceAndOkx({ bid: 64900, ask: 64910 }, { bid: 65200, ask: 65210 });
    await _internalArbTickForTests();
    fetchSpy.mockRestore();

    const opportunities = listOpportunities();
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]!.symbol).toBe("BTC");
    expect(opportunities[0]!.buyExchange).toBe("binance");
    expect(opportunities[0]!.buyPrice.toNumber()).toBe(64910);
    expect(opportunities[0]!.sellExchange).toBe("okx");
    expect(opportunities[0]!.sellPrice.toNumber()).toBe(65200);
    expect(opportunities[0]!.acted).toBe(true); // 0 fees configured, so this clears minNetSpreadPct
  });
});
