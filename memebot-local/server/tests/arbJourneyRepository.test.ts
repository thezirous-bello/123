import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "./testUtils.js";
import { Decimal } from "../src/lib/decimal.js";
import {
  beginReturnHome,
  botControlledCapitalByExchange,
  chainNextLeg,
  closeJourneyAborted,
  closeJourneyReturnedHome,
  createJourney,
  getArbPaperAccount,
  getJourney,
  listJourneys,
  listOpenJourneys,
  markArrivedAndSold,
  resetArbPaperAccount,
} from "../src/arb/repository.js";

describe("arb journey state machine (repository)", () => {
  beforeEach(() => {
    resetDb();
    resetArbPaperAccount(new Decimal(1000));
  });

  it("opens a journey in_transit on the origin exchange, holding the asset", () => {
    const journey = createJourney({
      symbol: "BTC",
      originExchange: "binance",
      legDestinationExchange: "okx",
      principalUsd: new Decimal(100),
      assetQty: new Decimal(0.002),
      arrivesAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(journey.status).toBe("in_transit");
    expect(journey.originExchange).toBe("binance");
    expect(journey.currentExchange).toBe("binance");
    expect(journey.legDestinationExchange).toBe("okx");
    expect(journey.legCount).toBe(1);
    expect(journey.assetQty).not.toBeNull();
    expect(journey.usdAmount).toBeNull();
    expect(listOpenJourneys().map((j) => j.id)).toContain(journey.id);
  });

  it("markArrivedAndSold moves current_exchange to the destination and opens the reverse-check window", () => {
    const journey = createJourney({
      symbol: "BTC",
      originExchange: "binance",
      legDestinationExchange: "okx",
      principalUsd: new Decimal(100),
      assetQty: new Decimal(0.002),
      arrivesAt: new Date().toISOString(),
    });
    const deadline = new Date(Date.now() + 30_000).toISOString();
    const updated = markArrivedAndSold(journey.id, { usdAmount: new Decimal(102), reverseCheckDeadline: deadline });
    expect(updated.status).toBe("checking_reverse");
    expect(updated.currentExchange).toBe("okx");
    expect(updated.legDestinationExchange).toBeNull();
    expect(updated.assetQty).toBeNull();
    expect(updated.usdAmount?.toFixed()).toBe("102");
    expect(updated.reverseCheckDeadline).toBe(deadline);
  });

  it("chainNextLeg increments leg count and goes back to in_transit toward the new destination", () => {
    const journey = createJourney({
      symbol: "BTC",
      originExchange: "binance",
      legDestinationExchange: "okx",
      principalUsd: new Decimal(100),
      assetQty: new Decimal(0.002),
      arrivesAt: new Date().toISOString(),
    });
    markArrivedAndSold(journey.id, { usdAmount: new Decimal(102), reverseCheckDeadline: new Date().toISOString() });
    const arrivesAt = new Date(Date.now() + 60_000).toISOString();
    const chained = chainNextLeg(journey.id, { legDestinationExchange: "kucoin", assetQty: new Decimal(0.0019), arrivesAt });
    expect(chained.status).toBe("in_transit");
    expect(chained.currentExchange).toBe("okx");
    expect(chained.legDestinationExchange).toBe("kucoin");
    expect(chained.legCount).toBe(2);
    expect(chained.usdAmount).toBeNull();
  });

  it("beginReturnHome routes the next leg back to origin_exchange", () => {
    const journey = createJourney({
      symbol: "BTC",
      originExchange: "binance",
      legDestinationExchange: "okx",
      principalUsd: new Decimal(100),
      assetQty: new Decimal(0.002),
      arrivesAt: new Date().toISOString(),
    });
    markArrivedAndSold(journey.id, { usdAmount: new Decimal(102), reverseCheckDeadline: new Date().toISOString() });
    const returning = beginReturnHome(journey.id, { arrivesAt: new Date(Date.now() + 30_000).toISOString() });
    expect(returning.status).toBe("returning_home");
    expect(returning.legDestinationExchange).toBe("binance");
  });

  it("closeJourneyReturnedHome closes the journey, records profit, and credits the shared paper cash pool", () => {
    const startingCash = getArbPaperAccount().cashBalanceUsd;
    const journey = createJourney({
      symbol: "BTC",
      originExchange: "binance",
      legDestinationExchange: "okx",
      principalUsd: new Decimal(100),
      assetQty: new Decimal(0.002),
      arrivesAt: new Date().toISOString(),
    });
    markArrivedAndSold(journey.id, { usdAmount: new Decimal(102), reverseCheckDeadline: new Date().toISOString() });
    beginReturnHome(journey.id, { arrivesAt: new Date().toISOString() });
    const closed = closeJourneyReturnedHome(journey.id, new Decimal(101));
    expect(closed.status).toBe("closed");
    expect(closed.closeReason).toBe("returned_home");
    expect(closed.currentExchange).toBe("binance");
    expect(closed.realizedProfitUsd.toFixed()).toBe("1"); // 101 - 100 principal
    expect(getArbPaperAccount().cashBalanceUsd.toFixed()).toBe(startingCash.plus(101).toFixed());
    expect(listOpenJourneys().map((j) => j.id)).not.toContain(journey.id);
  });

  it("closeJourneyAborted credits back exactly the recovered amount (never fabricates profit)", () => {
    const startingCash = getArbPaperAccount().cashBalanceUsd;
    const journey = createJourney({
      symbol: "BTC",
      originExchange: "binance",
      legDestinationExchange: "okx",
      principalUsd: new Decimal(100),
      assetQty: new Decimal(0.002),
      arrivesAt: new Date().toISOString(),
    });
    const aborted = closeJourneyAborted(journey.id, new Decimal(100), "Manually aborted from dashboard.");
    expect(aborted.status).toBe("closed");
    expect(aborted.closeReason).toBe("Manually aborted from dashboard.");
    expect(aborted.realizedProfitUsd.toFixed()).toBe("0");
    expect(getArbPaperAccount().cashBalanceUsd.toFixed()).toBe(startingCash.plus(100).toFixed());
  });

  it("botControlledCapitalByExchange sums open journeys by current exchange, using cash when landed and principal while in transit", () => {
    const a = createJourney({
      symbol: "BTC",
      originExchange: "binance",
      legDestinationExchange: "okx",
      principalUsd: new Decimal(100),
      assetQty: new Decimal(0.002),
      arrivesAt: new Date().toISOString(),
    });
    const b = createJourney({
      symbol: "ETH",
      originExchange: "binance",
      legDestinationExchange: "kucoin",
      principalUsd: new Decimal(50),
      assetQty: new Decimal(0.02),
      arrivesAt: new Date().toISOString(),
    });
    markArrivedAndSold(b.id, { usdAmount: new Decimal(52), reverseCheckDeadline: new Date().toISOString() });

    const committed = botControlledCapitalByExchange();
    expect(committed.binance?.toFixed()).toBe("100"); // journey a still in transit, held at origin
    expect(committed.kucoin?.toFixed()).toBe("52"); // journey b landed and sold on kucoin

    const closedIds = listJourneys(10).map((j) => j.id);
    expect(closedIds).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(getJourney(a.id)?.status).toBe("in_transit");
  });
});
