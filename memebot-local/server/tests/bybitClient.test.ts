import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.BYBIT_TESTNET_API_KEY = "test-key";
process.env.BYBIT_TESTNET_API_SECRET = "test-secret";

const { bybitGetPrivate, BybitApiError } = await import("../src/bybit/client.js");
const { setLeverage } = await import("../src/bybit/trading.js");

function envelope(retCode: number, retMsg: string, result: unknown, timeMs: number): Response {
  return new Response(JSON.stringify({ retCode, retMsg, result, time: timeMs }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("bybit client — clock drift resilience", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("retries once on retCode 10002 (timestamp/recv_window) and succeeds using the corrected server-time offset", async () => {
    // Server time is 10 seconds ahead of whatever our local clock (and
    // therefore the first request's timestamp) reports — simulating a
    // container/VM with clock drift, exactly like the user's reported error.
    const serverTimeMs = Date.now() + 10_000;
    let callCount = 0;
    let firstAttemptTimestamp: string | undefined;
    let secondAttemptTimestamp: string | undefined;

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      callCount++;
      const headers = init?.headers as Record<string, string>;
      if (callCount === 1) {
        firstAttemptTimestamp = headers["X-BAPI-TIMESTAMP"];
        return envelope(10002, "invalid request, please check your server timestamp or recv_window param", null, serverTimeMs);
      }
      secondAttemptTimestamp = headers["X-BAPI-TIMESTAMP"];
      return envelope(0, "OK", { ok: true }, serverTimeMs + 50);
    });

    const result = await bybitGetPrivate("testnet", "/v5/account/wallet-balance", { accountType: "UNIFIED" });

    expect(result).toEqual({ ok: true });
    expect(callCount).toBe(2);
    // The retried request's timestamp should be corrected toward server
    // time — meaningfully later than the first, rejected attempt's.
    expect(Number(secondAttemptTimestamp)).toBeGreaterThan(Number(firstAttemptTimestamp) + 5000);
  });

  it("does not loop forever if the retry also comes back as a timestamp error", async () => {
    let callCount = 0;
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      return envelope(10002, "invalid request, please check your server timestamp or recv_window param", null, Date.now());
    });

    await expect(bybitGetPrivate("testnet", "/v5/account/wallet-balance", { accountType: "UNIFIED" })).rejects.toThrow(BybitApiError);
    expect(callCount).toBe(2); // one real attempt + exactly one retry, never more
  });

  it("does not retry a non-timestamp error", async () => {
    let callCount = 0;
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      return envelope(10004, "signature error", null, Date.now());
    });

    await expect(bybitGetPrivate("testnet", "/v5/account/wallet-balance", { accountType: "UNIFIED" })).rejects.toThrow(BybitApiError);
    expect(callCount).toBe(1);
  });
});

describe("setLeverage — 'leverage not modified' is not a real failure", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("swallows retCode 110043 instead of throwing, since the leverage is already correct", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(envelope(110043, "leverage not modified", null, Date.now()));
    await expect(setLeverage("testnet", "COTIUSDT", 22)).resolves.toBeUndefined();
  });

  it("still throws on a genuine set-leverage failure", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(envelope(10001, "params error", null, Date.now()));
    await expect(setLeverage("testnet", "COTIUSDT", 22)).rejects.toThrow(BybitApiError);
  });
});
