import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scanSymbolStage1 } from "../src/futures/signalEngine.js";
import { FuturesStrategyConfigSchema } from "../src/futures/schema.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify({ retCode: 0, retMsg: "OK", result: body }), { status: 200, headers: { "content-type": "application/json" } });
}

function candleRow(startTime: number, open: number, high: number, low: number, close: number, volume: number): string[] {
  return [String(startTime), String(open), String(high), String(low), String(close), String(volume), String(volume * close)];
}

/** Rise, then a real pullback, then a gentle recovery into the last candle —
 * lands RSI mid-band and StochRSI K>=D without a fresh crossover, a volume
 * spike, or price sitting at a pullback level on the exact last candle. This
 * is the shape that used to be rejected outright (see the removed hard
 * gates in evaluateLongSetup) and now should qualify on RSI + StochRSI
 * direction alone. */
function buildLooseLongCandles(n: number, startPrice: number): string[][] {
  const rows: string[][] = [];
  let price = startPrice;
  for (let i = 0; i < n; i++) {
    let pct: number;
    if (i < n - 25) pct = 0.006;
    else if (i < n - 6) pct = -0.01;
    else pct = 0.003;
    price = price * (1 + pct);
    const open = price / (1 + pct);
    const close = price;
    const high = Math.max(open, close) * 1.001;
    const low = Math.min(open, close) * 0.999;
    const volume = 1000 + (i % 5) * 50;
    rows.push(candleRow(1_700_000_000_000 + i * 900_000, open, high, low, close, volume));
  }
  return rows.reverse(); // Bybit returns newest-first
}

describe("scanSymbolStage1 — loosened entry gates", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const entryCandles = buildLooseLongCandles(70, 100);
    const trendCandles = buildLooseLongCandles(70, 90);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(typeof input === "string" ? input : (input as URL).toString());
      if (url.pathname === "/v5/market/kline") {
        const interval = url.searchParams.get("interval");
        return jsonResponse({ category: "linear", symbol: "TESTUSDT", list: interval === "240" ? trendCandles : entryCandles });
      }
      if (url.pathname === "/v5/market/tickers") {
        return jsonResponse({
          category: "linear",
          list: [
            {
              symbol: "TESTUSDT",
              lastPrice: "138",
              volume24h: "5000000",
              turnover24h: "5000000000",
              price24hPcnt: "0.09",
              openInterest: "1000000",
              fundingRate: "0.0001",
              bid1Price: "137.9",
              bid1Size: "100",
              ask1Price: "138.05",
              ask1Size: "100",
            },
          ],
        });
      }
      return jsonResponse({ list: [] });
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("qualifies a setup with no pullback, no fresh crossover, and no volume spike — RSI band + StochRSI direction is enough", async () => {
    const config = FuturesStrategyConfigSchema.parse({});
    const result = await scanSymbolStage1("TESTUSDT", config, "testnet");

    expect("reason" in result).toBe(false);
    if ("reason" in result) throw new Error(result.reason); // narrow for TS below
    expect(result.side).toBe("long");
    expect(result.details.pulledBack).toBe(false);
    expect(result.details.freshCrossover).toBe(false);
    expect(result.details.volumeSpike).toBe(false);
  });

  it("still rejects when RSI is out of band, regardless of everything else", async () => {
    const config = FuturesStrategyConfigSchema.parse({ rsiLongMin: 90, rsiLongMax: 95, rsiShortMin: 90, rsiShortMax: 95 });
    const result = await scanSymbolStage1("TESTUSDT", config, "testnet");
    expect("reason" in result).toBe(true);
  });
});
