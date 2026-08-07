import { afterEach, describe, expect, it, vi } from "vitest";
import { getInstrumentInfo } from "../src/bybit/marketData.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify({ retCode: 0, retMsg: "OK", result: body, time: Date.now() }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function instrumentsInfoRow(lotSizeFilter: Record<string, string>) {
  return {
    category: "linear",
    list: [
      {
        symbol: "ZKUSDT",
        status: "Trading",
        lotSizeFilter,
        priceFilter: { tickSize: "0.0001" },
        leverageFilter: { minLeverage: "1", maxLeverage: "50" },
      },
    ],
  };
}

describe("getInstrumentInfo — market-order qty cap", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the smaller of maxOrderQty (limit) and maxMktOrderQty (market) as the effective cap", async () => {
    // Real-world shape: maxOrderQty (limit orders) is often far larger than
    // maxMktOrderQty (market orders, slippage-protected) — this app only
    // ever submits Market orders, so the market cap must win.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(instrumentsInfoRow({ qtyStep: "1", minOrderQty: "1", maxOrderQty: "986211890000000", maxMktOrderQty: "220000000000000" })),
    );
    const info = await getInstrumentInfo("ZKUSDT", "testnet", "linear");
    expect(info?.maxOrderQty).toBe(220000000000000);
  });

  it("falls back to maxOrderQty alone when maxMktOrderQty is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(instrumentsInfoRow({ qtyStep: "1", minOrderQty: "1", maxOrderQty: "500000" })));
    const info = await getInstrumentInfo("ZKUSDT", "testnet", "linear");
    expect(info?.maxOrderQty).toBe(500000);
  });

  it("falls back to Infinity (no clamp) when neither cap is present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(instrumentsInfoRow({ qtyStep: "1", minOrderQty: "1" })));
    const info = await getInstrumentInfo("ZKUSDT", "testnet", "linear");
    expect(info?.maxOrderQty).toBe(Infinity);
  });
});
