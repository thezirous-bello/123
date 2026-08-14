import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "./testUtils.js";
import { db, nowIso } from "../src/db/index.js";
import { isSameCoinAcrossExchanges, hasIdentityDataFor, resolveCoinId } from "../src/arb/identity.js";
import { checkMinMarketCap } from "../src/arb/marketCap.js";

function seedIdentity(exchange: string, symbol: string, ids: { coingeckoId?: string | null; cmcId?: string | null }) {
  db.prepare(
    `INSERT INTO coin_identity_cache (exchange_id, symbol, coingecko_id, cmc_id, checked_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(exchange, symbol, ids.coingeckoId ?? null, ids.cmcId ?? null, nowIso());
}

function seedMarketCap(source: "coingecko" | "cmc", coinId: string, marketCapUsd: number | null) {
  db.prepare(
    `INSERT INTO coin_market_cap_cache (source, coin_id, market_cap_usd, checked_at) VALUES (?, ?, ?, ?)`,
  ).run(source, coinId, marketCapUsd === null ? null : String(marketCapUsd), nowIso());
}

beforeEach(() => {
  resetDb();
});

describe("isSameCoinAcrossExchanges", () => {
  it("is unverifiable when neither exchange has identity data cached yet", () => {
    expect(isSameCoinAcrossExchanges("BTC", "binance", "okx")).toBe("unverifiable");
  });

  it("matches via CoinGecko ids when both sides have one and they're equal", () => {
    seedIdentity("binance", "BTC", { coingeckoId: "bitcoin" });
    seedIdentity("okx", "BTC", { coingeckoId: "bitcoin" });
    expect(isSameCoinAcrossExchanges("BTC", "binance", "okx")).toBe("match");
  });

  it("mismatches via CoinGecko ids when both sides have one but they differ (ticker collision)", () => {
    seedIdentity("binance", "PEPE", { coingeckoId: "pepe" });
    seedIdentity("kucoin", "PEPE", { coingeckoId: "pepe-2-0" }); // a different, unrelated PEPE-ticker coin
    expect(isSameCoinAcrossExchanges("PEPE", "binance", "kucoin")).toBe("mismatch");
  });

  it("falls back to comparing CMC ids when CoinGecko data is missing on at least one side", () => {
    seedIdentity("binance", "SOL", { coingeckoId: "solana" }); // CoinGecko covered this exchange
    seedIdentity("kraken", "SOL", { cmcId: "5426" }); // CoinGecko was rate-limited for kraken this cycle, CMC filled in
    // Neither side has a comparable pair (binance has no cmc_id, kraken has no coingecko_id) -> unverifiable, never guessed.
    expect(isSameCoinAcrossExchanges("SOL", "binance", "kraken")).toBe("unverifiable");
  });

  it("matches via CMC ids when both sides only have CMC data", () => {
    seedIdentity("kraken", "SOL", { cmcId: "5426" });
    seedIdentity("bitstamp", "SOL", { cmcId: "5426" });
    expect(isSameCoinAcrossExchanges("SOL", "kraken", "bitstamp")).toBe("match");
  });

  it("never cross-compares a CoinGecko id against a CMC id even if the underlying coin is the same", () => {
    // Both rows really are Solana, but one only resolved via CoinGecko and
    // the other only via CMC — the two id spaces are numerically unrelated,
    // so this must stay unverifiable rather than risk a false match.
    seedIdentity("binance", "SOL", { coingeckoId: "solana" });
    seedIdentity("kraken", "SOL", { cmcId: "5426" });
    expect(isSameCoinAcrossExchanges("SOL", "binance", "kraken")).toBe("unverifiable");
  });

  it("prefers CoinGecko ids over CMC ids when a row has both", () => {
    seedIdentity("binance", "SOL", { coingeckoId: "solana", cmcId: "5426" });
    seedIdentity("okx", "SOL", { coingeckoId: "solana", cmcId: "WRONG_CMC_ID" });
    // CoinGecko ids agree even though the (irrelevant, wrong on purpose) CMC ids don't.
    expect(isSameCoinAcrossExchanges("SOL", "binance", "okx")).toBe("match");
  });
});

describe("hasIdentityDataFor", () => {
  it("is false with no cached rows for the exchange", () => {
    expect(hasIdentityDataFor("binance")).toBe(false);
  });

  it("is true once at least one row has either id populated", () => {
    seedIdentity("binance", "BTC", { coingeckoId: "bitcoin" });
    expect(hasIdentityDataFor("binance")).toBe(true);
  });
});

describe("resolveCoinId", () => {
  it("returns null when nothing is cached", () => {
    expect(resolveCoinId("binance", "BTC")).toBeNull();
  });

  it("prefers the CoinGecko id when both are present", () => {
    seedIdentity("binance", "BTC", { coingeckoId: "bitcoin", cmcId: "1" });
    expect(resolveCoinId("binance", "BTC")).toEqual({ source: "coingecko", id: "bitcoin" });
  });

  it("falls back to the CMC id when only that's present", () => {
    seedIdentity("kraken", "SOL", { cmcId: "5426" });
    expect(resolveCoinId("kraken", "SOL")).toEqual({ source: "cmc", id: "5426" });
  });
});

describe("checkMinMarketCap", () => {
  it("is unverifiable when neither exchange has identity data cached", () => {
    expect(checkMinMarketCap("BTC", "binance", "okx", 50_000_000)).toBe("unverifiable");
  });

  it("is unverifiable when identity is cached but no market-cap data has been fetched yet", () => {
    seedIdentity("binance", "BTC", { coingeckoId: "bitcoin" });
    expect(checkMinMarketCap("BTC", "binance", "okx", 50_000_000)).toBe("unverifiable");
  });

  it("is sufficient when the cached market cap clears the minimum", () => {
    seedIdentity("binance", "BTC", { coingeckoId: "bitcoin" });
    seedMarketCap("coingecko", "bitcoin", 900_000_000_000);
    expect(checkMinMarketCap("BTC", "binance", "okx", 50_000_000)).toBe("sufficient");
  });

  it("is insufficient when the cached market cap is below the minimum", () => {
    seedIdentity("binance", "SOME", { coingeckoId: "some-microcap" });
    seedMarketCap("coingecko", "some-microcap", 2_000_000);
    expect(checkMinMarketCap("SOME", "binance", "okx", 50_000_000)).toBe("insufficient");
  });

  it("resolves via the sell exchange when the buy exchange has no identity data", () => {
    seedIdentity("okx", "BTC", { coingeckoId: "bitcoin" });
    seedMarketCap("coingecko", "bitcoin", 900_000_000_000);
    expect(checkMinMarketCap("BTC", "binance", "okx", 50_000_000)).toBe("sufficient");
  });

  it("works via a CMC-only identity resolution too", () => {
    seedIdentity("kraken", "SOL", { cmcId: "5426" });
    seedMarketCap("cmc", "5426", 80_000_000_000);
    expect(checkMinMarketCap("SOL", "kraken", "bitstamp", 50_000_000)).toBe("sufficient");
  });
});
