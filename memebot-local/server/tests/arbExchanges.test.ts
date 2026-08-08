import { afterEach, describe, expect, it, vi } from "vitest";
import { binanceAdapter } from "../src/arb/exchanges/binance.js";
import { okxAdapter } from "../src/arb/exchanges/okx.js";
import { kucoinAdapter } from "../src/arb/exchanges/kucoin.js";
import { gateioAdapter } from "../src/arb/exchanges/gateio.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("exchange adapters — normalize to base-symbol bid/ask", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("binance: parses bookTicker and keeps only requested symbols, stripping the USDT suffix", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        { symbol: "BTCUSDT", bidPrice: "64900.1", askPrice: "64910.2" },
        { symbol: "ETHUSDT", bidPrice: "3400", askPrice: "3401" },
        { symbol: "SHIBUSDT", bidPrice: "0.00001", askPrice: "0.000011" }, // not requested
      ]),
    );
    const result = await binanceAdapter.fetchTickers(["BTC", "ETH"]);
    expect(result).not.toBeNull();
    expect(result!.get("BTC")).toEqual({ bid: 64900.1, ask: 64910.2 });
    expect(result!.get("ETH")).toEqual({ bid: 3400, ask: 3401 });
    expect(result!.has("SHIB")).toBe(false);
  });

  it("binance: returns null on a failed request without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));
    const result = await binanceAdapter.fetchTickers(["BTC"]);
    expect(result).toBeNull();
  });

  it("okx: parses instId 'BASE-QUOTE' format", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ code: "0", data: [{ instId: "BTC-USDT", bidPx: "64950", askPx: "64960" }] }),
    );
    const result = await okxAdapter.fetchTickers(["BTC"]);
    expect(result!.get("BTC")).toEqual({ bid: 64950, ask: 64960 });
  });

  it("kucoin: maps 'buy' to bid and 'sell' to ask", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ code: "200000", data: { ticker: [{ symbol: "BTC-USDT", buy: "64845", sell: "64850" }] } }),
    );
    const result = await kucoinAdapter.fetchTickers(["BTC"]);
    expect(result!.get("BTC")).toEqual({ bid: 64845, ask: 64850 });
  });

  it("gate.io: maps highest_bid/lowest_ask from underscore pair format", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([{ currency_pair: "BTC_USDT", highest_bid: "64830", lowest_ask: "64840" }]));
    const result = await gateioAdapter.fetchTickers(["BTC"]);
    expect(result!.get("BTC")).toEqual({ bid: 64830, ask: 64840 });
  });
});
